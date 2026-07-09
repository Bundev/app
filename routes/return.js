const express = require('express');
const router = express.Router();
const db = require('../config/db');
const auth = require('../middleware/auth');

router.get('/:id',auth, async (req, res) => {

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
module.exports = router;