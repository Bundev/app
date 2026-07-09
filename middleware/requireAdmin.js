// Middleware проверки администратора
function requireAdmin(req,res,next) {

    if (!req.session.user) {

        return res.redirect(
            '/login'
        );

    }

    if (
        req.session.user.role !==
        'admin'
    ) {

        return res.status(403).send(
            'Доступ запрещён'
        );

    }

    next();

}

module.exports = requireAdmin;