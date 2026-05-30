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



app.listen(port, () => {
    console.log(`Server started on port ${port}`);
});





// console.log(fuse.search('клаппн'));