const mysql = require('mysql2/promise');
const fs = require('fs');
const path = require('path');

const user1 = "u891612247_bundev95";
const password1 = "Bundev1995";
const database1 = "u891612247_crm";

const user2 = "u891612247_bundev";
const password2 = "R?O09@g6";
const database2 = "u891612247_crm_clon";

const db = mysql.createPool({
    host: 'srv1798.hstgr.io.',
    port: 3306,
    user: user2,
    password: password2,
    database: database2,
    timezone: '+03:00',

    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0,

    enableKeepAlive: true,
    keepAliveInitialDelay: 0
    
});

module.exports = db;