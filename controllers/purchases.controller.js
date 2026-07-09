const db = require('../config/db');

// ======================================================
// Список закупок
// ======================================================
exports.index = async (req, res) => {
    try {

        const companyId = req.session.user.company_id;

        const [purchases] = await db.execute(
            `
            SELECT
                p.*,
                sup.name AS supplier_name,
                st.name AS store_name,
                DATE_FORMAT(p.date, '%d.%m.%Y') AS formatted_date
            FROM purchases p
            LEFT JOIN suppliers sup
                ON p.supplier_id = sup.id
            LEFT JOIN stores st
                ON p.store_id = st.id
            WHERE p.company_id = ?
            ORDER BY p.date DESC, p.id DESC
            `,
            [companyId]
        );

        res.render('purchases', {
            titleKey: 'title.purchases',
            activeMenu: 'purchases',
            purchases,
            breadcrumbs: [
                {
                    title: req.__('title.dashboard'),
                    url: '/'
                },
                {
                    title: 'Закупівлі'
                }
            ]
        });

    } catch (error) {

        console.error('Ошибка в роутере закупок:', error);

        res.status(500).send('Ошибка сервера');

    }
};


// ======================================================
// Страница создания закупки
// ======================================================
exports.showAdd = async (req, res) => {

    try {

        const companyId = req.session.user.company_id;

        const [suppliers] = await db.execute(
            `
            SELECT id, name
            FROM suppliers
            WHERE company_id = ?
            AND archived = 0
            ORDER BY name ASC
            `,
            [companyId]
        );

        const [stores] = await db.execute(
            `
            SELECT id, name
            FROM stores
            WHERE company_id = ?
            ORDER BY name ASC
            `,
            [companyId]
        );

        const [products] = await db.execute(
            `
            SELECT id, name, purchase_price
            FROM products
            WHERE company_id = ?
            AND archived = 0
            ORDER BY name ASC
            `,
            [companyId]
        );

        res.render('purchases_add', {
            titleKey: 'title.purchases_add',
            activeMenu: 'purchases',
            suppliers,
            stores,
            products,
            breadcrumbs: [
                {
                    title: req.__('title.dashboard'),
                    url: '/'
                },
                {
                    title: 'Закупка',
                    url: '/purchases'
                },
                {
                    title: 'Новая закупка'
                }
            ]
        });

    } catch (error) {

        console.error(error);

        res.status(500).send('Ошибка сервера');

    }

};


// ======================================================
// Просмотр закупки
// ======================================================
exports.view = async (req, res) => {

    try {

        const purchaseId = req.params.id;
        const companyId = req.session.user.company_id;

        const [purchases] = await db.query(
            `
            SELECT
                p.*,
                s.name AS supplier_name,
                s.phone AS supplier_phone,
                st.name AS store_name
            FROM purchases p
            LEFT JOIN suppliers s
                ON p.supplier_id = s.id
            LEFT JOIN stores st
                ON p.store_id = st.id
            WHERE p.id = ?
            AND p.company_id = ?
            `,
            [
                purchaseId,
                companyId
            ]
        );

        if (!purchases.length) {

            return res.status(404).send(
                'Закупка не найдена'
            );

        }

        const purchase = purchases[0];

        purchase.user_name = req.session.user.name;

        const [items] = await db.query(
            `
            SELECT
                pi.*,
                pr.name AS product_name
            FROM purchase_items pi
            JOIN products pr
                ON pi.product_id = pr.id
            WHERE pi.purchase_id = ?
            `,
            [purchaseId]
        );

        res.render('purchases_view', {

            activeMenu: 'purchases',

            purchase,

            items,

            user: req.session.user,

            breadcrumbs: [
                {
                    title: req.__('title.dashboard'),
                    url: '/'
                },
                {
                    title: 'Закупка',
                    url: '/purchases'
                },
                {
                    title: 'Приходная накладная'
                }
            ]

        });

    } catch (error) {

        console.error(error);

        res.status(500).send(
            'Внутренняя ошибка сервера'
        );

    }

};


// ======================================================
// Сохранение закупки
// ======================================================
exports.store = async (req, res) => {

    const connection = await db.getConnection();

    try {

        const companyId = req.session.user.company_id;

        const {
            number,
            date,
            supplier_id,
            store_id,
            items
        } = req.body;

        if (
            !number ||
            !date ||
            !supplier_id ||
            !store_id ||
            !items ||
            !items.length
        ) {

            return res.status(400).send(
                'Все поля обязательны'
            );

        }

        await connection.beginTransaction();

        let totalAmount = 0;

        items.forEach(item => {

            totalAmount +=
                (Number(item.quantity) || 0) *
                (Number(item.price) || 0);

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
                VALUES
                (?, ?, ?, ?, ?, ?, 'received')
                `,
                [
                    companyId,
                    supplier_id,
                    store_id,
                    number.trim(),
                    date,
                    totalAmount
                ]
            );

        const purchaseId =
            purchaseResult.insertId;

        for (const item of items) {

            const productId =
                item.product_id;

            const quantity =
                Number(item.quantity) || 0;

            const price =
                Number(item.price) || 0;

            if (
                !productId ||
                quantity <= 0
            ) {
                continue;
            }

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
                    productId,
                    quantity,
                    price
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
                    productId,
                    store_id,
                    quantity,
                    quantity
                ]
            );

        }

        await connection.commit();

        res.redirect('/purchases');

    } catch (error) {

        await connection.rollback();

        console.error(
            'Ошибка при сохранении закупки:',
            error
        );

        res.status(500).send(
            'Ошибка при сохранении закупки'
        );

    } finally {

        connection.release();

    }

};