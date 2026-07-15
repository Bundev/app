const db = require('../config/db');
const bcrypt = require('bcrypt');
const page = require('../helpers/page');

function renderLogin(res, error = null, success = null) {
    res.render('login', {
        titleKey: 'title.login',
        error,
        success,
        ...page(req, 'login')
    });
}

// Форма входа
exports.showLogin = (req, res) => {

    if (req.session.user) {
        return res.redirect('/dashboard');
    }

    const success = req.session.success;
    req.session.success = null;

    res.render('login', {
        titleKey: 'title.login',
        error: null,
        success,
        ...page(req, 'login')
    });

};


// Авторизация
exports.login = async (req, res) => {

    try {

        const {
            login,
            password
        } = req.body;

        const [rows] = await db.execute(
            `
            SELECT *
            FROM user
            WHERE login = ?
            `,
            [login]
        );

        if (!rows.length) {

            return res.render('login', {
                titleKey: 'title.login',
                error: 'Неверный логин или пароль',
                success: null,
                ...page(req, 'login')
            });

        }

        const user = rows[0];

        const validPassword = await bcrypt.compare(
            password,
            user.password
        );

        if (!validPassword) {

            return res.render('login', {
                titleKey: 'title.login',
                error: 'Неверный логин или пароль',
                success: null,
                ...page(req, 'login')
            });

        }

        if (user.status === 'blocked') {

            return res.render('login', {
                titleKey: 'title.login',
                error: 'Ваш аккаунт заблокирован',
                success: null,
                ...page(req, 'login')
            });

        }

        req.session.user = {
            id: user.id,
            name: user.name,
            login: user.login,
            role: user.role,
            avatar: user.avatar,
            status: user.status,
            phone: user.phone,
            store_id: user.store_id,
            company_id: user.company_id
        };

        await db.query(
            'UPDATE user SET last_login = NOW() WHERE id = ?',
            [user.id]
        );

        res.redirect('/dashboard');

    } catch (error) {

        console.error(error);
        res.status(500).send('Ошибка входа');

    }

};

exports.showRegister = (req, res) => {

    res.render('register', {
        titleKey: 'title.register',
        error: null,
        success: null,
        ...page(req, 'register')
    });

};

exports.register = async (req, res) => {

    try {

        const {
            name,
            login,
            email,
            password,
            password2
        } = req.body;

        if (password !== password2) {

            return res.render('register', {
                titleKey: 'title.register',
                error: 'Пароли не совпадают',
                success: null,
                ...page(req, 'register')
            });

        }

        const [exists] = await db.execute(
            `
            SELECT id
            FROM user
            WHERE login = ?
               OR email = ?
            `,
            [
                login,
                email
            ]
        );

        if (exists.length) {

            return res.render('register', {
                titleKey: 'title.register',
                error: 'Пользователь с таким логином или email уже существует',
                success: null,
                ...page(req, 'register')
            });

        }

        const hashedPassword = await bcrypt.hash(
            password,
            10
        );

        await db.execute(
            `
            INSERT INTO user
            (
                name,
                email,
                login,
                password,
                role,
                avatar,
                created_at
            )
            VALUES (?, ?, ?, ?, ?, ?, ?)
            `,
            [
                name,
                email,
                login,
                hashedPassword,
                'admin',
                '/img/default-avatar.png',
                new Date()
            ]
        );

        req.session.success =
            'Пользователь успешно зарегистрирован';

        res.redirect('/login');

    } catch (error) {

        console.error(error);

        res.status(500).send('Ошибка регистрации');

    }

};

// Выход из аккаунта
exports.logout = (req, res) => {

    req.session.destroy(() => {

        res.redirect('/login');

    });

};