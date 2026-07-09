const express = require('express');
const router = express.Router();

const auth = require('../middleware/auth');

const financeController = require('../controllers/finance.controller');
const transactionController = require('../controllers/transaction.controller');

router.get('/cash', auth, financeController.cash);

router.post('/transaction', auth, transactionController.store);

module.exports = router;