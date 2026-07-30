const express = require('express');
const router = express.Router();

const auth = require('../middleware/auth');
const requireAdmin = require('../middleware/requireAdmin');
const purchasesController = require('../controllers/purchases.controller');

router.use(auth, requireAdmin);

router.get('/', purchasesController.index);

router.get('/add', purchasesController.showAdd);

router.post('/add', purchasesController.store);

router.get('/view/:id', purchasesController.view);

module.exports = router;
