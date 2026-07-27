const express = require('express');
const router = express.Router();
const db = require('../config/db');
const auth = require('../middleware/auth');
const requireAdmin = require('../middleware/requireAdmin');
const page = require('../helpers/page');

router.get('/new', auth, (req, res) => {

    if (!req.session.user || req.session.user.role !== 'admin') {
        return res.redirect('/dashboard');
    }

    res.render('store-add', {
        titleKey: 'title.stores',
        activeMenu: 'settings',
        ...page(req, 'store-add', [
            { title: req.__('title.settings'), url: '/settings' },
            { title: req.__('title.store-add') }
        ])
    });

});
router.post('/add', auth, async (req, res) => {

    try {

        if (!req.session.user || req.session.user.role !== 'admin') {
            return res.status(403).send('Доступ запрещён');
        }

        const {
            name,
            address,
            phone
        } = req.body;

        if (!name) {
            return res.send('Введите название магазина');
        }

const [result] = await db.execute(
    `
    INSERT INTO stores
    (
        name,
        address,
        phone,
        status,
        owner_id,
        company_id
    )
    VALUES (?, ?, ?, ?, ?, ?)
    `,
    [
        name,
        address,
        phone,
        'active',
        req.session.user.id,
        req.session.user.company_id
    ]
);

const storeId = result.insertId;

await db.execute(
    `
    INSERT INTO user_stores
    (
        user_id,
        store_id
    )
    VALUES (?, ?)
    `,
    [
        req.session.user.id,
        storeId
    ]
);

        res.redirect('/settings?tab=stores');

    } catch (error) {

        console.error(error);

        res.status(500).send('Ошибка добавления магазина');

    }

});

router.get('/:id/edit', auth, requireAdmin, async (req, res) => {

    try {
        const [stores] = await db.execute(
            `
            SELECT id, name, address, phone, status
            FROM stores
            WHERE id = ? AND company_id = ?
            LIMIT 1
            `,
            [req.params.id, req.session.user.company_id]
        );

        if (!stores.length) {
            req.session.storeError = 'Магазин не найден.';
            return res.redirect('/settings?tab=stores');
        }

        const formError = req.session.storeError || null;
        delete req.session.storeError;

        return res.render('store-edit', {
            titleKey: 'title.stores',
            activeMenu: 'settings',
            store: stores[0],
            error: formError,
            ...page(req, 'store-edit', [
                { title: req.__('title.settings'), url: '/settings?tab=stores' },
                { title: 'Редактирование магазина' }
            ])
        });

    } catch (error) {
        console.error(error);
        req.session.storeError = 'Не удалось открыть магазин.';
        return res.redirect('/settings?tab=stores');
    }

});

router.post('/:id/edit', auth, requireAdmin, async (req, res) => {

    const name = (req.body.name || '').trim();
    const address = (req.body.address || '').trim();
    const phone = (req.body.phone || '').trim();

    if (!name) {
        req.session.storeError = 'Укажите название магазина.';
        return res.redirect(`/stores/${req.params.id}/edit`);
    }

    if (name.length > 255 || address.length > 255 || phone.length > 20) {
        req.session.storeError = 'Проверьте длину введённых данных.';
        return res.redirect(`/stores/${req.params.id}/edit`);
    }

    try {
        const [result] = await db.execute(
            `
            UPDATE stores
            SET name = ?, address = ?, phone = ?
            WHERE id = ? AND company_id = ?
            LIMIT 1
            `,
            [
                name,
                address || null,
                phone || null,
                req.params.id,
                req.session.user.company_id
            ]
        );

        if (!result.affectedRows) {
            req.session.storeError = 'Магазин не найден.';
            return res.redirect('/settings?tab=stores');
        }

        req.session.storeSuccess = 'Данные магазина сохранены.';
        return res.redirect('/settings?tab=stores');

    } catch (error) {
        console.error(error);
        req.session.storeError = 'Не удалось сохранить магазин.';
        return res.redirect(`/stores/${req.params.id}/edit`);
    }

});

router.post('/:id/archive', auth, requireAdmin, async (req, res) => {

    try {
        const [result] = await db.execute(
            `
            UPDATE stores
            SET status = 'inactive'
            WHERE id = ? AND company_id = ? AND status = 'active'
            LIMIT 1
            `,
            [req.params.id, req.session.user.company_id]
        );

        req.session[result.affectedRows ? 'storeSuccess' : 'storeError'] = result.affectedRows
            ? 'Магазин перенесён в архив.'
            : 'Не удалось архивировать магазин.';

        return res.redirect('/settings?tab=stores');

    } catch (error) {
        console.error(error);
        req.session.storeError = 'Не удалось архивировать магазин.';
        return res.redirect('/settings?tab=stores');
    }

});

module.exports = router;
