const db = require('../config/db');

exports.getCashData = async (req) => {
    try {
        const companyId = req.session.user.company_id;
        const currentUser = req.session.user;

        const requestedPeriod = String(req.query.period || 'all');
        const periodAliases = {
            week: 'current_week',
            month: 'current_month',
            year: 'current_year'
        };
        const normalizedPeriod =
            periodAliases[requestedPeriod] || requestedPeriod;
        const periodRanges = {
            day: {
                start: 'CURDATE()',
                end: 'DATE_ADD(CURDATE(), INTERVAL 1 DAY)'
            },
            yesterday: {
                start: 'DATE_SUB(CURDATE(), INTERVAL 1 DAY)',
                end: 'CURDATE()'
            },
            current_week: {
                start: 'DATE_SUB(CURDATE(), INTERVAL WEEKDAY(CURDATE()) DAY)',
                end: 'DATE_ADD(DATE_SUB(CURDATE(), INTERVAL WEEKDAY(CURDATE()) DAY), INTERVAL 7 DAY)'
            },
            previous_week: {
                start: 'DATE_SUB(DATE_SUB(CURDATE(), INTERVAL WEEKDAY(CURDATE()) DAY), INTERVAL 7 DAY)',
                end: 'DATE_SUB(CURDATE(), INTERVAL WEEKDAY(CURDATE()) DAY)'
            },
            current_month: {
                start: "DATE_FORMAT(CURDATE(), '%Y-%m-01')",
                end: "DATE_ADD(DATE_FORMAT(CURDATE(), '%Y-%m-01'), INTERVAL 1 MONTH)"
            },
            previous_month: {
                start: "DATE_SUB(DATE_FORMAT(CURDATE(), '%Y-%m-01'), INTERVAL 1 MONTH)",
                end: "DATE_FORMAT(CURDATE(), '%Y-%m-01')"
            },
            current_year: {
                start: 'MAKEDATE(YEAR(CURDATE()), 1)',
                end: 'MAKEDATE(YEAR(CURDATE()) + 1, 1)'
            },
            previous_year: {
                start: 'MAKEDATE(YEAR(CURDATE()) - 1, 1)',
                end: 'MAKEDATE(YEAR(CURDATE()), 1)'
            },
            all: null
        };
        const period = Object.prototype.hasOwnProperty.call(
            periodRanges,
            normalizedPeriod
        )
            ? normalizedPeriod
            : 'all';
        const method = req.query.method || 'all';
        const docType = req.query.docType || 'all';        // 'all', 'sale', 'transaction', 'return'
        const employeeId = req.query.employeeId || 'all';

        // Полуоткрытые календарные интервалы [начало, конец) сохраняют
        // возможность использовать индексы по created_at.
        const range = periodRanges[period];
        const buildDateFilter = alias => {
            if (!range) {
                return '';
            }

            const column = alias
                ? `${alias}.created_at`
                : 'created_at';

            return ` AND ${column} >= ${range.start} AND ${column} < ${range.end}`;
        };
        const filterNoAlias = buildDateFilter('');
        const filterS = buildDateFilter('s');
        const filterT = buildDateFilter('t');
        const filterSR = buildDateFilter('sr');

        // 1. Считаем общую выручку компании (Продажи)
        const [[salesTotals]] = await db.query(
            `SELECT 
                SUM(CASE WHEN payment_method = 'cash' THEN total ELSE 0 END) AS sales_cash,
                SUM(CASE WHEN payment_method = 'card' THEN total ELSE 0 END) AS sales_card,
                SUM(CASE WHEN payment_method = 'transfer' THEN total ELSE 0 END) AS sales_transfer
            FROM sales WHERE company_id = ? ${filterNoAlias}`,
            [companyId]
        );

        // 2. Считаем общие ручные транзакции кассы
        const [[transTotals]] = await db.query(
            `SELECT 
                SUM(CASE WHEN payment_method = 'cash' AND type = 'income' THEN amount 
                         WHEN payment_method = 'cash' AND type = 'expense' THEN -amount ELSE 0 END) AS trans_cash,
                SUM(CASE WHEN payment_method = 'card' AND type = 'income' THEN amount 
                         WHEN payment_method = 'card' AND type = 'expense' THEN -amount ELSE 0 END) AS trans_card,
                SUM(CASE WHEN payment_method = 'transfer' AND type = 'income' THEN amount 
                         WHEN payment_method = 'transfer' AND type = 'expense' THEN -amount ELSE 0 END) AS trans_transfer
            FROM transactions WHERE company_id = ? ${filterNoAlias}`,
            [companyId]
        );

        // 3. УЧИТЫВАЕМ ВОЗВРАТЫ: связываем sale_returns с оригинальным чеком sales для получения типа оплаты
        const [[returnsTotals]] = await db.query(
            `SELECT 
                SUM(CASE WHEN s.payment_method = 'cash' THEN sr.total ELSE 0 END) AS returns_cash,
                SUM(CASE WHEN s.payment_method = 'card' THEN sr.total ELSE 0 END) AS returns_card,
                SUM(CASE WHEN s.payment_method = 'transfer' THEN sr.total ELSE 0 END) AS returns_transfer
            FROM sale_returns sr
            INNER JOIN sales s ON s.id = sr.sale_id
            WHERE sr.company_id = ? ${filterSR}`,
            [companyId]
        );

        // Валовая маржа: сумма продаж минус закупочная стоимость, с учетом возвратов.
        const [[marginTotals]] = await db.query(
            `
            SELECT
                COALESCE(SUM(
                    (si.final_subtotal - (si.purchase_price * si.quantity))
                    - COALESCE(returned.margin, 0)
                ), 0) AS margin,
                COALESCE(SUM(
                    COALESCE(si.purchase_price, 0)
                    * GREATEST(
                        si.quantity - COALESCE(returned.returned_quantity, 0),
                        0
                    )
                ), 0) AS cost_total
            FROM sale_items si
            INNER JOIN sales s ON s.id = si.sale_id
            LEFT JOIN (
                SELECT
                    sri.sale_item_id,
                    SUM(sri.quantity) AS returned_quantity,
                    SUM(
                        ((si2.final_subtotal / NULLIF(si2.quantity, 0)) - si2.purchase_price)
                        * sri.quantity
                    ) AS margin
                FROM sale_return_items sri
                INNER JOIN sale_items si2 ON si2.id = sri.sale_item_id
                GROUP BY sri.sale_item_id
            ) returned ON returned.sale_item_id = si.id
            WHERE s.company_id = ?
              ${filterS}
              AND s.status IN ('completed', 'partial_return', 'returned')
            `,
            [companyId]
        );

        const margin = Number(marginTotals.margin || 0);
        const costTotal = Number(marginTotals.cost_total || 0);

        // Вычисляем чистый баланс кассы организации (Продажи + Транзакции - Возвраты)
        const cashBalance = Number(salesTotals.sales_cash || 0) + Number(transTotals.trans_cash || 0) - Number(returnsTotals.returns_cash || 0);
        const cardBalance = Number(salesTotals.sales_card || 0) + Number(transTotals.trans_card || 0) - Number(returnsTotals.returns_card || 0);
        const transferBalance = Number(salesTotals.sales_transfer || 0) + Number(transTotals.trans_transfer || 0) - Number(returnsTotals.returns_transfer || 0);
        const totalBalance = cashBalance + cardBalance + transferBalance;

        // 4. КАССЫ СОТРУДНИКОВ С УЧЕТОМ ВОЗВРАТОВ (вычитаем из рук выданные клиентам возвраты)
        const [employeeCashes] = await db.query(
            `
            SELECT 
                u.id AS user_id, u.name AS user_name, u.role AS user_role,
                (SELECT COALESCE(SUM(s.total), 0) FROM sales s WHERE s.user_id = u.id AND s.payment_method = 'cash' ${filterS}) +
                (SELECT COALESCE(SUM(CASE WHEN t.type = 'income' THEN t.amount ELSE -t.amount END), 0) FROM transactions t WHERE t.user_id = u.id AND t.payment_method = 'cash' ${filterT}) -
                (SELECT COALESCE(SUM(sr.total), 0) FROM sale_returns sr INNER JOIN sales s ON s.id = sr.sale_id WHERE sr.user_id = u.id AND s.payment_method = 'cash' ${filterSR}) AS employee_cash,
                
                (SELECT COALESCE(SUM(s.total), 0) FROM sales s WHERE s.user_id = u.id AND s.payment_method = 'card' ${filterS}) +
                (SELECT COALESCE(SUM(CASE WHEN t.type = 'income' THEN t.amount ELSE -t.amount END), 0) FROM transactions t WHERE t.user_id = u.id AND t.payment_method = 'card' ${filterT}) -
                (SELECT COALESCE(SUM(sr.total), 0) FROM sale_returns sr INNER JOIN sales s ON s.id = sr.sale_id WHERE sr.user_id = u.id AND s.payment_method = 'card' ${filterSR}) AS employee_card,
                
                (SELECT COALESCE(SUM(s.total), 0) FROM sales s WHERE s.user_id = u.id AND s.payment_method = 'transfer' ${filterS}) +
                (SELECT COALESCE(SUM(CASE WHEN t.type = 'income' THEN t.amount ELSE -t.amount END), 0) FROM transactions t WHERE t.user_id = u.id AND t.payment_method = 'transfer' ${filterT}) -
                (SELECT COALESCE(SUM(sr.total), 0) FROM sale_returns sr INNER JOIN sales s ON s.id = sr.sale_id WHERE sr.user_id = u.id AND s.payment_method = 'transfer' ${filterSR}) AS employee_transfer,

                (
                    SELECT COALESCE(SUM(
                        (si.final_subtotal - (si.purchase_price * si.quantity))
                        - COALESCE(returned.margin, 0)
                    ), 0)
                    FROM sale_items si
                    INNER JOIN sales s ON s.id = si.sale_id
                    LEFT JOIN (
                        SELECT
                            sri.sale_item_id,
                            SUM(
                                ((si2.final_subtotal / NULLIF(si2.quantity, 0)) - si2.purchase_price)
                                * sri.quantity
                            ) AS margin
                        FROM sale_return_items sri
                        INNER JOIN sale_items si2 ON si2.id = sri.sale_item_id
                        GROUP BY sri.sale_item_id
                    ) returned ON returned.sale_item_id = si.id
                    WHERE s.user_id = u.id
                      AND s.company_id = ?
                      ${filterS}
                      AND s.status IN ('completed', 'partial_return', 'returned')
                ) AS employee_margin,

                (
                    SELECT COALESCE(SUM(
                        COALESCE(si.purchase_price, 0)
                        * GREATEST(
                            si.quantity - COALESCE(returned.returned_quantity, 0),
                            0
                        )
                    ), 0)
                    FROM sale_items si
                    INNER JOIN sales s ON s.id = si.sale_id
                    LEFT JOIN (
                        SELECT
                            sri.sale_item_id,
                            SUM(sri.quantity) AS returned_quantity
                        FROM sale_return_items sri
                        GROUP BY sri.sale_item_id
                    ) returned ON returned.sale_item_id = si.id
                    WHERE s.user_id = u.id
                      AND s.company_id = ?
                      ${filterS}
                      AND s.status IN ('completed', 'partial_return', 'returned')
                ) AS employee_cost
            FROM user u WHERE u.company_id = ? ORDER BY u.name ASC
            `,
            [companyId, companyId, companyId]
        );

        const employeeTotals = employeeCashes.reduce(
            (totals, employee) => {
                totals.cash += Number(employee.employee_cash || 0);
                totals.card += Number(employee.employee_card || 0);
                totals.transfer += Number(employee.employee_transfer || 0);
                totals.cost += Number(employee.employee_cost || 0);
                totals.margin += Number(employee.employee_margin || 0);
                return totals;
            },
            {
                cash: 0,
                card: 0,
                transfer: 0,
                cost: 0,
                margin: 0
            }
        );

        employeeTotals.balance =
            employeeTotals.cash +
            employeeTotals.card +
            employeeTotals.transfer;

        // 5. ДИНАМИЧЕСКИЙ КОНСТРУКТОР ДЛЯ ИСТОРИИ ОПЕРАЦИЙ
        let queries = [];
        let params = [];

        // Блок "Продажи"
        if (docType === 'all' || docType === 'sale') {
            let salesSql = `
                SELECT CONVERT('Продажа' USING utf8mb4) as source, CONVERT(s.invoice_number USING utf8mb4) as doc_num, s.total as amount, CONVERT(s.payment_method USING utf8mb4) as payment_method, CONVERT('income' USING utf8mb4) as type, CONVERT(u.name USING utf8mb4) as employee_name, CONVERT('Продажа товаров' USING utf8mb4) as details, s.created_at 
                FROM sales s LEFT JOIN user u ON u.id = s.user_id WHERE s.company_id = ? ${filterS}`;
            let salesParams = [companyId];
            if (method !== 'all') { salesSql += ` AND s.payment_method = ?`; salesParams.push(method); }
            if (employeeId !== 'all') { salesSql += ` AND s.user_id = ?`; salesParams.push(employeeId); }
            queries.push(`(${salesSql})`); params.push(...salesParams);
        }

        // Блок "Ручные операции кассы"
        if (docType === 'all' || docType === 'transaction') {
            let transSql = `
                SELECT CONVERT('Касса' USING utf8mb4) as source, CONVERT(t.id USING utf8mb4) as doc_num, t.amount, CONVERT(t.payment_method USING utf8mb4) as payment_method, CONVERT(t.type USING utf8mb4) as type, CONVERT(u.name USING utf8mb4) as employee_name, CONVERT(t.description USING utf8mb4) as details, t.created_at 
                FROM transactions t LEFT JOIN user u ON u.id = t.user_id WHERE t.company_id = ? ${filterT}`;
            let transParams = [companyId];
            if (method !== 'all') { transSql += ` AND t.payment_method = ?`; transParams.push(method); }
            if (employeeId !== 'all') { transSql += ` AND t.user_id = ?`; transParams.push(employeeId); }
            queries.push(`(${transSql})`); params.push(...transParams);
        }

        // Блок "Возвраты" (Берем из sale_returns, тип оплаты вытаскиваем через JOIN из sales)
        if (docType === 'all' || docType === 'return') {
            let returnsSql = `
                SELECT 
                    CONVERT('Возврат' USING utf8mb4) as source, 
                    CONVERT(sr.return_number USING utf8mb4) as doc_num, 
                    sr.total as amount, 
                    CONVERT(s.payment_method USING utf8mb4) as payment_method, 
                    CONVERT('expense' USING utf8mb4) as type, 
                    CONVERT(u.name USING utf8mb4) as employee_name, 
                    CONVERT(CONCAT('Возврат по чеку #', s.invoice_number) USING utf8mb4) as details, 
                    sr.created_at 
                FROM sale_returns sr
                INNER JOIN sales s ON s.id = sr.sale_id
                LEFT JOIN user u ON u.id = sr.user_id
                WHERE sr.company_id = ? ${filterSR}`;
            let returnsParams = [companyId];
            
            if (method !== 'all') {
                returnsSql += ` AND s.payment_method = ?`;
                returnsParams.push(method);
            }
            if (employeeId !== 'all') {
                returnsSql += ` AND sr.user_id = ?`;
                returnsParams.push(employeeId);
            }
            queries.push(`(${returnsSql})`);
            params.push(...returnsParams);
        }

        let finalHistorySql = 'SELECT NULL FROM dual WHERE 1=0';
        if (queries.length > 0) {
            finalHistorySql = queries.join(' UNION ALL ') + ' ORDER BY created_at DESC';
        }

        const [history] = await db.query(finalHistorySql, params);

        return {
            titleKey: 'Финансы',
            cashBalance,
            cardBalance,
            transferBalance,
            totalBalance,
            margin,
            costTotal,
            employeeCashes,
            employeeTotals,
            currentUser,
            history,
            period,
            method,
            docType,
            employeeId,
            activeMenu: 'finance',
            breadcrumbs: [
                { title: 'Главная', url: '/' },
                { title: 'Касса и Финансы' }
            ]
        };
    } catch (error) {
        console.error(error);
        throw error;
    }

};
