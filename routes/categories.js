const express = require('express');
const router = express.Router();
const db = require('../config/db');
const auth = require('../middleware/auth');

// Роут создает новую ктегорию
router.post(['/ajax-create', '/categories/ajax-create'], auth, async (req, res) => {

    const { name } = req.body;

    const [result] = await db.query(
        `INSERT INTO categories
        (name, company_id)
        VALUES (?, ?)`,
        [
            name,
            req.session.user.company_id
        ]
    );

    res.json({
        success: true,
        id: result.insertId,
        name
    });

});

module.exports = router;
