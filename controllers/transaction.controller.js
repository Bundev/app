const db = require('../config/db');

exports.store = async (req, res) => {

    try {

        const companyId =
            req.session.user.company_id;

        const userId =
            req.session.user.id;

        const {
            type,
            amount,
            payment_method,
            description
        } = req.body;

        await db.query(
            `
            INSERT INTO transactions
            (
                company_id,
                user_id,
                type,
                amount,
                payment_method,
                description
            )
            VALUES (?, ?, ?, ?, ?, ?)
            `,
            [
                companyId,
                userId,
                type,
                Number(amount),
                payment_method,
                description.trim()
            ]
        );

        res.redirect('/finance/cash');

    } catch (error) {

        console.error(error);

        res.status(500).send('Ошибка');

    }

};