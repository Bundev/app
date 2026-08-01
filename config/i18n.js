const i18n = require('i18n');
const path = require('path');

i18n.configure({
    locales: ['ru', 'uk'],
    defaultLocale: 'ru',
    directory: path.join(__dirname, '../locales'),
    objectNotation: true,
    updateFiles: false,
    syncFiles: false,
    autoReload: true
});

module.exports = i18n;
