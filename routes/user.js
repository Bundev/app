const express = require('express');
const router = express.Router();
const db = require('../config/db');
const uploadUser = require('../config/uploadUser');
const auth = require('../middleware/auth');

const requireAdmin = require('../middleware/requireAdmin');



router.get('/new', auth, async (req, res) => {
    const [stores] =
        await db.execute(
            `
            SELECT s.*
            FROM stores s
            INNER JOIN user_stores us
                ON us.store_id = s.id
            WHERE us.user_id = ?
            ORDER BY s.name
            `,
            [req.session.user.id]
        );
    
    res.render('user_new', {
        titleKey: 'title.user_new',
        activeMenu: 'settings',
        stores,
        script: [
            {
                src: 'user_new.js'
            }
        ],
        style: [
            {
                href: 'user_new.css'
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
                title: req.__('title.user_new'), 
            }
        ]

    });

});

router.post('/new', auth, uploadUser.single('avatar'),
    async (req, res) => {

        try {

            const {
                name,
                email,
                phone,
                login,
                password,
                role,
                salary,
                position,
                notes,
                hire_date,
                birth_date
            } = req.body;

            const hashedPassword =
                await bcrypt.hash(
                    password,
                    10
                );

            const avatar =
                req.file
                    ? `/uploads/avatars/${req.file.filename}`
                    : '/img/default-avatar.png';

            const [result] =
                await db.execute(
                    `
                    INSERT INTO user
                    (
                        company_id,
                        login,
                        password,
                        name,
                        role,
                        status,
                        avatar,
                        email,
                        phone,
                        notes,
                        salary,
                        hire_date,
                        birth_date,
                        position
                    )
                    VALUES
                    (
                        ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?
                    )
                    `,
                    [
                        req.session.user.company_id,
                        login,
                        hashedPassword,
                        name,
                        role,
                        'active',
                        avatar,
                        email || null,
                        phone || null,
                        notes || null,
                        salary || null,
                        hire_date || null,
                        birth_date || null,
                        position || null
                    ]
                );

            const userId =
                result.insertId;

        

            if (req.body.store_id) {

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
                    userId,
                    req.body.store_id
                ]
            );

            }

            res.redirect(
                `/users/${userId}`
            );

            

        } catch (error) {

            console.error(error);

            res.status(500).send(
                'Ошибка создания сотрудника'
            );

        }

    }
);

router.get('/stores/:id', auth, async (req, res) => {

    const userId =
        req.params.id;

    const [user] =
        await db.execute(
            `
            SELECT *
            FROM user
            WHERE id = ?
            `,
            [userId]
        );

    const [stores] =
        await db.execute(
            `
            SELECT *
            FROM stores
            WHERE company_id = ?
            ORDER BY name
            `,
            [
                user[0].company_id
            ]
        );

        const [selectedStores] =
            await db.execute(
                `
                SELECT store_id
                FROM user_stores
                WHERE user_id = ?
                `,
                [userId]
            );


    const selectedIds =
    selectedStores.map(
        item => item.store_id
    );

    res.render('user_stores', {

        user_st: user[0],
        stores,
        selectedStores: selectedIds,

        titleKey: 'title.user_new',
        activeMenu: 'settings',
        script: [
            {
                src: 'user_new.js'
            }
        ],
        style: [
            {
                href: 'user_new.css'
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
                title: req.__('title.user_new'), 
            }
        ]

    });

});

router.get('/block/:id',requireAdmin, auth, async (req, res) => {

        const userId = Number(req.params.id);
        // нельзя заблокировать самого себя
        if (userId === req.session.user.id) {

            return res.send(
                'Нельзя заблокировать самого себя'
            );

        }
        // сотрудник должен принадлежать текущему админу
        const [rows] =
            await db.execute(
                `
                SELECT id
                FROM user
                WHERE id = ?
                AND id_admin = ?
                `,
                [
                    userId,
                    req.session.user.id
                ]
            );

        if (!rows.length) {

            return res.status(403).send(
                'Доступ запрещён'
            );

        }

        await db.execute(
            `
            UPDATE user
            SET status = 'blocked'
            WHERE id = ?
            `,
            [userId]
        );

        res.redirect(
            `/users/${userId}`
        );

    }
);

router.get('/unblock/:id', auth, requireAdmin, async (req, res) => {

    const userId =
        Number(req.params.id);

    const [rows] =
        await db.execute(
            `
            SELECT id
            FROM user
            WHERE id = ?
            AND id_admin = ?
            `,
            [
                userId,
                req.session.user.id
            ]
        );

    if (!rows.length) {

        return res.status(403).send(
            'Доступ запрещён'
        );

    }

    await db.execute(
        `
        UPDATE user
        SET status = 'active'
        WHERE id = ?
        `,
        [userId]
    );

    res.redirect(
        `/users/${userId}`
    );

});

router.get('/delete/:id', auth,requireAdmin, async (req, res) => {

    const userId =
        req.params.id;

    if (Number(req.params.id) === req.session.user.id) {

        return res.send(
            'Нельзя удалить самого себя'
        );

    }

    await db.execute(
        `
        DELETE
        FROM user_stores
        WHERE user_id = ?
        `,
        [userId]
    );

    await db.execute(
        `
        DELETE
        FROM user
        WHERE id = ?
        `,
        [userId]
    );

    res.redirect('/settings?tab=users');

});

router.post('/stores/:id', auth, async (req, res) => {

    const userId = req.params.id;

    const stores =
        Array.isArray(req.body.stores)
            ? req.body.stores
            : req.body.stores
                ? [req.body.stores]
                : [];

    await db.execute(
        `
        DELETE
        FROM user_stores
        WHERE user_id = ?
        `,
        [userId]
    );

    for (const storeId of stores) {

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
                userId,
                storeId
            ]
        );

    }

    res.redirect(`/users/${userId}`);

});

router.get('/:id', auth, async (req, res) => {

    const [users] =
        await db.execute(
            `
            SELECT *
            FROM user
            WHERE id = ?
            `,
            [req.params.id]
        );

    if (!users.length) {

        return res.redirect('/users');

    }

    const user_st =
        users[0];

    const [stores] =
        await db.execute(
            `
            SELECT s.*
            FROM stores s
            INNER JOIN user_stores us
                ON us.store_id = s.id
            WHERE us.user_id = ?
            `,
            [user_st.id]
        );

    res.render('user', {
        titleKey: 'title.user',
        activeMenu: 'settings',
        user_st,
        stores,
        script: [
            {
                src: 'user.js'
            }
        ],
        style: [
            {
                href: 'user.css'
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
                title: req.__('title.user'),
                
            }
        ]
    });

});

module.exports = router;