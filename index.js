const express = require('express');
const XLSX = require('xlsx');
const Fuse = require('fuse.js');
const cookieParser = require('cookie-parser');
const i18n = require('i18n');
const session = require('express-session');
const statuses =require('./config/statuses');



const fs = require('fs');
const path = require('path');
const { name } = require('ejs');


const app = express();

app.set('view engine', 'ejs');
app.use(express.static('public'));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(session({
    secret: 'retailpro-secret',
    resave: false,
    saveUninitialized: false
}));

app.use(express.urlencoded({
    extended: true
}));

const port = 3000;

app.use(cookieParser());

i18n.configure({
    locales: ['ru', 'uk'],
    defaultLocale: 'ru',
    directory: path.join(__dirname, 'locales'),
    objectNotation: true
});

app.use(i18n.init);

// Автоматическое определение языка
app.use((req, res, next) => {
    let lang = req.cookies.lang;

    if (!lang) {
        lang = req.acceptsLanguages('ru', 'uk') || 'ru';
        res.cookie('lang', lang, { maxAge: 365 * 24 * 60 * 60 * 1000 });
    }

    req.setLocale(lang);
    res.locals.__ = res.__;
    res.locals.lang = lang;

    next();
});




const workbook = XLSX.readFile('./db/db.xls');
const sheet = workbook.Sheets['TDSheet'];

const data = XLSX.utils.sheet_to_json(sheet, {
  range: 3,
  header: 1
});

const products = data.filter(row =>
      row[4] &&
      row[4] !== 'Номенклатура, Упаковка' &&
      !isNaN(row[13])
  ).map((row, index) => ({
    id: index + 1,
    name: row[4]
      ?.replace(/,\s*шт\.?$/i, '')
      .trim(),
    unit: row[4]
        .toLowerCase()
        .includes(', м')
            ? 'м'
            : 'шт',
    searchName: row[4]?.toLowerCase()
      ?.toLowerCase()
      .replace(/,\s*шт\.?$/i, '')
      .replace(/[(),№]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim(),
    price: Math.round(
    row[13] > 100
        ? row[13] * 1.1
        : row[13] * 1.2
    ),
    stock: row[14]
  }))
  .filter(item => item.name);

function auth(req, res, next) {

    if (!req.session.user) {

        return res.redirect('/login');

    }

    next();

}

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


function renderDashboard(req, res) {
  

    const nextInvoiceNumber =
        getNextInvoiceNumber();

    const invoicesDir = path.join(
        __dirname,
        'data',
        'invoices'
    );

    let invoices = [];

    if (fs.existsSync(invoicesDir)) {

        const files = fs.readdirSync(invoicesDir);

        invoices = files.map(file => {

            return JSON.parse(
                fs.readFileSync(
                    path.join(invoicesDir, file),
                    'utf8'
                )
            );

        });

    }

    const today =
        new Date().toISOString().split('T')[0];

    const salesToday =
        invoices
            .filter(
                invoice => invoice.date === today &&
                invoice.status === 'completed'
            )
            .reduce(
                (sum, invoice) =>
                    sum + Number(invoice.total),
                0
            );

    const invoicesToday =
        invoices.filter(
            invoice => invoice.date === today &&
            invoice.status === 'completed'
        ).length;

    const clientsCount =
        new Set(
            invoices.map(
                invoice => invoice.customer
            )
        ).size;

    const productsCount =
        invoices.reduce(
            (total, invoice) =>
                total +
                (invoice.items
                    ? invoice.items.length
                    : 0),
            0
        );
    const productsToday =
    invoices
        .filter(invoice =>
            invoice.date === today &&
            invoice.status === 'completed'
        )
        .reduce((total, invoice) => {

            const items =
                invoice.items || [];

            return total +
                items.reduce(
                    (sum, item) =>
                        sum + Number(item.qty || 0),
                    0
                );

        }, 0);

    invoices.sort((a, b) =>
        Number(b.number) -
        Number(a.number)
    );

    const latestInvoices =
        invoices.slice(0, 10);

    res.render('dashboard', {
        titleKey: 'title.dashboard',
        activeMenu: 'dashboard',

        nextInvoiceNumber,

        invoices: latestInvoices,

        salesToday,
        invoicesToday,
        clientsCount,
        productsCount,
        productsToday,
        statuses,
        script: [
            {
                src: 'dashboard.js',
            }
        ],
        style: [
            {
                href: 'dashboard.css',
            }
        ],
        breadcrumbs: [
            {
                title: req.__('title.dashboard'),
                url: '/'
            }
        ]
    });
}


// Роутер панели упражнения
app.get('/', auth, renderDashboard);
app.get('/dashboard', auth, renderDashboard);

// Продажи
app.get('/sales', auth, (req, res) => {

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
        titleKey: 'title.sales',
        nextInvoiceNumber,
        invoices,
        activeMenu: 'sales',
        statuses,
        script: [
            {
                src: 'sales.js',
            }
        ],
        style: [
            {
                href: 'sales.css',
            }
        ],
        breadcrumbs: [
            {
                title: req.__('title.dashboard'),
                url: '/'
            },
            {
                title: req.__('title.sales'),
                url: '/sales'
            }
        ]
    });

});


