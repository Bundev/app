const db = require('../config/db');
const page = require('../helpers/page');

const MAX_ITEMS = 200;
const MAX_PURCHASE_NUMBER_LENGTH = 50;
const MAX_QUANTITY = 99999999;
const MAX_PRICE_CENTS = 9999999999;
const MAX_TOTAL_CENTS = 9999999999;
const MAX_STOCK_QUANTITY = 2147483647;

class PurchaseValidationError extends Error {

    constructor(message, statusCode = 400) {

        super(message);
        this.name = 'PurchaseValidationError';
        this.statusCode = statusCode;
        this.isPublic = true;

    }

}

function positiveInteger(value, label) {

    const text = String(value ?? '').trim();

    if (!/^\d+$/.test(text)) {

        throw new PurchaseValidationError(
            `${label}: выберите корректное значение.`
        );

    }

    const number = Number(text);

    if (!Number.isSafeInteger(number) || number <= 0) {

        throw new PurchaseValidationError(
            `${label}: выберите корректное значение.`
        );

    }

    return number;

}

function purchaseNumber(value) {

    if (typeof value !== 'string') {

        throw new PurchaseValidationError(
            'Укажите номер накладной.'
        );

    }

    const number = value.trim();

    if (!number) {

        throw new PurchaseValidationError(
            'Укажите номер накладной.'
        );

    }

    if (number.length > MAX_PURCHASE_NUMBER_LENGTH) {

        throw new PurchaseValidationError(
            `Номер накладной не должен превышать ${MAX_PURCHASE_NUMBER_LENGTH} символов.`
        );

    }

    return number;

}

function purchaseDate(value) {

    if (
        typeof value !== 'string' ||
        !/^\d{4}-\d{2}-\d{2}$/.test(value)
    ) {

        throw new PurchaseValidationError(
            'Укажите корректную дату закупки.'
        );

    }

    const [year, month, day] =
        value.split('-').map(Number);

    const date = new Date(
        Date.UTC(year, month - 1, day)
    );

    if (
        date.getUTCFullYear() !== year ||
        date.getUTCMonth() !== month - 1 ||
        date.getUTCDate() !== day
    ) {

        throw new PurchaseValidationError(
            'Укажите корректную дату закупки.'
        );

    }

    return value;

}

function itemQuantity(value, position) {

    const text = String(value ?? '').trim();

    if (!/^\d+$/.test(text)) {

        throw new PurchaseValidationError(
            `Позиция ${position}: количество должно быть целым положительным числом.`
        );

    }

    const quantity = Number(text);

    if (
        !Number.isSafeInteger(quantity) ||
        quantity <= 0 ||
        quantity > MAX_QUANTITY
    ) {

        throw new PurchaseValidationError(
            `Позиция ${position}: проверьте количество товара.`
        );

    }

    return quantity;

}

function itemPrice(value, position) {

    const text = String(value ?? '').trim();

    if (!/^\d+(?:\.\d{1,2})?$/.test(text)) {

        throw new PurchaseValidationError(
            `Позиция ${position}: цена должна содержать не более двух знаков после запятой.`
        );

    }

    const priceCents = Math.round(
        Number(text) * 100
    );

    if (
        !Number.isSafeInteger(priceCents) ||
        priceCents < 0 ||
        priceCents > MAX_PRICE_CENTS
    ) {

        throw new PurchaseValidationError(
            `Позиция ${position}: проверьте цену закупки.`
        );

    }

    return {
        price: priceCents / 100,
        priceCents
    };

}

