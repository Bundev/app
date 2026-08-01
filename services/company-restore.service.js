const bcrypt = require('bcrypt');
const db = require('../config/db');

const normalize = value => String(value ?? '').trim().toLocaleLowerCase();
const timeKey = value => {
    const date = value ? new Date(value) : null;
    return date && !Number.isNaN(date.getTime()) ? date.toISOString() : '';
};
const mapValue = value => value instanceof Date
    ? value
    : value && typeof value === 'object'
        ? JSON.stringify(value)
        : value;

function assertBackup(backup) {
    if (!backup || backup.format !== 'retailpro-company-backup' || backup.version !== 1) {
        const error = new Error('INVALID_BACKUP');
        error.code = 'INVALID_BACKUP';
        throw error;
    }

    if (!backup.data || typeof backup.data !== 'object' || Array.isArray(backup.data)) {
        const error = new Error('INVALID_BACKUP');
        error.code = 'INVALID_BACKUP';
        throw error;
    }

    const totalRows = Object.values(backup.data).reduce(
        (total, rows) => total + (Array.isArray(rows) ? rows.length : 0),
        0
    );

    if (totalRows > 250000) {
        const error = new Error('BACKUP_TOO_LARGE');
        error.code = 'BACKUP_TOO_LARGE';
        throw error;
    }
}

async function rows(connection, sql, params = []) {
    const [result] = await connection.execute(sql, params);
    return result;
}

