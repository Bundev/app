const express = require('express');
const router = express.Router();
const db = require('../config/db');
const auth = require('../middleware/auth');
const requireAdmin = require('../middleware/requireAdmin');
const page = require('../helpers/page');

router.use(auth, requireAdmin);

// 1. ПОЛУЧЕНИЕ КЛИЕНТОВ: Выводим только со статусом 'active'
router.get('/', async (req, res) => {
    try {
        const companyId = req.session.user.company_id;

        // Добавили условие: status = 'active'
        const [customers] = await db.query(
            `SELECT * FROM customers WHERE company_id = ? AND status = 'active' ORDER BY id DESC`,
            [companyId]
        );

        res.render('customers', {
            titleKey: 'Клиенты',
            customers,
            activeMenu: 'customers',
            ...page(req, 'customers', [
                { title: 'Клиенты' }
            ])
        });
    } catch (error) {
        console.error(error);
        res.status(500).send('Ошибка сервера');
    }
});

// 2. АРХИВАЦИЯ: Меняем статус на 'archived' вместо удаления строки
router.post('/archive/:id', async (req, res) => {
    try {
        const companyId = req.session.user.company_id;
        const customerId = req.params.id;

        // Защита розничного покупателя
        if (Number(customerId) === 1) {
            return res.status(400).send('Нельзя архивировать системного розничного покупателя');
        }

        // Вместо DELETE делаем UPDATE статуса
        await db.query(
            "UPDATE customers SET status = 'archived', updated_at = NOW() WHERE id = ? AND company_id = ? AND status = 'active'",
            [customerId, companyId]
        );

        res.redirect('/customers');
    } catch (error) {
        console.error(error);
        res.status(500).send('Ошибка при архивации клиента');
    }
});

// 2. Роут обработки формы создания клиента
router.post('/add', async (req, res) => {
    try {
        const { name, phone, email, discount_percentage, comment } = req.body;
        const companyId = req.session.user.company_id;

        if (!name || name.trim() === '') {
            return res.status(400).send('Имя клиента обязательно для заполнения');
        }

        // Вставляем строго по полям вашей структуры из phpMyAdmin
        await db.query(
            `INSERT INTO customers (company_id, name, phone, email, discount_percentage, comment, created_at) 
             VALUES (?, ?, ?, ?, ?, ?, NOW())`,
            [
                companyId,
                name.trim(), 
                phone ? phone.trim() : null, 
                email ? email.trim() : null, 
                discount_percentage ? Number(discount_percentage) : 0.00, 
                comment ? comment.trim() : null
            ]
        );

        res.redirect('/customers');
    } catch (error) {
        console.error(error);
        res.status(500).send('Ошибка сервера при создании клиента');
    }
});
// 2. Обработка формы редактирования (POST-запрос)
router.post('/edit/:id', async (req, res) => {
    try {
        const { name, phone, email, discount_percentage, comment } = req.body;
        const companyId = req.session.user.company_id;
        const customerId = req.params.id;

        if (!name || name.trim() === '') {
            return res.status(400).send('Имя клиента обязательно');
        }

        await db.query(
            `UPDATE customers 
             SET name = ?, phone = ?, email = ?, discount_percentage = ?, comment = ?, updated_at = NOW() 
             WHERE id = ? AND company_id = ?`,
            [
                name.trim(), 
                phone ? phone.trim() : null, 
                email ? email.trim() : null, 
                discount_percentage ? Number(discount_percentage) : 0.00, 
                comment ? comment.trim() : null,
                customerId,
                companyId
            ]
        );

        res.redirect('/customers');
    } catch (error) {
        console.error(error);
        res.status(500).send('Ошибка при обновлении клиента');
    }
});


module.exports = router;