function normalizeItems(value) {

    if (!Array.isArray(value)) {

        throw new PurchaseValidationError(
            'Добавьте хотя бы один товар в закупку.'
        );

    }

    if (!value.length) {

        throw new PurchaseValidationError(
            'Добавьте хотя бы один товар в закупку.'
        );

    }

    if (value.length > MAX_ITEMS) {

        throw new PurchaseValidationError(
            `В одной закупке может быть не более ${MAX_ITEMS} позиций.`
        );

    }

    const productIds = new Set();
    const items = [];
    let totalCents = 0;

    value.forEach((item, index) => {

        const position = index + 1;

        if (
            !item ||
            typeof item !== 'object' ||
            Array.isArray(item)
        ) {

            throw new PurchaseValidationError(
                `Позиция ${position}: проверьте данные товара.`
            );

        }

        const productId = positiveInteger(
            item.product_id,
            `Позиция ${position}`
        );

        if (productIds.has(productId)) {

            throw new PurchaseValidationError(
                `Позиция ${position}: товар уже добавлен в накладную.`
            );

        }

        const quantity = itemQuantity(
            item.quantity,
            position
        );

        const {
            price,
            priceCents
        } = itemPrice(
            item.price,
            position
        );

        if (
            priceCents > 0 &&
            quantity > Math.floor(
                (MAX_TOTAL_CENTS - totalCents) /
                priceCents
            )
        ) {

            throw new PurchaseValidationError(
                'Итоговая сумма закупки превышает допустимый предел.'
            );

        }

        totalCents +=
            quantity * priceCents;

        if (totalCents > MAX_TOTAL_CENTS) {

            throw new PurchaseValidationError(
                'Итоговая сумма закупки превышает допустимый предел.'
            );

        }

        productIds.add(productId);
        items.push({
            productId,
            quantity,
            price
        });

    });

    return {
        items,
        totalAmount: totalCents / 100
    };

}

function normalizePurchaseInput(body = {}) {

    const {
        items,
        totalAmount
    } = normalizeItems(body.items);

    return {
        number: purchaseNumber(body.number),
        date: purchaseDate(body.date),
        supplierId: positiveInteger(
            body.supplier_id,
            'Поставщик'
        ),
        storeId: positiveInteger(
            body.store_id,
            'Склад поступления'
        ),
        items,
        totalAmount
    };

}

function currentDateInKyiv() {

    const parts = new Intl.DateTimeFormat(
        'en-CA',
        {
            timeZone: 'Europe/Kyiv',
            year: 'numeric',
            month: '2-digit',
            day: '2-digit'
        }
    ).formatToParts(new Date());

    const dateParts = Object.fromEntries(
        parts.map(part => [
            part.type,
            part.value
        ])
    );

    return [
        dateParts.year,
        dateParts.month,
        dateParts.day
    ].join('-');

}

// ======================================================
// Список закупок
// ======================================================
exports.index = async (req, res) => {

    try {

        const companyId =
            req.session.user.company_id;

        const [purchases] = await db.execute(
            `
            SELECT
                p.id,
                p.number,
                p.date,
                p.total_amount,
                p.status,
                sup.name AS supplier_name,
                st.name AS store_name,
                DATE_FORMAT(
                    p.date,
                    '%d.%m.%Y'
                ) AS formatted_date
            FROM purchases p
            LEFT JOIN suppliers sup
                ON sup.id = p.supplier_id
               AND sup.company_id = p.company_id
            LEFT JOIN stores st
                ON st.id = p.store_id
               AND st.company_id = p.company_id
            WHERE p.company_id = ?
            ORDER BY
                p.date DESC,
                p.id DESC
            `,
            [
                companyId
            ]
        );

        res.render('purchases', {
            titleKey: 'title.purchases',
            activeMenu: 'purchases',
            purchases,
            ...page(req, 'purchases', [
                {
                    title: 'Закупки'
                }
            ])
        });

    } catch (error) {

        console.error(
            'Ошибка при загрузке закупок:',
            error
        );

        res.status(500).send(
            'Ошибка сервера'
        );

    }

};


