module.exports = (req, res, next) => {

    let lang = req.cookies.lang;

    if (!lang) {
        lang = req.acceptsLanguages('ru', 'uk') || 'ru';

        res.cookie('lang', lang, {
            maxAge: 365 * 24 * 60 * 60 * 1000
        });
    }

    req.setLocale(lang);

    res.locals.__ = res.__;
    res.locals.lang = lang;

    next();

};