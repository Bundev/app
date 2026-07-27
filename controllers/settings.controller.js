const db = require('../config/db');
const page = require('../helpers/page');

exports.index = async (req, res) => {

    if (
        !req.session.user ||
        req.session.user.role !== 'admin'
    ) {
        return res.redirect('/dashboard');
    }

    const companyId = req.session.user.company_id;

    const [[stores], [users], [companies]] = await Promise.all([
        db.execute(
            `
            SELECT *
            FROM stores
            WHERE company_id = ?
            ORDER BY name ASC
            `,
            [companyId]
        ),
        db.execute(
            `
            SELECT *
            FROM user
            WHERE company_id = ?
            ORDER BY name
            `,
            [companyId]
        ),
        db.execute(
            `
            SELECT id, name, status, created_at
            FROM companies
            WHERE id = ?
            LIMIT 1
            `,
            [companyId]
        )
    ]);

    const tab = req.query.tab || 'company';

    res.render('settings', {
        titleKey: 'title.settings',
        activeMenu: 'settings',
        activeSettingsTab: tab,
        stores,
        users,
        company: companies[0] || null,
        companySuccess: req.session.companySuccess || null,
        companyError: req.session.companyError || null,
        storeSuccess: req.session.storeSuccess || null,
        storeError: req.session.storeError || null,
        ...page(req, 'settings', [
            { title: req.__('title.settings') }
        ])
    });

    delete req.session.companySuccess;
    delete req.session.companyError;
    delete req.session.storeSuccess;
    delete req.session.storeError;

};

exports.updateCompany = async (req, res) => {

    if (!req.session.user || req.session.user.role !== 'admin') {
        return res.redirect('/dashboard');
    }

    const name = (req.body.name || '').trim();

    if (!name) {
        req.session.companyError = 'Укажите название компании.';
        return res.redirect('/settings?tab=company');
    }

    if (name.length > 255) {
        req.session.companyError = 'Название компании не должно превышать 255 символов.';
        return res.redirect('/settings?tab=company');
    }

    try {
        const [result] = await db.execute(
            `
            UPDATE companies
            SET name = ?
            WHERE id = ?
            LIMIT 1
            `,
            [name, req.session.user.company_id]
        );

        if (!result.affectedRows) {
            req.session.companyError = 'Компания не найдена.';
            return res.redirect('/settings?tab=company');
        }

        req.session.companySuccess = 'Данные компании сохранены.';
        return res.redirect('/settings?tab=company');

    } catch (error) {
        console.error(error);
        req.session.companyError = 'Не удалось сохранить данные компании.';
        return res.redirect('/settings?tab=company');
    }

};
