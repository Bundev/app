const db = require('../config/db');
const page = require('../helpers/page');
const { createCompanyBackup } = require('../services/company-backup.service');
const { restoreCompanyBackup } = require('../services/company-restore.service');

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
        backupSuccess: req.session.backupSuccess || null,
        backupError: req.session.backupError || null,
        ...page(req, 'settings', [
            { title: req.__('title.settings') }
        ])
    });

    delete req.session.companySuccess;
    delete req.session.companyError;
    delete req.session.storeSuccess;
    delete req.session.storeError;
    delete req.session.backupSuccess;
    delete req.session.backupError;

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

exports.downloadBackup = async (req, res) => {
    if (!req.session.user || req.session.user.role !== 'admin') {
        return res.status(403).send(req.__('backup.forbidden'));
    }

    try {
        const backup = await createCompanyBackup(req.session.user.company_id);
        const safeName = String(backup.company.name || 'company')
            .trim()
            .replace(/[^a-zA-Z0-9а-яА-ЯёЁіІїЇєЄ_-]+/g, '-')
            .replace(/^-+|-+$/g, '')
            .slice(0, 60) || 'company';
        const date = new Date().toISOString().slice(0, 10);
        const fileName = `retailpro-backup-${safeName}-${date}.json`;

        res.setHeader('Content-Type', 'application/json; charset=utf-8');
        res.setHeader(
            'Content-Disposition',
            `attachment; filename="retailpro-backup-${date}.json"; filename*=UTF-8''${encodeURIComponent(fileName)}`
        );
        res.setHeader('Cache-Control', 'no-store');
        return res.send(JSON.stringify(backup, null, 2));

    } catch (error) {
        console.error(error);
        return res.status(500).send(req.__('backup.failed'));
    }
};

exports.importBackup = async (req, res) => {
    if (!req.session.user || req.session.user.role !== 'admin') {
        return res.status(403).send(req.__('backup.forbidden'));
    }

    if (!req.file || !req.file.buffer) {
        req.session.backupError = req.__('backup.fileRequired');
        return res.redirect('/settings?tab=company');
    }

    try {
        const backup = JSON.parse(req.file.buffer.toString('utf8'));
        const report = await restoreCompanyBackup(
            req.session.user.company_id,
            req.session.user.id,
            backup
        );
        const inserted = Object.values(report.inserted).reduce((sum, count) => sum + count, 0);
        const skipped = Object.values(report.skipped).reduce((sum, count) => sum + count, 0);

        req.session.backupSuccess = req.__('backup.importSuccess', inserted, skipped);
        return res.redirect('/settings?tab=company');

    } catch (error) {
        console.error(error);
        req.session.backupError = ['INVALID_BACKUP', 'BACKUP_TOO_LARGE'].includes(error.code)
            ? req.__('backup.invalidFile')
            : req.__('backup.importFailed');
        return res.redirect('/settings?tab=company');
    }
};
