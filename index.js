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
const axios = require('axios');
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

let exchangeRates = {
    USD: 41.7,
    EUR: 48.7
};

async function updateRates() {

    try {

        const { data } = await axios.get(
            'https://api.privatbank.ua/p24api/pubinfo?exchange&json&coursid=11'
        );

        exchangeRates.USD =
            parseFloat(
                data.find(x => x.ccy === 'USD').sale
            );

        exchangeRates.EUR =
            parseFloat(
                data.find(x => x.ccy === 'EUR').sale
            );

    } catch (err) {

        console.error('Ошибка получения курса:', err.message);

    }

}

updateRates();
setInterval(updateRates, 60 * 60 * 1000);

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
  
    const [[salesTodayRow]] =
        await db.query(`
            SELECT
                COALESCE(SUM(total),0) AS total,
                COUNT(*) AS invoices
            FROM sales
            WHERE DATE(created_at)=CURDATE()
            AND status IN (
                'completed',
                'partial_return',
                'returned'
            )
        `);

    const [[returnsTodayRow]] =
        await db.query(`
            SELECT
                COALESCE(SUM(total),0) AS total
            FROM sale_returns
            WHERE DATE(created_at)=CURDATE()
        `);

    const [[clientsRow]] =
        await db.query(`
            SELECT COUNT(*) AS total
            FROM customers
        `);

    const [[productsTodayRow]] =
        await db.query(`
            SELECT
                COALESCE(
                    SUM(si.quantity),
                    0
                ) AS total
            FROM sale_items si
            JOIN sales s
                ON s.id = si.sale_id
            WHERE DATE(s.created_at)=CURDATE()
        `);

    const [latestSales] =
        await db.query(`
            SELECT *
            FROM sales
            ORDER BY id DESC
            LIMIT 10
        `);

