const db = require('../config/db');

exports.index = async (req, res) => {

    if (
        !req.session.user ||
        req.session.user.role !== 'admin'
    ) {
        return res.redirect('/dashboard');
    }

    const [stores] = await db.execute(
        `
        SELECT *
        FROM stores
        WHERE company_id = ?
        ORDER BY name ASC
        `,
        [req.session.user.company_id]
    );

    const [users] = await db.execute(
        `
        SELECT *
        FROM user
        WHERE company_id = ?
        ORDER BY name
        `,
        [req.session.user.company_id]
    );

    const tab = req.query.tab || 'company';

    res.render('settings', {
        titleKey: 'title.settings',
        activeMenu: 'settings',
        activeSettingsTab: tab,
        stores,
        users,
        script: [
            {
                src: 'settings.js'
            }
        ],
        style: [
            {
                href: 'settings.css'
            }
        ],
        breadcrumbs: [
            {
                title: req.__('title.dashboard'),
                url: '/'
            },
            {
                title: req.__('title.settings')
            }
        ]
    });

};