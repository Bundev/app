const mysql = require('mysql2/promise');
const fs = require('fs');
const path = require('path');

const db = mysql.createPool({
    host: 'srv1798.hstgr.io.',
    port: 3306,
    user: 'u891612247_bundev95',
    password: 'Bundev1995',
    database: 'u891612247_crm',
    timezone: '+03:00',

    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0,

    enableKeepAlive: true,
    keepAliveInitialDelay: 0
    
});

module.exports = db;