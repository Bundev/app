const express = require('express');
const router = express.Router();
const db = require('../config/db');
const auth = require('../middleware/auth');
// Новый API-роут для получения данных чека (печать из списка продаж)
router.get('/:id', auth, async (req, res) => {
    try {
        const saleId = req.params.id;

        // 1. Достаем основную информацию о чеке и кассире
        const [[sale]] = await db.query(
            `
            SELECT 
                s.id, 
                s.invoice_number, 
                s.total, 
                s.discount_amount, 
                s.payment_method, 
                s.created_at,
                u.name AS cashier_name
            FROM sales s
            LEFT JOIN user u ON u.id = s.user_id
            WHERE s.id = ?
            `,
            [saleId]
        );

        if (!sale) {
            return res.status(404).json({ error: 'Продажа не найдена' });
        }

        // 2. Достаем все товары из этого чека
        const [items] = await db.query(
            `
            SELECT 
                si.quantity, 
                si.price, 
                p.name 
            FROM sale_items si
            JOIN products p ON p.id = si.product_id
            WHERE si.sale_id = ?
            `,
            [saleId]
        );

        // Объединяем данные в один объект
        sale.items = items;

        // Отправляем JSON на фронтенд
        res.json(sale);

    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Ошибка сервера при загрузке чека' });
    }
});
module.exports = router;