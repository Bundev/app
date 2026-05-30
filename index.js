const express = require('express');
const XLSX = require('xlsx');
const Fuse = require('fuse.js');

const app = express();

app.set('view engine', 'ejs');
app.use(express.static('public')); 

const port = 3000;

app.get('/', (req, res) => {
    res.render('index');
});
app.get('/add', (req, res) => {
    res.render('add', { title: 'Add Page' });
});



app.listen(port, () => {
    console.log(`Server started on port ${port}`);
});




const workbook = XLSX.readFile('./namiclothura.xls');
const sheet = workbook.Sheets['TDSheet'];

const data = XLSX.utils.sheet_to_json(sheet, {
  range: 3, // начать чтение с 4-й строки
  header: 1
});

const products = data.map((row, index) => ({
  id: index + 1,
  name: row[4],
  price: row[13],
  stock: row[14],
})).filter(item => item.name);


const fuse = new Fuse(products, {
  keys: ['name'],
  threshold: 0.3
});

console.log(fuse.search('клаппн'));

console.log();
console.log();