const { Client } = require('pg');

const client = new Client({
  connectionString: 'postgresql://neondb_owner:npg_Z0rEyqF2Clbg@ep-bold-grass-aqgqfjan-pooler.c-8.us-east-1.aws.neon.tech/neondb?sslmode=require&channel_binding=require',
  ssl: {
    rejectUnauthorized: false
  }
});

client.connect();

module.exports = client;