const express = require('express');
const router = express.Router();
const db = require('../config/db');
const auth = require('../middleware/auth');
router.get('/generate', auth, async (req, res) => {
        try {

            let barcode;

            while (true) {

                barcode =
                    Math.floor(
                        1000000000000 +
                        Math.random() *
                        9000000000000
                    ).toString();

                const [[exists]] =
                    await db.query(
                        `
                        SELECT id
                        FROM products
                        WHERE barcode = ?
                        LIMIT 1
                        `,
                        [barcode]
                    );

                if (!exists) {
                    break;
                }

            }

            res.json({
                barcode
            });

        } catch (error) {

            console.error(error);

            res.status(500).json({
                success: false
            });

        }

    }
);
module.exports = router;