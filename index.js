const express = require('express');

const app = express();

app.set('view engine', 'ejs');
app.use(express.static('public')); 

const port = 3000;

app.get('/', (req, res) => {
    res.render('index', { title: 'Home Page' });
});

app.listen(port, () => {
    console.log(`Server started on port ${port}`);
});
