const mysql =
    require('mysql2/promise');

const importProducts =
    require('./importProducts');

(async () => {

    try {

        const db =
            await mysql.createConnection({

                host: 'srv1798.hstgr.io.',
                user: 'u891612247_bundev95',
                password: 'Bundev1995',
                database: 'u891612247_crm'


            });

        const result =
            await importProducts(
                db,
                './db.xlsx',
                1 // ID магазина
            );

        console.log(
            'Импорт завершён'
        );

        console.log(
            `Категорий: ${result.categoriesCount}`
        );

        console.log(
            `Товаров: ${result.productsCount}`
        );

        await db.end();

    } catch (error) {

        console.error(error);

    }

})();