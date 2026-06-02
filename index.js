const express = require('express');
const XLSX = require('xlsx');
const Fuse = require('fuse.js');


const fs = require('fs');
const path = require('path');


const app = express();

app.set('view engine', 'ejs');
app.use(express.static('public')); 
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

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
    price: row[13]+(row[13] * 20 / 100),
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

// Продажи
app.get('/sales', (req, res) => {

    const nextInvoiceNumber =
        getNextInvoiceNumber();

    const invoicesDir = path.join(
        __dirname,
        'data',
        'invoices'
    );

    let invoices = [];

    if (fs.existsSync(invoicesDir)) {

        const files =
            fs.readdirSync(invoicesDir);

        invoices = files.map(file => {

            const filePath = path.join(
                invoicesDir,
                file
            );

            return JSON.parse(
                fs.readFileSync(
                    filePath,
                    'utf8'
                )
            );

        });

        invoices.sort((a, b) =>
            Number(b.number) -
            Number(a.number)
        );
    }

    res.render('sales', {
        title: 'Продажи',
        nextInvoiceNumber,
        invoices,
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

app.get('/new/:id', (req, res) => {
  const id = req.params.id;

  res.render('new', {
    title: `Новый чек №${id}`,
    invoiceId: id,
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
        title: `Новый чек №${id}`, 
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


// Сохранение чека
function getNextInvoiceNumber() {

    const dir = path.join(__dirname, 'data', 'invoices');

    if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
    }

    const files = fs.readdirSync(dir);

    let max = 0;

    files.forEach(file => {

        if (file.endsWith('.json')) {

            const num = parseInt(
                file.replace('.json', '')
            );

            if (!isNaN(num) && num > max) {
                max = num;
            }
        }

    });

    return String(max + 1).padStart(6, '0');
}

app.post('/save-invoice', (req, res) => {

    const invoice = req.body;

    const invoiceNumber = getNextInvoiceNumber();

    invoice.number = invoiceNumber;

    const filePath = path.join(
        __dirname,
        'data',
        'invoices',
        `${invoiceNumber}.json`
    );

    fs.writeFile(
        filePath,
        JSON.stringify(invoice, null, 2),
        err => {

            if (err) {
                console.error(err);

                return res.status(500).json({
                    success: false
                });
            }

            res.json({
                success: true,
                number: invoiceNumber
            });

        }
    );

});
app.listen(port, () => {
    console.log(`Server started on port ${port}`);
});



