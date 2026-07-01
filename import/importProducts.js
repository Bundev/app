const XLSX = require('xlsx');

module.exports = async (db, filePath, storeId, companyId) => {
    const workbook = XLSX.readFile(filePath);
    const sheet = workbook.Sheets['TDSheet'];
    
    if (!sheet) {
        throw new Error('Лист с именем "TDSheet" не найден в файле импорта.');
    }

    const data = XLSX.utils.sheet_to_json(sheet, {
        range: 3,
        header: 1
    });

    let currentCategory = null;
    const products = [];
    
    // Регулярное выражение для поиска единиц измерения на конце строки
    const unitRegex = /(?:,\s*)(шт|кг|м)(?:\.?)\s*$/i;

    // Шаг 1: Первичный парсинг данных из файла
    for (const row of data) {
        const category = String(row[0] || '').trim();

        // Определение текущей категории товара
        if (category && !['Артикул', 'Цінова группа'].includes(category) && !row[4]) {
            currentCategory = category;
            continue;
        }

        // Валидация строки товара
        if (row[4] && !isNaN(row[13]) && String(row[13]).trim() !== '') {
            const rawName = String(row[4]).trim();
            let unit = 'шт'; 
            let cleanedName = rawName;

            // Извлекаем единицу измерения и отсекаем её часть
            const unitMatch = rawName.match(unitRegex);
            if (unitMatch) {
                unit = unitMatch[1].toLowerCase();
                cleanedName = rawName.substring(0, unitMatch.index).trim();
            }

            // Удаляем висячую запятую на конце названия, если она осталась
            cleanedName = cleanedName.replace(/,\s*$/, '').trim();

            products.push({
                category: currentCategory,
                sku: null,
                name: cleanedName,
                purchase_price: Number(row[13]),
                quantity: Number(row[14] || 0),
                unit: unit
            });
        }
    }

    // Шаг 4: Дедупликация массива товаров внутри файла импорта
    // ВЫНЕСЛИ СЮДА, чтобы переменная была доступна во всем модуле, включая return
    const uniqueProducts = new Map();
    for (const product of products) {
        const key = product.sku 
            ? `sku:${String(product.sku).trim().toLowerCase()}` 
            : `name:${String(product.name).trim().toLowerCase()}`;
        uniqueProducts.set(key, product);
    }

    let createdCount = 0;
    let updatedCount = 0;
    let categoriesCreated = 0;
    
    const connection = await db.getConnection();

    try {
        await connection.beginTransaction();

        // Шаг 2: Обработка категорий
        const [existingCategories] = await connection.execute(
            `SELECT id, name FROM categories WHERE company_id = ?`,
            [companyId]
        );

        const categoryMap = new Map(
            existingCategories.map(cat => [cat.name.trim().toLowerCase(), cat.id])
        );

        for (const product of uniqueProducts.values()) {
            if (!product.category) continue;

            const catKey = product.category.trim().toLowerCase();
            if (!categoryMap.has(catKey)) {
                const [result] = await connection.execute(
                    `INSERT INTO categories (company_id, name) VALUES (?, ?)`,
                    [companyId, product.category]
                );
                categoryMap.set(catKey, result.insertId);
                categoriesCreated++;
            }
        }

        // Шаг 3: Загрузка существующих товаров (Защита от #1062)
        const [existingProducts] = await connection.execute(
            `SELECT id, sku, name, purchase_price, sale_price, category_id, unit 
             FROM products 
             WHERE company_id = ?`,
            [companyId]
        );

        const productMap = new Map();
        for (const item of existingProducts) {
            if (item.sku) {
                productMap.set(`sku:${String(item.sku).trim().toLowerCase()}`, item);
            }
            if (item.name) {
                productMap.set(`name:${String(item.name).trim().toLowerCase()}`, item);
            }
        }

        // Шаг 5: Основной цикл обновления/создания записей
        for (const product of uniqueProducts.values()) {
            const lookupKey = product.sku 
                ? `sku:${String(product.sku).trim().toLowerCase()}` 
                : `name:${String(product.name).trim().toLowerCase()}`;

            const dbProduct = productMap.get(lookupKey);
            let productId = dbProduct ? dbProduct.id : null;

            const catKey = product.category ? product.category.trim().toLowerCase() : null;
            const categoryId = catKey ? categoryMap.get(catKey) || null : null;

            // Расчет розничной цены
            let salePrice;
            if ([87, 88, 90, 91].includes(categoryId)) {
                salePrice = Math.round(product.purchase_price);
            } else {
                salePrice = Math.round(
                    product.purchase_price > 100
                        ? product.purchase_price * 1.10
                        : product.purchase_price * 1.20
                );
            }

            if (dbProduct) {
                // Проверяем изменения
                const isChanged = 
                    Number(dbProduct.purchase_price) !== product.purchase_price ||
                    Number(dbProduct.sale_price) !== salePrice ||
                    Number(dbProduct.category_id) !== Number(categoryId) ||
                    dbProduct.name.trim() !== product.name.trim() ||
                    (dbProduct.unit || '').trim().toLowerCase() !== product.unit.toLowerCase();

                if (isChanged) {
                    await connection.execute(
                        `UPDATE products 
                         SET category_id = ?, name = ?, purchase_price = ?, sale_price = ?, unit = ? 
                         WHERE id = ?`,
                        [categoryId, product.name, product.purchase_price, salePrice, product.unit, productId]
                    );

                    dbProduct.purchase_price = product.purchase_price;
                    dbProduct.sale_price = salePrice;
                    dbProduct.category_id = categoryId;
                    dbProduct.name = product.name;
                    dbProduct.unit = product.unit;

                    updatedCount++;
                }
            } else {
                // Вставка нового товара
                const [result] = await connection.execute(
                    `INSERT INTO products (company_id, category_id, sku, name, purchase_price, sale_price, unit, image) 
                     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
                    [companyId, categoryId, product.sku, product.name, product.purchase_price, salePrice, product.unit, '/img/no-image.png']
                );

                productId = result.insertId;
                createdCount++;

                const cachedItem = {
                    id: productId,
                    sku: product.sku,
                    name: product.name,
                    purchase_price: product.purchase_price,
                    sale_price: salePrice,
                    category_id: categoryId,
                    unit: product.unit
                };
                if (product.sku) productMap.set(`sku:${String(product.sku).trim().toLowerCase()}`, cachedItem);
                productMap.set(`name:${String(product.name).trim().toLowerCase()}`, cachedItem);
            }

            // Шаг 6: Синхронизация количества товара на складе
            await connection.execute(
                `INSERT INTO product_stores (product_id, store_id, quantity) 
                 VALUES (?, ?, ?) 
                 ON DUPLICATE KEY UPDATE quantity = VALUES(quantity)`,
                [productId, storeId, product.quantity]
            );
        }

        await connection.commit();

    } catch (error) {
        await connection.rollback();
        throw error;
    } finally {
        connection.release();
    }

    return {
        categoriesCreated,
        createdCount,
        updatedCount,
        totalProducts: uniqueProducts.size
    };
};