const mysql = require('mysql2');
const fs = require('fs');
const path = require('path');

const host = "gateway01.eu-central-1.prod.aws.tidbcloud.com";
const port = 4000;
const user = '4B7w4KYsyjeetHq.root';
const password = 'g7VSBWhhRS7P33g5';
const database = 'mycrm';


const pool = mysql.createPool({
    host: host,
    port: port,
    user: user,
    password: password,
    database: database,
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0,
    ssl: {
        ca: fs.readFileSync(
            path.join(
                __dirname,
                './certs/isrgrootx1.pem'
            )
        )
    }

});

module.exports = pool.promise();