const express = require('express');
const router = express.Router();

const auth = require('../middleware/auth');
const settingsController = require('../controllers/settings.controller');
const uploadBackup = require('../config/upload-backup');

router.get('/', auth, settingsController.index);
router.post('/company', auth, settingsController.updateCompany);
router.get('/backup', auth, settingsController.downloadBackup);
router.post('/backup/import', auth, (req, res, next) => {
    uploadBackup.single('backup')(req, res, error => {
        if (!error) return settingsController.importBackup(req, res, next);
        req.session.backupError = req.__('backup.invalidFile');
        return res.redirect('/settings?tab=company');
    });
});

module.exports = router;
