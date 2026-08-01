const multer = require('multer');

module.exports = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: 25 * 1024 * 1024, files: 1 },
    fileFilter: (req, file, callback) => {
        const isJson = file.mimetype === 'application/json' || /\.json$/i.test(file.originalname);
        callback(isJson ? null : new Error('INVALID_BACKUP_TYPE'), isJson);
    }
});
