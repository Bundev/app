const express = require('express');
const router = express.Router();

const db = require('../config/db');
const auth = require('../middleware/auth');
const requireAdmin = require('../middleware/requireAdmin');
const uploadImport = require('../config/upload-import');
const page = require('../helpers/page');

const importProducts = require('../import/importProducts');
const previewProducts = require('../import/previewProducts');
// const XLSX = require('xlsx');
// const fs = require('fs');


router.get('/import',auth,requireAdmin,async (req, res) => {

        const [stores] =
            await db.execute(
                `
                SELECT *
                FROM stores
                WHERE company_id = ?
                  AND status = 'active'
                ORDER BY name
                `,
                [
                    req.session.user.company_id
                ]
            );

        res.render('products_import',{
                titleKey: 'Импорт товаров',
                activeMenu: 'products',
                stores,
                user: req.session.user,
                ...page(req, 'products_import', [
                    { title: req.__('title.products'), url: '/products' },
                    { title: req.__('title.products_import') }
                ])
                
            }
        );

    }
);
router.post(
    '/import/preview',
    auth,
    requireAdmin,
    uploadImport.single('excel'),
    async (req, res) => {
        try {
            if (!req.file) {
                return res.status(400).json({
                    success: false,
                    error: 'Выберите Excel-файл'
                });
            }

            const products = previewProducts(req.file.path);
            const previewRows = products.slice(0, 20);
            const totalQuantity = products.reduce(
                (sum, product) => sum + product.quantity,
                0
            );

            return res.json({
                success: true,
                rows: previewRows,
                totalRows: products.length,
                totalQuantity
            });
        } catch (error) {
            console.error(error);

            return res.status(400).json({
                success: false,
                error: error.message || 'Не удалось прочитать Excel-файл'
            });
        } finally {
            const fs = require('fs');

            if (
                req.file &&
                fs.existsSync(req.file.path)
            ) {
                fs.unlinkSync(req.file.path);
            }
        }
    }
);


router.post('/import', auth, requireAdmin, uploadImport.single('excel'),async (req, res) => {
        
        try {

            if (!req.file) {

                return res.status(400).send(
                    'Выберите Excel-файл'
                );

            }

            const storeId =
                    Number(
                        req.body.store_id
                    );

            const markupBelow100Value = String(
                req.body.markup_below_100 ?? ''
            ).trim();
            const markupFrom100Value = String(
                req.body.markup_from_100 ?? ''
            ).trim();

            if (!markupBelow100Value || !markupFrom100Value) {

                return res.status(400).send(
                    'Обе наценки обязательны для заполнения'
                );

            }

            const markupBelow100 = Number(markupBelow100Value);
            const markupFrom100 = Number(markupFrom100Value);

            if (!Number.isSafeInteger(storeId) || storeId <= 0) {

                return res.status(400).send(
                    'Магазин не выбран'
                );

            }

            if (
                !Number.isFinite(markupBelow100) || markupBelow100 < 0 ||
                !Number.isFinite(markupFrom100) || markupFrom100 < 0
            ) {

                return res.status(400).send(
                    'Наценка должна быть числом не меньше 0'
                );

            }

            const result =
                await importProducts(
                    db,
                    req.file.path,
                    storeId,
                    req.session.user.company_id,
                    markupBelow100,
                    markupFrom100
                );




            req.session.importSuccess = {
                categoriesCreated: result.categoriesCreated,
                createdCount: result.createdCount,
                updatedCount: result.updatedCount,
                zeroedStockCount: result.zeroedStockCount
            };
            
            res.redirect('/products');

        } catch (error) {

            console.error(error);

            res.status(error.statusCode || 500).send(
                error.message
            );

        }   finally {
            
                const fs =
                    require('fs');

                if (
                    req.file &&
                    fs.existsSync(
                        req.file.path
                    )
                ) {

                    fs.unlinkSync(
                        req.file.path
                    );

                }

        }

    }
);
module.exports = router;
