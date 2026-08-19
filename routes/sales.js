const express = require('express');
const router = express.Router();
const db = require('../config/db');
const auth = require('../middleware/auth');
const statuses = require('../config/statuses');
const roles = require('../config/roles');
const page = require('../helpers/page');
const telegram = require('../services/telegram.service');
// Продажи
router.get('/', auth, async (req, res) => {
    try {
        let sql = `
            SELECT
                s.*,
                c.name AS customer_name,
                u.name AS user_name,
                st.name AS store_name,
                (
                    SELECT COUNT(*)
                    FROM sale_items si
                    WHERE si.sale_id = s.id
                ) AS item_count
            FROM sales s

            LEFT JOIN customers c
                ON c.id = s.customer_id

            LEFT JOIN user u
                ON u.id = s.user_id

            LEFT JOIN stores st
                ON st.id = s.store_id
        `;

        const params = [];

        if (req.session.user.role === 'admin') {

            sql += `
                WHERE s.company_id = ?
            `;
            params.push(req.session.user.company_id);

        } else {
            
            sql += `
                WHERE s.user_id = ? 
            `;
            params.push(req.session.user.id);

        }

        sql += `ORDER BY s.id DESC`;

        const [sales] = await db.query(sql,params);

        res.render('sales', 
        {
            titleKey: 'title.sales',
            activeMenu: 'sales',
            sales,
            statuses,
            ...page(req, 'sales', [
                {title: req.__('title.sales')}
            ])
        });

    } catch (error) {

        console.error(error);
        res.status(500).send(error.message);

    }

});
// Роут автообновлени чеков
router.get('/latest', auth, async (req, res) => {
    try {

        let sql = `
            SELECT
                s.id,
                s.invoice_number,
                s.total,
                s.status,
                s.created_at,
                c.name AS customer_name,
                u.name AS user_name,
                st.name AS store_name,
                (
                    SELECT COUNT(*)
                    FROM sale_items si
                    WHERE si.sale_id = s.id
                ) AS item_count
            FROM sales s
            LEFT JOIN customers c
                ON c.id = s.customer_id
            LEFT JOIN user u
                ON u.id = s.user_id
            LEFT JOIN stores st
                ON st.id = s.store_id
            WHERE s.company_id = ?
        `;
        const params = [req.session.user.company_id];

        if (req.session.user.role !== 'admin') {
            sql += ` AND s.user_id = ?`;
            params.push(req.session.user.id);
        }

        sql += ` ORDER BY s.id DESC LIMIT 10`;

        const [sales] = await db.query(sql, params);

        res.json(sales);

    } catch (error) {

        console.error('Ошибка latest:', error);

        res.status(500).json({
            success: false,
            message: error.message
        });

    }
});