async function insert(connection, table, source, allowed, overrides = {}) {
    const record = { ...source, ...overrides };
    const columns = allowed.filter(column => record[column] !== undefined);
    const values = columns.map(column => mapValue(record[column]));
    const marks = columns.map(() => '?').join(', ');
    const sql = `INSERT INTO \`${table}\` (${columns.map(c => `\`${c}\``).join(', ')}) VALUES (${marks})`;
    const [result] = await connection.execute(sql, values);
    return result.insertId;
}

function createReport() {
    return { inserted: {}, skipped: {}, warnings: [] };
}

function bump(bucket, table) {
    bucket[table] = (bucket[table] || 0) + 1;
}

async function restoreRoot({ connection, backupRows, currentRows, table, identity, allowed, overrides, report }) {
    const byIdentity = new Map(currentRows.map(row => [identity(row), row]).filter(([key]) => key));
    const idMap = new Map();

    for (const source of backupRows || []) {
        const key = identity(source);
        const existing = key ? byIdentity.get(key) : null;

        if (existing) {
            idMap.set(Number(source.id), Number(existing.id));
            bump(report.skipped, table);
            continue;
        }

        const preparedOverrides = typeof overrides === 'function' ? await overrides(source) : overrides;
        const newId = await insert(connection, table, source, allowed, preparedOverrides || {});
        idMap.set(Number(source.id), Number(newId));
        const created = { ...source, ...(preparedOverrides || {}), id: newId };
        if (key) byIdentity.set(key, created);
        bump(report.inserted, table);
    }

    return idMap;
}

async function restoreCompanyBackup(companyId, currentUserId, backup, options = {}) {
    assertBackup(backup);
    const connection = await db.getConnection();
    const report = createReport();
    const data = backup.data;

    try {
        await connection.beginTransaction();

        const company = await rows(connection, 'SELECT id FROM companies WHERE id = ? LIMIT 1', [companyId]);
        if (!company.length) throw Object.assign(new Error('COMPANY_NOT_FOUND'), { code: 'COMPANY_NOT_FOUND' });

        const categoryMap = await restoreRoot({
            connection, table: 'categories', backupRows: data.categories,
            currentRows: await rows(connection, 'SELECT * FROM categories WHERE company_id = ?', [companyId]),
            identity: row => normalize(row.name), allowed: ['company_id', 'name'],
            overrides: { company_id: companyId }, report
        });

        const storeMap = await restoreRoot({
            connection, table: 'stores', backupRows: data.stores,
            currentRows: await rows(connection, 'SELECT * FROM stores WHERE company_id = ?', [companyId]),
            identity: row => normalize(row.name),
            allowed: ['name', 'address', 'phone', 'created_at', 'status', 'owner_id', 'company_id'],
            overrides: { company_id: companyId, owner_id: currentUserId }, report
        });

        const customerMap = await restoreRoot({
            connection, table: 'customers', backupRows: data.customers,
            currentRows: await rows(connection, 'SELECT * FROM customers WHERE company_id = ?', [companyId]),
            identity: row => normalize(row.phone) || normalize(row.email) || normalize(row.name),
            allowed: ['company_id', 'name', 'phone', 'email', 'discount_percentage', 'comment', 'status', 'created_at', 'updated_at'],
            overrides: { company_id: companyId }, report
        });

        const supplierMap = await restoreRoot({
            connection, table: 'suppliers', backupRows: data.suppliers,
            currentRows: await rows(connection, 'SELECT * FROM suppliers WHERE company_id = ?', [companyId]),
            identity: row => normalize(row.email) || normalize(row.phone) || normalize(row.name),
            allowed: ['company_id', 'name', 'phone', 'email', 'address', 'archived', 'created_at'],
            overrides: { company_id: companyId }, report
        });

        const disabledPassword = await bcrypt.hash(`restored-${Date.now()}-${Math.random()}`, 10);
        const userMap = await restoreRoot({
            connection, table: 'user', backupRows: data.users,
            currentRows: await rows(connection, 'SELECT * FROM user WHERE company_id = ?', [companyId]),
            identity: row => normalize(row.login) || normalize(row.email),
            allowed: ['company_id', 'login', 'password', 'name', 'role', 'status', 'created_at', 'avatar', 'email', 'phone', 'updated_at', 'notes', 'salary', 'hire_date', 'birth_date', 'position'],
            overrides: source => ({
                company_id: companyId,
                password: disabledPassword,
                status: 'blocked',
                avatar: source.avatar || '/img/default-avatar.png'
            }), report
        });

        const currentProducts = await rows(connection, 'SELECT * FROM products WHERE company_id = ?', [companyId]);
        const productMap = await restoreRoot({
            connection, table: 'products', backupRows: data.products, currentRows: currentProducts,
            identity: row => normalize(row.sku) || normalize(row.barcode) || normalize(row.name),
            allowed: ['category_id', 'name', 'unit', 'sku', 'barcode', 'purchase_price', 'sale_price', 'image', 'description', 'created_at', 'archived', 'company_id'],
            overrides: source => ({ company_id: companyId, category_id: categoryMap.get(Number(source.category_id)) || null }),
            report
        });

        const purchaseMap = await restoreRoot({
            connection, table: 'purchases', backupRows: data.purchases,
            currentRows: await rows(connection, 'SELECT * FROM purchases WHERE company_id = ?', [companyId]),
            identity: row => normalize(row.number),
            allowed: ['company_id', 'supplier_id', 'store_id', 'number', 'date', 'total_amount', 'status', 'created_at'],
            overrides: source => ({
                company_id: companyId,
                supplier_id: supplierMap.get(Number(source.supplier_id)) || null,
                store_id: storeMap.get(Number(source.store_id)) || null
            }), report
        });

        const saleMap = await restoreRoot({
            connection, table: 'sales', backupRows: data.sales,
            currentRows: await rows(connection, 'SELECT * FROM sales WHERE company_id = ?', [companyId]),
            identity: row => normalize(row.invoice_number),
            allowed: ['customer_id', 'user_id', 'store_id', 'total', 'payment_method', 'status', 'created_at', 'invoice_number', 'company_id', 'discount_percent', 'discount_amount', 'comment'],
            overrides: source => ({
                company_id: companyId,
                customer_id: customerMap.get(Number(source.customer_id)) || null,
                user_id: userMap.get(Number(source.user_id)) || currentUserId,
                store_id: storeMap.get(Number(source.store_id)) || null
            }), report
        });

        const returnMap = await restoreRoot({
            connection, table: 'sale_returns', backupRows: data.sale_returns,
            currentRows: await rows(connection, 'SELECT * FROM sale_returns WHERE company_id = ?', [companyId]),
            identity: row => normalize(row.return_number),
            allowed: ['sale_id', 'user_id', 'total', 'created_at', 'return_number', 'company_id'],
            overrides: source => ({
                company_id: companyId,
                sale_id: saleMap.get(Number(source.sale_id)),
                user_id: userMap.get(Number(source.user_id)) || currentUserId
            }), report
        });

        const transferMap = await restoreRoot({
            connection, table: 'stock_transfers', backupRows: data.stock_transfers,
            currentRows: await rows(connection, 'SELECT * FROM stock_transfers WHERE company_id = ?', [companyId]),
            identity: row => normalize(row.request_key),
            allowed: ['company_id', 'request_key', 'request_hash', 'from_store_id', 'to_store_id', 'from_store_name', 'to_store_name', 'created_by_user_id', 'created_by_name', 'status', 'comment', 'created_at', 'completed_at'],
            overrides: source => ({
                company_id: companyId,
                from_store_id: storeMap.get(Number(source.from_store_id)),
                to_store_id: storeMap.get(Number(source.to_store_id)),
                created_by_user_id: userMap.get(Number(source.created_by_user_id)) || currentUserId
            }), report
        });

        const saleItemMap = new Map();
        const existingChildren = {
            product_stores: await rows(connection, `SELECT ps.* FROM product_stores ps INNER JOIN products p ON p.id=ps.product_id WHERE p.company_id=?`, [companyId]),
            purchase_items: await rows(connection, `SELECT pi.* FROM purchase_items pi INNER JOIN purchases p ON p.id=pi.purchase_id WHERE p.company_id=?`, [companyId]),
            sale_items: await rows(connection, `SELECT si.* FROM sale_items si INNER JOIN sales s ON s.id=si.sale_id WHERE s.company_id=?`, [companyId]),
            sale_return_items: await rows(connection, `SELECT sri.* FROM sale_return_items sri INNER JOIN sale_returns sr ON sr.id=sri.return_id WHERE sr.company_id=?`, [companyId]),
            stock_transfer_items: await rows(connection, `SELECT sti.* FROM stock_transfer_items sti INNER JOIN stock_transfers st ON st.id=sti.transfer_id WHERE st.company_id=?`, [companyId]),
            user_stores: await rows(connection, `SELECT us.* FROM user_stores us INNER JOIN user u ON u.id=us.user_id WHERE u.company_id=?`, [companyId])
        };
        const childSpecs = [
            ['product_stores', data.product_stores, ['product_id', 'store_id', 'quantity', 'location'], row => [productMap.get(Number(row.product_id)), storeMap.get(Number(row.store_id))], ['product_id', 'store_id']],
            ['purchase_items', data.purchase_items, ['purchase_id', 'product_id', 'quantity', 'price'], row => [purchaseMap.get(Number(row.purchase_id)), productMap.get(Number(row.product_id))], ['purchase_id', 'product_id']],
            ['sale_items', data.sale_items, ['sale_id', 'product_id', 'quantity', 'price', 'purchase_price', 'subtotal', 'final_subtotal'], row => [saleMap.get(Number(row.sale_id)), productMap.get(Number(row.product_id))], ['sale_id', 'product_id']],
            ['sale_return_items', data.sale_return_items, ['return_id', 'sale_item_id', 'product_id', 'quantity', 'price', 'subtotal'], row => [returnMap.get(Number(row.return_id)), saleItemMap.get(Number(row.sale_item_id)), productMap.get(Number(row.product_id))], ['return_id', 'sale_item_id', 'product_id']],
            ['stock_transfer_items', data.stock_transfer_items, ['transfer_id', 'product_id', 'product_name', 'product_sku', 'product_unit', 'quantity', 'from_quantity_before', 'from_quantity_after', 'to_quantity_before', 'to_quantity_after'], row => [transferMap.get(Number(row.transfer_id)), productMap.get(Number(row.product_id))], ['transfer_id', 'product_id']],
            ['user_stores', data.user_stores, ['user_id', 'store_id'], row => [userMap.get(Number(row.user_id)), storeMap.get(Number(row.store_id))], ['user_id', 'store_id']]
        ];

        for (const [table, sourceRows = [], allowed, resolveKeys, keyColumns] of childSpecs) {
            const existingKeys = new Set(
                (existingChildren[table] || []).map(row => keyColumns.map(column => String(row[column])).join('|'))
            );
            for (const source of sourceRows) {
                const keys = resolveKeys(source);
                if (keys.some(value => !value)) {
                    report.warnings.push(`${table}:${source.id || 'row'}:missing-parent`);
                    continue;
                }
                const key = keys.map(String).join('|');
                if (existingKeys.has(key)) {
                    if (table === 'sale_items') {
                        const found = (existingChildren.sale_items || []).find(row =>
                            String(row.sale_id) === String(keys[0]) && String(row.product_id) === String(keys[1])
                        );
                        if (found) saleItemMap.set(Number(source.id), Number(found.id));
                    }
                    bump(report.skipped, table);
                    continue;
                }
                const overrides = Object.fromEntries(keyColumns.map((column, index) => [column, keys[index]]));
                const insertedId = await insert(connection, table, source, allowed, overrides);
                if (table === 'sale_items') saleItemMap.set(Number(source.id), Number(insertedId));
                existingKeys.add(key);
                bump(report.inserted, table);
            }
        }

        const simpleSpecs = [
            ['transactions', data.transactions, ['company_id', 'user_id', 'type', 'amount', 'payment_method', 'description', 'created_at'], await rows(connection, 'SELECT * FROM transactions WHERE company_id = ?', [companyId])],
            ['held_sales', data.held_sales, ['company_id', 'user_id', 'customer_id', 'customer_name', 'items', 'payment_method', 'cash_received', 'discount_percent', 'comment', 'created_at', 'updated_at'], await rows(connection, 'SELECT * FROM held_sales WHERE company_id = ?', [companyId])]
        ];

        for (const [table, sourceRows = [], allowed, currentRows] of simpleSpecs) {
            const existingKeys = new Set(currentRows.map(row => `${row.user_id}|${timeKey(row.created_at)}`));
            for (const source of sourceRows) {
                const userId = userMap.get(Number(source.user_id)) || currentUserId;
                const key = `${userId}|${timeKey(source.created_at)}`;
                if (existingKeys.has(key)) {
                    bump(report.skipped, table);
                    continue;
                }
                await insert(connection, table, source, allowed, {
                    company_id: companyId,
                    user_id: userId,
                    customer_id: customerMap.get(Number(source.customer_id)) || null
                });
                existingKeys.add(key);
                bump(report.inserted, table);
            }
        }

        if (options.dryRun) {
            await connection.rollback();
        } else {
            await connection.commit();
        }
        return report;

    } catch (error) {
        await connection.rollback();
        throw error;

    } finally {
        connection.release();
    }
}

module.exports = { restoreCompanyBackup, assertBackup };