// ======================================================
// Страница создания закупки
// ======================================================
exports.showAdd = async (req, res) => {

    try {

        const companyId =
            req.session.user.company_id;

        const [
            [suppliers],
            [stores],
            [products]
        ] = await Promise.all([
            db.execute(
                `
                SELECT
                    id,
                    name
                FROM suppliers
                WHERE company_id = ?
                  AND archived = 0
                ORDER BY name ASC
                `,
                [
                    companyId
                ]
            ),
            db.execute(
                `
                SELECT
                    id,
                    name
                FROM stores
                WHERE company_id = ?
                  AND status = 'active'
                ORDER BY name ASC
                `,
                [
                    companyId
                ]
            ),
            db.execute(
                `
                SELECT
                    id,
                    name,
                    sku,
                    unit,
                    purchase_price
                FROM products
                WHERE company_id = ?
                  AND archived = 0
                ORDER BY name ASC
                `,
                [
                    companyId
                ]
            )
        ]);

        res.render('purchases_add', {
            titleKey: 'Новая закупка',
            activeMenu: 'purchases',
            suppliers,
            stores,
            products,
            today: currentDateInKyiv(),
            ...page(req, 'purchases_add', [
                {
                    title: 'Закупки',
                    url: '/purchases'
                },
                {
                    title: 'Новая закупка'
                }
            ])
        });

    } catch (error) {

        console.error(
            'Ошибка при подготовке закупки:',
            error
        );

        res.status(500).send(
            'Ошибка сервера'
        );

    }

};


// ======================================================
// Просмотр закупки
// ======================================================
exports.view = async (req, res) => {

    try {

        const purchaseId = positiveInteger(
            req.params.id,
            'Закупка'
        );

        const companyId =
            req.session.user.company_id;

        const [[purchase]] = await db.execute(
            `
            SELECT
                p.id,
                p.number,
                p.date,
                p.total_amount,
                p.status,
                s.name AS supplier_name,
                s.phone AS supplier_phone,
                s.email AS supplier_email,
                st.name AS store_name
            FROM purchases p
            LEFT JOIN suppliers s
                ON s.id = p.supplier_id
               AND s.company_id = p.company_id
            LEFT JOIN stores st
                ON st.id = p.store_id
               AND st.company_id = p.company_id
            WHERE p.id = ?
              AND p.company_id = ?
            LIMIT 1
            `,
            [
                purchaseId,
                companyId
            ]
        );

        if (!purchase) {

            return res.status(404).send(
                'Закупка не найдена'
            );

        }

        const [items] = await db.execute(
            `
            SELECT
                pi.product_id,
                pi.quantity,
                pi.price,
                pr.name AS product_name,
                pr.sku AS product_sku,
                pr.unit AS product_unit
            FROM purchase_items pi
            JOIN purchases scoped_purchase
                ON scoped_purchase.id = pi.purchase_id
               AND scoped_purchase.company_id = ?
            LEFT JOIN products pr
                ON pr.id = pi.product_id
               AND pr.company_id =
                   scoped_purchase.company_id
            WHERE pi.purchase_id = ?
            `,
            [
                companyId,
                purchaseId
            ]
        );

        res.render('purchases_view', {
            titleKey: 'Приходная накладная',
            activeMenu: 'purchases',
            purchase,
            items,
            ...page(req, 'purchases_view', [
                {
                    title: 'Закупки',
                    url: '/purchases'
                },
                {
                    title: `Накладная № ${purchase.number}`
                }
            ])
        });

    } catch (error) {

        if (
            error instanceof PurchaseValidationError
        ) {

            return res.status(400).send(
                error.message
            );

        }

        console.error(
            'Ошибка при загрузке закупки:',
            error
        );

        res.status(500).send(
            'Внутренняя ошибка сервера'
        );

    }

};