// Товары, фактически проданные за текущий день.
router.get('/today', auth, async (req, res) => {
    try {
        let sql = `
            SELECT
                p.id AS product_id,
                p.name AS product_name,
                p.sku,
                si.purchase_price,
                si.price AS sale_price,
                SUM(GREATEST(si.quantity - COALESCE(returned.quantity, 0), 0)) AS quantity
            FROM sale_items si
            INNER JOIN sales s ON s.id = si.sale_id
            INNER JOIN products p ON p.id = si.product_id
            LEFT JOIN (
                SELECT sale_item_id, SUM(quantity) AS quantity
                FROM sale_return_items
                GROUP BY sale_item_id
            ) returned ON returned.sale_item_id = si.id
            WHERE s.company_id = ?
              AND s.created_at >= CURDATE()
              AND s.created_at < CURDATE() + INTERVAL 1 DAY
              AND s.status IN ('completed', 'partial_return')
        `;
        const params = [req.session.user.company_id];

        if (req.session.user.role !== 'admin') {
            sql += ' AND s.user_id = ?';
            params.push(req.session.user.id);
        }

        sql += `
            GROUP BY p.id, p.name, p.sku, si.purchase_price, si.price
            HAVING quantity > 0
            ORDER BY si.price DESC, p.name ASC
        `;

        const [items] = await db.query(sql, params);
        const rows = items.map(item => ({
            ...item,
            quantity: Number(item.quantity || 0),
            purchase_price: Number(item.purchase_price || 0),
            sale_price: Number(item.sale_price || 0),
            purchase_total: Number(item.quantity || 0) * Number(item.purchase_price || 0),
            sale_total: Number(item.quantity || 0) * Number(item.sale_price || 0)
        }));

        res.render('sales-today', {
            titleKey: 'Проданные товары за сегодня',
            activeMenu: 'sales-today',
            items: rows,
            style: [{ href: 'sales-today.css' }],
            ...page(req, 'sales-today', [
                { title: req.__('title.sales'), url: '/sales' },
                { title: 'Проданные товары за сегодня' }
            ])
        });
    } catch (error) {
        console.error(error);
        res.status(500).send(error.message);
    }
});
//Роут страницы нового чека
router.get('/new', auth, async (req, res) => {

    



    res.render('new', {
        titleKey: 'title.new',
        activeMenu: 'sales',
        statuses,
        invoice_merchant: req.session.user.name,
        ...page(req, 'new', [
            {title: req.__('title.sales'),url: '/sales'},
            {title: req.__('title.new')}
        ])
       
    });

});
// Отложенные чеки не создают продажу и не меняют остатки до проведения.
router.get('/held', auth, async (req, res) => {
    try {
        const [heldReceipts] = await db.execute(
            `
            SELECT id, customer_id, customer_name, items, payment_method,
                   cash_received, discount_percent, comment, created_at, updated_at
            FROM held_sales
            WHERE company_id = ? AND user_id = ?
            ORDER BY updated_at DESC
            `,
            [req.session.user.company_id, req.session.user.id]
        );

        res.json({
            success: true,
            receipts: heldReceipts.map(receipt => ({
                ...receipt,
                items: typeof receipt.items === 'string'
                    ? JSON.parse(receipt.items)
                    : receipt.items
            }))
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({ success: false, error: 'Не удалось получить отложенные чеки.' });
    }
});

router.post('/held', auth, async (req, res) => {
    try {
        const { customer_id, customer_name, items, payment_method, cash_received, discount_percent, comment } = req.body;

        if (!Array.isArray(items) || !items.length) {
            return res.status(400).json({ success: false, error: 'В отложенном чеке должен быть хотя бы один товар.' });
        }

        if (items.length > 100) {
            return res.status(400).json({ success: false, error: 'В чеке слишком много товаров.' });
        }

        const normalizedItems = items.map(item => ({
            id: Number(item.id),
            name: String(item.name || '').slice(0, 255),
            unit: String(item.unit || '').slice(0, 50),
            qty: Number(item.qty),
            price: Number(item.price),
            originalPrice: Number(item.originalPrice || item.price),
            stock: Number(item.stock || 0),
            stock_info: String(item.stock_info || '').slice(0, 500)
        }));

        if (normalizedItems.some(item => !Number.isInteger(item.id) || item.id <= 0 || item.qty <= 0 || item.price < 0)) {
            return res.status(400).json({ success: false, error: 'В чеке есть некорректные товары.' });
        }

        const [result] = await db.execute(
            `
            INSERT INTO held_sales
            (company_id, user_id, customer_id, customer_name, items, payment_method, cash_received, discount_percent, comment)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
            `,
            [
                req.session.user.company_id,
                req.session.user.id,
                Number(customer_id) > 0 ? Number(customer_id) : null,
                String(customer_name || 'Основной покупатель').slice(0, 255),
                JSON.stringify(normalizedItems),
                ['cash', 'card', 'transfer'].includes(payment_method) ? payment_method : 'cash',
                Math.max(0, Number(cash_received) || 0),
                Math.min(100, Math.max(0, Number(discount_percent) || 0)),
                String(comment || '').slice(0, 2000) || null
            ]
        );

        res.status(201).json({ success: true, id: result.insertId });
    } catch (error) {
        console.error(error);
        res.status(500).json({ success: false, error: 'Не удалось отложить чек.' });
    }
});

router.delete('/held/:id', auth, async (req, res) => {
    try {
        const [result] = await db.execute(
            `
            DELETE FROM held_sales
            WHERE id = ? AND company_id = ? AND user_id = ?
            LIMIT 1
            `,
            [req.params.id, req.session.user.company_id, req.session.user.id]
        );

        if (!result.affectedRows) {
            return res.status(404).json({ success: false, error: 'Отложенный чек не найден.' });
        }

        res.json({ success: true });
    } catch (error) {
        console.error(error);
        res.status(500).json({ success: false, error: 'Не удалось удалить отложенный чек.' });
    }
});

async function getSaleForPrint(req, saleId) {
    const params = [saleId, req.session.user.company_id];
    const userFilter = req.session.user.role === 'admin'
        ? ''
        : ' AND s.user_id = ?';

    if (userFilter) {
        params.push(req.session.user.id);
    }

    const [[sale]] = await db.query(
        `
        SELECT
            s.*,
            c.name AS customer_name,
            u.name AS user_name,
            st.name AS store_name,
            st.address AS store_address,
            st.phone AS store_phone
        FROM sales s
        LEFT JOIN customers c ON c.id = s.customer_id
        LEFT JOIN user u ON u.id = s.user_id
        LEFT JOIN stores st ON st.id = s.store_id
        WHERE s.id = ? AND s.company_id = ?${userFilter}
        `,
        params
    );

    if (!sale) {
        return null;
    }

    const [items] = await db.query(
        `
        SELECT si.*, p.name, p.sku
        FROM sale_items si
        JOIN products p ON p.id = si.product_id
        WHERE si.sale_id = ?
        ORDER BY si.id
        `,
        [saleId]
    );

    return { sale, items };
}

router.get('/print/:width/:id', auth, async (req, res) => {
    const width = Number(req.params.width);

    if (![58, 80].includes(width)) {
        return res.status(404).send('Формат печати не найден');
    }

    try {
        const receipt = await getSaleForPrint(req, req.params.id);

        if (!receipt) {
            return res.status(404).send('Чек не найден');
        }

        return res.render('sale-print-cash', {
            ...receipt,
            printWidth: width
        });
    } catch (error) {
        console.error(error);
        return res.status(500).send('Не удалось подготовить чек к печати');
    }
});

router.get('/receipt/:id', auth, async (req, res) => {
    try {
        const receipt = await getSaleForPrint(req, req.params.id);

        if (!receipt) {
            return res.status(404).send('Чек не найден');
        }

        return res.render('sale-print-receipt', receipt);
    } catch (error) {
        console.error(error);
        return res.status(500).send('Не удалось подготовить чек к печати');
    }
});

// Роут просмотра продажи
router.get('/:id', auth, async (req, res) => {

    const saleId = req.params.id;

    const [[sale]] =
        await db.query(
            `
            SELECT
                s.*,
                c.name AS customer_name,
                u.name AS user_name,
                st.name AS store_name
            FROM sales s

            LEFT JOIN customers c
                ON c.id = s.customer_id

            LEFT JOIN user u
                ON u.id = s.user_id

            LEFT JOIN stores st
                ON st.id = s.store_id

            WHERE s.id = ?
            `,
            [saleId]
        );

    if (!sale) {
        return res.redirect('/sales');
    }

    const [items] =
        await db.query(
            `
            SELECT
                si.*,
                p.name,
                p.sku
            FROM sale_items si

            JOIN products p
                ON p.id = si.product_id

            WHERE si.sale_id = ?
            `,
            [saleId]
        );

    const [returns] =
    await db.query(
        `
        SELECT
            sr.*,
            u.name AS user_name
        FROM sale_returns sr

        LEFT JOIN user u
            ON u.id = sr.user_id

        WHERE sr.sale_id = ?
                `,
                [saleId]
            );

    const subtotal =
    Number(sale.total) +
    Number(sale.discount_amount || 0);

const returnTotal =
    returns.reduce(
        (sum, item) =>
            sum + Number(item.total || 0),
        0
    );

sale.return_percent =
    sale.total > 0
        ? Math.min(
            100,
            Math.round(
                returnTotal /
                Number(sale.total) *
                100
            )
        )
        : 0;

        
    res.render('sale-view', {
        titleKey: 'Чек',
        sale,
        items,
        returns,
        returnTotal,
        subtotal, 
        activeMenu: 'sales',
        ...page(req, 'sale-view', [
            {title: req.__('title.sales'),url: '/sales'},
            {title: `Чек`}
        ])
       
        
    });

});
// Роут страницы возврата продажи
router.get('/:id/return',auth,async (req, res) => {

        const saleId =
            req.params.id;

        const [[sale]] =
            await db.query(
                `
                SELECT *
                FROM sales
                WHERE id = ?
                `,
                [saleId]
            );

        const [items] =
            await db.query(
                `
                SELECT
                    si.*,
                    p.name,

                    COALESCE(
                        (
                            SELECT
                                SUM(sri.quantity)

                            FROM sale_return_items sri

                            WHERE sri.sale_item_id = si.id
                        ),
                        0
                    ) AS returned_qty

                FROM sale_items si

                JOIN products p
                    ON p.id = si.product_id

                WHERE si.sale_id = ?
                `,
                [saleId]
            );

        res.render('sale_return',
            {
                titleKey: "Возврата товара",
                sale,
                items,
                activeMenu: 'sales',
                ...page(req, 'sale-return', [
                    {title: req.__('title.sales'),url: '/sales'},
                    {title: `Возврать по чек`}
                ])
                
            }
        );

    }
);
// Роут сохранение возврата
router.post('/:id/return',auth, async (req, res) => {

        try {

            const saleId =
                req.params.id;
            

            const [[sale]] =
                await db.query(
                    `
                    SELECT *
                    FROM sales
                    WHERE id = ?
                    `,
                    [saleId]
                );

            const [saleItems] =
                await db.query(
                    `
                    SELECT *
                    FROM sale_items
                    WHERE sale_id = ?
                    `,
                    [saleId]
                );

            const saleSubtotal =
                saleItems.reduce(
                    (sum, item) =>
                        sum +
                        Number(item.subtotal),
                    0
                );

            const year =
                new Date().getFullYear();

            const [[lastReturn]] =
                await db.query(
                    `
                    SELECT return_number
                    FROM sale_returns
                    WHERE return_number LIKE ?
                    ORDER BY id DESC
                    LIMIT 1
                    `,
                    [
                        `RET-${year}-%`
                    ]
                );

            let nextNumber = 1;

            if (
                lastReturn &&
                lastReturn.return_number
            ) {

                nextNumber =
                    Number(
                        lastReturn.return_number
                            .split('-')[2]
                    ) + 1;

            }

            const returnNumber =
                `RET-${year}-${String(nextNumber)
                    .padStart(6, '0')}`;

            const [ret] =
                await db.query(
                    `
                    INSERT INTO sale_returns
                    (
                        sale_id,
                        return_number,
                        user_id,
                        total,
                        company_id
                    )
                    VALUES
                    (
                        ?, ?, ?, 0, ?
                    )
                    `,
                    [
                        saleId,
                        returnNumber,
                        req.session.user.id,
                        req.session.user.company_id
                    ]
                );

            let returnTotal = 0;

            for (const item of saleItems) {

                const qty =
                    Number(
                        req.body[
                            `return_${item.id}`
                        ] || 0
                    );

                if (qty <= 0) {
                    continue;
                }

                const [[returned]] =
                    await db.query(
                        `
                        SELECT
                            COALESCE(
                                SUM(quantity),
                                0
                            ) qty
                        FROM sale_return_items
                        WHERE sale_item_id = ?
                        `,
                        [item.id]
                    );

                const available =
                    item.quantity -
                    returned.qty;

                if (
                    qty > available
                ) {

                    return res.send(
                        'Количество превышает доступный остаток'
                    );

                }

                const subtotal =
                    qty *
                    Number(item.price);

                returnTotal +=
                    subtotal;

                await db.query(
                    `
                    INSERT INTO sale_return_items
                    (
                        return_id,
                        sale_item_id,
                        product_id,
                        quantity,
                        price,
                        subtotal
                    )
                    VALUES
                    (
                        ?, ?, ?, ?, ?, ?
                    )
                    `,
                    [
                        ret.insertId,
                        item.id,
                        item.product_id,
                        qty,
                        item.price,
                        subtotal
                    ]
                );

                await db.query(
                    `
                    INSERT INTO product_stores
                    (
                        product_id,
                        store_id,
                        quantity
                    )
                    VALUES (?, ?, ?)

                    ON DUPLICATE KEY UPDATE
                    quantity = quantity + VALUES(quantity)
                    `,
                    [
                        item.product_id,
                        sale.store_id,
                        qty
                    ]
                );

            }

            // возврат с учетом скидки

            const actualReturnTotal =
                saleSubtotal > 0
                    ? (
                        returnTotal *
                        Number(sale.total) /
                        saleSubtotal
                    )
                    : 0;

            await db.query(
                `
                UPDATE sale_returns
                SET total = ?
                WHERE id = ?
                `,
                [
                    actualReturnTotal,
                    ret.insertId
                ]
            );

            const [[stats]] =
                await db.query(
                    `
                    SELECT

                        SUM(si.quantity)
                            AS sold,

                        (
                            SELECT
                                COALESCE(
                                    SUM(
                                        sri.quantity
                                    ),
                                    0
                                )
                            FROM sale_return_items sri

                            JOIN sale_items sii
                                ON sii.id =
                                   sri.sale_item_id

                            WHERE sii.sale_id = ?
                        )
                        AS returned

                    FROM sale_items si

                    WHERE si.sale_id = ?
                    `,
                    [
                        saleId,
                        saleId
                    ]
                );

            let status =
                'completed';

            if (
                Number(stats.returned) > 0
            ) {

                status =
                    Number(stats.returned) >=
                    Number(stats.sold)
                        ? 'returned'
                        : 'partial_return';

            }

            await db.query(
                `
                UPDATE sales
                SET status = ?
                WHERE id = ?
                `,
                [
                    status,
                    saleId
                ]
            );

            res.redirect(
                `/sales/${saleId}`
            );

        } catch (error) {

            console.error(error);

            res.status(500).send(
                error.message
            );

        }

    }
);



//Роут Сохранение чека
router.post('/save', auth, async (req, res) => {
    const connection = await db.getConnection();

    try {
        await connection.beginTransaction();

        const {
            customer_id,
            payment_method,
            total,
            discount_percent,
            discount_amount,
            items,
            comment
        } = req.body;

        const company_id = req.session.user.company_id;

        const [[userStore]] = await connection.query(
            `
            SELECT st.id AS store_id
            FROM user_stores us
            INNER JOIN stores st
                ON st.id = us.store_id
            WHERE us.user_id = ?
              AND st.company_id = ?
              AND st.status = 'active'
            ORDER BY st.id
            LIMIT 1
            FOR UPDATE
            `,
            [
                req.session.user.id,
                company_id
            ]
        );

        if (!userStore) {
            const storeError = new Error(
                'Нет активного магазина, доступного для продажи.'
            );
            storeError.statusCode = 400;
            throw storeError;
        }

        const store_id = Number(userStore.store_id);

        const year = new Date().getFullYear();

        const [[lastSale]] = await connection.query(
            `
            SELECT invoice_number
            FROM sales
            WHERE company_id = ?
            AND invoice_number LIKE ?
            ORDER BY id DESC
            LIMIT 1
            `,
            [company_id, `SALE-${year}-%`]
        );

        let nextNumber = 1;

        if (lastSale && lastSale.invoice_number) {
            const parts = lastSale.invoice_number.split('-');
            nextNumber = Number(parts[2]) + 1;
        }

        const invoiceNumber = `SALE-${year}-${String(nextNumber).padStart(6, '0')}`;

        const created_at = new Date().toLocaleString('sv-SE', {
            timeZone: 'Europe/Kyiv'
        });

        if (!Array.isArray(items) || items.length === 0) {
            const itemsError = new Error('Добавьте товары в чек.');
            itemsError.statusCode = 400;
            throw itemsError;
        }

        const productIds = [...new Set(items.map(item => Number(item.product_id)))];
        if (productIds.some(productId => !Number.isInteger(productId) || productId <= 0)) {
            const productError = new Error('В чеке указан некорректный товар.');
            productError.statusCode = 400;
            throw productError;
        }

        const placeholders = productIds.map(() => '?').join(', ');
        const [discountProducts] = await connection.query(
            `SELECT id, purchase_price FROM products WHERE company_id = ? AND id IN (${placeholders})`,
            [company_id, ...productIds]
        );
        const purchasePrices = new Map(
            discountProducts.map(product => [Number(product.id), Number(product.purchase_price) || 0])
        );

        let validatedSubtotal = 0;
        let validatedPurchaseTotal = 0;
        for (const item of items) {
            const productId = Number(item.product_id);
            const quantity = Number(item.quantity);
            const price = Number(item.price);

            if (!purchasePrices.has(productId) || !Number.isFinite(quantity) || quantity <= 0 || !Number.isFinite(price) || price < 0) {
                const itemError = new Error('Проверьте товары, количество и цены в чеке.');
                itemError.statusCode = 400;
                throw itemError;
            }

            validatedSubtotal += quantity * price;
            validatedPurchaseTotal += quantity * purchasePrices.get(productId);
        }

        const validatedDiscountAmount = Number(discount_amount) || 0;
        const maxDiscountAmount = Math.max(0, validatedSubtotal - validatedPurchaseTotal);
        if (validatedDiscountAmount < 0 || validatedDiscountAmount > maxDiscountAmount + 0.005) {
            const discountError = new Error(
                `Скидка не может превышать ${maxDiscountAmount.toFixed(2)} ₴: итоговая сумма не должна быть ниже закупочной стоимости.`
            );
            discountError.statusCode = 400;
            throw discountError;
        }

        const validatedTotal = validatedSubtotal - validatedDiscountAmount;
        const validatedDiscountPercent = validatedSubtotal > 0
            ? validatedDiscountAmount / validatedSubtotal * 100
            : 0;

        const [saleResult] = await connection.execute(
            `
            INSERT INTO sales
            (
                company_id,
                invoice_number,
                customer_id,
                user_id,
                store_id,
                total,
                discount_percent,
                discount_amount,
                payment_method,
                status,
                created_at,
                comment
            )
            VALUES
            (
                ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?
            )
            `,
            [
                company_id,
                invoiceNumber,
                customer_id > 0 ? customer_id : null,
                req.session.user.id,
                store_id,
                validatedTotal,
                validatedDiscountPercent,
                validatedDiscountAmount,
                payment_method,
                'completed',
                created_at,
                comment
            ]
        );

        // `discount_amount` is the total discount for the receipt.  It already
        // represents `discount_percent` when the discount was entered as a
        // percentage, so it must be applied only once to sale items.
        let subtotalBeforeDiscount = 0;

        for (const item of items) {
            const subtotal = Number(item.price) * Number(item.quantity);

            subtotalBeforeDiscount += subtotal;
        }

        const saleId = saleResult.insertId;

        // ПЕРЕМЕННЫЕ ДЛЯ СБОРА ДАННЫХ В ТЕЛЕГРАМ
        const telegramItems = [];

        for (const item of items) {

            const [[stock]] = await connection.query(
                `
                SELECT quantity
                FROM product_stores
                WHERE product_id = ?
                AND store_id = ?
                `,
                [item.product_id, store_id]
            );

            if (!stock || stock.quantity < item.quantity) {
                throw new Error(`Недостаточно остатка: ${item.name}`);
            }

            // Достаем оригинальное имя товара и закупочную цену из таблицы products
            const [[productInfo]] = await connection.query(
                `SELECT name, purchase_price, unit FROM products WHERE id = ? LIMIT 1`,
                [item.product_id]
            );

            let productName = productInfo?.name || item.name || `Товар ID ${item.product_id}`;
            const purchasePrice = Number(productInfo?.purchase_price) || 0;

            const subtotal = Number(item.quantity) * Number(item.price);
            telegramItems.push({
                name: productName,
                quantity: item.quantity,
                unit: productInfo?.unit || '',
                price: purchasePrice
            });
            const share =
                subtotalBeforeDiscount > 0
                    ? subtotal / subtotalBeforeDiscount
                    : 0;

            const itemDiscount =
                validatedDiscountAmount * share;

            const finalSubtotal =
                subtotal - itemDiscount;
            await connection.execute(
                `
                INSERT INTO sale_items
                (
                    sale_id,
                    product_id,
                    quantity,
                    price,
                    purchase_price,
                    subtotal,
                    final_subtotal
                )
                VALUES
                (
                    ?, ?, ?, ?, ?, ?, ?
                )
                `,
                [
                    saleId, 
                    item.product_id, 
                    item.quantity, 
                    item.price, 
                    purchasePrice, 
                    subtotal,
                    finalSubtotal
                ]
            );

            await connection.execute(
                `
                UPDATE product_stores
                SET quantity = quantity - ?
                WHERE product_id = ?
                AND store_id = ?
                `,
                [item.quantity, item.product_id, store_id]
            );
        }

        // Подтверждаем транзакцию в БД
        await connection.commit();

        try {
            telegram.sendSaleReceipt({
                items: telegramItems
            }).catch(tgError => console.error('Ошибка отправки в Telegram:', tgError));

        } catch (tgError) {
            console.error('Ошибка формирования отчета в Telegram:', tgError);
        }

        res.json({
            success: true,
            sale_id: saleId,
            invoice_number: invoiceNumber
        });

    } catch (error) {
        await connection.rollback();
        console.error(error);
        res.status(error.statusCode || 500).json({
            success: false,
            error: error.message
        });
    } finally {
        connection.release();
    }
});


module.exports = router;
