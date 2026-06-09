const mysql = require('mysql2/promise');
const fs = require('fs');
const path = require('path');

const db = mysql.createPool({
    host: 'srv1798.hstgr.io.',
    port: 3306,
    user: 'u891612247_bundev95',
    password: 'Bundev1995',
    database: 'u891612247_crm',
    timezone: '+03:00'
    
});

module.exports = db;