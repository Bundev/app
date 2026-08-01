const db = require('../config/db');

const DIRECT_TABLES = [
    'categories',
    'customers',
    'held_sales',
    'products',
    'purchases',
    'sales',
    'sale_returns',
    'stock_transfers',
    'stores',
    'suppliers',
    'transactions'
];

async function select(connection, sql, params) {
    const [rows] = await connection.execute(sql, params);
    return rows;
}

async function createCompanyBackup(companyId) {
    const connection = await db.getConnection();

    try {
        await connection.beginTransaction();

        const companies = await select(
            connection,
            'SELECT id, name, status, created_at FROM companies WHERE id = ? LIMIT 1',
            [companyId]
        );

        if (!companies.length) {
            const error = new Error('Company not found');
            error.code = 'COMPANY_NOT_FOUND';
            throw error;
        }

        const data = { companies };

        for (const table of DIRECT_TABLES) {
            data[table] = await select(
                connection,
                `SELECT * FROM \`${table}\` WHERE company_id = ? ORDER BY id`,
                [companyId]
            );
        }

        data.users = await select(
            connection,
            `SELECT id, login, name, role, status, created_at, avatar, email,
                    phone, last_login, updated_at, notes, salary, hire_date,
                    birth_date, position, company_id
             FROM user
             WHERE company_id = ?
             ORDER BY id`,
            [companyId]
        );

        data.product_stores = await select(
            connection,
            `SELECT ps.*
             FROM product_stores ps
             INNER JOIN products p ON p.id = ps.product_id
             INNER JOIN stores s ON s.id = ps.store_id
             WHERE p.company_id = ? AND s.company_id = ?
             ORDER BY ps.id`,
            [companyId, companyId]
        );

        data.purchase_items = await select(
            connection,
            `SELECT pi.* FROM purchase_items pi
             INNER JOIN purchases p ON p.id = pi.purchase_id
             WHERE p.company_id = ? ORDER BY pi.id`,
            [companyId]
        );

        data.sale_items = await select(
            connection,
            `SELECT si.* FROM sale_items si
             INNER JOIN sales s ON s.id = si.sale_id
             WHERE s.company_id = ? ORDER BY si.id`,
            [companyId]
        );

        data.sale_return_items = await select(
            connection,
            `SELECT sri.* FROM sale_return_items sri
             INNER JOIN sale_returns sr ON sr.id = sri.return_id
             WHERE sr.company_id = ? ORDER BY sri.id`,
            [companyId]
        );

        data.stock_transfer_items = await select(
            connection,
            `SELECT sti.* FROM stock_transfer_items sti
             INNER JOIN stock_transfers st ON st.id = sti.transfer_id
             WHERE st.company_id = ? ORDER BY sti.id`,
            [companyId]
        );

        data.user_stores = await select(
            connection,
            `SELECT us.* FROM user_stores us
             INNER JOIN user u ON u.id = us.user_id
             INNER JOIN stores s ON s.id = us.store_id
             WHERE u.company_id = ? AND s.company_id = ?
             ORDER BY us.user_id, us.store_id`,
            [companyId, companyId]
        );

        await connection.commit();

        return {
            format: 'retailpro-company-backup',
            version: 1,
            createdAt: new Date().toISOString(),
            company: {
                id: companies[0].id,
                name: companies[0].name
            },
            security: {
                passwordsIncluded: false,
                sessionsIncluded: false
            },
            counts: Object.fromEntries(
                Object.entries(data).map(([key, rows]) => [key, rows.length])
            ),
            data
        };

    } catch (error) {
        await connection.rollback();
        throw error;

    } finally {
        connection.release();
    }
}

module.exports = { createCompanyBackup };
