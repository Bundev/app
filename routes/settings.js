const express = require('express');
const router = express.Router();

const auth = require('../middleware/auth');
const settingsController = require('../controllers/settings.controller');

router.get('/', auth, settingsController.index);
router.post('/company', auth, settingsController.updateCompany);

module.exports = router;
