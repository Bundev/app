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
    res.render('add');
});



app.listen(port, () => {
    console.log(`Server started on port ${port}`);
});



