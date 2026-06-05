const db = require('./db');

async function test() {
  try {
    const [rows] = await db.query('SELECT DATABASE() as db');
    console.log(rows);
  } catch (err) {
    console.error(err);
  }
}

test();