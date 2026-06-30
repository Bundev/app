const express = require('express');
const XLSX = require('xlsx');
const Fuse = require('fuse.js');
const cookieParser = require('cookie-parser');
const i18n = require('i18n');
const session = require('express-session');
const MySQLStore = require('express-mysql-session')(session);
const statuses = require('./config/statuses');
const roles = require('./config/roles');
const db = require('./config/db');
const bcrypt = require('bcrypt');
const upload = require('./config/upload');
const uploadImport = require('./config/upload-import');
const bwipjs = require('bwip-js');
const multer = require('multer');
const PDFDocument = require('pdfkit');
// const axios = require('axios');
const port = 3000;


const fs = require('fs');
const path = require('path');
const { name } = require('ejs');


const app = express();

app.set('view engine', 'ejs');
app.use(express.static('public'));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));


const sessionStore =
    new MySQLStore({

        host: 'srv1798.hstgr.io',

        user: 'u891612247_bundev95',

        password: 'Bundev1995',

        database: 'u891612247_crm'

    });

app.use(
    session({

        key: 'retailpro',

        secret: 'super-secret-key',

        store: sessionStore,

        resave: false,

        saveUninitialized: false,

        cookie: {

            maxAge:
                1000 *
                60 *
                60 *
                24 *
                30

        }

    })
);


app.use((req, res, next) => {

    res.locals.user =
        req.session.user || null;

    next();

});

app.use(express.urlencoded({
    extended: true
}));

app.use((req, res, next) => {

    res.locals.roles = {
        admin: 'Администратор',
        manager: 'Менеджер',
        seller: 'Продавец'
    };

    next();

});


app.use(cookieParser());

i18n.configure({
    locales: ['ru', 'uk'],
    defaultLocale: 'ru',
    directory: path.join(__dirname, 'locales'),
    objectNotation: true
});

app.use(i18n.init);

// Автоматическое определение языка
app.use((req, res, next) => {
    let lang = req.cookies.lang;

    if (!lang) {
        lang = req.acceptsLanguages('ru', 'uk') || 'ru';
        res.cookie('lang', lang, { maxAge: 365 * 24 * 60 * 60 * 1000 });
    }

    req.setLocale(lang);
    res.locals.__ = res.__;
    res.locals.lang = lang;

    next();
});




const storage = multer.diskStorage({

        destination:
            (
                req,
                file,
                cb
            ) => {

                cb(
                    null,
                    'public/uploads/products'
                );

            },

        filename:
            (
                req,
                file,
                cb
            ) => {

                cb(
                    null,
                    Date.now() +
                    '-' +
                    file.originalname
                );

            }

    });

const uploadProduct =
    multer({
        storage
    });

// let exchangeRates = {
//     USD: 41.7,
//     EUR: 48.7
// };

// async function updateRates() {

//     try {

//         const { data } = await axios.get(
//             'https://api.privatbank.ua/p24api/pubinfo?exchange&json&coursid=11'
//         );

//         exchangeRates.USD =
//             parseFloat(
//                 data.find(x => x.ccy === 'USD').sale
//             );

//         exchangeRates.EUR =
//             parseFloat(
//                 data.find(x => x.ccy === 'EUR').sale
//             );

//     } catch (err) {

//         console.error('Ошибка получения курса:', err.message);

//     }

// }

// updateRates();
// setInterval(updateRates, 60 * 60 * 1000);

// Проверка подключения
(async () => {
    try {
        const [rows] = await db.query('SELECT 1');
        console.log("База данных подключена!");
    } catch (err) {
        console.error(err);
    }
})();


function auth(req, res, next) {

    if (!req.session.user) {

        return res.redirect('/login');

    }

    next();

}

async function renderDashboard(req, res) {
    try {
        const companyId = req.session.user.company_id;
        const userId = req.session.user.id;

        // 1. Продажи текущего пользователя за сегодня
        const [[salesTodayRow]] = await db.query(
            `
            SELECT
                COALESCE(SUM(total), 0) AS total,
                COUNT(*) AS invoices
            FROM sales
            WHERE company_id = ?
              AND user_id = ?
              AND DATE(created_at) = CURDATE()
              AND status IN ('completed', 'partial_return', 'returned')
            `,
            [companyId, userId]
        );

        // 2. Возвраты текущего пользователя за сегодня
        const [[returnsTodayRow]] = await db.query(
            `
            SELECT
                COALESCE(SUM(sr.total), 0) AS total
            FROM sale_returns sr
            JOIN sales s ON s.id = sr.sale_id
            WHERE s.company_id = ?
              AND s.user_id = ?
              AND DATE(sr.created_at) = CURDATE()
            `,
            [companyId, userId]
        );

        // 3. Количество клиентов (клиентская база общая для всей компании)
        const [[clientsRow]] = await db.query(
            `
            SELECT COUNT(*) AS total
            FROM customers
            WHERE company_id = ? AND status = 'active'
            `,
            [companyId]
        );

        // 4. Продано товаров текущим пользователем за сегодня
        const [[productsTodayRow]] = await db.query(
            `
            SELECT
                COALESCE(SUM(si.quantity), 0) AS total
            FROM sale_items si
            JOIN sales s ON s.id = si.sale_id
            WHERE s.company_id = ?
              AND s.user_id = ?
              AND DATE(s.created_at) = CURDATE()
            `,
            [companyId, userId]
        );

        // 5. Последние 10 чеков текущего пользователя
        const [latestSales] = await db.query(
            `
            SELECT *
            FROM sales
            WHERE company_id = ?
              AND user_id = ?
            ORDER BY id DESC
            LIMIT 10
            `,
            [companyId, userId]
        );

        // 6. Топ 10 товаров текущего пользователя за последние 7 дней
        const [topProducts] = await db.query(
            `
            SELECT
                p.name,
                p.unit, -- Забираем единицу измерения из таблицы товаров
                SUM(si.quantity) AS total_qty,
                SUM(si.subtotal) AS total_sales
            FROM sale_items si
            JOIN products p ON p.id = si.product_id
            JOIN sales s ON s.id = si.sale_id
            WHERE s.company_id = ?
              AND s.user_id = ?
              AND s.created_at >= DATE_SUB(NOW(), INTERVAL 7 DAY)
            GROUP BY p.id, p.name, p.unit
            ORDER BY total_qty DESC
            LIMIT 10
            `,
            [companyId, userId]
        );

        const salesToday = Number(salesTodayRow.total);
        const returnsToday = Number(returnsTodayRow.total);
        const incomeToday = salesToday - returnsToday;
        
        res.render('dashboard', {
            titleKey: 'title.dashboard',
            activeMenu: 'dashboard',
            salesToday: incomeToday,
            grossSalesToday: salesToday,
            returnsToday,
            topProducts,
            invoicesToday: salesTodayRow.invoices,
            clientsCount: clientsRow.total,
            productsToday: productsTodayRow.total,
            invoices: latestSales,
            statuses, 
            script: [{ src: 'dashboard.js' }],
            style: [{ href: 'dashboard.css' }],
            breadcrumbs: [
                { title: req.__('title.dashboard'), url: '/' }
            ]
        });

    } catch (error) {
        console.error('Ошибка при рендере дашборда:', error);
        res.status(500).send('Ошибка сервера при загрузке панели управления');
    }
}
function renderLogin(res, error = null, success = null) {

    return res.render('login', {
        titleKey: 'title.login',
        error,
        success,

        script: [
            {
                src: 'login.js'
            }
        ],

        style: [
            {
                href: 'login.css'
            }
        ]
    });

}
// Middleware проверки администратора
function requireAdmin(req,res,next) {

    if (!req.session.user) {

        return res.redirect(
            '/login'
        );

    }

    if (
        req.session.user.role !==
        'admin'
    ) {

        return res.status(403).send(
            'Доступ запрещён'
        );

    }

    next();

}
// Роутер панели упражнения
app.get('/', auth, renderDashboard);
app.get('/dashboard', auth, renderDashboard);
// Продажи
app.get('/sales', auth, async (req, res) => {

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

            params.push(
                req.session.user.company_id
            );

        } else {
            
            sql += `
                WHERE s.user_id = ?
            `;

            params.push(
                req.session.user.id
            );

        }

        sql += `
            ORDER BY s.id DESC
        `;

        const [sales] =
            await db.query(
                sql,
                params
            );

        res.render('sales', {
            titleKey: 'title.sales',
            activeMenu: 'sales',
            sales,
            statuses,
            script: [
                {
                    src: 'sales.js'
                }
            ],
            style: [
                {
                    href: 'sales.css'
                }
            ],
            breadcrumbs: [
                {
                    title: req.__('title.dashboard'),
                    url: '/'
                },
                {
                    title: req.__('title.sales')
                }
            ]
        });

    } catch (error) {

        console.error(error);

        res.status(500).send(error.message);

    }

});
// Роут просмотра продажи
app.get('/sale/:id', auth, async (req, res) => {

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
        script: [
            {
                src: 'sale-view.js'
            }
        ],
        style: [
            {
                href: 'sale-view.css'
            }
        ],
        breadcrumbs: [
            {
                title: req.__('title.dashboard'),
                url: '/'
            },
            {
                title: 'Продажи',
                url: '/sales'
            },
            {
                title: `Чек`
            }
        ]
    });

});

