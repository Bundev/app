const fs = require('fs');

if (fs.existsSync('.env')) {
    process.loadEnvFile('.env');
}

const express = require('express');
const cookieParser = require('cookie-parser');
const db = require('./config/db');
const i18n = require('./config/i18n');
const port = 3000;
const app = express();
app.set('view engine', 'ejs');
app.use(express.static('public'));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.get('/api/connection-status', async (req, res) => {
    res.set('Cache-Control', 'no-store');

    try {
        await db.query('SELECT 1');
        res.status(204).end();
    } catch (error) {
        res.status(503).json({ available: false });
    }
});
app.use(require('./config/session'));
app.use((req, res, next) => {
    res.locals.user =
        req.session.user || null;
    next();
});
app.use((req, res, next) => {

    res.locals.roles = {
        admin: 'Администратор',
        manager: 'Менеджер',
        seller: 'Продавец'
    };

    next();

});
app.use(cookieParser());
const languageMiddleware = require('./middleware/language');
app.use(i18n.init);
app.use(languageMiddleware);
app.use('/lang', require('./routes/lang'));
// Проверка подключения
(async () => {
    try {
        const [rows] = await db.query('SELECT 1');
        console.log("База данных подключена!");
    } catch (err) {
        console.error(err);
    }
})();

// Авторизация
app.use('/', require('./routes/auth'));

// Главная
app.use('/', require('./routes/dashboard'));

// Товары
app.use('/products', require('./routes/products'));
app.use('/products', require('./routes/product-import'));
app.use('/api/products', require('./routes/product-api'));

// Продажи
app.use('/sales', require('./routes/sales'));
app.use('/api/sales', require('./routes/sales-api'));
app.use('/return', require('./routes/return'));

// Клиенты
app.use('/customers', require('./routes/customers'));
app.use('/api/customers', require('./routes/customers-api'));

// Закупки
app.use('/purchases', require('./routes/purchases'));
app.use('/transfers', require('./routes/transfers'));
app.use('/suppliers', require('./routes/suppliers'));

// Финансы
app.use('/finance', require('./routes/finance'));

// Справочники
app.use('/categories', require('./routes/categories'));
app.use('/stores', require('./routes/stores'));
app.use('/settings', require('./routes/settings'));
app.use('/user', require('./routes/user'));

// API
app.use('/api/barcode', require('./routes/barcode-api'));
app.use('/barcode', require('./routes/barcode'));

app.use((error, req, res, next) => {
    if (res.headersSent) return next(error);

    console.error(error);

    const unavailableCodes = new Set([
        'EAI_AGAIN',
        'ENOTFOUND',
        'ECONNREFUSED',
        'ECONNRESET',
        'ETIMEDOUT',
        'PROTOCOL_CONNECTION_LOST'
    ]);
    const unavailable = unavailableCodes.has(error?.code);
    const status = unavailable ? 503 : 500;

    if (req.path.startsWith('/api/') || req.accepts(['html', 'json']) === 'json') {
        return res.status(status).json({
            success: false,
            message: unavailable
                ? 'Сервис временно недоступен. Повторите позже.'
                : 'Не удалось выполнить запрос.'
        });
    }

    return res.status(status).render('service-unavailable', {
        unavailable,
        retryUrl: req.originalUrl || '/'
    });
});

app.listen(port, () => {
    console.log(`Server started on port ${port}`);
});
