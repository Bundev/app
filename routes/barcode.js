const express = require('express');
const router = express.Router();

const barcodeController = require('../controllers/barcode.controller');

router.get('/:code', barcodeController.generate);

module.exports = router;