const mysql = require('mysql2/promise');

const configs = {
    1: {
        user: "u891612247_bundev95",
        password: "Bundev1995",
        database: "u891612247_crm"
    },
    2: {
        user: "u891612247_bundev22",
        password: "8Aj6vAt&",
        database: "u891612247_crm_test"
    }
};

const num = 1;

const db = mysql.createPool({
    host: 'srv1798.hstgr.io',
    port: 3306,

    user: configs[num].user,
    password: configs[num].password,
    database: configs[num].database,

    timezone: '+03:00',

    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0,

    enableKeepAlive: true,
    keepAliveInitialDelay: 0
});

module.exports = db;