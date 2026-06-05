const db = require('./db');

async function test() {
  try {
    const [result] = await db.query(`
      CREATE TABLE IF NOT EXISTS test (
        id INT PRIMARY KEY AUTO_INCREMENT,
        name VARCHAR(100)
      )
    `);

    console.log('Таблица создана');

    await db.query(
      'INSERT INTO test (name) VALUES (?)',
      ['Привет']
    );

    console.log('Запись добавлена');

    const [rows] = await db.query('SELECT * FROM test');
    console.log(rows);

  } catch (err) {
    console.error(err);
  }
}

test();