const db = require('../config/db');

exports.getCashData = async (req) => {
    try {
        const companyId = req.session.user.company_id;
        const currentUser = req.session.user;

        const period = req.query.period || 'all';
        const method = req.query.method || 'all';
        const docType = req.query.docType || 'all';        // 'all', 'sale', 'transaction', 'return'
        const employeeId = req.query.employeeId || 'all';

        // Настройки фильтров времени
        let filterNoAlias = '';
        let filterS = '';
        let filterT = '';
        let filterSR = ''; // Специальный фильтр дат для sale_returns

        if (period === 'day') {
            filterNoAlias = ' AND DATE(created_at) = CURDATE()';
            filterS = ' AND DATE(s.created_at) = CURDATE()';
            filterT = ' AND DATE(t.created_at) = CURDATE()';
            filterSR = ' AND DATE(sr.created_at) = CURDATE()';

        } else if (period === 'yesterday') {

            filterNoAlias = ' AND DATE(created_at) = DATE_SUB(CURDATE(), INTERVAL 1 DAY)';
            filterS = ' AND DATE(s.created_at) = DATE_SUB(CURDATE(), INTERVAL 1 DAY)';
            filterT = ' AND DATE(t.created_at) = DATE_SUB(CURDATE(), INTERVAL 1 DAY)';
            filterSR = ' AND DATE(sr.created_at) = DATE_SUB(CURDATE(), INTERVAL 1 DAY)';

        } else if (period === 'week') {

            filterNoAlias = ' AND created_at >= DATE_SUB(NOW(), INTERVAL 7 DAY)';
            filterS = ' AND s.created_at >= DATE_SUB(NOW(), INTERVAL 7 DAY)';
            filterT = ' AND t.created_at >= DATE_SUB(NOW(), INTERVAL 7 DAY)';
            filterSR = ' AND sr.created_at >= DATE_SUB(NOW(), INTERVAL 7 DAY)';

        } else if (period === 'current_month') {

            filterNoAlias = ' AND YEAR(created_at)=YEAR(CURDATE()) AND MONTH(created_at)=MONTH(CURDATE())';
            filterS = ' AND YEAR(s.created_at)=YEAR(CURDATE()) AND MONTH(s.created_at)=MONTH(CURDATE())';
            filterT = ' AND YEAR(t.created_at)=YEAR(CURDATE()) AND MONTH(t.created_at)=MONTH(CURDATE())';
            filterSR = ' AND YEAR(sr.created_at)=YEAR(CURDATE()) AND MONTH(sr.created_at)=MONTH(CURDATE())';

        } else if (period === 'month') {

            filterNoAlias = ' AND created_at >= DATE_SUB(NOW(), INTERVAL 1 MONTH)';
            filterS = ' AND s.created_at >= DATE_SUB(NOW(), INTERVAL 1 MONTH)';
            filterT = ' AND t.created_at >= DATE_SUB(NOW(), INTERVAL 1 MONTH)';
            filterSR = ' AND sr.created_at >= DATE_SUB(NOW(), INTERVAL 1 MONTH)';

        } else if (period === '2months') {

            filterNoAlias = ' AND created_at >= DATE_SUB(NOW(), INTERVAL 2 MONTH)';
            filterS = ' AND s.created_at >= DATE_SUB(NOW(), INTERVAL 2 MONTH)';
            filterT = ' AND t.created_at >= DATE_SUB(NOW(), INTERVAL 2 MONTH)';
            filterSR = ' AND sr.created_at >= DATE_SUB(NOW(), INTERVAL 2 MONTH)';

        } else if (period === '3months') {

            filterNoAlias = ' AND created_at >= DATE_SUB(NOW(), INTERVAL 3 MONTH)';
            filterS = ' AND s.created_at >= DATE_SUB(NOW(), INTERVAL 3 MONTH)';
            filterT = ' AND t.created_at >= DATE_SUB(NOW(), INTERVAL 3 MONTH)';
            filterSR = ' AND sr.created_at >= DATE_SUB(NOW(), INTERVAL 3 MONTH)';

        } else if (period === 'current_year') {

            filterNoAlias = ' AND YEAR(created_at)=YEAR(CURDATE())';
            filterS = ' AND YEAR(s.created_at)=YEAR(CURDATE())';
            filterT = ' AND YEAR(t.created_at)=YEAR(CURDATE())';
            filterSR = ' AND YEAR(sr.created_at)=YEAR(CURDATE())';

        } else if (period === 'year') {

            filterNoAlias = ' AND created_at >= DATE_SUB(NOW(), INTERVAL 1 YEAR)';
            filterS = ' AND s.created_at >= DATE_SUB(NOW(), INTERVAL 1 YEAR)';
            filterT = ' AND t.created_at >= DATE_SUB(NOW(), INTERVAL 1 YEAR)';
            filterSR = ' AND sr.created_at >= DATE_SUB(NOW(), INTERVAL 1 YEAR)';

        }

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
                (SELECT COALESCE(SUM(sr.total), 0) FROM sale_returns sr INNER JOIN sales s ON s.id = sr.sale_id WHERE sr.user_id = u.id AND s.payment_method = 'transfer' ${filterSR}) AS employee_transfer
            FROM user u WHERE u.company_id = ? ORDER BY u.name ASC
            `,
            [companyId]
        );

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
            finalHistorySql = queries.join(' UNION ALL ') + ' ORDER BY created_at DESC LIMIT 50';
        }

        const [history] = await db.query(finalHistorySql, params);

        return {
            titleKey: 'Финансы',
            cashBalance,
            cardBalance,
            transferBalance,
            totalBalance,
            employeeCashes,
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
        res.status(500).send('Ошибка сервера');
    }

};