// Новый API-роут для получения данных чека (печать из списка продаж)
app.get('/api/sales/:id', auth, async (req, res) => {
    try {
        const saleId = req.params.id;

        // 1. Достаем основную информацию о чеке и кассире
        const [[sale]] = await db.query(
            `
            SELECT 
                s.id, 
                s.invoice_number, 
                s.total, 
                s.discount_amount, 
                s.payment_method, 
                s.created_at,
                u.name AS cashier_name
            FROM sales s
            LEFT JOIN user u ON u.id = s.user_id
            WHERE s.id = ?
            `,
            [saleId]
        );

        if (!sale) {
            return res.status(404).json({ error: 'Продажа не найдена' });
        }

        // 2. Достаем все товары из этого чека
        const [items] = await db.query(
            `
            SELECT 
                si.quantity, 
                si.price, 
                p.name 
            FROM sale_items si
            JOIN products p ON p.id = si.product_id
            WHERE si.sale_id = ?
            `,
            [saleId]
        );

        // Объединяем данные в один объект
        sale.items = items;

        // Отправляем JSON на фронтенд
        res.json(sale);

    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Ошибка сервера при загрузке чека' });
    }
});

// Роут страницы возврата продажи
app.get(
    '/sale/:id/return',
    auth,
    async (req, res) => {

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

        res.render(
            'sale_return',
            {
                titleKey: "Возврата товара",
                sale,
                items,
                activeMenu: 'sales',
                script: [
                    {
                        src: 'sale-return.js'
                    }
                ],
                style: [
                    {
                        href: 'sale-return.css'
                    }
                ],
                breadcrumbs: [
                    {
                        title: req.__('title.dashboard'),
                        url: '/'
                    },
                    {
                        title: 'Продажи',
                        url: '/sales'
                    },
                    {
                        title: `Возврать по чек`
                    }
                ]
            }
        );

    }
);
// Роут сохранение возврата
app.post(
    '/sale/:id/return',
    auth,
    async (req, res) => {

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
                `/sale/${saleId}`
            );

        } catch (error) {

            console.error(error);

            res.status(500).send(
                error.message
            );

        }

    }
);
app.get(
    '/return/:id',
    auth,
    async (req, res) => {

        const returnId =
            req.params.id;

        const [[ret]] =
            await db.query(
                `
                SELECT
                    sr.*,
                    s.invoice_number,
                    c.name AS customer_name,
                    u.name AS user_name,
                    st.name AS store_name

                FROM sale_returns sr

                JOIN sales s
                    ON s.id = sr.sale_id

                LEFT JOIN customers c
                    ON c.id = s.customer_id

                LEFT JOIN user u
                    ON u.id = sr.user_id

                LEFT JOIN stores st
                    ON st.id = s.store_id

                WHERE sr.id = ?
                `,
                [returnId]
            );

        if (!ret) {

            return res.redirect(
                '/sales'
            );

        }

        const [items] =
            await db.query(
                `
                SELECT
                    sri.*,
                    p.name,
                    p.sku

                FROM sale_return_items sri

                JOIN products p
                    ON p.id =
                       sri.product_id

                WHERE sri.return_id = ?
                `,
                [returnId]
            );

        res.render(
            'return-view',
            {

                titleKey:
                    'Возврат',

                ret,
                items,

                activeMenu:
                    'sales',

                script: [
                    {
                        src:
                            'return-view.js'
                    }
                ],

                style: [
                    {
                        href:
                            'return-view.css'
                    }
                ],

                breadcrumbs: [
                    {
                        title:
                            req.__(
                                'title.dashboard'
                            ),
                        url: '/'
                    },
                    {
                        title:
                            'Продажи',
                        url:
                            '/sales'
                    },
                    {
                        title:
                            'Возврат'
                    }
                ]

            }
        );

    }
);

