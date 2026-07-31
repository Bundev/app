const XLSX = require('xlsx');

const unitRegex = /(?:,\s*)(шт|кг|м)(?:\.?)\s*$/i;

module.exports = filePath => {
    const workbook = XLSX.readFile(filePath);
    const sheet = workbook.Sheets.TDSheet;

    if (!sheet) {
        const error = new Error(
            'В файле не найден обязательный лист TDSheet'
        );
        error.statusCode = 400;
        throw error;
    }

    const rows = XLSX.utils.sheet_to_json(sheet, {
        range: 6,
        header: 1
    });
    const products = [];
    let currentCategory = null;

    for (const row of rows) {
        const category = String(row[0] || '').trim();

        if (
            category &&
            !['Артикул', 'Цінова група', 'Цінова группа'].includes(category) &&
            !row[4]
        ) {
            currentCategory = category;
            continue;
        }

        if (!row[4] || isNaN(row[13]) || String(row[13]).trim() === '') {
            continue;
        }

        const rawName = String(row[4]).trim();
        const unitMatch = rawName.match(unitRegex);
        const unit = unitMatch ? unitMatch[1].toLowerCase() : 'шт';
        const name = (
            unitMatch ? rawName.substring(0, unitMatch.index) : rawName
        ).replace(/,\s*$/, '').trim();
        const quantity = Number(row[14] || 0);

        products.push({
            category: currentCategory || 'Без категории',
            name,
            unit,
            purchasePrice: Number(row[13]),
            quantity: Number.isFinite(quantity) ? quantity : 0
        });
    }

    return products;
};
