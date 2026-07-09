const express = require('express');
const router = express.Router();

const auth = require('../middleware/auth');
const purchasesController = require('../controllers/purchases.controller');

router.get('/', auth, purchasesController.index);

router.get('/add', auth, purchasesController.showAdd);

router.post('/add', auth, purchasesController.store);

router.get('/view/:id', auth, purchasesController.view);

module.exports = router;