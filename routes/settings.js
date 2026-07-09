const express = require('express');
const router = express.Router();

const auth = require('../middleware/auth');
const settingsController = require('../controllers/settings.controller');

router.get('/', auth, settingsController.index);

module.exports = router;