const db = require('../config/db');
const page = require('../helpers/page');

// ======================================================
// Список поставщиков
// ======================================================
exports.index = async (req, res) => {

    try {

        const companyId = req.session.user.company_id;

        const [suppliers] = await db.execute(
            `
            SELECT *
            FROM suppliers
            WHERE company_id = ?
            AND archived = 0
            ORDER BY name ASC
            `,
            [companyId]
        );

        res.render('suppliers', {
            titleKey: 'title.suppliers',
            activeMenu: 'suppliers',
            suppliers,
            ...page(req, 'suppliers', [
                { title: 'Поставщики' }
            ])
        });

    } catch (error) {

        console.error(
            'Ошибка в роутере поставщиков:',
            error
        );

        res.status(500).send(
            'Ошибка сервера'
        );

    }

};


// ======================================================
// Добавление поставщика
// ======================================================
exports.store = async (req, res) => {

    try {

        const companyId =
            req.session.user.company_id;

        const {
            name,
            phone,
            email,
            address
        } = req.body;

        if (
            !name ||
            !name.trim()
        ) {

            return res.status(400).send(
                'Название поставщика обязательно'
            );

        }

        await db.execute(
            `
            INSERT INTO suppliers
            (
                company_id,
                name,
                phone,
                email,
                address
            )
            VALUES (?, ?, ?, ?, ?)
            `,
            [
                companyId,
                name.trim(),
                phone?.trim() || null,
                email?.trim() || null,
                address?.trim() || null
            ]
        );

        res.redirect('/suppliers');

    } catch (error) {

        console.error(
            'Ошибка при добавлении поставщика:',
            error
        );

        res.status(500).send(
            'Ошибка сервера'
        );

    }

};
