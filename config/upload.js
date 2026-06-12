const multer = require('multer');
const path = require('path');

const fs = require('fs');

const uploadDir =
    'public/uploads/imports';

if (!fs.existsSync(uploadDir)) {

    fs.mkdirSync(
        uploadDir,
        { recursive: true }
    );

}

const storage = multer.diskStorage({

    destination(req, file, cb) {

        cb(
            null,
            'public/uploads/avatars'
        );

    },

    filename(req, file, cb) {

        cb(
            null,
            Date.now() +
            path.extname(file.originalname)
        );

    }

});

module.exports =
    multer({
        storage
    });