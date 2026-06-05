const db = require('./db');

db.query('SELECT NOW()', (err, res) => {
  if (err) {
    console.log(err);
  } else {
    console.log(res.rows);
  }

  db.end();
});