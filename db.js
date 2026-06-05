const mysql = require('mysql2');
const fs = require('fs');
const host = "gateway01.eu-central-1.prod.aws.tidbcloud.com";
const port = 4000;
const user = '4B7w4KYsyjeetHq.root';
const password = 'MslHCGyFWWWn9WAG';
const database = 'mycrm';

const pool = mysql.createPool({
  host: host,
  port: 4000,
  user: user,
  password: password,
  database: database,

  ssl: {
    ca: fs.readFileSync('./certs/isrgrootx1.pem')
  }
});

module.exports = pool.promise();