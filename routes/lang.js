const express = require('express');
const router = express.Router();

router.get('/:lang', (req, res) => {

    const lang = req.params.lang;

    if (['ru', 'uk'].includes(lang)) {

        res.cookie('lang', lang, {
            maxAge: 365 * 24 * 60 * 60 * 1000
        });

    }

    res.redirect(req.get('Referer') || '/');

});

module.exports = router;