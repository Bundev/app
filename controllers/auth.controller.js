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
                error: req.__('auth.invalidCredentials'),
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
                error: req.__('auth.invalidCredentials'),
                success: null,
                ...page(req, 'login')
            });

        }

        if (user.status === 'blocked') {

            return res.render('login', {
                titleKey: 'title.login',
                error: req.__('auth.accountBlocked'),
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
        res.status(500).send(req.__('auth.loginError'));

    }

};

exports.showRegister = (req, res) => {

    res.render('register', {
        titleKey: 'title.register',
        error: null,
        success: null,
        formData: {},
        ...page(req, 'register')
    });

};

exports.register = async (req, res) => {

    const formData = {
        companyName: (req.body.company_name || '').trim(),
        name: (req.body.name || '').trim(),
        email: (req.body.email || '').trim(),
        login: (req.body.login || '').trim()
    };

    const renderError = error => res.render('register', {
        titleKey: 'title.register',
        error,
        success: null,
        formData,
        ...page(req, 'register')
    });

    if (!formData.companyName) {
        return renderError(req.__('auth.companyRequired'));
    }

    if (formData.companyName.length > 255) {
        return renderError(req.__('auth.companyTooLong'));
    }

    if (req.body.password !== req.body.password2) {
        return renderError(req.__('auth.passwordMismatch'));
    }

    let connection;

    try {
        connection = await db.getConnection();
        await connection.beginTransaction();

        const [exists] = await connection.execute(
            `SELECT id FROM user WHERE login = ? OR email = ? LIMIT 1`,
            [formData.login, formData.email]
        );

        if (exists.length) {
            await connection.rollback();
            return renderError(req.__('auth.userExists'));
        }

        const hashedPassword = await bcrypt.hash(req.body.password, 10);

        const [companyResult] = await connection.execute(
            `INSERT INTO companies (name, status, created_at)
             VALUES (?, 'active', NOW())`,
            [formData.companyName]
        );

        await connection.execute(
            `INSERT INTO user
                (company_id, name, email, login, password, role, avatar, created_at)
             VALUES (?, ?, ?, ?, ?, 'admin', ?, NOW())`,
            [
                companyResult.insertId,
                formData.name,
                formData.email,
                formData.login,
                hashedPassword,
                '/img/default-avatar.png'
            ]
        );

        await connection.commit();
        req.session.success = req.__('auth.registrationSuccess');
        return res.redirect('/login');

    } catch (error) {
        if (connection) {
            await connection.rollback();
        }

        console.error(error);
        return renderError(req.__('auth.registrationError'));

    } finally {
        if (connection) {
            connection.release();
        }
    }

};

// Выход из аккаунта
exports.logout = (req, res) => {

    req.session.destroy(() => {

        res.redirect('/login');

    });

};
