const express = require('express');
const router = express.Router();
const db = require('../config/db');
const auth = require('../middleware/auth');
const uploadProduct = require('../config/uploadProduct');
const requireAdmin = require('../middleware/requireAdmin');
const PDFDocument = require('pdfkit');
const bwipjs = require('bwip-js');
// Роутер товаров с фильтрацией по категориям
router.get('/', auth, async (req, res) => {
    try {
        const companyId = req.session.user.company_id;
        
        // 1. Получаем выбранную категорию из GET-запроса (по умолчанию 'all')
        const categoryId = req.query.categoryId || 'all';

        const importSuccess = req.session.importSuccess;
        const productSuccess = req.session.productSuccess;
        
        req.session.importSuccess = null;
        req.session.productSuccess = null;

        // 2. Получаем ВСЕ категории компании для выпадающего списка в фильтре
        const [categories] = await db.execute(
            `SELECT id, name FROM categories WHERE company_id = ? ORDER BY name ASC`,
            [companyId]
        );

        // 3. Динамически формируем условия SQL-запроса для товаров
        let productsSql = `
            SELECT
                p.*,
                c.name AS category_name,
                SUM(COALESCE(ps.quantity, 0)) AS quantity,
                GROUP_CONCAT(
                    CONCAT(s.name, ': ', ps.quantity)
                    ORDER BY s.name
                    SEPARATOR ' | '
                ) AS stock_info
            FROM products p
            LEFT JOIN categories c ON c.id = p.category_id
            LEFT JOIN product_stores ps ON ps.product_id = p.id
            LEFT JOIN stores s ON s.id = ps.store_id
            WHERE s.company_id = ? AND p.archived = 0
        `;
        
        const queryParams = [companyId];

        // Если выбрана конкретная категория — добавляем фильтр в SQL
        if (categoryId !== 'all') {
            productsSql += ` AND p.category_id = ?`;
            queryParams.push(categoryId);
        }

        productsSql += ` GROUP BY p.id ORDER BY p.name`;

        // Выполняем запрос товаров
        const [products] = await db.execute(productsSql, queryParams);

        // 4. Рендерим шаблон и передаем массив категорий и выбранный ID назад в EJS
        res.render('products', {
            titleKey: 'title.products',
            activeMenu: 'products',
            products,
            categories,      // Передаем список категорий
            categoryId,      // Передаем текущий активный фильтр
            importSuccess,
            productSuccess,
            script: [{ src: 'products.js' }],
            style: [{ href: 'products.css' }],
            breadcrumbs: [
                { title: req.__('title.dashboard'), url: '/' },
                { title: req.__('title.products') }
            ]
        });

    } catch (error) {
        console.error('Ошибка в роутере товаров:', error);
        res.status(500).send('Ошибка сервера');
    }
});
// Роут страныцы добавлени товара
router.get('/add', auth, async (req, res) => {
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
router.post('/add', uploadProduct.single('image'), async (req, res) => {

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
router.get('/view/:id',auth,async (req, res) => {
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
router.get('/edit/:id',auth, async (req, res) => {

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
router.post('/edit/:id',auth,uploadProduct.single('image'),async (req, res) => {
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

router.get('/archive/:id',auth, async (req, res) => {

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



router.post('/barcode/:id',auth, async (req, res) => {

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

router.get('/label/:id',auth, async (req, res) => {

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

module.exports = router;