const mysql = require('mysql2');
const fs = require('fs');

const pool = mysql.createPool({
  host: 'gateway01.eu-central-1.prod.aws.tidbcloud.com',
  port: 4000,
  user: '4B7w4KYsyjeetHq.root',
  password: 'MslHCGyFWWWn9WAG',
  database: 'mycrm',

  ssl: {
    ca: fs.readFileSync('./certs/isrgrootx1.pem')
  }
});

module.exports = pool.promise();