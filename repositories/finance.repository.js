const db = require('../config/db');

module.exports = {
    // Получаем агрегированные суммы
    getTotals: async (companyId, filter) => {
        const query = `SELECT ...`; // ваш запрос из сервиса
        const [rows] = await db.query(query, [companyId]);
        return rows[0];
    },
    // Получаем историю транзакций/продаж/возвратов
    getHistory: async (companyId, filters) => {
        // Здесь будет ваш сложный UNION ALL запрос
        return await db.query(...);
    }
};