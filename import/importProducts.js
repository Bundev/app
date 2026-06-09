const XLSX = require('xlsx');

module.exports = async (
    db,
    filePath,
    storeId
) => {

    const workbook =
        XLSX.readFile(filePath);

    const sheet =
        workbook.Sheets['TDSheet'];

    const data =
        XLSX.utils.sheet_to_json(
            sheet,
            {
                range: 3,
                header: 1
            }
        );

    let currentCategory = null;

    const products = [];

    for (const row of data) {

        const category =
            String(row[0] || '')
                .trim();

        /*
         * Категория
         */
        if (
            category &&
            ![
                'Артикул',
                'Цінова група'
            ].includes(category) &&
            !row[4]
        ) {

            currentCategory =
                category;

            continue;

        }

        /*
         * Товар
         */
        if (
            row[4] &&
            row[4] !== 'Номенклатура, Упаковка' &&
            !isNaN(row[13])
        ) {

            const skuMatch =
                row[4].match(
                    /\(([A-Za-z0-9]+)\)/
                );

            products.push({

                category:
                    currentCategory,

                sku:
                    skuMatch
                        ? skuMatch[1]
                        : null,

                name:
                    row[4]
                        .replace(
                            /,\s*(шт|м)\.?$/i,
                            ''
                        )
                        .trim(),

                purchase_price:
                    Number(row[13]),

                sale_price:
                    Math.round(
                        row[13] > 100
                            ? row[13] * 1.1
                            : row[13] * 1.2
                    ),

                quantity:
                    Number(row[14] || 0)

            });

        }

    }

    /*
     * Создание категорий
     */

    const categoryMap =
        new Map();

    for (const product of products) {

        if (!product.category)
            continue;

        const [exists] =
            await db.execute(
                `
                SELECT id
                FROM categories
                WHERE name = ?
                `,
                [product.category]
            );

        let categoryId;

        if (exists.length) {

            categoryId =
                exists[0].id;

        } else {

            const [result] =
                await db.execute(
                    `
                    INSERT INTO categories
                    (
                        name
                    )
                    VALUES (?)
                    `,
                    [product.category]
                );

            categoryId =
                result.insertId;

        }

        categoryMap.set(
            product.category,
            categoryId
        );

    }

    /*
     * Импорт товаров
     */

    let productsCount = 0;

    for (const product of products) {

        const categoryId =
            categoryMap.get(
                product.category
            ) || null;

        const [exists] =
            await db.execute(
                `
                SELECT id
                FROM products
                WHERE sku = ?
                AND store_id = ?
                `,
                [
                    product.sku,
                    storeId
                ]
            );

        if (exists.length)
            continue;

        await db.execute(
            `
            INSERT INTO products
            (
                category_id,
                store_id,
                sku,
                name,
                purchase_price,
                sale_price,
                quantity,
                image
            )
            VALUES
            (
                ?, ?, ?, ?, ?, ?, ?, ?
            )
            `,
            [
                categoryId,
                storeId,
                product.sku,
                product.name,
                product.purchase_price,
                product.sale_price,
                product.quantity,
                '/img/no-image.png'
            ]
        );

        productsCount++;

    }

    return {

        categoriesCount:
            categoryMap.size,

        productsCount

    };

};