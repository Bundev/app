const crypto = require('crypto');
const db = require('../config/db');
const { variants: keyboardLayoutVariants } = require('../public/js/keyboard-layout');

const MAX_INT = 2147483647;
const MAX_ITEMS = 200;

class StockTransferError extends Error {
    constructor(message, statusCode = 400, code = 'TRANSFER_ERROR') {
        super(message);
        this.name = 'StockTransferError';
        this.statusCode = statusCode;
        this.code = code;
        this.isPublic = true;
    }
}

function positiveInteger(value, fieldName) {
    const number = Number(value);

    if (!Number.isSafeInteger(number) || number <= 0 || number > MAX_INT) {
        throw new StockTransferError(
            `${fieldName} должно быть целым положительным числом.`,
            400,
            'INVALID_INTEGER'
        );
    }

    return number;
}

function normalizeRequestKey(value) {
    const requestKey = String(value || '').trim();

    if (
        requestKey.length < 8 ||
        requestKey.length > 128 ||
        !/^[A-Za-z0-9._:-]+$/.test(requestKey)
    ) {
        throw new StockTransferError(
            'Форма перемещения устарела. Обновите страницу и попробуйте снова.',
            400,
            'INVALID_REQUEST_KEY'
        );
    }

    return requestKey;
}

function normalizeItems(value) {
    const rawItems = Array.isArray(value)
        ? value
        : value && typeof value === 'object'
            ? Object.values(value)
            : [];

    if (!rawItems.length) {
        throw new StockTransferError(
            'Добавьте хотя бы один товар.',
            400,
            'EMPTY_ITEMS'
        );
    }

    if (rawItems.length > MAX_ITEMS) {
        throw new StockTransferError(
            `За одно перемещение можно добавить не более ${MAX_ITEMS} товаров.`,
            400,
            'TOO_MANY_ITEMS'
        );
    }

    const quantities = new Map();

    for (const rawItem of rawItems) {
        if (!rawItem || typeof rawItem !== 'object') {
            throw new StockTransferError(
                'Проверьте список товаров.',
                400,
                'INVALID_ITEM'
            );
        }

        const productId = positiveInteger(
            rawItem.product_id ?? rawItem.productId ?? rawItem.id,
            'Идентификатор товара'
        );
        const quantity = positiveInteger(
            rawItem.quantity,
            'Количество'
        );
        const total = (quantities.get(productId) || 0) + quantity;

        if (!Number.isSafeInteger(total) || total > MAX_INT) {
            throw new StockTransferError(
                'Суммарное количество товара слишком велико.',
                400,
                'QUANTITY_TOO_LARGE'
            );
        }

        quantities.set(productId, total);
    }

    return [...quantities.entries()]
        .map(([productId, quantity]) => ({ productId, quantity }))
        .sort((left, right) => left.productId - right.productId);
}

function normalizeTransferInput(input) {
    const fromStoreId = positiveInteger(
        input.from_store_id ?? input.source_store_id ?? input.fromStoreId,
        'Магазин-отправитель'
    );
    const toStoreId = positiveInteger(
        input.to_store_id ?? input.destination_store_id ?? input.toStoreId,
        'Магазин-получатель'
    );

    if (fromStoreId === toStoreId) {
        throw new StockTransferError(
            'Выберите разные магазины.',
            400,
            'SAME_STORE'
        );
    }

    const comment = String(input.comment || '').trim();

    if (comment.length > 2000) {
        throw new StockTransferError(
            'Комментарий не должен превышать 2000 символов.',
            400,
            'COMMENT_TOO_LONG'
        );
    }

    const normalized = {
        requestKey: normalizeRequestKey(
            input.request_key ?? input.requestKey
        ),
        fromStoreId,
        toStoreId,
        comment,
        items: normalizeItems(input.items)
    };

    normalized.requestHash = crypto
        .createHash('sha256')
        .update(JSON.stringify({
            fromStoreId: normalized.fromStoreId,
            toStoreId: normalized.toStoreId,
            comment: normalized.comment,
            items: normalized.items
        }))
        .digest('hex');

    return normalized;
}

function assertIdentity(value, fieldName) {
    return positiveInteger(value, fieldName);
}

