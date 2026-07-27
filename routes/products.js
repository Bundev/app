const express = require('express');
const router = express.Router();
const db = require('../config/db');
const auth = require('../middleware/auth');
const uploadProduct = require('../config/uploadProduct');
const requireAdmin = require('../middleware/requireAdmin');
const PDFDocument = require('pdfkit');
const bwipjs = require('bwip-js');
const page = require('../helpers/page');
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
            ...page(req, 'products', [
                {title: req.__('title.products')}
            ])
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

    res.render('product-add', {
        titleKey: 'title.addProducts',
        activeMenu: 'products',
        categories,
        stores,
        ...page(req, 'product-add', [
                {title: req.__('title.products'),url: '/products'},
                {title: req.__('title.addProducts')}
            ])
       
        
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
                    ...page(req, 'product-view', [
                        {title: req.__('title.products'),url: '/products'},
                        {title: req.__('title.product-edit')}
                    ])
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
                    ...page(req, 'product-edit', [
                        {title: req.__('title.products'),url: '/products'},
                        {title: req.__('title.product-edit')}
                    ])
                       
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

router.post('/sku/:id', auth, async (req, res) => {

    try {

        const sku = String(req.body.sku || '').trim() || null;

        const [result] = await db.execute(
            `
            UPDATE products p
            SET sku = ?
            WHERE p.id = ?
              AND (
                  p.company_id = ?
                  OR EXISTS (
                      SELECT 1
                      FROM product_stores ps
                      INNER JOIN stores s ON s.id = ps.store_id
                      WHERE ps.product_id = p.id AND s.company_id = ?
                  )
              )
            `,
            [
                sku,
                req.params.id,
                req.session.user.company_id,
                req.session.user.company_id
            ]
        );

        if (!result.affectedRows) {
            return res.status(404).json({
                success: false,
                message: 'Товар не найден'
            });
        }

        res.json({
            success: true,
            sku
        });

    } catch (error) {

        console.error(error);

        res.status(500).json({
            success: false,
            message: 'Не удалось сохранить артикул'
        });
    }
});

router.post('/quick-edit/:id', auth, async (req, res) => {

    const editableFields = new Set([
        'name',
        'category_id',
        'purchase_price',
        'sale_price',
        'quantity'
    ]);

    const { field } = req.body;

    if (!editableFields.has(field)) {
        return res.status(400).json({
            success: false,
            message: 'Недопустимое поле для редактирования'
        });
    }

    try {

        const productId = Number(req.params.id);
        const companyId = req.session.user.company_id;
        const [[product]] = await db.execute(
            `
            SELECT p.id
            FROM products p
            WHERE p.id = ?
              AND (
                  p.company_id = ?
                  OR EXISTS (
                      SELECT 1
                      FROM product_stores ps
                      INNER JOIN stores s ON s.id = ps.store_id
                      WHERE ps.product_id = p.id AND s.company_id = ?
                  )
              )
            `,
            [productId, companyId, companyId]
        );

        if (!product) {
            return res.status(404).json({
                success: false,
                message: 'Товар не найден'
            });
        }

        if (field === 'quantity') {

            const quantity = Number(req.body.value);

            if (!Number.isFinite(quantity) || quantity < 0) {
                return res.status(400).json({
                    success: false,
                    message: 'Остаток должен быть числом не меньше нуля'
                });
            }

            const [stocks] = await db.execute(
                `
                SELECT ps.store_id, ps.quantity
                FROM product_stores ps
                INNER JOIN stores s ON s.id = ps.store_id
                WHERE ps.product_id = ? AND s.company_id = ?
                ORDER BY ps.store_id
                `,
                [productId, companyId]
            );

            if (!stocks.length) {

                const [[store]] = await db.execute(
                    `SELECT id FROM stores WHERE company_id = ? ORDER BY id LIMIT 1`,
                    [companyId]
                );

                if (!store) {
                    return res.status(400).json({
                        success: false,
                        message: 'Сначала создайте склад'
                    });
                }

                await db.execute(
                    `INSERT INTO product_stores (product_id, store_id, quantity, location) VALUES (?, ?, ?, '')`,
                    [productId, store.id, quantity]
                );

            } else {

                let remaining = quantity;

                for (const stock of stocks) {

                    const nextQuantity = Math.min(Number(stock.quantity), remaining);

                    await db.execute(
                        `UPDATE product_stores SET quantity = ? WHERE product_id = ? AND store_id = ?`,
                        [nextQuantity, productId, stock.store_id]
                    );

                    remaining -= nextQuantity;
                }

                if (remaining > 0) {
                    await db.execute(
                        `UPDATE product_stores SET quantity = quantity + ? WHERE product_id = ? AND store_id = ?`,
                        [remaining, productId, stocks[0].store_id]
                    );
                }
            }

            return res.json({ success: true, value: quantity });
        }

        let value = req.body.value;

        if (field === 'name') {

            value = String(value || '').trim();

            if (!value) {
                return res.status(400).json({
                    success: false,
                    message: 'Название не может быть пустым'
                });
            }
        }

        if (field === 'purchase_price' || field === 'sale_price') {

            value = Number(value);

            if (!Number.isFinite(value) || value < 0) {
                return res.status(400).json({
                    success: false,
                    message: 'Цена должна быть числом не меньше нуля'
                });
            }
        }

        if (field === 'category_id') {

            value = value ? Number(value) : null;

            if (value !== null) {

                const [[category]] = await db.execute(
                    `SELECT id FROM categories WHERE id = ? AND company_id = ?`,
                    [value, companyId]
                );

                if (!category) {
                    return res.status(400).json({
                        success: false,
                        message: 'Категория не найдена'
                    });
                }
            }
        }

        await db.execute(
            `UPDATE products SET ${field} = ? WHERE id = ?`,
            [value, productId]
        );

        res.json({ success: true, value });

    } catch (error) {

        console.error(error);

        res.status(500).json({
            success: false,
            message: 'Не удалось сохранить изменения'
        });
    }
});

router.get('/stocks/:id', auth, async (req, res) => {

    try {

        const productId = Number(req.params.id);
        const companyId = req.session.user.company_id;
        const [[product]] = await db.execute(
            `
            SELECT p.id
            FROM products p
            WHERE p.id = ?
              AND (
                  p.company_id = ?
                  OR EXISTS (
                      SELECT 1
                      FROM product_stores ps
                      INNER JOIN stores s ON s.id = ps.store_id
                      WHERE ps.product_id = p.id AND s.company_id = ?
                  )
              )
            `,
            [productId, companyId, companyId]
        );

        if (!product) {
            return res.status(404).json({
                success: false,
                message: 'Товар не найден'
            });
        }

        const [stores] = await db.execute(
            `
            SELECT
                s.id,
                s.name,
                COALESCE(ps.quantity, 0) AS quantity
            FROM stores s
            LEFT JOIN product_stores ps
                ON ps.store_id = s.id AND ps.product_id = ?
            WHERE s.company_id = ?
            ORDER BY s.name
            `,
            [productId, companyId]
        );

        res.json({ success: true, stores });

    } catch (error) {

        console.error(error);

        res.status(500).json({
            success: false,
            message: 'Не удалось загрузить остатки'
        });
    }
});

router.post('/stocks/:id', auth, async (req, res) => {

    try {

        const productId = Number(req.params.id);
        const companyId = req.session.user.company_id;
        const requestedStocks = req.body.stocks;

        if (!requestedStocks || typeof requestedStocks !== 'object') {
            return res.status(400).json({
                success: false,
                message: 'Передайте остатки по магазинам'
            });
        }

        const [[product]] = await db.execute(
            `
            SELECT p.id
            FROM products p
            WHERE p.id = ?
              AND (
                  p.company_id = ?
                  OR EXISTS (
                      SELECT 1
                      FROM product_stores ps
                      INNER JOIN stores s ON s.id = ps.store_id
                      WHERE ps.product_id = p.id AND s.company_id = ?
                  )
              )
            `,
            [productId, companyId, companyId]
        );

        if (!product) {
            return res.status(404).json({
                success: false,
                message: 'Товар не найден'
            });
        }

        const [stores] = await db.execute(
            `SELECT id FROM stores WHERE company_id = ?`,
            [companyId]
        );

        const stockUpdates = [];
        let totalQuantity = 0;

        for (const store of stores) {

            const quantity = Number(requestedStocks[store.id]);

            if (!Number.isFinite(quantity) || quantity < 0) {
                return res.status(400).json({
                    success: false,
                    message: 'Остаток каждого магазина должен быть числом не меньше нуля'
                });
            }

            stockUpdates.push({
                storeId: store.id,
                quantity
            });

            totalQuantity += quantity;
        }

        for (const stock of stockUpdates) {

            await db.execute(
                `
                INSERT INTO product_stores (product_id, store_id, quantity, location)
                VALUES (?, ?, ?, '')
                ON DUPLICATE KEY UPDATE quantity = VALUES(quantity)
                `,
                [productId, stock.storeId, stock.quantity]
            );
        }

        res.json({ success: true, totalQuantity });

    } catch (error) {

        console.error(error);

        res.status(500).json({
            success: false,
            message: 'Не удалось сохранить остатки'
        });
    }
});

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
