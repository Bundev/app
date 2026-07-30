const db = require('../config/db');
const page = require('../helpers/page');

function supplierId(value) {

    const id = Number(value);

    return Number.isSafeInteger(id) && id > 0
        ? id
        : null;

}

function supplierInput(body = {}) {

    const name =
        typeof body.name === 'string'
            ? body.name.trim()
            : '';

    if (!name) {

        return {
            error: 'Название поставщика обязательно'
        };

    }

    if (name.length > 255) {

        return {
            error: 'Название поставщика слишком длинное'
        };

    }

    const fields = [
        ['phone', 'Телефон', 50],
        ['email', 'Email', 100],
        ['address', 'Адрес', 1000]
    ];

    const normalized = {
        name
    };

    for (const [field, label, maxLength] of fields) {

        const rawValue = body[field];

        if (
            rawValue !== undefined &&
            rawValue !== null &&
            typeof rawValue !== 'string'
        ) {

            return {
                error: `Некорректное значение поля «${label}»`
            };

        }

        const value =
            typeof rawValue === 'string'
                ? rawValue.trim()
                : '';

        if (value.length > maxLength) {

            return {
                error: `Поле «${label}» слишком длинное`
            };

        }

        normalized[field] =
            value || null;

    }

    return {
        value: normalized
    };

}

// ======================================================
// Список поставщиков
// ======================================================
exports.index = async (req, res) => {

    try {

        const companyId = req.session.user.company_id;

        const [suppliers] = await db.execute(
            `
            SELECT
                id,
                name,
                phone,
                email,
                address
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

        const input = supplierInput(req.body);

        if (input.error) {
            return res.status(400).send(
                input.error
            );
        }

        const {
            name,
            phone,
            email,
            address
        } = input.value;

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
                name,
                phone,
                email,
                address
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


// ======================================================
// Редактирование поставщика
// ======================================================
exports.update = async (req, res) => {

    try {

        const companyId =
            req.session.user.company_id;

        const id = supplierId(req.params.id);
        const input = supplierInput(req.body);

        if (!id) {

            return res.status(400).send(
                'Некорректный идентификатор поставщика'
            );

        }

        if (input.error) {

            return res.status(400).send(
                input.error
            );

        }

        const {
            name,
            phone,
            email,
            address
        } = input.value;

        const [result] = await db.execute(
            `
            UPDATE suppliers
            SET
                name = ?,
                phone = ?,
                email = ?,
                address = ?
            WHERE id = ?
              AND company_id = ?
              AND archived = 0
            `,
            [
                name,
                phone,
                email,
                address,
                id,
                companyId
            ]
        );

        if (!result.affectedRows) {

            return res.status(404).send(
                'Поставщик не найден'
            );

        }

        res.redirect('/suppliers');

    } catch (error) {

        console.error(
            'Ошибка при редактировании поставщика:',
            error
        );

        res.status(500).send(
            'Ошибка сервера'
        );

    }

};


// ======================================================
// Архивация поставщика
// ======================================================
exports.archive = async (req, res) => {

    try {

        const companyId =
            req.session.user.company_id;

        const id = supplierId(req.params.id);

        if (!id) {

            return res.status(400).send(
                'Некорректный идентификатор поставщика'
            );

        }

        const [result] = await db.execute(
            `
            UPDATE suppliers
            SET archived = 1
            WHERE id = ?
              AND company_id = ?
              AND archived = 0
            `,
            [
                id,
                companyId
            ]
        );

        if (!result.affectedRows) {

            return res.status(404).send(
                'Поставщик не найден'
            );

        }

        res.redirect('/suppliers');

    } catch (error) {

        console.error(
            'Ошибка при архивации поставщика:',
            error
        );

        res.status(500).send(
            'Ошибка сервера'
        );

    }

};
