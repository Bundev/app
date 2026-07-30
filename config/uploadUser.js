const multer = require('multer');
const path = require('path');
const fs = require('fs');

const uploadDir = path.join(
    __dirname,
    '..',
    'public',
    'uploads',
    'avatars'
);

if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(
        uploadDir,
        { recursive: true }
    );
}

const storage = multer.diskStorage({

    destination(req, file, cb) {
        cb(null, uploadDir);
    },

    filename(req, file, cb) {
        const extensions = {
            'image/jpeg': '.jpg',
            'image/png': '.png',
            'image/webp': '.webp'
        };
        const suffix = Math.random()
            .toString(36)
            .slice(2, 10);

        cb(
            null,
            `${Date.now()}-${suffix}${extensions[file.mimetype]}`
        );
    }

});

module.exports = multer({
    storage,
    limits: {
        fileSize: 5 * 1024 * 1024
    },
    fileFilter(req, file, cb) {
        const allowedTypes = new Set([
            'image/jpeg',
            'image/png',
            'image/webp'
        ]);

        if (!allowedTypes.has(file.mimetype)) {
            return cb(
                new Error('Допустимы только изображения JPG, PNG или WEBP.')
            );
        }

        return cb(null, true);
    }
});