const [topProducts] =
    await db.query(
        `
        SELECT
            p.name,

            SUM(si.quantity)
                AS total_qty,

            SUM(si.subtotal)
                AS total_sales

        FROM sale_items si

        JOIN products p
            ON p.id = si.product_id

        JOIN sales s
            ON s.id = si.sale_id

        WHERE s.created_at >=
            DATE_SUB(
                NOW(),
                INTERVAL 7 DAY
            )

        GROUP BY
            p.id,
            p.name

        ORDER BY
            total_qty DESC

        LIMIT 10
        `
    );


    const salesToday =
        Number(salesTodayRow.total);

    const returnsToday =
        Number(returnsTodayRow.total);

    const incomeToday =
        salesToday - returnsToday;
    
    res.render('dashboard', {
        titleKey: 'title.dashboard',
        activeMenu: 'dashboard',

        salesToday: incomeToday,

        grossSalesToday: salesToday,

        returnsToday,
        topProducts,
        invoicesToday:
            salesTodayRow.invoices,

        clientsCount:
            clientsRow.total,

        productsToday:
            productsTodayRow.total,

        invoices:
            latestSales,

        statuses,
        script: [
            {
                src: 'dashboard.js',
            }
        ],
        style: [
            {
                href: 'dashboard.css',
            }
        ],
        breadcrumbs: [
            {
                title: req.__('title.dashboard'),
                url: '/'
            }
        ]
    });
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

    const connection =
        await db.getConnection();

    try {

        await connection.beginTransaction();

        const {
            customer_id,
            payment_method,
            total,
            discount_percent,
            discount_amount,
            items
        } = req.body;

        const company_id =
            req.session.user.company_id;

        const [[userStore]] =
            await connection.query(
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

        const store_id =
            userStore?.store_id || 1;

        const year =
            new Date().getFullYear();

        const [[lastSale]] =
            await connection.query(
                `
                SELECT invoice_number
                FROM sales
                WHERE company_id = ?
                AND invoice_number LIKE ?
                ORDER BY id DESC
                LIMIT 1
                `,
                [
                    company_id,
                    `SALE-${year}-%`
                ]
            );

        let nextNumber = 1;

        if (
            lastSale &&
            lastSale.invoice_number
        ) {

            const parts =
                lastSale.invoice_number
                    .split('-');

            nextNumber =
                Number(parts[2]) + 1;

        }

        const invoiceNumber =
            `SALE-${year}-${String(nextNumber)
                .padStart(6, '0')}`;

        const created_at =
            new Date()
                .toLocaleString(
                    'sv-SE',
                    {
                        timeZone:
                            'Europe/Kyiv'
                    }
                );

        const [saleResult] =
            await connection.execute(
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
                    created_at
                )
                VALUES
                (
                    ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?
                )
                `,
                [
                    company_id,
                    invoiceNumber,
                    customer_id > 0
                        ? customer_id
                        : null,
                    req.session.user.id,
                    store_id,
                    total,
                    discount_percent,
                    discount_amount,
                    payment_method,
                    'completed',
                    created_at
                ]
            );

        const saleId =
            saleResult.insertId;

        for (const item of items) {

            const [[stock]] =
                await connection.query(
                    `
                    SELECT quantity
                    FROM product_stores
                    WHERE product_id = ?
                    AND store_id = ?
                    `,
                    [
                        item.product_id,
                        store_id
                    ]
                );

            if (
                !stock ||
                stock.quantity < item.quantity
            ) {

                throw new Error(
                    `Недостаточно остатка: ${item.name}`
                );

            }

            const subtotal =
                Number(item.quantity) *
                Number(item.price);

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
                [
                    saleId,
                    item.product_id,
                    item.quantity,
                    item.price,
                    subtotal
                ]
            );

            await connection.execute(
                `
                UPDATE product_stores
                SET quantity =
                    quantity - ?
                WHERE product_id = ?
                AND store_id = ?
                `,
                [
                    item.quantity,
                    item.product_id,
                    store_id
                ]
            );

        }

        await connection.commit();

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
        usdRate: exchangeRates.USD,
        eurRate: exchangeRates.EUR,
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
app.post(
    '/products/add',
    uploadProduct.single('image'),
    async (req, res) => {

        try {

            const {
                category_id,
                name,
                sku,
                barcode,
                purchase_price,
                sale_price,
                description
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
                    sku,
                    barcode,
                    purchase_price,
                    sale_price,
                    image,
                    description
                )
                VALUES (?, ?, ?, ?, ?, ?, ?, ?)
                `,
                [
                    category_id,
                    name,
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

                if (quantity <= 0) {
                    continue;
                }

                await db.query(
                    `
                    INSERT INTO product_stores
                    (
                        product_id,
                        store_id,
                        quantity
                    )
                    VALUES (?, ?, ?)
                    `,
                    [
                        productId,
                        store.id,
                        quantity
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

            const [rows] =
                await db.execute(
                    `
                    SELECT
                        p.*,
                        c.name AS category_name,
                        s.name AS store_name
                    FROM products p

                    LEFT JOIN categories c
                        ON c.id = p.category_id

                    LEFT JOIN stores s
                        ON s.id = p.store_id

                    WHERE p.id = ?
                    LIMIT 1
                    `,
                    [
                        req.params.id
                    ]
                );

            if (!rows.length) {

                return res
                    .status(404)
                    .send(
                        'Товар не найден'
                    );

            }

            res.render('product-view',{
                    product: rows[0],
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
                            title: req.__('title.product-view'),
                            
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
app.get(
    '/products/edit/:id',
    auth,
    async (req, res) => {

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

                LEFT JOIN stores s
                    ON s.id = p.store_id

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
                    COALESCE(ps.quantity, 0) AS quantity
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
                    usdRate: exchangeRates.USD,
                    eurRate: exchangeRates.EUR,
                    activeMenu: 'products',
                    script: [
                        {
                            src: 'product-edit.js'
                        }
                    ],
                    style: [
                        {
                            href: 'product-edit.css'
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

app.post(
    '/products/edit/:id',
    auth,
    uploadProduct.single('image'),
    async (req, res) => {

        try {

            const {
                name,
                sku,
                barcode,
                category_id,
                purchase_price,
                sale_price,
                description
            } = req.body;

            let sql = `
                UPDATE products
                SET
                    name = ?,
                    sku = ?,
                    barcode = ?,
                    category_id = ?,
                    purchase_price = ?,
                    sale_price = ?,
                    description = ?
            `;

            const params = [
                name,
                sku,
                barcode,
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
                        req.body[`quantity_${store.id}`]
                    ) || 0;

                await db.query(`
                    INSERT INTO product_stores
                    (
                        product_id,
                        store_id,
                        quantity
                    )
                    VALUES (?, ?, ?)

                    ON DUPLICATE KEY UPDATE
                    quantity = VALUES(quantity)
                `, [
                    req.params.id,
                    store.id,
                    quantity
                ]);

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

        const q =
            req.query.q?.trim() || '';

        if (q.length < 2) {

            return res.json([]);

        }

        const companyId =
            req.session.user.company_id;

        const role =
            req.session.user.role;

        // Администратор компании
        if (role === 'admin') {

            const [products] =
                await db.query(
                    `
                    SELECT
                        p.id,
                        p.name,
                        p.sku,
                        p.barcode,
                        p.sale_price,

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

                    LEFT JOIN product_stores ps
                        ON ps.product_id = p.id

                    LEFT JOIN stores s
                        ON s.id = ps.store_id

                    WHERE s.company_id = ?
                    AND p.archived = 0
                    AND (
                        p.name LIKE ?
                        OR p.sku LIKE ?
                        OR p.barcode LIKE ?
                    )

                    GROUP BY p.id

                    ORDER BY

                        CASE

                            WHEN p.barcode = ?
                                THEN 0

                            WHEN p.sku = ?
                                THEN 1

                            WHEN p.name LIKE ?
                                THEN 2

                            ELSE 3

                        END,

                        p.sale_price ASC,

                        p.name ASC

                    LIMIT 30
                    `,
                    [
                        companyId,

                        `%${q}%`,
                        `%${q}%`,
                        `%${q}%`,

                        q,
                        q,
                        `${q}%`
                    ]
                );

            return res.json(products);

        }

        // Менеджер / продавец
        const [products] =
            await db.query(
                `
                SELECT
                    p.id,
                    p.name,
                    p.sku,
                    p.barcode,
                    p.sale_price,

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

                INNER JOIN product_stores ps
                    ON ps.product_id = p.id

                INNER JOIN user_stores us
                    ON us.store_id = ps.store_id

                INNER JOIN stores s
                    ON s.id = ps.store_id

                WHERE us.user_id = ?
                AND p.archived = 0
                AND (
                    p.name LIKE ?
                    OR p.sku LIKE ?
                    OR p.barcode LIKE ?
                )

                GROUP BY p.id

                ORDER BY

                    CASE

                        WHEN p.barcode = ?
                            THEN 0

                        WHEN p.sku = ?
                            THEN 1

                        WHEN p.name LIKE ?
                            THEN 2

                        ELSE 3

                    END,

                    p.sale_price ASC,

                    p.name ASC

                LIMIT 30
                `,
                [
                    req.session.user.id,

                    `%${q}%`,
                    `%${q}%`,
                    `%${q}%`,

                    q,
                    q,
                    `${q}%`
                ]
            );

        res.json(products);

    } catch (error) {

        console.error(error);

        res.status(500).json({
            success: false
        });

    }

});

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
                        id_admin,
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
                        req.session.user.id,
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

   
    const [stores] =
    await db.execute(
        `
        SELECT s.*
        FROM stores s
        INNER JOIN user_stores us
            ON us.store_id = s.id
        WHERE us.user_id = ?
        `,
        [req.session.user.id]
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
app.listen(port, () => {
    console.log(`Server started on port ${port}`);
});