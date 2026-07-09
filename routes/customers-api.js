const express = require('express');
const router = express.Router();
const db = require('../config/db');
const auth = require('../middleware/auth');

// Получение списка клиентов компании (только активные)
router.get('/', auth, async (req, res) => {
    try {
        const companyId = req.session.user.company_id;

        // ИСПРАВЛЕНО: добавлено условие AND status = 'active'
        const [customers] = await db.query(
            `
            SELECT id, name, phone, email, discount_percentage 
            FROM customers 
            WHERE company_id = ? 
              AND status = 'active'
            ORDER BY name ASC
            `,
            [companyId]
        );

        return res.json({
            success: true,
            customers
        });

    } catch (error) {
        console.error('Ошибка при получении клиентов:', error);
        return res.status(500).json({
            success: false,
            message: 'Не удалось загрузить список клиентов'
        });
    }
});
// Роут для создания нового клиента
router.post('/', auth, async (req, res) => {
    try {
        const { name, phone, email, discount_percentage, comment } = req.body;
        const companyId = req.session.user.company_id;

        // 1. Валидация обязательных полей
        if (!name || !name.trim()) {
            return res.status(400).json({ 
                success: false, 
                message: 'Имя клиента обязательно для заполнения' 
            });
        }

        // Очищаем телефон от лишних символов (пробелы, дефисы, скобки), если он передан
        const cleanPhone = phone ? phone.replace(/\D/g, '') : null;

        // 2. Проверка на дубликат (если телефон указан, проверяем внутри этой же компании)
        if (cleanPhone) {
            const [existingClient] = await db.query(
                `SELECT id FROM customers WHERE phone = ? AND company_id = ? LIMIT 1`,
                [cleanPhone, companyId]
            );

            if (existingClient.length > 0) {
                return res.status(400).json({ 
                    success: false, 
                    message: 'Клиент с таким номером телефона уже существует в вашей компании' 
                });
            }
        }

        // 3. Безопасное приведение типов для скидки
        const discount = discount_percentage ? parseFloat(discount_percentage) : 0;

        // 4. Вставка нового клиента в базу данных
        const [result] = await db.query(
            `
            INSERT INTO customers 
                (company_id, name, phone, email, discount_percentage, comment, created_at) 
            VALUES 
                (?, ?, ?, ?, ?, ?, NOW())
            `,
            [
                companyId, 
                name.trim(), 
                cleanPhone, 
                email?.trim() || null, 
                discount, 
                comment?.trim() || null
            ]
        );

        // 5. Возвращаем созданного клиента
        return res.status(201).json({
            success: true,
            message: 'Клиент успешно создан',
            client: {
                id: result.insertId,
                name: name.trim(),
                phone: cleanPhone,
                email: email?.trim() || null,
                discount_percentage: discount
            }
        });

    } catch (error) {
        console.error('Ошибка при создании клиента:', error);
        return res.status(500).json({
            success: false,
            message: 'Внутренняя ошибка сервера при создании клиента'
        });
    }
});
router.put('/:id', auth, async (req, res) => {
    try {
        const customerId = req.params.id;
        const companyId = req.session.user.company_id;
        const { name, phone, email, discount_percentage } = req.body;

        if (!name || !name.trim()) {
            return res.status(400).json({ success: false, message: 'Имя обязательно' });
        }

        const cleanPhone = phone ? phone.replace(/\D/g, '') : null;
        const discount = discount_percentage ? parseFloat(discount_percentage) : 0;

        // Обновляем только если клиент принадлежит текущей компании
        await db.query(
            `UPDATE customers 
             SET name = ?, phone = ?, email = ?, discount_percentage = ?, updated_at = NOW() 
             WHERE id = ? AND company_id = ?`,
            [name.trim(), cleanPhone, email?.trim() || null, discount, customerId, companyId]
        );

        return res.json({
            success: true,
            message: 'Данные клиента обновлены',
            client: { id: customerId, name: name.trim(), phone: cleanPhone, discount_percentage: discount }
        });

    } catch (error) {
        console.error('Ошибка при обновлении клиента:', error);
        return res.status(500).json({ success: false, message: 'Ошибка сервера при обновлении' });
    }
});
// Обновленный API-роут для получения данных одного клиента
router.get('/:id', auth, async (req, res) => {
    try {
        const customerId = req.params.id;

        // Временно убираем фильтр по company_id, чтобы проверить связь
        const [[customer]] = await db.query(
            'SELECT * FROM customers WHERE id = ?',
            [customerId]
        );

        if (!customer) {
            return res.status(404).json({ error: 'Клиент не найден в базе данных' });
        }

        res.json(customer);
    } catch (error) {
        console.error('Ошибка API Клиенты:', error);
        res.status(500).json({ error: 'Внутренняя ошибка сервера' });
    }
});
module.exports = router;