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
                         /\(([^)]+)\)/
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

         let createdCount = 0;
        let updatedCount = 0;
        let categoriesCreated = 0;
        const connection =
        await db.getConnection();

       
     try {

        await connection.beginTransaction();
        const [existingCategories] =
        await connection.execute(
        `         SELECT
                    id,
                    name
                FROM categories
                WHERE company_id = ?
                `,
        [companyId]
        );

        const categoryMap =
        new Map(
        existingCategories.map(
        category => [
        category.name,
        category.id
        ]
        )
        );

        

        for (const product of products) {


        if (
            !product.category ||
            categoryMap.has(
                product.category
            )
        ) {
            continue;
        }

        const [result] =
            await connection.execute(
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

        categoryMap.set(
            product.category,
            result.insertId
        );

        categoriesCreated++;


        }


    

    

   

            const [existingProducts] =
            await connection.execute(
            `         SELECT
                        id,
                        sku,
                        name,
                        purchase_price,
                        sale_price,
                        category_id
                    FROM products
                    WHERE company_id = ?
                    `,
            [companyId]
            );

            const productMap =
            new Map();

            for (const item of existingProducts) {


                if (item.sku) {

                    productMap.set(
                        `sku:${item.sku}`,
                        item
                    );

                }

                productMap.set(
                    `name:${item.name}`,
                    item
                );


            }

            const uniqueProducts = new Map();

            for (const product of products) {

                const key =
                    product.sku
                        ? `sku:${product.sku}`
                        : `name:${product.name}`;

                uniqueProducts.set(
                    key,
                    product
                );
            }

            products.length = 0;
            products.push(
                ...uniqueProducts.values()
            );


            for (const product of products) {
                const dbProduct =
                product.sku
                ? productMap.get(
                `sku:${product.sku}`
                )
                : productMap.get(
                `name:${product.name}`
                );

                let productId =
                dbProduct
                ? dbProduct.id
                : null;


                const categoryId =
                    product.category
                        ? categoryMap.get(
                            product.category
                        ) || null
                        : null;

                if (dbProduct) {

                        if (
                            Number(dbProduct.purchase_price) !== product.purchase_price ||
                            Number(dbProduct.sale_price) !== product.sale_price ||
                            Number(dbProduct.category_id) !== Number(categoryId) ||
                            dbProduct.name !== product.name
                        ) {

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

                            dbProduct.purchase_price =
                                product.purchase_price;

                            dbProduct.sale_price =
                                product.sale_price;

                            dbProduct.category_id =
                                categoryId;

                            dbProduct.name =
                                product.name;

                            updatedCount++;
                        }
                    } else {

                    const [result] =
                        await connection.execute(
                            `
                            INSERT INTO products
                            (
                                company_id,
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
                                ?, ?, ?, ?, ?, ?, ?, ?, ?
                            )
                            `,
                            [
                                companyId,
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

                    if (product.sku) {

                        productMap.set(
                            `sku:${product.sku}`,
                            {
                                id: productId,
                                sku: product.sku,
                                name: product.name,
                                category_id: categoryId,
                                purchase_price: product.purchase_price,
                                sale_price: product.sale_price
                            }
                        );

                    }

                   productMap.set(
                        `name:${product.name}`,
                        {
                            id: productId,
                            sku: product.sku,
                            name: product.name,
                            category_id: categoryId,
                            purchase_price: product.purchase_price,
                            sale_price: product.sale_price
                        }
                    );

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
            }


        

            await connection.commit();

        }catch (error) {

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