app.get('/search', auth, (req, res) => {

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

app.get('/new/:id', auth, (req, res) => {
  const id = req.params.id;

  res.render('new', {
    titleKey: 'title.new',
    invoiceId: id,
    activeMenu: 'sales',
    statuses,
    script: [
            {
                src: 'new.js',
            }
        ],
        style: [
            {
                href: 'new.css',
            }
        ],
    breadcrumbs: [
      {
        title: req.__('title.dashboard'),
        url: '/'
      },
      {
        title: req.__('title.sales'),
        url: '/sales'
      },
      {
        title: req.__('title.new'), 
      }
    ]
  });
});
app.get('/invoices/:id', auth, (req, res) => {

    const id = req.params.id;

    const filePath = path.join(
        __dirname,
        'data',
        'invoices',
        `${id}.json`
    );

    if (!fs.existsSync(filePath)) {
        return res.status(404).send('Чек не найден');
    }

    const invoice = JSON.parse(
        fs.readFileSync(filePath, 'utf8')
    );

    res.render('invoices', {
        titleKey: req.__('title.invoices'),
        invoice,
        invoiceId: id,
        activeMenu: 'sales',
        statuses,
        script: [
            {
                src: 'invoices.js',
            }
        ],
        style: [
            {
                href: 'invoices.css',
            }
        ],
        breadcrumbs: [
            {
                title: req.__('title.dashboard'),
                url: '/'
            },
            {
                title: req.__('title.sales'),
                url: '/sales'
            },
            {
                title: req.__('title.invoices'),
            }
        ]
    });

});
// Роутер товаров
app.get('/products', auth, (req, res) => {

    res.render('products', {
        titleKey: 'title.products',
        activeMenu: 'products',
        products,
        script: [
            {
                src: 'products.js',
            }
        ],
        style: [
            {
                href: 'products.css',
            }
        ],
        breadcrumbs: [
            {
                title: req.__('title.dashboard'),
                url: '/'
            },
            {
                title: req.__('title.products')
            }
        ]
    });

});
app.get('/login', (req, res) => {
    if (req.session.user) {
        return res.redirect('/dashboard');
    }
    res.render('login', {
        titleKey: 'login',
        script: [
            {
                src: 'login.js',
            }
        ],
        style: [
            {
                href: 'login.css',
            }
        ],
    });

});


app.get('/logout', (req, res) => {

    req.session.destroy(err => {

        if (err) {
            return res.redirect('/dashboard');
        }

        res.redirect('/login');

    });

});

app.get('/invoice/:id/delete-item/:index', (req, res) => {

    const invoiceId =
        req.params.id;

    const itemIndex =
        Number(req.params.index);

    const filePath = path.join(
        __dirname,
        'data',
        'invoices',
        `${invoiceId}.json`
    );

    if (!fs.existsSync(filePath)) {

        return res.redirect('/sales');

    }

    const invoice = JSON.parse(
        fs.readFileSync(
            filePath,
            'utf8'
        )
    );

    invoice.items.splice(
        itemIndex,
        1
    );

    invoice.total =
        invoice.items.reduce(
            (sum, item) =>
                sum + Number(item.sum),
            0
        );

    fs.writeFileSync(
        filePath,
        JSON.stringify(
            invoice,
            null,
            2
        )
    );

    res.redirect(
        `/invoices/${invoiceId}`
    );

});

app.post('/login', (req, res) => {

    const { login, password } = req.body;

    if (
        login === 'admin' &&
        password === '123456'
    ) {

        req.session.user = {
            login
        };

        return res.redirect('/dashboard');
    }

    res.redirect('/login');

});



// Сохранение чека
app.post('/save-invoice', auth, (req, res) => {

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

app.post('/invoice/status/:id', (req, res) => {

    const invoiceId =
        req.params.id;

    const filePath = path.join(
        __dirname,
        'data',
        'invoices',
        `${invoiceId}.json`
    );

    if (!fs.existsSync(filePath)) {

        return res.redirect('/sales');

    }

    const invoice = JSON.parse(
        fs.readFileSync(
            filePath,
            'utf8'
        )
    );

    invoice.status =
        req.body.status;

    fs.writeFileSync(
        filePath,
        JSON.stringify(
            invoice,
            null,
            2
        )
    );

    res.redirect(
        `/invoices/${invoiceId}`
    );

});

app.post('/invoice/delete/:id', (req, res) => {

    const filePath = path.join(
        __dirname,
        'data',
        'invoices',
        `${req.params.id}.json`
    );

    if (fs.existsSync(filePath)) {

        fs.unlinkSync(filePath);

    }

    res.redirect('/sales');

});
app.get('/invoice/delete/:id', (req, res) => {

    const invoiceId =
        req.params.id;

    const filePath = path.join(
        __dirname,
        'data',
        'invoices',
        `${invoiceId}.json`
    );

    if (fs.existsSync(filePath)) {

        fs.unlinkSync(filePath);

    }

    res.redirect('/sales');

});


// Переключение языка
app.get('/lang/:lang', (req, res) => {
    const lang = req.params.lang;

    if (['ru', 'uk'].includes(lang)) {
        res.cookie('lang', lang, {
            maxAge: 365 * 24 * 60 * 60 * 1000
        });
    }

    res.redirect(req.get('Referer') || '/');
});



app.listen(port, () => {
    console.log(`Server started on port ${port}`);
});

