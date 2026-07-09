const bwipjs = require('bwip-js');

exports.generate = async (req, res) => {
    try {

        const png = await bwipjs.toBuffer({
            bcid: 'code128',
            text: req.params.code,
            scale: 3,
            height: 10,
            includetext: true,
            textxalign: 'center'
        });

        res.type('png');
        res.send(png);

    } catch (error) {

        console.error(error);

        res.status(500).send(error.message);

    }
};