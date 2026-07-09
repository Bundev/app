const financeService = require('../services/finance.service');

exports.cash = async (req, res) => {

    try {

        const data =
            await financeService.getCashData(req);

        res.render(
            'finance-cash',
            data
        );

    } catch (error) {

        console.error(error);

        res.status(500).send(
            'Ошибка сервера'
        );

    }

};