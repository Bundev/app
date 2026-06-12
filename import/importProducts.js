const XLSX = require('xlsx');

module.exports = async (
    db,
    filePath,
    storeId,
    companyId
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

        // Категория
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

        // Товар
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

                name:row[4],

                purchase_price:
                    Number(row[13]),

                sale_price:
                    Math.round(
                        row[13] > 100
                            ? row[13] * 1.10
                            : row[13] * 1.20
                    ),

                quantity:
                    Number(row[14] || 0)

            });

        }

    }

    const categoryMap =
        new Map();

    let categoriesCreated = 0;

    // Создание категорий
    for (const product of products) {

        if (!product.category)
            continue;

        const [exists] =
            await db.execute(
                `
                SELECT id
                FROM categories
                WHERE name = ?
                AND company_id = ?
                LIMIT 1
                `,
                [
                    product.category,
                    companyId
                ]
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
                        company_id,
                        name
                    )
                    VALUES
                    (
                        ?, ?
                    )
                    `,
                    [
                        companyId,
                        product.category
                    ]
                );

            categoryId =
                result.insertId;

            categoriesCreated++;

        }

        categoryMap.set(
            product.category,
            categoryId
        );

    }

let createdCount = 0;
let updatedCount = 0;

const connection =
    await db.getConnection();

try {

    let counter = 0;

    for (const product of products) {

        counter++;

        console.log(
            `[${counter}/${products.length}] ${product.name}`
        );

        // Поиск дублей

        let exists = [];

        if (product.sku) {

            [exists] =
                await connection.execute(
                    `
                    SELECT id
                    FROM products
                    WHERE sku = ?
                    AND store_id = ?
                    ORDER BY id
                    `,
                    [
                        product.sku,
                        storeId
                    ]
                );

        } else {

            [exists] =
                await connection.execute(
                    `
                    SELECT id
                    FROM products
                    WHERE name = ?
                    AND store_id = ?
                    ORDER BY id
                    `,
                    [
                        product.name,
                        storeId
                    ]
                );

        }

        if (exists.length > 1) {

            const keepId =
                exists[0].id;

            const duplicateIds =
                exists
                    .slice(1)
                    .map(item => item.id);

            await connection.execute(
                `
                DELETE FROM products
                WHERE id IN (${duplicateIds.map(() => '?').join(',')})
                `,
                duplicateIds
            );

            console.log(
                `Удалены дубли товара: ${product.name}`
            );

        }

        const categoryId =
            categoryMap.get(
                product.category
            ) || null;

        
        if (exists.length) {

            await connection.execute(
                `
                UPDATE products
                SET
                    category_id = ?,
                    name = ?,
                    purchase_price = ?,
                    sale_price = ?,
                    quantity = ?
                WHERE id = ?
                `,
                [
                    categoryId,
                    product.name,
                    product.purchase_price,
                    product.sale_price,
                    product.quantity,
                    exists[0].id
                ]
            );

            updatedCount++;

        } else {

            await connection.execute(
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

            createdCount++;

        }

    }

} finally {

    connection.release();

}

    return {

        categoriesCreated,

        createdCount,

        updatedCount,

        totalProducts:
            products.length

    };

};