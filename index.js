const express = require('express');
const XLSX = require('xlsx');
const Fuse = require('fuse.js');





const app = express();

app.set('view engine', 'ejs');
app.use(express.static('public')); 

const port = 3000;


const workbook = XLSX.readFile('./db/db.xls');
const sheet = workbook.Sheets['TDSheet'];

const data = XLSX.utils.sheet_to_json(sheet, {
  range: 3,
  header: 1
});

const products = data
  .map((row, index) => ({
    id: index + 1,
    name: row[4]
      ?.replace(/,\s*шт\.?$/i, '')
      .trim(),
    searchName: row[4]?.toLowerCase()
      ?.toLowerCase()
      .replace(/,\s*шт\.?$/i, '')
      .replace(/[(),№]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim(),
    price: row[13],
    stock: row[14]
  }))
  .filter(item => item.name);


app.get('/', (req, res) => {
    res.render('index',{
      breadcrumbs: [
      {
        title: 'Главная',
        url: '/'
      }
    ]
    });
});


app.get('/sales', (req, res) => {
  res.render('sales', {
    breadcrumbs: [
      {
        title: 'Главная',
        url: '/'
      },
      {
        title: 'Продажи',
        url: '/sales'
      }
    ]
  });
});


app.get('/search', (req, res) => {

    const q = (req.query.q || '').toLowerCase();

  if (q.length < 2) {
    return res.json([]);
  }

  const result = [];
  const limit = 200;

  for (let i = 0; i < products.length; i++) {
    if (products[i].searchName.includes(q)) {
      result.push(products[i]);

      if (result.length === limit) {
        break;
      }
    }
  }

 res.json(result);
    
});

app.get('/new', (req, res) => {
  res.render('new', {
    title: 'Поиск товаров',
    breadcrumbs: [
      {
        title: 'Главная',
        url: '/'
      },
      {
        title: 'Продажи',
        url: '/sales'
      },
      {
        title: "Новый счет"
      }
    ]
  });
});

app.get('/products', (req, res) => {
  res.render('products', {
    breadcrumbs: [
      {
        title: 'Главная',
        url: '/'
      },
      {
        title: 'Товары',
        url: '/products'
      }
    ]
  });
});



app.listen(port, () => {
    console.log(`Server started on port ${port}`);
});



