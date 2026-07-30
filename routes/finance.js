const express = require('express');
const router = express.Router();

const auth = require('../middleware/auth');
const requireAdmin = require('../middleware/requireAdmin');

const financeController = require('../controllers/finance.controller');
const transactionController = require('../controllers/transaction.controller');

router.use(auth, requireAdmin);

router.get('/cash', financeController.cash);

router.post('/transaction', transactionController.store);

module.exports = router;