function placeholders(count) {
    return new Array(count).fill('?').join(', ');
}

async function findByRequestKey(executor, companyId, requestKey) {
    const [rows] = await executor.execute(
        `
        SELECT id, request_hash, status
        FROM stock_transfers
        WHERE company_id = ?
          AND request_key = ?
        LIMIT 1
        `,
        [companyId, requestKey]
    );

    return rows[0] || null;
}

function resolveExistingTransfer(existing, requestHash) {
    if (existing.request_hash !== requestHash) {
        throw new StockTransferError(
            'Этот ключ запроса уже использован для другого перемещения.',
            409,
            'REQUEST_KEY_CONFLICT'
        );
    }

    return {
        transferId: existing.id,
        created: false
    };
}

async function createTransfer({ companyId, userId, userName, input }) {
    const safeCompanyId = assertIdentity(companyId, 'Компания');
    const safeUserId = assertIdentity(userId, 'Пользователь');
    const safeUserName = (
        String(userName || '').trim() || 'Пользователь'
    ).slice(0, 255);
    const transfer = normalizeTransferInput(input || {});
    const connection = await db.getConnection();
    let transactionStarted = false;

    try {
        await connection.beginTransaction();
        transactionStarted = true;

        const existing = await findByRequestKey(
            connection,
            safeCompanyId,
            transfer.requestKey
        );

        if (existing) {
            const result = resolveExistingTransfer(
                existing,
                transfer.requestHash
            );
            await connection.commit();
            transactionStarted = false;
            return result;
        }

        const storeIds = [
            transfer.fromStoreId,
            transfer.toStoreId
        ].sort((left, right) => left - right);

        const [stores] = await connection.execute(
            `
            SELECT id, name
            FROM stores
            WHERE id IN (?, ?)
              AND company_id = ?
              AND status = 'active'
            ORDER BY id
            FOR UPDATE
            `,
            [storeIds[0], storeIds[1], safeCompanyId]
        );

        if (stores.length !== 2) {
            throw new StockTransferError(
                'Один из магазинов не найден или находится в архиве.',
                400,
                'STORE_NOT_AVAILABLE'
            );
        }

        const storesById = new Map(
            stores.map(store => [Number(store.id), store])
        );
        const fromStore = storesById.get(transfer.fromStoreId);
        const toStore = storesById.get(transfer.toStoreId);

        if (!fromStore || !toStore) {
            throw new StockTransferError(
                'Не удалось определить магазины перемещения.',
                400,
                'STORE_NOT_AVAILABLE'
            );
        }

        const productIds = transfer.items.map(item => item.productId);
        const productPlaceholders = placeholders(productIds.length);
        const [products] = await connection.execute(
            `
            SELECT id, name, sku, unit
            FROM products
            WHERE id IN (${productPlaceholders})
              AND company_id = ?
              AND archived = 0
            ORDER BY id
            FOR UPDATE
            `,
            [...productIds, safeCompanyId]
        );

        if (products.length !== productIds.length) {
            throw new StockTransferError(
                'Один из товаров не найден или находится в архиве.',
                400,
                'PRODUCT_NOT_AVAILABLE'
            );
        }

        const productsById = new Map(
            products.map(product => [Number(product.id), product])
        );

        const [stockRows] = await connection.execute(
            `
            SELECT product_id, store_id, quantity
            FROM product_stores
            WHERE store_id IN (?, ?)
              AND product_id IN (${productPlaceholders})
            ORDER BY store_id, product_id
            FOR UPDATE
            `,
            [storeIds[0], storeIds[1], ...productIds]
        );

        const stocks = new Map();

        for (const stock of stockRows) {
            stocks.set(
                `${Number(stock.store_id)}:${Number(stock.product_id)}`,
                Number(stock.quantity)
            );
        }

        for (const item of transfer.items) {
            const available = stocks.get(
                `${transfer.fromStoreId}:${item.productId}`
            ) || 0;
            const destinationQuantity = stocks.get(
                `${transfer.toStoreId}:${item.productId}`
            ) || 0;

            if (available < item.quantity) {
                const product = productsById.get(item.productId);
                throw new StockTransferError(
                    `Недостаточно остатка товара «${product.name}». Доступно: ${available}.`,
                    409,
                    'INSUFFICIENT_STOCK'
                );
            }

            if (destinationQuantity > MAX_INT - item.quantity) {
                const product = productsById.get(item.productId);
                throw new StockTransferError(
                    `Остаток товара «${product.name}» в магазине-получателе слишком велик.`,
                    409,
                    'DESTINATION_QUANTITY_TOO_LARGE'
                );
            }
        }

        const [headerResult] = await connection.execute(
            `
            INSERT INTO stock_transfers
            (
                company_id,
                request_key,
                request_hash,
                from_store_id,
                to_store_id,
                from_store_name,
                to_store_name,
                created_by_user_id,
                created_by_name,
                status,
                comment
            )
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'completed', ?)
            `,
            [
                safeCompanyId,
                transfer.requestKey,
                transfer.requestHash,
                transfer.fromStoreId,
                transfer.toStoreId,
                fromStore.name,
                toStore.name,
                safeUserId,
                safeUserName,
                transfer.comment || null
            ]
        );

        const transferId = headerResult.insertId;

        for (const item of transfer.items) {
            const product = productsById.get(item.productId);
            const fromQuantityBefore = stocks.get(
                `${transfer.fromStoreId}:${item.productId}`
            ) || 0;
            const toQuantityBefore = stocks.get(
                `${transfer.toStoreId}:${item.productId}`
            ) || 0;
            const fromQuantityAfter = fromQuantityBefore - item.quantity;
            const toQuantityAfter = toQuantityBefore + item.quantity;

            const [sourceResult] = await connection.execute(
                `
                UPDATE product_stores
                SET quantity = quantity - ?
                WHERE product_id = ?
                  AND store_id = ?
                  AND quantity >= ?
                `,
                [
                    item.quantity,
                    item.productId,
                    transfer.fromStoreId,
                    item.quantity
                ]
            );

            if (sourceResult.affectedRows !== 1) {
                throw new StockTransferError(
                    `Остаток товара «${product.name}» изменился. Повторите попытку.`,
                    409,
                    'STOCK_CHANGED'
                );
            }

            await connection.execute(
                `
                INSERT INTO product_stores
                (
                    product_id,
                    store_id,
                    quantity,
                    location
                )
                VALUES (?, ?, ?, '')
                ON DUPLICATE KEY UPDATE
                    quantity = quantity + VALUES(quantity)
                `,
                [
                    item.productId,
                    transfer.toStoreId,
                    item.quantity
                ]
            );

            await connection.execute(
                `
                INSERT INTO stock_transfer_items
                (
                    transfer_id,
                    product_id,
                    product_name,
                    product_sku,
                    product_unit,
                    quantity,
                    from_quantity_before,
                    from_quantity_after,
                    to_quantity_before,
                    to_quantity_after
                )
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                `,
                [
                    transferId,
                    item.productId,
                    product.name,
                    product.sku || null,
                    product.unit || null,
                    item.quantity,
                    fromQuantityBefore,
                    fromQuantityAfter,
                    toQuantityBefore,
                    toQuantityAfter
                ]
            );
        }

        await connection.commit();
        transactionStarted = false;

        return {
            transferId,
            created: true
        };
    } catch (error) {
        if (transactionStarted) {
            try {
                await connection.rollback();
            } catch (rollbackError) {
                console.error(
                    'Не удалось откатить перемещение:',
                    rollbackError
                );
            }
        }

        if (error && error.code === 'ER_DUP_ENTRY') {
            const existing = await findByRequestKey(
                db,
                safeCompanyId,
                transfer.requestKey
            );

            if (existing) {
                return resolveExistingTransfer(
                    existing,
                    transfer.requestHash
                );
            }
        }

        throw error;
    } finally {
        connection.release();
    }
}

