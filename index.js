const express = require('express');
const XLSX = require('xlsx');
const Fuse = require('fuse.js');
const cookieParser = require('cookie-parser');
const i18n = require('i18n');
const session = require('express-session');
const statuses = require('./config/statuses');
const roles = require('./config/roles');
const db = require('./config/db');
const bcrypt = require('bcrypt');
const upload = require('./config/upload');
const bwipjs = require('bwip-js');
const multer = require('multer');
const port = 3000;


const fs = require('fs');
const path = require('path');
const { name } = require('ejs');


const app = express();

app.set('view engine', 'ejs');
app.use(express.static('public'));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use(session({
    secret: 'mycrm_secret',
    resave: false,
    saveUninitialized: false
}));

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
// Сохранение чека
function getNextInvoiceNumber() {

    const dir = path.join(__dirname, 'data', 'invoices');

    if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
    }

    const files = fs.readdirSync(dir);

    let max = 0;

    files.forEach(file => {

        if (file.endsWith('.json')) {

            const num = parseInt(
                file.replace('.json', '')
            );

            if (!isNaN(num) && num > max) {
                max = num;
            }
        }

    });

    return String(max + 1).padStart(6, '0');
}
function renderDashboard(req, res) {
  

    const nextInvoiceNumber =
        getNextInvoiceNumber();

    const invoicesDir = path.join(
        __dirname,
        'data',
        'invoices'
    );

    let invoices = [];

    if (fs.existsSync(invoicesDir)) {

        const files = fs.readdirSync(invoicesDir);

        invoices = files.map(file => {

            return JSON.parse(
                fs.readFileSync(
                    path.join(invoicesDir, file),
                    'utf8'
                )
            );

        });

    }

    const today =
        new Date().toISOString().split('T')[0];

    const salesToday =
        invoices
            .filter(
                invoice => invoice.date === today &&
                invoice.status === 'completed'
            )
            .reduce(
                (sum, invoice) =>
                    sum + Number(invoice.total),
                0
            );

    const invoicesToday =
        invoices.filter(
            invoice => invoice.date === today &&
            invoice.status === 'completed'
        ).length;

    const clientsCount =
        new Set(
            invoices.map(
                invoice => invoice.customer
            )
        ).size;

    const productsCount =
        invoices.reduce(
            (total, invoice) =>
                total +
                (invoice.items
                    ? invoice.items.length
                    : 0),
            0
        );
    const productsToday =
    invoices
        .filter(invoice =>
            invoice.date === today &&
            invoice.status === 'completed'
        )
        .reduce((total, invoice) => {

            const items =
                invoice.items || [];

            return total +
                items.reduce(
                    (sum, item) =>
                        sum + Number(item.qty || 0),
                    0
                );

        }, 0);

    invoices.sort((a, b) =>
        Number(b.number) -
        Number(a.number)
    );

    const latestInvoices =
        invoices.slice(0, 10);

    res.render('dashboard', {
        titleKey: 'title.dashboard',
        activeMenu: 'dashboard',

        nextInvoiceNumber,

        invoices: latestInvoices,

        salesToday,
        invoicesToday,
        clientsCount,
        productsCount,
        productsToday,
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

    res.render('sale-view', {
        titleKey: 'Чек',
        sale,
        items,
        activeMenu: 'sales',
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
                title: `Чек №${sale.invoice_number}`
            }
        ]
    });

});

