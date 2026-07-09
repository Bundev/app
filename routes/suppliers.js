const express = require('express');
const router = express.Router();

const auth = require('../middleware/auth');
const suppliersController = require('../controllers/suppliers.controller');

router.get('/', auth, suppliersController.index);

router.post('/add', auth, suppliersController.store);

module.exports = router;