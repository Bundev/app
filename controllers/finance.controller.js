const financeService = require('../services/finance.service');
const page = require('../helpers/page');

exports.cash = async (req, res) => {

    try {

        const data =
            await financeService.getCashData(req);

        res.render(
            'finance-cash',
            {
                ...data,
                ...page(req, 'finance-cash', [
                    { title: 'Касса и Финансы' }
                ])
            }
        );

    } catch (error) {

        console.error(error);

        res.status(500).send(
            'Ошибка сервера'
        );

    }

};
