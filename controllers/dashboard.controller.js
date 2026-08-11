const db = require('../config/db');
const statuses = require('../config/statuses');
const roles = require('../config/roles');
const page = require('../helpers/page');
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

const [[todayMargin]] = await db.query(`
SELECT
    COALESCE(
        SUM(
            (si.final_subtotal - (si.purchase_price * si.quantity))
            -
            COALESCE(r.return_margin, 0)
        ),
        0
    ) AS margin
FROM sale_items si

JOIN sales s
    ON s.id = si.sale_id

LEFT JOIN (
    SELECT
        sri.sale_item_id,
        SUM(
            (
                (si2.final_subtotal / si2.quantity)
                - si2.purchase_price
            ) * sri.quantity
        ) AS return_margin
    FROM sale_return_items sri
    JOIN sale_items si2
        ON si2.id = sri.sale_item_id
    GROUP BY sri.sale_item_id
) r
    ON r.sale_item_id = si.id

WHERE
    s.company_id = ?
    AND s.user_id = ?
    AND DATE(s.created_at) = CURDATE()
    AND s.status IN ('completed', 'partial_return', 'returned')
`, [companyId, userId]);
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

        // Товары, которые закончились или скоро закончатся.
        const [lowStockProducts] = await db.query(
            `
            SELECT
                p.id,
                p.name,
                p.unit,
                SUM(
                    CASE
                        WHEN s.id IS NOT NULL THEN COALESCE(ps.quantity, 0)
                        ELSE 0
                    END
                ) AS quantity
            FROM products p
            LEFT JOIN product_stores ps ON ps.product_id = p.id
            LEFT JOIN stores s
                ON s.id = ps.store_id
               AND s.company_id = ?
               AND s.status = 'active'
            WHERE p.company_id = ?
              AND p.archived = 0
            GROUP BY p.id, p.name, p.unit
            HAVING quantity < 5
            ORDER BY quantity ASC, p.name ASC
            LIMIT 10
            `,
            [companyId, companyId]
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
            lowStockProducts,
            invoicesToday: salesTodayRow.invoices,
            clientsCount: clientsRow.total,
            productsToday: productsTodayRow.total,
            invoices: latestSales,
            statuses,
            todayMargin: Number(todayMargin.margin || 0),
            ...page(req, 'dashboard')
        });

    } catch (error) {
        console.error('Ошибка при рендере дашборда:', error);
        res.status(500).send('Ошибка сервера при загрузке панели управления');
    }
}

module.exports = {
    renderDashboard
};
