const express = require('express');
const router = express.Router();

const auth = require('../middleware/auth');
const requireAdmin = require('../middleware/requireAdmin');
const suppliersController = require('../controllers/suppliers.controller');

router.use(auth, requireAdmin);

router.get('/', suppliersController.index);

router.post('/add', suppliersController.store);

router.post('/edit/:id', suppliersController.update);

router.post('/archive/:id', suppliersController.archive);

module.exports = router;
