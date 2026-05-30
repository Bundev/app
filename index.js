const express = require('express');
const XLSX = require('xlsx');
const Fuse = require('fuse.js');





const app = express();

app.set('view engine', 'ejs');
app.use(express.static('public')); 

const port = 3000;


const workbook = XLSX.readFile('./namiclothura.xls');
const sheet = workbook.Sheets['TDSheet'];

const data = XLSX.utils.sheet_to_json(sheet, {
  range: 3,
  header: 1
});

const products = data
  .map((row, index) => ({
    id: index + 1,
    name: row[4],
    searchName: row[4]?.toLowerCase(),
    price: row[13],
    stock: row[14]
  }))
  .filter(item => item.name);


app.get('/', (req, res) => {
    res.render('index');
});


app.get('/add', (req, res) => {

    const q = (req.query.q || '').toLowerCase();

  if (q.length < 2) {
    return res.json([]);
  }

  const result = [];
  const limit = 20;

  for (let i = 0; i < products.length; i++) {
    if (products[i].searchName.includes(q)) {
      result.push(products[i]);

      if (result.length === limit) {
        break;
      }
    }
  }

  res.render('add', {
    products : "sd"
  });
    
});



app.listen(port, () => {
    console.log(`Server started on port ${port}`);
});