async function listTransfers({ companyId }) {
    const safeCompanyId = assertIdentity(companyId, 'Компания');
    const [transfers] = await db.execute(
        `
        SELECT
            transfer.id,
            transfer.from_store_id,
            transfer.to_store_id,
            transfer.from_store_name,
            transfer.to_store_name,
            transfer.created_by_user_id,
            transfer.created_by_name,
            transfer.status,
            transfer.comment,
            transfer.created_at,
            transfer.completed_at,
            COALESCE(summary.position_count, 0) AS position_count,
            COALESCE(summary.total_quantity, 0) AS total_quantity
        FROM stock_transfers transfer
        LEFT JOIN
        (
            SELECT
                transfer_id,
                COUNT(*) AS position_count,
                COALESCE(SUM(quantity), 0) AS total_quantity
            FROM stock_transfer_items
            GROUP BY transfer_id
        ) summary
            ON summary.transfer_id = transfer.id
        WHERE transfer.company_id = ?
        ORDER BY transfer.created_at DESC, transfer.id DESC
        LIMIT 500
        `,
        [safeCompanyId]
    );

    return transfers;
}

async function getTransfer({ companyId, transferId }) {
    const safeCompanyId = assertIdentity(companyId, 'Компания');
    const safeTransferId = positiveInteger(
        transferId,
        'Перемещение'
    );
    const [transfers] = await db.execute(
        `
        SELECT
            id,
            company_id,
            from_store_id,
            to_store_id,
            from_store_name,
            to_store_name,
            created_by_user_id,
            created_by_name,
            status,
            comment,
            created_at,
            completed_at
        FROM stock_transfers
        WHERE id = ?
          AND company_id = ?
        LIMIT 1
        `,
        [safeTransferId, safeCompanyId]
    );

    if (!transfers.length) {
        throw new StockTransferError(
            'Перемещение не найдено.',
            404,
            'TRANSFER_NOT_FOUND'
        );
    }

    const [items] = await db.execute(
        `
        SELECT
            id,
            product_id,
            product_name,
            product_sku,
            product_unit,
            quantity,
            from_quantity_before,
            from_quantity_after,
            to_quantity_before,
            to_quantity_after
        FROM stock_transfer_items
        WHERE transfer_id = ?
        ORDER BY id
        `,
        [safeTransferId]
    );

    return {
        transfer: transfers[0],
        items
    };
}