// Сохранение чека
app.post('/sales/save', auth, async (req, res) => {

    try {

        const {
            customer_id,
            payment_method,
            total,
            items
        } = req.body;

        const company_id =
            req.session.user.company_id;

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

        const store_id =
            userStore?.store_id || 1;

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
            await db.execute(
                `
                INSERT INTO sales
                (
                    company_id,
                    invoice_number,
                    customer_id,
                    user_id,
                    store_id,
                    total,
                    payment_method,
                    status,
                    created_at
                )
                VALUES
                (
                    ?, ?, ?, ?, ?, ?, ?, ?, ?
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
                    payment_method,
                    'completed',
                    created_at
                ]
            );

        const saleId =
            saleResult.insertId;

        for (const item of items) {

            const subtotal =
                Number(item.quantity) *
                Number(item.price);

            await db.execute(
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

            await db.execute(
                `
                UPDATE products
                SET quantity =
                    quantity - ?
                WHERE id = ?
                `,
                [
                    item.quantity,
                    item.product_id
                ]
            );

        }

        res.json({
            success: true,
            sale_id: saleId,
            invoice_number: invoiceNumber
        });

    } catch (error) {

        console.error(error);

        res.status(500).json({
            success: false,
            error: error.message
        });

    }

});

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
app.get('/invoices/:id', auth, (req, res) => {

    const id = req.params.id;

    const filePath = path.join(
        __dirname,
        'data',
        'invoices',
        `${id}.json`
    );

    if (!fs.existsSync(filePath)) {
        return res.status(404).send('Чек не найден');
    }

    const invoice = JSON.parse(
        fs.readFileSync(filePath, 'utf8')
    );

    res.render('invoices', {
        titleKey: req.__('title.invoices'),
        invoice,
        invoiceId: id,
        activeMenu: 'sales',
        statuses,
        script: [
            {
                src: 'invoices.js',
            }
        ],
        style: [
            {
                href: 'invoices.css',
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
                title: req.__('title.invoices'),
            }
        ]
    });

});
// Роутер товаров
app.get('/products', auth, async (req, res) => {

    const success =
        req.session.success;

    req.session.success =
        null;

    const [products] =
        await db.execute(
            `
            SELECT
                p.*,
                c.name AS category_name,
                s.name AS store_name
            FROM products p
            LEFT JOIN categories c
                ON c.id = p.category_id
            INNER JOIN user_stores us
                ON us.store_id = p.store_id
            INNER JOIN stores s
                ON s.id = p.store_id
            WHERE us.user_id = ?
            ORDER BY p.name
            `,
            [
                req.session.user.id
            ]
        );

    res.render('products', {
        titleKey: 'title.products',
        activeMenu: 'products',
        products,
        success,
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

            if (!product) {

                return res.redirect(
                    '/products'
                );

            }

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

            res.render(
                'product-edit',
                {
                    product,
                    categories,
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
                quantity,
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
                    quantity = ?,
                    description = ?
            `;

            const params = [
                name,
                sku,
                barcode,
                category_id,
                purchase_price,
                sale_price,
                quantity,
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

            req.session.success =
                'Товар успешно обновлён';

            res.redirect(
                '/products/view/' +
                req.params.id
            );

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
                SELECT s.*
                FROM stores s
                INNER JOIN user_stores us
                    ON us.store_id = s.id
                WHERE us.user_id = ?
                ORDER BY s.name
                `,
                [
                    req.session.user.id
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
    upload.single('excel'),
    async (req, res) => {
        console.log(req.file);
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

    }
);
const importProducts = require('./import/importProducts');

app.post('/products/import', auth, requireAdmin, upload.single('excel'),async (req, res) => {
        console.log(req.file.path);
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

            req.session.success = {
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

        }

    }
);
app.get('/api/products/search', auth, async (req, res) => {

    try {

        const q =
            req.query.q?.trim() || '';

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
                        p.quantity,
                        s.name AS store_name
                    FROM products p

                    JOIN stores s
                        ON s.id = p.store_id

                    WHERE s.company_id = ?
                    AND (
                        p.name LIKE ?
                        OR p.sku LIKE ?
                        OR p.barcode LIKE ?
                    )

                    ORDER BY p.name
                    LIMIT 30
                    `,
                    [
                        companyId,
                        `%${q}%`,
                        `%${q}%`,
                        `%${q}%`
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
                    p.quantity,
                    s.name AS store_name
                FROM products p

                JOIN user_stores us
                    ON us.store_id = p.store_id

                JOIN stores s
                    ON s.id = p.store_id

                WHERE us.user_id = ?
                AND (
                    p.name LIKE ?
                    OR p.sku LIKE ?
                    OR p.barcode LIKE ?
                )

                ORDER BY p.name
                LIMIT 30
                `,
                [
                    req.session.user.id,
                    `%${q}%`,
                    `%${q}%`,
                    `%${q}%`
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
        SELECT s.*
        FROM stores s
        INNER JOIN user_stores us
            ON us.store_id = s.id
        WHERE us.user_id = ?
        ORDER BY s.name
        `,
        [req.session.user.id]
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

    res.render('user_stores', {

        user_st: user[0],
        stores,
        selectedStores,

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
app.listen(port, () => {
    console.log(`Server started on port ${port}`);
});