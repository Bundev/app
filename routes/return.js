const express = require('express');
const router = express.Router();
const db = require('../config/db');
const auth = require('../middleware/auth');
const page = require('../helpers/page');

router.get('/', auth, async (req, res) => {
    try {
        const params = [req.session.user.company_id];
        const userFilter = req.session.user.role === 'admin'
            ? ''
            : ' AND sr.user_id = ?';

        if (userFilter) {
            params.push(req.session.user.id);
        }

        const [returns] = await db.query(
            `
            SELECT
                sr.*,
                s.invoice_number,
                c.name AS customer_name,
                u.name AS user_name,
                st.name AS store_name
            FROM sale_returns sr
            JOIN sales s ON s.id = sr.sale_id
            LEFT JOIN customers c ON c.id = s.customer_id
            LEFT JOIN user u ON u.id = sr.user_id
            LEFT JOIN stores st ON st.id = s.store_id
            WHERE sr.company_id = ?${userFilter}
            ORDER BY sr.created_at DESC
            `,
            params
        );

        const total = returns.reduce(
            (sum, item) => sum + Number(item.total || 0),
            0
        );

        return res.render('returns', {
            titleKey: 'Возвраты',
            activeMenu: 'sales',
            returns,
            total,
            ...page(req, 'returns', [
                { title: req.__('title.sales'), url: '/sales' },
                { title: 'Возвраты' }
            ])
        });
    } catch (error) {
        console.error(error);
        return res.status(500).send('Не удалось загрузить возвраты');
    }
});

router.get('/:id',auth, async (req, res) => {

        const returnId =
            req.params.id;
        const params = [returnId, req.session.user.company_id];
        const userFilter = req.session.user.role === 'admin'
            ? ''
            : ' AND sr.user_id = ?';

        if (userFilter) {
            params.push(req.session.user.id);
        }

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
                AND sr.company_id = ?${userFilter}
                `,
                params
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
                ...page(req, 'return-view', [
                    { title: 'Продажи', url: '/sales' },
                    { title: 'Возвраты', url: '/return' },
                    { title: 'Возврат' }
                ])

            }
        );

    }
);
module.exports = router;