async function getActiveStores({ companyId }) {
    const safeCompanyId = assertIdentity(companyId, 'Компания');
    const [stores] = await db.execute(
        `
        SELECT id, name, address
        FROM stores
        WHERE company_id = ?
          AND status = 'active'
        ORDER BY name, id
        `,
        [safeCompanyId]
    );

    return stores;
}

async function searchProducts({ companyId, storeId, query }) {
    const safeCompanyId = assertIdentity(companyId, 'Компания');
    const safeStoreId = positiveInteger(storeId, 'Магазин');
    const search = String(query || '').trim().slice(0, 100);
    const [stores] = await db.execute(
        `
        SELECT id
        FROM stores
        WHERE id = ?
          AND company_id = ?
          AND status = 'active'
        LIMIT 1
        `,
        [safeStoreId, safeCompanyId]
    );

    if (!stores.length) {
        throw new StockTransferError(
            'Магазин не найден или находится в архиве.',
            404,
            'STORE_NOT_AVAILABLE'
        );
    }

    const searchVariants = keyboardLayoutVariants(search);
    const searchClause = search
        ? `
          AND (
              ${searchVariants
                  .map(() => '(p.name LIKE ? OR p.sku LIKE ? OR p.barcode LIKE ?)')
                  .join(' OR ')}
          )
        `
        : '';
    const searchParams = search
        ? searchVariants.flatMap(variant => {
            const like = `%${variant}%`;
            return [like, like, like];
        })
        : [];
    const [products] = await db.execute(
        `
        SELECT
            p.id,
            p.name,
            p.sku,
            p.barcode,
            p.unit,
            ps.quantity AS available_quantity,
            ps.quantity AS quantity
        FROM product_stores ps
        INNER JOIN products p
            ON p.id = ps.product_id
        WHERE ps.store_id = ?
          AND ps.quantity > 0
          AND p.company_id = ?
          AND p.archived = 0
          ${searchClause}
        ORDER BY p.name, p.id
        LIMIT 50
        `,
        [
            safeStoreId,
            safeCompanyId,
            ...searchParams
        ]
    );

    return products;
}

module.exports = {
    StockTransferError,
    createTransfer,
    listTransfers,
    getTransfer,
    getActiveStores,
    searchProducts
};
