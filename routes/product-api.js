const express = require('express');
const router = express.Router();
const db = require('../config/db');
const auth = require('../middleware/auth');
const { variants: keyboardLayoutVariants } = require('../public/js/keyboard-layout');
router.get('/search', auth, async (req, res) => {
    try {
        const q = req.query.q?.trim() || '';
        if (q.length < 2) {
            return res.json([]);
        }

        const { id: userId, company_id: companyId, role } = req.session.user;
        const searchVariants = keyboardLayoutVariants(q);

        // Базовая часть запроса для обеих ролей
        let queryStr = `
            SELECT
                p.id,
                p.name,
                p.unit,
                p.sku,
                p.barcode,
                p.purchase_price,
                p.sale_price,
                p.image,
                SUM(
                    CASE
                        WHEN s.id IS NOT NULL THEN COALESCE(ps.quantity, 0)
                        ELSE 0
                    END
                ) AS quantity,
                GROUP_CONCAT(
                    CASE
                        WHEN s.id IS NOT NULL THEN
                            CONCAT(s.name, ' (', COALESCE(ps.location, '-'), ') : ', COALESCE(ps.quantity, 0))
                    END
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
                LEFT JOIN stores s
                    ON s.id = ps.store_id
                   AND s.company_id = ?
                   AND s.status = 'active'
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
                INNER JOIN stores s
                    ON s.id = ps.store_id
                   AND s.company_id = ?
                   AND s.status = 'active'
                WHERE p.company_id = ?
                  AND p.archived = 0
            `;
            queryParams.push(userId, companyId, companyId);
        }

        // Общая часть условий поиска и сортировки
        const searchConditions = searchVariants
            .map(() => '(p.name LIKE ? OR p.sku LIKE ? OR p.barcode LIKE ?)')
            .join(' OR ');

        queryStr += `
            AND (${searchConditions})
            GROUP BY p.id
            HAVING SUM(
                CASE
                    WHEN s.id IS NOT NULL THEN COALESCE(ps.quantity, 0)
                    ELSE 0
                END
            ) > 0
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
        searchVariants.forEach(search => {
            queryParams.push(`%${search}%`, `%${search}%`, `%${search}%`);
        });
        queryParams.push(q, q, `${q}%`);

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

router.get('/catalog', auth, async (req, res) => {
    try {
        const { id: userId, company_id: companyId, role } = req.session.user;
        const params = [];
        let joins;

        if (role === 'admin') {
            joins = `
                LEFT JOIN product_stores ps ON ps.product_id = p.id
                LEFT JOIN stores s
                    ON s.id = ps.store_id
                   AND s.company_id = ?
                   AND s.status = 'active'
                WHERE p.company_id = ? AND p.archived = 0
            `;
            params.push(companyId, companyId);
        } else {
            joins = `
                INNER JOIN product_stores ps ON ps.product_id = p.id
                INNER JOIN user_stores us ON us.store_id = ps.store_id AND us.user_id = ?
                INNER JOIN stores s
                    ON s.id = ps.store_id
                   AND s.company_id = ?
                   AND s.status = 'active'
                WHERE p.company_id = ? AND p.archived = 0
            `;
            params.push(userId, companyId, companyId);
        }

        const [products] = await db.query(
            `
            SELECT
                p.id,
                p.name,
                p.unit,
                p.sku,
                p.barcode,
                p.sale_price,
                p.image,
                SUM(
                    CASE
                        WHEN s.id IS NOT NULL THEN COALESCE(ps.quantity, 0)
                        ELSE 0
                    END
                ) AS quantity,
                GROUP_CONCAT(
                    CONCAT(s.name, ' (', COALESCE(ps.location, '-'), ') : ', COALESCE(ps.quantity, 0))
                    ORDER BY s.name
                    SEPARATOR ' | '
                ) AS stock_info
            FROM products p
            ${joins}
            GROUP BY p.id
            HAVING SUM(
                CASE
                    WHEN s.id IS NOT NULL THEN COALESCE(ps.quantity, 0)
                    ELSE 0
                END
            ) > 0
            ORDER BY p.name ASC
            LIMIT 10000
            `,
            params
        );

        return res.json(products);
    } catch (error) {
        console.error('Ошибка синхронизации офлайн-каталога:', error);
        return res.status(500).json({ success: false });
    }
});
module.exports = router;
