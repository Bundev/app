const express = require('express');
const router = express.Router();

const auth = require('../middleware/auth');

// Если renderDashboard находится в отдельном файле
const { renderDashboard } = require('../controllers/dashboard.controller');

// Если пока он еще в index.js, то его тоже нужно будет перенести.
router.get('/', auth, renderDashboard);
router.get('/dashboard', auth, renderDashboard);

module.exports = router;