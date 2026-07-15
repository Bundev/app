const express = require('express');
const router = express.Router();
const db = require('../config/db');
const auth = require('../middleware/auth');
const statuses = require('../config/statuses');
const roles = require('../config/roles');
const https = require('https');
const page = require('../helpers/page');
// Продажи
router.get('/', auth, async (req, res) => {
    try {
        let sql = `
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

        const [sales] = await db.query(`
            SELECT
                s.id,
                s.invoice_number,
                s.total,
                s.status,
                s.created_at,
                c.name AS customer_name
            FROM sales s
            LEFT JOIN customers c
                ON c.id = s.customer_id
            ORDER BY s.id DESC
            LIMIT 10
        `);

        res.json(sales);

    } catch (error) {

        console.error('Ошибка latest:', error);

        res.status(500).json({
            success: false,
            message: error.message
        });

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
    const https = require('https');

    // Токены вашего бота (лучше вынести в .env файл)
    const TELEGRAM_BOT_TOKEN = '8627452539:AAEVgdXq8q_g9JAWCKaovvcCbknewx1pHYk';
    // ВНИМАНИЕ: Здесь должен быть ID вашего личного чата с ботом или ID группы (число), а не юзернейм самого бота!
    const TELEGRAM_CHAT_ID = '218308591'; 

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
            SELECT store_id
            FROM user_stores
            WHERE user_id = ?
            LIMIT 1
            `,
            [req.session.user.id]
        );

        const store_id = userStore?.store_id || 1;

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
                total,
                discount_percent,
                discount_amount,
                payment_method,
                'completed',
                created_at,
                comment
            ]
        );

        const saleId = saleResult.insertId;

        // ПЕРЕМЕННЫЕ ДЛЯ СБОРА ДАННЫХ В ТЕЛЕГРАМ
        let totalPurchaseTotal = 0;
        let itemsTextForTelegram = '';
        let itemIndex = 1;

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
            const subtotalPurchase = Number(item.quantity) * purchasePrice;

            totalPurchaseTotal += subtotalPurchase;

            
            // Формируем текст по каждому товару прямо в цикле
            itemsTextForTelegram += `${itemIndex}. *${productName}*\n`;
            itemsTextForTelegram += `    🔹 Кол-во: ${item.quantity} ${productInfo.unit}\n`;
            // itemsTextForTelegram += `    🔹 Продажа: ${item.price} ₴ | Сумма: ${subtotal} ₴\n`;
            itemsTextForTelegram += `    🔸 Продажа: ${purchasePrice} ₴ | Сумма: ${subtotalPurchase} ₴\n`; //закупочная цена
            itemIndex++;

            await connection.execute(
                `
                INSERT INTO sale_items
                (
                    sale_id,
                    product_id,
                    quantity,
                    price,
                    subtotal
                )
                VALUES
                (
                    ?, ?, ?, ?, ?
                )
                `,
                [saleId, item.product_id, item.quantity, item.price, subtotal]
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

        // ========================================================
        // НАЧАЛО БЛОКА: ОТПРАВКА В ТЕЛЕГРАМ С БЭКЕНДА
        // ========================================================
        try {
            const cashierName = req.body.merchant || req.session?.user?.name || 'Администратор';
            
            // Получаем имя текущего склада для отчета Telegram
            const [[storeInfo]] = await connection.query(
                `SELECT name FROM stores WHERE id = ? LIMIT 1`, 
                [store_id]
            );
            const storeName = storeInfo?.name || `Склад №${store_id}`;
            
            let message = `🧾 *Чек №${invoiceNumber}*\n`;
            message += `👨‍💼 Кассир: ${cashierName}\n`;
            message += `📦 Склад: ${storeName}\n`;
            message += `-------------------------------------\n`;

            // Вставляем сгенерированный в цикле текст товаров
            message += itemsTextForTelegram;

            message += `-------------------------------------\n`;
            //message += `💰 *Итого Продажа: ${total} ₴*`;
            message += `💰 *Итого Продажа: ${totalPurchaseTotal} ₴*`;
            // if (Number(discount_percent) > 0) message += ` (Скидка ${discount_percent}%)`;
            // message += `\n📉 *Итого Закупка: ${totalPurchaseTotal} ₴*\n`;
            
            // const profit = total - totalPurchaseTotal;
            // message += `📈 *Чистая маржа: ${profit} ₴*`;
            
            if (comment) message += `\n💬 Комментарий: _${comment}_`;

            const tgData = JSON.stringify({
                chat_id: TELEGRAM_CHAT_ID,
                text: message,
                parse_mode: 'Markdown'
            });

            const tgOptions = {
                hostname: 'api.telegram.org',
                port: 443,
                path: `/bot${TELEGRAM_BOT_TOKEN}/sendMessage`,
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Content-Length': Buffer.byteLength(tgData)
                }
            };

            const tgReq = https.request(tgOptions);
            tgReq.on('error', (tgErr) => console.error('Ошибка сети Telegram:', tgErr));
            tgReq.write(tgData);
            tgReq.end();

        } catch (tgError) {
            console.error('Ошибка формирования отчета в Telegram:', tgError);
        }
        // ========================================================
        // КОНЕЦ БЛОКА: ОТПРАВКА В ТЕЛЕГРАМ
        // ========================================================

        res.json({
            success: true,
            sale_id: saleId,
            invoice_number: invoiceNumber
        });

    } catch (error) {
        await connection.rollback();
        console.error(error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    } finally {
        connection.release();
    }
});


module.exports = router;