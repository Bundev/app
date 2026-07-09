const session = require('express-session');
const MySQLStore = require('express-mysql-session')(session);

const sessionStore = new MySQLStore({
    host: 'srv1798.hstgr.io',
    user: 'u891612247_bundev95',
    password: 'Bundev1995',
    database: 'u891612247_crm'
});

module.exports = session({
    key: 'retailpro',
    secret: 'super-secret-key',
    store: sessionStore,
    resave: false,
    saveUninitialized: false,
    cookie: {
        maxAge: 1000 * 60 * 60 * 24 * 30
    }
});