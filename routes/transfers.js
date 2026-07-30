const express = require('express');
const auth = require('../middleware/auth');
const requireAdmin = require('../middleware/requireAdmin');
const transfersController = require('../controllers/transfers.controller');

const router = express.Router();

router.use(auth, requireAdmin);

router.get('/', transfersController.index);
router.get('/add', transfersController.showAdd);
router.get('/products', transfersController.products);
router.post('/add', transfersController.store);
router.get('/view/:id', transfersController.view);

module.exports = router;