// Роут автообновлени чеков
app.get('/sales/latest', auth, async (req, res) => {

    const [sales] =
        await db.query(`
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

});

//Роут Сохранение чека
app.post('/sales/save', auth, async (req, res) => {
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
                `SELECT name, purchase_price FROM products WHERE id = ? LIMIT 1`,
                [item.product_id]
            );

            let productName = productInfo?.name || item.name || `Товар ID ${item.product_id}`;
            const purchasePrice = Number(productInfo?.purchase_price) || 0;

            const subtotal = Number(item.quantity) * Number(item.price);
            const subtotalPurchase = Number(item.quantity) * purchasePrice;

            totalPurchaseTotal += subtotalPurchase;

            // ========================================================
            // ОПРЕДЕЛЕНИЕ ЕДИНИЦЫ ИЗМЕРЕНИЯ ИЗ НАЗВАНИЯ
            // ========================================================
            let unit = 'шт.'; // Единица измерения по умолчанию
            
            // Регулярное выражение ищет в конце названия "шт", "шт.", "м", "м." (игнорируя регистр)
            // Пример: "Провод 2х1.5 м." -> Название: "Провод 2х1.5", Единица: "м."
            const unitMatch = productName.match(/\s+([шШ][тТ]\.?|[мМ]\.?)$/);
            
            if (unitMatch) {
                unit = unitMatch[1].toLowerCase();
                if (!unit.endsWith('.')) unit += '.'; // Приводим к виду "шт." или "м."
                
                // Удаляем найденную единицу измерения из названия товара
                productName = productName.replace(/[,.\s]+([шШ][тТ]\.?|[мМ]\.?)$/, '').trim();
            }
            // ========================================================
            // Формируем текст по каждому товару прямо в цикле
            itemsTextForTelegram += `${itemIndex}. *${productName}*\n`;
            itemsTextForTelegram += `    🔹 Кол-во: ${item.quantity} ${unit}\n`;
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
//Роут страницы нового чека
app.get('/new', auth, async (req, res) => {

    const year =
        new Date().getFullYear();

    const [[lastSale]] =
        await db.query(
            `
            SELECT invoice_number
            FROM sales
            WHERE company_id = ?
            AND invoice_number LIKE ?
            ORDER BY id DESC
            LIMIT 1
            `,
            [
                req.session.user.company_id,
                `SALE-${year}-%`
            ]
        );

    let nextNumber = 1;

    if (
        lastSale &&
        lastSale.invoice_number
    ) {

        const parts =
            lastSale.invoice_number.split('-');

        nextNumber =
            Number(parts[2]) + 1;
    }

    const invoiceNumber =
        `SALE-${year}-${String(nextNumber)
            .padStart(6, '0')}`;



    res.render('new', {

        titleKey: 'title.new',

        invoiceNumber,

        activeMenu: 'sales',

        statuses,
        invoice_merchant: req.session.user.name,

        script: [
            {
                src: 'new.js'
            }
        ],

        style: [
            {
                href: 'new.css'
            }
        ],

        breadcrumbs: [
            {
                title: req.__('title.dashboard'),
                url: '/'
            },
            {
                title: req.__('title.sales'),
                url: '/sales'
            },
            {
                title: req.__('title.new')
            }
        ]
    });

});
// 1. ПОЛУЧЕНИЕ КЛИЕНТОВ: Выводим только со статусом 'active'
app.get('/customers', auth, async (req, res) => {
    try {
        const companyId = req.session?.user?.company_id || 1; 

        // Добавили условие: status = 'active'
        const [customers] = await db.query(
            `SELECT * FROM customers WHERE company_id = ? AND status = 'active' ORDER BY id DESC`,
            [companyId]
        );

        res.render('customers', {
            titleKey: 'Клиенты',
            customers,
            activeMenu: 'customers',
            breadcrumbs: [
                { title: req.__('title.dashboard') || 'Главная', url: '/' },
                { title: 'Клиенты' }
            ]
        });
    } catch (error) {
        console.error(error);
        res.status(500).send('Ошибка сервера');
    }
});

// 2. АРХИВАЦИЯ: Меняем статус на 'archived' вместо удаления строки
app.get('/customers/archive/:id', auth, async (req, res) => {
    try {
        const companyId = req.session?.user?.company_id || 1;
        const customerId = req.params.id;

        // Защита розничного покупателя
        if (Number(customerId) === 1) {
            return res.status(400).send('Нельзя архивировать системного розничного покупателя');
        }

        // Вместо DELETE делаем UPDATE статуса
        await db.query(
            "UPDATE customers SET status = 'archived', updated_at = NOW() WHERE id = ? AND company_id = ?",
            [customerId, companyId]
        );

        res.redirect('/customers');
    } catch (error) {
        console.error(error);
        res.status(500).send('Ошибка при архивации клиента');
    }
});

// 2. Роут обработки формы создания клиента
app.post('/customers/add', auth, async (req, res) => {
    try {
        const { name, phone, email, discount_percentage, comment } = req.body;
        const companyId = req.session?.user?.company_id || 1; // Заглушка 1, если сессия еще не настроена

        if (!name || name.trim() === '') {
            return res.status(400).send('Имя клиента обязательно для заполнения');
        }

        // Вставляем строго по полям вашей структуры из phpMyAdmin
        await db.query(
            `INSERT INTO customers (company_id, name, phone, email, discount_percentage, comment, created_at) 
             VALUES (?, ?, ?, ?, ?, ?, NOW())`,
            [
                companyId,
                name.trim(), 
                phone ? phone.trim() : null, 
                email ? email.trim() : null, 
                discount_percentage ? Number(discount_percentage) : 0.00, 
                comment ? comment.trim() : null
            ]
        );

        res.redirect('/customers');
    } catch (error) {
        console.error(error);
        res.status(500).send('Ошибка сервера при создании клиента');
    }
});
// Получение списка клиентов компании (только активные)
app.get('/api/customers', auth, async (req, res) => {
    try {
        const companyId = req.session.user.company_id;

        // ИСПРАВЛЕНО: добавлено условие AND status = 'active'
        const [customers] = await db.query(
            `
            SELECT id, name, phone, email, discount_percentage 
            FROM customers 
            WHERE company_id = ? 
              AND status = 'active'
            ORDER BY name ASC
            `,
            [companyId]
        );

        return res.json({
            success: true,
            customers
        });

    } catch (error) {
        console.error('Ошибка при получении клиентов:', error);
        return res.status(500).json({
            success: false,
            message: 'Не удалось загрузить список клиентов'
        });
    }
});
// Роут для создания нового клиента
app.post('/api/customers', auth, async (req, res) => {
    try {
        const { name, phone, email, discount_percentage, comment } = req.body;
        const companyId = req.session.user.company_id;

        // 1. Валидация обязательных полей
        if (!name || !name.trim()) {
            return res.status(400).json({ 
                success: false, 
                message: 'Имя клиента обязательно для заполнения' 
            });
        }

        // Очищаем телефон от лишних символов (пробелы, дефисы, скобки), если он передан
        const cleanPhone = phone ? phone.replace(/\D/g, '') : null;

        // 2. Проверка на дубликат (если телефон указан, проверяем внутри этой же компании)
        if (cleanPhone) {
            const [existingClient] = await db.query(
                `SELECT id FROM customers WHERE phone = ? AND company_id = ? LIMIT 1`,
                [cleanPhone, companyId]
            );

            if (existingClient.length > 0) {
                return res.status(400).json({ 
                    success: false, 
                    message: 'Клиент с таким номером телефона уже существует в вашей компании' 
                });
            }
        }

        // 3. Безопасное приведение типов для скидки
        const discount = discount_percentage ? parseFloat(discount_percentage) : 0;

        // 4. Вставка нового клиента в базу данных
        const [result] = await db.query(
            `
            INSERT INTO customers 
                (company_id, name, phone, email, discount_percentage, comment, created_at) 
            VALUES 
                (?, ?, ?, ?, ?, ?, NOW())
            `,
            [
                companyId, 
                name.trim(), 
                cleanPhone, 
                email?.trim() || null, 
                discount, 
                comment?.trim() || null
            ]
        );

        // 5. Возвращаем созданного клиента
        return res.status(201).json({
            success: true,
            message: 'Клиент успешно создан',
            client: {
                id: result.insertId,
                name: name.trim(),
                phone: cleanPhone,
                email: email?.trim() || null,
                discount_percentage: discount
            }
        });

    } catch (error) {
        console.error('Ошибка при создании клиента:', error);
        return res.status(500).json({
            success: false,
            message: 'Внутренняя ошибка сервера при создании клиента'
        });
    }
});
app.put('/api/customers/:id', auth, async (req, res) => {
    try {
        const customerId = req.params.id;
        const companyId = req.session.user.company_id;
        const { name, phone, email, discount_percentage } = req.body;

        if (!name || !name.trim()) {
            return res.status(400).json({ success: false, message: 'Имя обязательно' });
        }

        const cleanPhone = phone ? phone.replace(/\D/g, '') : null;
        const discount = discount_percentage ? parseFloat(discount_percentage) : 0;

        // Обновляем только если клиент принадлежит текущей компании
        await db.query(
            `UPDATE customers 
             SET name = ?, phone = ?, email = ?, discount_percentage = ?, updated_at = NOW() 
             WHERE id = ? AND company_id = ?`,
            [name.trim(), cleanPhone, email?.trim() || null, discount, customerId, companyId]
        );

        return res.json({
            success: true,
            message: 'Данные клиента обновлены',
            client: { id: customerId, name: name.trim(), phone: cleanPhone, discount_percentage: discount }
        });

    } catch (error) {
        console.error('Ошибка при обновлении клиента:', error);
        return res.status(500).json({ success: false, message: 'Ошибка сервера при обновлении' });
    }
});


// 2. Обработка формы редактирования (POST-запрос)
app.post('/customers/edit/:id', auth, async (req, res) => {
    try {
        const { name, phone, email, discount_percentage, comment } = req.body;
        const companyId = req.session?.user?.company_id || 1;
        const customerId = req.params.id;

        if (!name || name.trim() === '') {
            return res.status(400).send('Имя клиента обязательно');
        }

        await db.query(
            `UPDATE customers 
             SET name = ?, phone = ?, email = ?, discount_percentage = ?, comment = ?, updated_at = NOW() 
             WHERE id = ? AND company_id = ?`,
            [
                name.trim(), 
                phone ? phone.trim() : null, 
                email ? email.trim() : null, 
                discount_percentage ? Number(discount_percentage) : 0.00, 
                comment ? comment.trim() : null,
                customerId,
                companyId
            ]
        );

        res.redirect('/customers');
    } catch (error) {
        console.error(error);
        res.status(500).send('Ошибка при обновлении клиента');
    }
});

// Обновленный API-роут для получения данных одного клиента
app.get('/api/customers/:id', auth, async (req, res) => {
    try {
        const customerId = req.params.id;

        // Временно убираем фильтр по company_id, чтобы проверить связь
        const [[customer]] = await db.query(
            'SELECT * FROM customers WHERE id = ?',
            [customerId]
        );

        if (!customer) {
            return res.status(404).json({ error: 'Клиент не найден в базе данных' });
        }

        res.json(customer);
    } catch (error) {
        console.error('Ошибка API Клиенты:', error);
        res.status(500).json({ error: 'Внутренняя ошибка сервера' });
    }
});

// Роутер товаров
app.get('/products', auth, async (req, res) => {

    const importSuccess =
    req.session.importSuccess;

    const productSuccess =
        req.session.productSuccess;
        

    req.session.importSuccess =
        null;

    req.session.productSuccess =
        null;
    
    const [products] =
        await db.execute(
            `
            SELECT
                p.*,
                c.name AS category_name,

                SUM(
                    COALESCE(ps.quantity, 0)
                ) AS quantity,

                GROUP_CONCAT(
                    CONCAT(
                        s.name,
                        ': ',
                        ps.quantity
                    )
                    ORDER BY s.name
                    SEPARATOR ' | '
                ) AS stock_info

            FROM products p

            LEFT JOIN categories c
                ON c.id = p.category_id

            LEFT JOIN product_stores ps
                ON ps.product_id = p.id

            LEFT JOIN stores s
                ON s.id = ps.store_id

            WHERE s.company_id = ?
            AND p.archived = 0

            GROUP BY p.id

            ORDER BY p.name
            `,
            [
                req.session.user.company_id
            ]
        );

    res.render('products', {
        titleKey: 'title.products',
        activeMenu: 'products',
        products,
        importSuccess,
        productSuccess,
        
        script: [
            {
                src: 'products.js'
            }
        ],
        style: [
            {
                href: 'products.css'
            }
        ],
        breadcrumbs: [
            {
                title: req.__('title.dashboard'),
                url: '/'
            },
            {
                title: req.__('title.products')
            }
        ]
    });

});
// Роут страныцы добавлени товара
app.get('/products/add', auth, async (req, res) => {
     const [categories] = await db.query(
        `SELECT *
         FROM categories
         WHERE company_id = ?
         ORDER BY name`,
        [req.session.user.company_id]
    );

    const [stores] = await db.query(
        `SELECT *
         FROM stores
         WHERE company_id = ?
         ORDER BY name`,
        [req.session.user.company_id]
    );

    res.render('add-product', {
        titleKey: 'title.addProducts',
        activeMenu: 'products',
        categories,
        stores,
        script: [
            {
                src: 'add-products.js'
            }
        ],
        style: [
            {
                href: 'add-products.css'
            }
        ],
        breadcrumbs: [
            {
                title: req.__('title.dashboard'),
                url: '/'
            },
            {
                title: req.__('title.products'),
                url: '/products'
            },
            {
                title: req.__('title.addProducts'),
                
            }
        ]
    });

});
// Роут создает новый тавар
app.post('/products/add', uploadProduct.single('image'), async (req, res) => {

        try {

            const {
                category_id,
                name,
                unit,
                sku,
                barcode,
                purchase_price,
                sale_price,
                description,
                location,
            } = req.body;

            const image = req.file
                ? '/uploads/products/' + req.file.filename
                : '/img/no-image.png';

            const [result] = await db.query(
                `
                INSERT INTO products
                (
                    category_id,
                    name,
                    unit,
                    sku,
                    barcode,
                    purchase_price,
                    sale_price,
                    image,
                    description
                )
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
                `,
                [
                    category_id,
                    name,
                    unit,
                    sku,
                    barcode,
                    purchase_price,
                    sale_price,
                    image,
                    description
                ]
            );

            const productId = result.insertId;

            const [stores] = await db.query(
                `
                SELECT id
                FROM stores
                WHERE company_id = ?
                `,
                [
                    req.session.user.company_id
                ]
            );

            for (const store of stores) {

                const quantity =
                    Number(
                        req.body[
                            `quantity_${store.id}`
                        ]
                    ) || 0;

                const location =
                    req.body[
                        `location_${store.id}`
                    ] || '';

                if (
                    quantity <= 0 &&
                    !location.trim()
                ) {
                    continue;
                }

                await db.query(
                    `
                    INSERT INTO product_stores
                    (
                        product_id,
                        store_id,
                        quantity,
                        location
                    )
                    VALUES (?, ?, ?, ?)
                    `,
                    [
                        productId,
                        store.id,
                        quantity,
                        location
                    ]
                );

            }

            req.session.productSuccess =
                'Товар успешно добавлен';

            res.redirect('/products');

        } catch (error) {

            console.error(error);

            res.status(500).send(
                error.message
            );

        }

    }
);
// Роут создает новую ктегорию
app.post('/categories/ajax-create', async (req, res) => {

    const { name } = req.body;

    const [result] = await db.query(
        `INSERT INTO categories
        (name, company_id)
        VALUES (?, ?)`,
        [
            name,
            req.session.user.company_id
        ]
    );

    res.json({
        success: true,
        id: result.insertId,
        name
    });

});

app.get(
    '/products/view/:id',
    auth,
    async (req, res) => {

        try {

            const [[product]] =
                await db.query(`
                    SELECT
                        p.*,
                        c.name AS category_name
                    FROM products p

                    LEFT JOIN categories c
                        ON c.id = p.category_id

                    WHERE p.id = ?
                `, [
                    req.params.id
                ]);

            if (!product) {

                return res.status(404).send(
                    'Товар не найден'
                );

            }

            const [storeStocks] =
                await db.query(`
                    SELECT
                        s.name,
                        ps.quantity,
                        ps.location
                    FROM product_stores ps

                    INNER JOIN stores s
                        ON s.id = ps.store_id

                    WHERE ps.product_id = ?

                    ORDER BY s.name
                `, [
                    req.params.id
                ]);

            res.render(
                'product-view',
                {
                    product,
                    storeStocks,

                    activeMenu: 'products',

                    script: [
                        {
                            src: 'product-view.js'
                        }
                    ],

                    style: [
                        {
                            href: 'product-view.css'
                        }
                    ],
                    breadcrumbs: [
                        {
                            title: req.__('title.dashboard'),
                            url: '/'
                        },
                        {
                            title: req.__('title.products'),
                            url: '/products'
                        },
                        {
                            title: req.__('title.product-edit'),
                            
                        }
                    ]
                }
            );

        } catch (error) {

            console.error(error);

            res.status(500).send(
                error.message
            );

        }

    }
);
app.get('/products/edit/:id',auth, async (req, res) => {

        try {
            const [categories] =
                await db.query(
                    `
                    SELECT *
                    FROM categories
                    WHERE company_id = ?
                    ORDER BY name
                    `,
                    [
                        req.session.user.company_id
                    ]
                );

            const [rows] = await db.query(`
                SELECT
                    p.*,
                    c.name AS category_name,
                    s.name AS store_name
                FROM products p

                LEFT JOIN categories c
                    ON c.id = p.category_id

                LEFT JOIN product_stores ps
                    ON ps.product_id = p.id

                LEFT JOIN stores s
                    ON s.id = ps.store_id

                WHERE p.id = ?
            `, [req.params.id]);

            const product = rows[0];

            const [stores] = await db.query(`
                SELECT *
                FROM stores
                WHERE company_id = ?
                ORDER BY name
            `, [
                req.session.user.company_id
            ]);

            const [storeStocks] = await db.query(`
                SELECT
                    s.id,
                    s.name,
                    COALESCE(ps.quantity, 0) AS quantity,
                    COALESCE(ps.location, '') AS location
                FROM stores s

                LEFT JOIN product_stores ps
                    ON ps.store_id = s.id
                    AND ps.product_id = ?

                WHERE s.company_id = ?

                ORDER BY s.name
            `, [
                req.params.id,
                req.session.user.company_id
            ]);

            res.render(
                'product-edit',
                {
                    stores,
                    storeStocks,
                    product,
                    categories,
                    activeMenu: 'products',
                    script: [{src: 'product-edit.js'}],
                    style: [{href: 'product-edit.css'}],
                    breadcrumbs: [{title: req.__('title.dashboard'),url: '/'},{title: req.__('title.products'),url: '/products'},{title: req.__('title.product-edit')}]   
                }
            );

        } catch (error) {

            console.error(error);

            res.status(500).send(
                error.message
            );

        }

    }
);

app.post('/products/edit/:id',auth,uploadProduct.single('image'),async (req, res) => {
        try {
            const productId = req.params.id;
            const {
                name,
                unit,
                category_id,
                purchase_price,
                sale_price,
                description,
                location,
            } = req.body;
            const sku = req.body.sku?.trim() || null;
            const barcode = req.body.barcode?.trim() || null;
            
            let sql = `
                UPDATE products
                SET
                    name = ?,
                    unit = ?,
                    sku = ?,
                    barcode = ?,
                    category_id = ?,
                    purchase_price = ?,
                    sale_price = ?,
                    description = ?
            `;

            const params = [
                name,
                unit,
                sku,
                barcode ,
                category_id,
                purchase_price,
                sale_price,
                description
            ];

            if (req.file) {

                sql += `,
                    image = ?
                `;

                params.push(
                    '/uploads/products/' +
                    req.file.filename
                );

            }

            sql += `
                WHERE id = ?
            `;

            params.push(
                req.params.id
            );

            await db.query(
                sql,
                params
            );

            const [stores] = await db.query(`
                SELECT id
                FROM stores
                WHERE company_id = ?
            `, [
                req.session.user.company_id
            ]);

            for (const store of stores) {

                const quantity =
                    Number(
                        req.body[
                            `quantity_${store.id}`
                        ]
                    ) || 0;

                const location =
                    req.body[
                        `location_${store.id}`
                    ] || '';

                await db.query(
                    `
                    INSERT INTO product_stores
                    (
                        product_id,
                        store_id,
                        quantity,
                        location
                    )
                    VALUES
                    (
                        ?, ?, ?, ?
                    )

                    ON DUPLICATE KEY UPDATE

                        quantity =
                            VALUES(quantity),

                        location =
                            VALUES(location)
                    `,
                    [
                        req.params.id,
                        store.id,
                        quantity,
                        location
                    ]
                );

            }

            req.session.productSuccess = 'Товар успешно обновлён';

            res.redirect(
                '/products'
            );

        } catch (error) {

            console.error(error);

            res.status(500).send(
                error.message
            );

        }

    }
);

// Архевирует 

app.get(
    '/products/archive/:id',
    auth,
    async (req, res) => {

        try {

            await db.query(`
                UPDATE products
                SET archived = 1
                WHERE id = ?
            `, [
                req.params.id
            ]);

            req.session.productSuccess =
                'Товар перемещён в архив';

            res.redirect('/products');

        } catch (error) {

            console.error(error);

            res.status(500).send(
                error.message
            );

        }

    }
);

app.get('/products/import',auth,requireAdmin,async (req, res) => {

        const [stores] =
            await db.execute(
                `
                SELECT *
                FROM stores
                WHERE company_id = ?
                ORDER BY name
                `,
                [
                    req.session.user.company_id
                ]
            );

        res.render('products_import',{
                titleKey: 'Импорт товаров',
                activeMenu: 'products',
                stores,
                user: req.session.user,
                script: [
                    {
                        src: 'products_import.js'
                    }
                ],
                style: [
                    {
                        href: 'products_import.css'
                    }
                ],
                breadcrumbs: [
                    {
                        title: req.__('title.dashboard'),
                        url: '/'
                    },
                    {
                        title: req.__('title.products'),
                        url: '/products'
                    },
                    {
                        title: req.__('title.products_import')
                    }
                ]
                
            }
        );

    }
);
app.post('/products/import/preview',
    auth,
    uploadImport.single('excel'),
    async (req, res) => {

    try{
        
        const XLSX = require('xlsx');
        const workbook =
            XLSX.readFile(req.file.path);

        

        const sheet =
            workbook.Sheets[
                workbook.SheetNames[0]
            ];

        const rows =
            XLSX.utils.sheet_to_json(
                sheet,
                { header: 1 }
            );

        

        res.json({
            success: true,
            rows: rows.slice(0, 20)
        });
    }finally {

            const fs = require('fs');

            if (
                req.file &&
                fs.existsSync(req.file.path)
            ) {

                fs.unlinkSync(
                    req.file.path
                );

            }

        }

    }
);
const importProducts = require('./import/importProducts');

app.post('/products/import', auth, requireAdmin, uploadImport.single('excel'),async (req, res) => {
        
        try {


            const [[userStore]] =
                await db.query(
                    `
                    SELECT store_id
                    FROM user_stores
                    WHERE user_id = ?
                    LIMIT 1
                    `,
                    [
                        req.session.user.id
                    ]
                );

            const storeId =
                    Number(
                        req.body.store_id
                    );

            if (!storeId) {

                return res.status(400).send(
                    'Магазин пользователя не найден'
                );

            }

            const result =
                await importProducts(
                    db,
                    req.file.path,
                    storeId,
                    req.session.user.company_id
                );




            req.session.importSuccess = {
                categoriesCreated: result.categoriesCreated,
                createdCount: result.createdCount,
                updatedCount: result.updatedCount
            };
            
            res.redirect('/products');

        } catch (error) {

            console.error(error);

            res.status(500).send(
                error.message
            );

        }   finally {
            
                const fs =
                    require('fs');

                if (
                    req.file &&
                    fs.existsSync(
                        req.file.path
                    )
                ) {

                    fs.unlinkSync(
                        req.file.path
                    );

                }

        }

    }
);
app.get('/api/products/search', auth, async (req, res) => {
    try {
        const q = req.query.q?.trim() || '';
        if (q.length < 2) {
            return res.json([]);
        }

        const { id: userId, company_id: companyId, role } = req.session.user;

        // Базовая часть запроса для обеих ролей
        let queryStr = `
            SELECT
                p.id,
                p.name,
                p.unit,
                p.sku,
                p.barcode,
                p.sale_price,
                p.image,
                SUM(COALESCE(ps.quantity, 0)) AS quantity,
                GROUP_CONCAT(
                    CONCAT(s.name, ' (', COALESCE(ps.location, '-'), ') : ', COALESCE(ps.quantity, 0))
                    ORDER BY s.name
                    SEPARATOR ' | '
                ) AS stock_info
            FROM products p
        `;

        const queryParams = [];

        if (role === 'admin') {
            // Для админа джоиним все склады этой компании
            queryStr += `
                LEFT JOIN product_stores ps ON ps.product_id = p.id
                LEFT JOIN stores s ON s.id = ps.store_id AND s.company_id = ?
                WHERE p.company_id = ? AND p.archived = 0
            `;
            // Важно: s.company_id в условии JOIN, чтобы LEFT JOIN не ломался,
            // а p.company_id в WHERE, чтобы искать товары только этой компании.
            queryParams.push(companyId, companyId);
        } else {
            // Для менеджера/продавца жестко привязываемся к его доступным складам
            queryStr += `
                INNER JOIN product_stores ps ON ps.product_id = p.id
                INNER JOIN user_stores us ON us.store_id = ps.store_id AND us.user_id = ?
                INNER JOIN stores s ON s.id = ps.store_id
                WHERE p.archived = 0
            `;
            queryParams.push(userId);
        }

        // Общая часть условий поиска и сортировки
        queryStr += `
            AND (
                p.name LIKE ?
                OR p.sku LIKE ?
                OR p.barcode LIKE ?
            )
            GROUP BY p.id
            ORDER BY
                CASE
                    WHEN p.barcode = ? THEN 0
                    WHEN p.sku = ? THEN 1
                    WHEN p.name LIKE ? THEN 2
                    ELSE 3
                END,
                p.sale_price ASC,
                p.name ASC
            LIMIT 30
        `;

        // Добавляем параметры для текстового поиска
        queryParams.push(
            `%${q}%`, `%${q}%`, `%${q}%`, // Для LIKE в WHERE
            q, q, `${q}%`                  // Для CASE в ORDER BY
        );

        const [products] = await db.query(queryStr, queryParams);
        return res.json(products);

    } catch (error) {
        console.error('Ошибка при поиске товаров:', error);
        return res.status(500).json({
            success: false,
            message: 'Внутренняя ошибка сервера'
        });
    }
});

app.get('/api/barcode/generate', auth, async (req, res) => {
        try {

            let barcode;

            while (true) {

                barcode =
                    Math.floor(
                        1000000000000 +
                        Math.random() *
                        9000000000000
                    ).toString();

                const [[exists]] =
                    await db.query(
                        `
                        SELECT id
                        FROM products
                        WHERE barcode = ?
                        LIMIT 1
                        `,
                        [barcode]
                    );

                if (!exists) {
                    break;
                }

            }

            res.json({
                barcode
            });

        } catch (error) {

            console.error(error);

            res.status(500).json({
                success: false
            });

        }

    }
);

app.post(
    '/products/barcode/:id',
    auth,
    async (req, res) => {

        try {

            await db.execute(
                `
                UPDATE products
                SET barcode = ?
                WHERE id = ?
                `,
                [
                    req.body.barcode,
                    req.params.id
                ]
            );

            res.json({
                success: true
            });

        } catch (error) {

            console.error(error);

            res.json({
                success: false
            });

        }

    }
);
app.get('/stores/new', auth, (req, res) => {

    if (!req.session.user || req.session.user.role !== 'admin') {
        return res.redirect('/dashboard');
    }

    res.render('store-add', {
        titleKey: 'title.stores',
        activeMenu: 'settings',
        script: [
            {
                src: 'store-add.js',
            }
        ],
        style: [
            {
                href: 'store-add.css',
            }
        ],
        breadcrumbs: [
            {
                title: req.__('title.dashboard'),
                url: '/'
            },
            {
                title: req.__('title.settings'),
                url: '/settings'
            },
            {
                title: req.__('title.store-add')
            }
        ]
    });

});
app.post('/stores/add', auth, async (req, res) => {

    try {

        if (!req.session.user || req.session.user.role !== 'admin') {
            return res.status(403).send('Доступ запрещён');
        }

        const {
            name,
            address,
            phone
        } = req.body;

        if (!name) {
            return res.send('Введите название магазина');
        }

const [result] = await db.execute(
    `
    INSERT INTO stores
    (
        name,
        address,
        phone,
        status
    )
    VALUES (?, ?, ?, ?)
    `,
    [
        name,
        address,
        phone,
        'active'
    ]
);

const storeId = result.insertId;

await db.execute(
    `
    INSERT INTO user_stores
    (
        user_id,
        store_id
    )
    VALUES (?, ?)
    `,
    [
        req.session.user.id,
        storeId
    ]
);

        res.redirect('/settings?tab=stores');

    } catch (error) {

        console.error(error);

        res.status(500).send('Ошибка добавления магазина');

    }

});
// Вход в аккаунт
app.get('/login', (req, res) => {
    if (req.session.user) {
        return res.redirect('/dashboard');
    }

    const success = req.session.success;
    req.session.success = null;

    res.render('login', {
        titleKey: 'title.login',
        error: null,
        success,
        script: [
            {
                src: 'login.js',
            }
        ],
        style: [
            {
                href: 'login.css',
            }
        ],
    });

});
app.post('/login', async (req, res) => {

    try {

        const {
            login,
            password
        } = req.body;

        const [rows] =
            await db.execute(
                `
                SELECT *
                FROM user
                WHERE login = ?
                `,
                [login]
            );

        

        if (!rows.length) {

            return renderLogin(
                res,
                'Неверный логин или пароль'
            );
        }

        const user =
            rows[0];

        

        const validPassword =
            await bcrypt.compare(
                password,
                user.password
            );

        if (!validPassword) {

            return renderLogin(
                res,
                'Неверный логин или пароль'
            );

        }


        if (user.status === 'blocked') {

            return renderLogin(
                res,
                'Ваш аккаунт заблокирован'
            );

        }

        req.session.user = {

            id: user.id,
            name: user.name,
            login: user.login,
            role: user.role,
            avatar: user.avatar,
            status: user.status,
            phone: user.phone,
            store_id: user.store_id,
            company_id: user.company_id


        };
        await db.query(
            'UPDATE user SET last_login = NOW() WHERE id = ?',
            [user.id]
        );
        res.redirect('/dashboard');

    } catch (error) {

        console.error(error);

        res.send(
            'Ошибка входа'
        );

    }

});
//Регистрация
app.get('/register', (req, res) => {

    res.render('register', {
        titleKey: 'title.register',
        error: null,
        success: null,
         script: [
            {
                src: 'register.js',
            }
        ],
        style: [
            {
                href: 'register.css',
            }
        ],
    });

});
app.post('/register', async (req, res) => {
    
    try {
        const {
            name,
            login,
            email,
            password,
            password2
        } = req.body;

        if (req.body.password !== req.body.password2) {

            return res.render('register', {

                titleKey: 'title.register',

                error: 'Пароли не совпадают'

            });
        }

        const hashedPassword =
            await bcrypt.hash(
                password,
                10
            );

        const [exists] =
            await db.execute(
                `
                SELECT id
                FROM user
                WHERE login = ?
                   OR email = ?
                `,
                [
                    login,
                    email
                ]
            );

        if (exists.length) {

            return res.render('register', {

                titleKey: 'title.register',

                error: 'Пользователь с таким логином или email уже существует'

            });

        }

        const [rows] =
            await db.execute(
                `
                SELECT COALESCE(MAX(id), 0) + 1 AS nextId
                FROM user
                `
            );

        const nextId = rows[0].nextId;
        

        await db.execute(
            `
            INSERT INTO user
            (
                name,
                email,
                login,
                password,
                role,
                avatar,
                created_at
            )
            VALUES (?, ?, ?, ?, ?, ?, ?)
            `,
            [ 
                name,
                email,
                login,
                hashedPassword,
                'admin',
                '/img/default-avatar.png',
                new Date()
            ]
        );
        req.session.success =
            'Пользователь успешно зарегистрирован';

        res.redirect('/login');
        // res.redirect('/login');

    } catch (error) {

        console.error(error);

        res.status(500).send(
            'Ошибка регистрации'
        );

    }

});
app.get('/users/:id', async (req, res) => {

    const [users] =
        await db.execute(
            `
            SELECT *
            FROM user
            WHERE id = ?
            `,
            [req.params.id]
        );

    if (!users.length) {

        return res.redirect('/users');

    }

    const user_st =
        users[0];

    const [stores] =
        await db.execute(
            `
            SELECT s.*
            FROM stores s
            INNER JOIN user_stores us
                ON us.store_id = s.id
            WHERE us.user_id = ?
            `,
            [user_st.id]
        );

    res.render('user', {
        titleKey: 'title.user',
        activeMenu: 'settings',
        user_st,
        stores,
        script: [
            {
                src: 'user.js'
            }
        ],
        style: [
            {
                href: 'user.css'
            }
        ],
        breadcrumbs: [
            {
                title: req.__('title.dashboard'),
                url: '/'
            },
            {
                title: req.__('title.settings'),
                url: '/settings'
            },
            {
                title: req.__('title.user'),
                
            }
        ]
    });

});

app.get('/user/new', auth, async (req, res) => {
    const [stores] =
        await db.execute(
            `
            SELECT s.*
            FROM stores s
            INNER JOIN user_stores us
                ON us.store_id = s.id
            WHERE us.user_id = ?
            ORDER BY s.name
            `,
            [req.session.user.id]
        );
    
    res.render('user_new', {
        titleKey: 'title.user_new',
        activeMenu: 'settings',
        stores,
        script: [
            {
                src: 'user_new.js'
            }
        ],
        style: [
            {
                href: 'user_new.css'
            }
        ],
         breadcrumbs: [
            {
                title: req.__('title.dashboard'),
                url: '/'
            },
            {
                title: req.__('title.settings'),
                url: '/settings'
            },
            {
                title: req.__('title.user_new'), 
            }
        ]

    });

});

app.post('/user/new', auth, upload.single('avatar'),
    async (req, res) => {

        try {

            const {
                name,
                email,
                phone,
                login,
                password,
                role,
                salary,
                position,
                notes,
                hire_date,
                birth_date
            } = req.body;

            const hashedPassword =
                await bcrypt.hash(
                    password,
                    10
                );

            const avatar =
                req.file
                    ? `/uploads/avatars/${req.file.filename}`
                    : '/img/default-avatar.png';

            const [result] =
                await db.execute(
                    `
                    INSERT INTO user
                    (
                        company_id,
                        login,
                        password,
                        name,
                        role,
                        status,
                        avatar,
                        email,
                        phone,
                        notes,
                        salary,
                        hire_date,
                        birth_date,
                        position
                    )
                    VALUES
                    (
                        ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?
                    )
                    `,
                    [
                        req.session.user.company_id,
                        login,
                        hashedPassword,
                        name,
                        role,
                        'active',
                        avatar,
                        email || null,
                        phone || null,
                        notes || null,
                        salary || null,
                        hire_date || null,
                        birth_date || null,
                        position || null
                    ]
                );

            const userId =
                result.insertId;

        

            if (req.body.store_id) {

            await db.execute(
                `
                INSERT INTO user_stores
                (
                    user_id,
                    store_id
                )
                VALUES (?, ?)
                `,
                [
                    userId,
                    req.body.store_id
                ]
            );

            }

            res.redirect(
                `/users/${userId}`
            );

            

        } catch (error) {

            console.error(error);

            res.status(500).send(
                'Ошибка создания сотрудника'
            );

        }

    }
);

app.get('/users/stores/:id', auth, async (req, res) => {

    const userId =
        req.params.id;

    const [user] =
        await db.execute(
            `
            SELECT *
            FROM user
            WHERE id = ?
            `,
            [userId]
        );

    const [stores] =
        await db.execute(
            `
            SELECT *
            FROM stores
            WHERE company_id = ?
            ORDER BY name
            `,
            [
                user[0].company_id
            ]
        );

        const [selectedStores] =
            await db.execute(
                `
                SELECT store_id
                FROM user_stores
                WHERE user_id = ?
                `,
                [userId]
            );


    const selectedIds =
    selectedStores.map(
        item => item.store_id
    );

    res.render('user_stores', {

        user_st: user[0],
        stores,
        selectedStores: selectedIds,

        titleKey: 'title.user_new',
        activeMenu: 'settings',
        script: [
            {
                src: 'user_new.js'
            }
        ],
        style: [
            {
                href: 'user_new.css'
            }
        ],
         breadcrumbs: [
            {
                title: req.__('title.dashboard'),
                url: '/'
            },
            {
                title: req.__('title.settings'),
                url: '/settings'
            },
            {
                title: req.__('title.user_new'), 
            }
        ]

    });

});

app.get('/users/block/:id',requireAdmin, auth, async (req, res) => {

        const userId = Number(req.params.id);
        // нельзя заблокировать самого себя
        if (userId === req.session.user.id) {

            return res.send(
                'Нельзя заблокировать самого себя'
            );

        }
        // сотрудник должен принадлежать текущему админу
        const [rows] =
            await db.execute(
                `
                SELECT id
                FROM user
                WHERE id = ?
                AND id_admin = ?
                `,
                [
                    userId,
                    req.session.user.id
                ]
            );

        if (!rows.length) {

            return res.status(403).send(
                'Доступ запрещён'
            );

        }

        await db.execute(
            `
            UPDATE user
            SET status = 'blocked'
            WHERE id = ?
            `,
            [userId]
        );

        res.redirect(
            `/users/${userId}`
        );

    }
);

app.get('/users/unblock/:id', auth, requireAdmin, async (req, res) => {

    const userId =
        Number(req.params.id);

    const [rows] =
        await db.execute(
            `
            SELECT id
            FROM user
            WHERE id = ?
            AND id_admin = ?
            `,
            [
                userId,
                req.session.user.id
            ]
        );

    if (!rows.length) {

        return res.status(403).send(
            'Доступ запрещён'
        );

    }

    await db.execute(
        `
        UPDATE user
        SET status = 'active'
        WHERE id = ?
        `,
        [userId]
    );

    res.redirect(
        `/users/${userId}`
    );

});

app.get('/users/delete/:id', auth,requireAdmin, async (req, res) => {

    const userId =
        req.params.id;

    if (Number(req.params.id) === req.session.user.id) {

        return res.send(
            'Нельзя удалить самого себя'
        );

    }

    await db.execute(
        `
        DELETE
        FROM user_stores
        WHERE user_id = ?
        `,
        [userId]
    );

    await db.execute(
        `
        DELETE
        FROM user
        WHERE id = ?
        `,
        [userId]
    );

    res.redirect('/settings?tab=users');

});

app.post('/users/stores/:id', auth, async (req, res) => {

    const userId = req.params.id;

    const stores =
        Array.isArray(req.body.stores)
            ? req.body.stores
            : req.body.stores
                ? [req.body.stores]
                : [];

    await db.execute(
        `
        DELETE
        FROM user_stores
        WHERE user_id = ?
        `,
        [userId]
    );

    for (const storeId of stores) {

        await db.execute(
            `
            INSERT INTO user_stores
            (
                user_id,
                store_id
            )
            VALUES (?, ?)
            `,
            [
                userId,
                storeId
            ]
        );

    }

    res.redirect(`/users/${userId}`);

});

// Выход из акаунта
app.get('/logout', (req, res) => {

    req.session.destroy(() => {

        res.redirect('/login');

    });

});
app.get('/invoice/:id/delete-item/:index', auth, (req, res) => {

    const invoiceId =
        req.params.id;

    const itemIndex =
        Number(req.params.index);

    const filePath = path.join(
        __dirname,
        'data',
        'invoices',
        `${invoiceId}.json`
    );

    if (!fs.existsSync(filePath)) {

        return res.redirect('/sales');

    }

    const invoice = JSON.parse(
        fs.readFileSync(
            filePath,
            'utf8'
        )
    );

    invoice.items.splice(
        itemIndex,
        1
    );

    invoice.total =
        invoice.items.reduce(
            (sum, item) =>
                sum + Number(item.sum),
            0
        );

    fs.writeFileSync(
        filePath,
        JSON.stringify(
            invoice,
            null,
            2
        )
    );

    res.redirect(
        `/invoices/${invoiceId}`
    );

});

app.post('/invoice/status/:id', auth, (req, res) => {

    const invoiceId =
        req.params.id;

    const filePath = path.join(
        __dirname,
        'data',
        'invoices',
        `${invoiceId}.json`
    );

    if (!fs.existsSync(filePath)) {

        return res.redirect('/sales');

    }

    const invoice = JSON.parse(
        fs.readFileSync(
            filePath,
            'utf8'
        )
    );

    invoice.status =
        req.body.status;

    fs.writeFileSync(
        filePath,
        JSON.stringify(
            invoice,
            null,
            2
        )
    );

    res.redirect(
        `/invoices/${invoiceId}`
    );

});
app.post('/invoice/delete/:id', auth, (req, res) => {

    const filePath = path.join(
        __dirname,
        'data',
        'invoices',
        `${req.params.id}.json`
    );

    if (fs.existsSync(filePath)) {

        fs.unlinkSync(filePath);

    }

    res.redirect('/sales');

});
app.get('/invoice/delete/:id', auth, (req, res) => {

    const invoiceId =
        req.params.id;

    const filePath = path.join(
        __dirname,
        'data',
        'invoices',
        `${invoiceId}.json`
    );

    if (fs.existsSync(filePath)) {

        fs.unlinkSync(filePath);

    }

    res.redirect('/sales');

});
app.get('/settings', auth, async(req, res) => {
    if (
        !req.session.user ||
        req.session.user.role !== 'admin'
    ) {

        return res.redirect('/dashboard');

    }

   
    const [stores] = await db.execute(
        `
        SELECT * FROM stores 
        WHERE company_id = ?
        ORDER BY name ASC
        `,
        [req.session.user.company_id] // Здесь company_id используется абсолютно правильно
    );
    const [users] =
    await db.execute(
        `
        SELECT *
        FROM user
        WHERE company_id = ?
        ORDER BY name
        `,
        [req.session.user.company_id]
    );

    const tab =
        req.query.tab || 'company';
    res.render('settings', {
        titleKey: 'title.settings',
        activeMenu: 'settings',
        activeSettingsTab: tab,
        stores,
        users,
        script: [
            {
                src: 'settings.js'
            }
        ],
        style: [
            {
                href: 'settings.css'
            }
        ],
        breadcrumbs: [
            {
                title: req.__('title.dashboard'),
                url: '/'
            },
            {
                title: req.__('title.settings'),
                
            }
        ]
    });

});

// Переключение языка
app.get('/lang/:lang', (req, res) => {
    const lang = req.params.lang;

    if (['ru', 'uk'].includes(lang)) {
        res.cookie('lang', lang, {
            maxAge: 365 * 24 * 60 * 60 * 1000
        });
    }

    res.redirect(req.get('Referer') || '/');
});

app.get(
    '/barcode/:code',
    async (req, res) => {

        try {

            const png =
                await bwipjs.toBuffer({

                    bcid: 'code128',

                    text:
                        req.params.code,

                    scale: 3,

                    height: 10,

                    includetext: true,

                    textxalign: 'center'

                });

            res.type('png');

            res.send(png);

        } catch (err) {

            res.status(500).send(
                err.message
            );

        }

    }
);

app.get(
    '/products/label/:id',
    auth,
    async (req, res) => {

        const [[product]] =
            await db.query(
                `
                SELECT *
                FROM products
                WHERE id = ?
                `,
                [
                    req.params.id
                ]
            );

        const doc =
            new PDFDocument({
                size: [
                    200,
                    120
                ],
                margin: 10
            });

        res.setHeader(
            'Content-Type',
            'application/pdf'
        );

        doc.pipe(res);

        doc.font('./public/fonts/DejaVu_Sans.ttf');

doc
    .fontSize(9)
    .text(
        product.name,
        10,
        10,
        {
            width: 180,
            align: 'center'
        }
    );

doc
    .fontSize(22)
    .text(
        `${product.sale_price} ₴`,
        10,
        45,
        {
            width: 180,
            align: 'center'
        }
    );

        // ШТРИХКОД

        if (product.barcode) {

            const barcode =
                await bwipjs.toBuffer({

                    bcid: 'code128',

                    text:
                        product.barcode,

                    scale: 2,

                    height: 10

                });

           doc.image(
            barcode,
            20,
            80,
            {
                width: 160
            }
        );

        }

        doc.end();

    }
);


app.get('/finance/cash', auth, async (req, res) => {
    try {
        const companyId = req.session.user.company_id;
        const currentUser = req.session.user; // Данные текущего авторизованного юзера

        // 1. Считаем общую выручку всей компании (Наличные и Карты)
        const [[salesTotals]] = await db.query(
            `SELECT 
                SUM(CASE WHEN payment_method = 'cash' THEN total ELSE 0 END) AS sales_cash,
                SUM(CASE WHEN payment_method = 'card' THEN total ELSE 0 END) AS sales_card
            FROM sales WHERE company_id = ?`,
            [companyId]
        );

        // 2. Считаем общие ручные транзакции всей компании
        const [[transTotals]] = await db.query(
            `SELECT 
                SUM(CASE WHEN payment_method = 'cash' AND type = 'income' THEN amount 
                         WHEN payment_method = 'cash' AND type = 'expense' THEN -amount ELSE 0 END) AS trans_cash,
                SUM(CASE WHEN payment_method = 'card' AND type = 'income' THEN amount 
                         WHEN payment_method = 'card' AND type = 'expense' THEN -amount ELSE 0 END) AS trans_card
            FROM transactions WHERE company_id = ?`,
            [companyId]
        );

        const cashBalance = Number(salesTotals.sales_cash || 0) + Number(transTotals.trans_cash || 0);
        const cardBalance = Number(salesTotals.sales_card || 0) + Number(transTotals.trans_card || 0);
        const totalBalance = cashBalance + cardBalance;

        // 3. НОВОЕ: Получаем баланс кассы в разрезе КАЖДОГО СОТРУДНИКА
        // Считаем сколько наличных и карт принял/потратил каждый юзер
        const [employeeCashes] = await db.query(
            `
            SELECT 
                u.id AS user_id,
                u.name AS user_name,
                u.role AS user_role,
                (
                    SELECT COALESCE(SUM(s.total), 0) 
                    FROM sales s 
                    WHERE s.user_id = u.id AND s.payment_method = 'cash'
                ) + (
                    SELECT COALESCE(SUM(CASE WHEN t.type = 'income' THEN t.amount ELSE -t.amount END), 0)
                    FROM transactions t 
                    WHERE t.user_id = u.id AND t.payment_method = 'cash'
                ) AS employee_cash,
                (
                    SELECT COALESCE(SUM(s.total), 0) 
                    FROM sales s 
                    WHERE s.user_id = u.id AND s.payment_method = 'card'
                ) + (
                    SELECT COALESCE(SUM(CASE WHEN t.type = 'income' THEN t.amount ELSE -t.amount END), 0)
                    FROM transactions t 
                    WHERE t.user_id = u.id AND t.payment_method = 'card'
                ) AS employee_card
            FROM user u
            WHERE u.company_id = ?
            ORDER BY u.name ASC
            `,
            [companyId]
        );

        // 4. РЕШЕНИЕ: Принудительная конвертация кодировок для UNION ALL
        const [history] = await db.query(
            `
            (SELECT 
                CONVERT('Продажа' USING utf8mb4) as source, 
                CONVERT(s.invoice_number USING utf8mb4) as doc_num, 
                s.total as amount, 
                CONVERT(s.payment_method USING utf8mb4) as payment_method, 
                CONVERT('income' USING utf8mb4) as type, 
                CONVERT(u.name USING utf8mb4) as employee_name, 
                CONVERT('Продажа товаров' USING utf8mb4) as details, 
                s.created_at 
             FROM sales s
             LEFT JOIN user u ON u.id = s.user_id
             WHERE s.company_id = ?)
            UNION ALL
            (SELECT 
                CONVERT('Касса' USING utf8mb4) as source, 
                CONVERT(t.id USING utf8mb4) as doc_num, 
                t.amount, 
                CONVERT(t.payment_method USING utf8mb4) as payment_method, 
                CONVERT(t.type USING utf8mb4) as type, 
                CONVERT(u.name USING utf8mb4) as employee_name, 
                CONVERT(t.description USING utf8mb4) as details, 
                t.created_at 
             FROM transactions t
             LEFT JOIN user u ON u.id = t.user_id
             WHERE t.company_id = ?)
            ORDER BY created_at DESC LIMIT 50
            `,
            [companyId, companyId]
        );

        res.render('finance-cash', {
            titleKey: 'Финансы',
            cashBalance,
            cardBalance,
            totalBalance,
            employeeCashes, // Передаем кассы сотрудников в шаблон
            currentUser,    // Передаем текущего юзера, чтобы проверять роль в EJS
            history,
            activeMenu: 'finance',
            breadcrumbs: [
                { title: req.__('title.dashboard') || 'Главная', url: '/' },
                { title: 'Касса и Финансы' }
            ]
        });
    } catch (error) {
        console.error(error);
        res.status(500).send('Ошибка сервера');
    }
});

// Не забудьте обновить роут создания ручной транзакции, чтобы писался user_id:
app.post('/finance/transaction', auth, async (req, res) => {
    try {
        const companyId = req.session.user.company_id;
        const userId = req.session.user.id; // ID сотрудника, который делает операцию
        const { type, amount, payment_method, description } = req.body;

        await db.query(
            `INSERT INTO transactions (company_id, user_id, type, amount, payment_method, description) VALUES (?, ?, ?, ?, ?, ?)`,
            [companyId, userId, Number(amount), payment_method, description.trim()]
        );

        res.redirect('/finance/cash');
    } catch (error) {
        console.error(error);
        res.status(500).send('Ошибка');
    }
});
app.listen(port, () => {
    console.log(`Server started on port ${port}`);
});