// ======================================================
// Сохранение закупки
// ======================================================
exports.store = async (req, res) => {

    let connection = null;
    let transactionStarted = false;

    try {

        const companyId =
            req.session.user.company_id;

        const input =
            normalizePurchaseInput(req.body);

        connection =
            await db.getConnection();

        await connection.beginTransaction();
        transactionStarted = true;

        const [[supplier]] =
            await connection.execute(
                `
                SELECT id
                FROM suppliers
                WHERE id = ?
                  AND company_id = ?
                  AND archived = 0
                LIMIT 1
                FOR UPDATE
                `,
                [
                    input.supplierId,
                    companyId
                ]
            );

        if (!supplier) {

            throw new PurchaseValidationError(
                'Выбранный поставщик недоступен.'
            );

        }

        const [[store]] =
            await connection.execute(
                `
                SELECT id
                FROM stores
                WHERE id = ?
                  AND company_id = ?
                  AND status = 'active'
                LIMIT 1
                FOR UPDATE
                `,
                [
                    input.storeId,
                    companyId
                ]
            );

        if (!store) {

            throw new PurchaseValidationError(
                'Выбранный склад неактивен или недоступен.'
            );

        }

        const productIds =
            input.items.map(item => item.productId);

        const productPlaceholders =
            productIds.map(() => '?').join(', ');

        const [availableProducts] =
            await connection.execute(
                `
                SELECT id
                FROM products
                WHERE company_id = ?
                  AND archived = 0
                  AND id IN (
                      ${productPlaceholders}
                  )
                FOR UPDATE
                `,
                [
                    companyId,
                    ...productIds
                ]
            );

        const availableProductIds = new Set(
            availableProducts.map(product =>
                Number(product.id)
            )
        );

        if (
            availableProductIds.size !==
            productIds.length ||
            productIds.some(productId =>
                !availableProductIds.has(productId)
            )
        ) {

            throw new PurchaseValidationError(
                'Один или несколько товаров недоступны.'
            );

        }

        const [currentStocks] =
            await connection.execute(
                `
                SELECT
                    product_id,
                    quantity
                FROM product_stores
                WHERE store_id = ?
                  AND product_id IN (
                      ${productPlaceholders}
                  )
                FOR UPDATE
                `,
                [
                    input.storeId,
                    ...productIds
                ]
            );

        const stockByProduct = new Map(
            currentStocks.map(stock => [
                Number(stock.product_id),
                Number(stock.quantity) || 0
            ])
        );

        input.items.forEach(item => {

            const currentQuantity =
                stockByProduct.get(item.productId) || 0;

            if (
                currentQuantity >
                MAX_STOCK_QUANTITY -
                item.quantity
            ) {

                throw new PurchaseValidationError(
                    'Остаток одного из товаров превышает допустимый предел.'
                );

            }

        });

        const [purchaseResult] =
            await connection.execute(
                `
                INSERT INTO purchases
                (
                    company_id,
                    supplier_id,
                    store_id,
                    number,
                    date,
                    total_amount,
                    status
                )
                VALUES (
                    ?,
                    ?,
                    ?,
                    ?,
                    ?,
                    ?,
                    'received'
                )
                `,
                [
                    companyId,
                    input.supplierId,
                    input.storeId,
                    input.number,
                    input.date,
                    input.totalAmount
                ]
            );

        const purchaseId =
            purchaseResult.insertId;

        for (const item of input.items) {

            await connection.execute(
                `
                INSERT INTO purchase_items
                (
                    purchase_id,
                    product_id,
                    quantity,
                    price
                )
                VALUES (?, ?, ?, ?)
                `,
                [
                    purchaseId,
                    item.productId,
                    item.quantity,
                    item.price
                ]
            );

            await connection.execute(
                `
                INSERT INTO product_stores
                (
                    product_id,
                    store_id,
                    quantity
                )
                VALUES (?, ?, ?)
                ON DUPLICATE KEY UPDATE
                    quantity = quantity + ?
                `,
                [
                    item.productId,
                    input.storeId,
                    item.quantity,
                    item.quantity
                ]
            );

        }

        await connection.commit();
        transactionStarted = false;

        res.redirect(
            `/purchases/view/${purchaseId}`
        );

    } catch (error) {

        if (
            connection &&
            transactionStarted
        ) {

            try {

                await connection.rollback();

            } catch (rollbackError) {

                console.error(
                    'Ошибка отката закупки:',
                    rollbackError
                );

            }

        }

        if (
            error instanceof PurchaseValidationError ||
            error.isPublic
        ) {

            return res.status(
                error.statusCode || 400
            ).send(
                error.message
            );

        }

        console.error(
            'Ошибка при сохранении закупки:',
            error
        );

        res.status(500).send(
            'Ошибка при сохранении закупки'
        );

    } finally {

        if (connection) {
            connection.release();
        }

    }

};
