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

    await connection.beginTransaction();

    for (const product of products) {

        let exists = [];

        if (product.sku) {

            [exists] =
                await connection.execute(
                    `
                    SELECT id
                    FROM products
                    WHERE sku = ?
                    LIMIT 1
                    `,
                    [
                        product.sku
                    ]
                );

        } else {

            [exists] =
                await connection.execute(
                    `
                    SELECT id
                    FROM products
                    WHERE name = ?
                    LIMIT 1
                    `,
                    [
                        product.name
                    ]
                );

        }

        const categoryId =
            categoryMap.get(
                product.category
            ) || null;

        let productId;

        if (exists.length) {

            productId =
                exists[0].id;

            await connection.execute(
                `
                UPDATE products
                SET
                    category_id = ?,
                    name = ?,
                    purchase_price = ?,
                    sale_price = ?
                WHERE id = ?
                `,
                [
                    categoryId,
                    product.name,
                    product.purchase_price,
                    product.sale_price,
                    productId
                ]
            );

            updatedCount++;

        } else {

            const [result] =
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
                        0,
                        '/img/no-image.png'
                    ]
                );

            productId =
                result.insertId;

            createdCount++;

        }

        await connection.execute(
            `
            INSERT INTO product_stores
            (
                product_id,
                store_id,
                quantity
            )
            VALUES
            (
                ?, ?, ?
            )

            ON DUPLICATE KEY UPDATE
            quantity = VALUES(quantity)
            `,
            [
                productId,
                storeId,
                product.quantity
            ]
        );

        await connection.execute(
            `
            UPDATE products p

            SET quantity =
            (
                SELECT
                    COALESCE(
                        SUM(ps.quantity),
                        0
                    )
                FROM product_stores ps
                WHERE ps.product_id = p.id
            )

            WHERE p.id = ?
            `,
            [
                productId
            ]
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

        totalProducts:
            products.length

    };

};