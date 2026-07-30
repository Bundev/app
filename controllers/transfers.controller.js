const crypto = require('crypto');
const page = require('../helpers/page');
const transferService = require('../services/stock-transfer.service');

function takeFlash(session, key) {
    const value = session[key] || null;
    delete session[key];
    return value;
}

function safeFormData(body) {
    const items = Array.isArray(body.items)
        ? body.items
        : body.items && typeof body.items === 'object'
            ? Object.values(body.items)
            : [];

    return {
        from_store_id:
            body.from_store_id ??
            body.source_store_id ??
            body.fromStoreId ??
            '',
        to_store_id:
            body.to_store_id ??
            body.destination_store_id ??
            body.toStoreId ??
            '',
        comment: String(body.comment || '').slice(0, 2000),
        items: items.slice(0, 200).map(item => ({
            product_id:
                item?.product_id ??
                item?.productId ??
                item?.id ??
                '',
            quantity: item?.quantity ?? ''
        }))
    };
}

function publicError(error, fallback) {
    if (error instanceof transferService.StockTransferError) {
        return error.message;
    }

    return fallback;
}

exports.index = async (req, res) => {
    try {
        const transfers = await transferService.listTransfers({
            companyId: req.session.user.company_id
        });

        return res.render('transfers', {
            titleKey: 'title.transfers',
            activeMenu: 'transfers',
            transfers,
            success: takeFlash(req.session, 'transferSuccess'),
            error: takeFlash(req.session, 'transferError'),
            ...page(req, 'transfers', [
                { title: 'Перемещения' }
            ])
        });
    } catch (error) {
        console.error('Не удалось загрузить перемещения:', error);
        return res.status(500).send(
            'Не удалось загрузить перемещения.'
        );
    }
};

exports.showAdd = async (req, res) => {
    try {
        const stores = await transferService.getActiveStores({
            companyId: req.session.user.company_id
        });
        const formData =
            takeFlash(req.session, 'transferFormData') || {};

        return res.render('transfer-add', {
            titleKey: 'title.transfers',
            activeMenu: 'transfers',
            stores,
            requestKey: crypto.randomUUID(),
            formData,
            error: takeFlash(req.session, 'transferError'),
            ...page(req, 'transfer-add', [
                { title: 'Перемещения', url: '/transfers' },
                { title: 'Новое перемещение' }
            ])
        });
    } catch (error) {
        console.error('Не удалось открыть форму перемещения:', error);
        req.session.transferError =
            'Не удалось открыть форму перемещения.';
        return res.redirect('/transfers');
    }
};

exports.products = async (req, res) => {
    try {
        const products = await transferService.searchProducts({
            companyId: req.session.user.company_id,
            storeId:
                req.query.store_id ??
                req.query.from_store_id ??
                req.query.source_store_id,
            query: req.query.q
        });

        return res.json({
            success: true,
            products
        });
    } catch (error) {
        if (!(error instanceof transferService.StockTransferError)) {
            console.error(
                'Не удалось загрузить товары для перемещения:',
                error
            );
        }

        return res
            .status(error.statusCode || 500)
            .json({
                success: false,
                message: publicError(
                    error,
                    'Не удалось загрузить товары.'
                )
            });
    }
};

exports.store = async (req, res) => {
    try {
        const result = await transferService.createTransfer({
            companyId: req.session.user.company_id,
            userId: req.session.user.id,
            userName: req.session.user.name,
            input: req.body
        });

        req.session.transferSuccess = result.created
            ? 'Перемещение успешно выполнено.'
            : 'Это перемещение уже было выполнено ранее.';

        return res.redirect(`/transfers/view/${result.transferId}`);
    } catch (error) {
        if (!(error instanceof transferService.StockTransferError)) {
            console.error('Не удалось выполнить перемещение:', error);
        }

        req.session.transferError = publicError(
            error,
            'Не удалось выполнить перемещение. Попробуйте ещё раз.'
        );
        req.session.transferFormData = safeFormData(req.body || {});

        return res.redirect('/transfers/add');
    }
};

exports.view = async (req, res) => {
    try {
        const result = await transferService.getTransfer({
            companyId: req.session.user.company_id,
            transferId: req.params.id
        });

        return res.render('transfer-view', {
            titleKey: 'title.transfers',
            activeMenu: 'transfers',
            transfer: result.transfer,
            items: result.items,
            success: takeFlash(req.session, 'transferSuccess'),
            ...page(req, 'transfer-view', [
                { title: 'Перемещения', url: '/transfers' },
                { title: `Перемещение №${result.transfer.id}` }
            ])
        });
    } catch (error) {
        if (!(error instanceof transferService.StockTransferError)) {
            console.error('Не удалось открыть перемещение:', error);
        }

        req.session.transferError = publicError(
            error,
            'Не удалось открыть перемещение.'
        );
        return res.redirect('/transfers');
    }
};
