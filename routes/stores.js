const express = require('express');
const router = express.Router();
const db = require('../config/db');
const auth = require('../middleware/auth');
router.get('/new', auth, (req, res) => {

    if (!req.session.user || req.session.user.role !== 'admin') {
        return res.redirect('/dashboard');
    }

    res.render('store-add', {
        titleKey: 'title.stores',
        activeMenu: 'settings',
        script: [
            {
                src: 'store-add.js',
            }
        ],
        style: [
            {
                href: 'store-add.css',
            }
        ],
        breadcrumbs: [
            {
                title: req.__('title.dashboard'),
                url: '/'
            },
            {
                title: req.__('title.settings'),
                url: '/settings'
            },
            {
                title: req.__('title.store-add')
            }
        ]
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
        status
    )
    VALUES (?, ?, ?, ?)
    `,
    [
        name,
        address,
        phone,
        'active'
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
module.exports = router;