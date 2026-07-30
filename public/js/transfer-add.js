(() => {
    'use strict';

    const page = document.getElementById('transferFormPage');
    const form = document.getElementById('transferForm');

    if (!page || !form) {
        return;
    }

    const fromStore = document.getElementById('fromStore');
    const toStore = document.getElementById('toStore');
    const swapButton = document.getElementById('swapStores');
    const addItemButton = document.getElementById('addTransferItem');
    const itemsBody = document.getElementById('transferItems');
    const itemTemplate = document.getElementById('transferItemTemplate');
    const tableWrap = document.getElementById('transferItemsTableWrap');
    const emptyState = document.getElementById('transferItemsEmpty');
    const positionCount = document.getElementById('transferPositionCount');
    const quantityTotal = document.getElementById('transferQuantityTotal');
    const submitButton = document.getElementById('submitTransfer');
    const submitSpinner = document.getElementById('transferSubmitSpinner');
    const submitIcon = document.getElementById('transferSubmitIcon');
    const submitText = document.getElementById('transferSubmitText');
    const clientError = document.getElementById('transferClientError');
    const liveMessage = document.getElementById('transferLiveMessage');

    if (
        !fromStore ||
        !toStore ||
        !addItemButton ||
        !itemsBody ||
        !itemTemplate ||
        !submitButton
    ) {
        return;
    }

    const messages = {
        searchHint: page.dataset.searchHint || '',
        loading: page.dataset.loading || '',
        noProducts: page.dataset.noProducts || '',
        searchError: page.dataset.searchError || '',
        alreadyAdded: page.dataset.alreadyAdded || '',
        selectStores: page.dataset.selectStoresError || '',
        sameStore: page.dataset.sameStoreError || '',
        addItem: page.dataset.addItemError || '',
        selectProduct: page.dataset.selectProductError || '',
        invalidQuantity: page.dataset.invalidQuantity || '',
        duplicateProduct: page.dataset.duplicateProduct || '',
        changeSourceConfirm: page.dataset.changeSourceConfirm || '',
        submitting: page.dataset.submitting || ''
    };

    const searchTimers = new WeakMap();
    const searchControllers = new WeakMap();
    let nextRowIndex = 0;
    let currentSourceStoreId = fromStore.value;

    const getRows = () => [...itemsBody.querySelectorAll('.transfer-item-row')];

    const announce = message => {
        if (liveMessage) {
            liveMessage.textContent = '';
            window.setTimeout(() => {
                liveMessage.textContent = message;
            }, 0);
        }
    };

    const showClientError = (message, focusTarget) => {
        if (!clientError) {
            return;
        }

        clientError.textContent = message;
        clientError.classList.remove('d-none');

        if (focusTarget) {
            focusTarget.focus();
        } else {
            clientError.focus();
        }
    };

    const clearClientError = () => {
        clientError?.classList.add('d-none');

        if (clientError) {
            clientError.textContent = '';
        }
    };

    const closeResults = row => {
        const results = row?.querySelector('.transfer-product-results');

        if (results) {
            results.classList.add('d-none');
            results.replaceChildren();
        }
    };

    const closeAllResults = exceptRow => {
        getRows().forEach(row => {
            if (row !== exceptRow) {
                closeResults(row);
            }
        });
    };

    const showSearchState = (row, message) => {
        const results = row.querySelector('.transfer-product-results');
        const state = document.createElement('div');

        state.className = 'transfer-search-state';
        state.textContent = message;
        results.replaceChildren(state);
        results.classList.remove('d-none');
    };

    const selectedProductIds = exceptRow => {
        const ids = new Set();

        getRows().forEach(row => {
            if (row === exceptRow) {
                return;
            }

            const productId = row.querySelector('.product-id-input')?.value;

            if (productId) {
                ids.add(String(productId));
            }
        });

        return ids;
    };

    const clearRowErrors = row => {
        const searchInput = row.querySelector('.product-search-input');
        const quantityInput = row.querySelector('.quantity-input');
        const quantityGroup = row.querySelector('.transfer-quantity-group');

        searchInput?.classList.remove('is-invalid');
        quantityInput?.classList.remove('is-invalid');
        quantityGroup?.classList.remove('has-error');
    };

    const setProductError = (row, message) => {
        const searchInput = row.querySelector('.product-search-input');
        const feedback = row.querySelector('.product-invalid-feedback');

        searchInput?.classList.add('is-invalid');

        if (feedback) {
            feedback.textContent = message;
        }
    };

    const setQuantityError = (row, message) => {
        const quantityInput = row.querySelector('.quantity-input');
        const quantityGroup = row.querySelector('.transfer-quantity-group');
        const feedback = row.querySelector('.quantity-invalid-feedback');

        quantityInput?.classList.add('is-invalid');
        quantityGroup?.classList.add('has-error');

        if (feedback) {
            feedback.textContent = message;
        }
    };

    const resetProductSelection = (row, preserveSearchText = true) => {
        const searchInput = row.querySelector('.product-search-input');
        const productIdInput = row.querySelector('.product-id-input');
        const quantityInput = row.querySelector('.quantity-input');
        const availableValue = row.querySelector('.transfer-available-value');
        const unitLabel = row.querySelector('.product-unit');

        if (!preserveSearchText && searchInput) {
            searchInput.value = '';
        }

        if (productIdInput) {
            productIdInput.value = '';
        }

        if (quantityInput) {
            quantityInput.removeAttribute('max');
            quantityInput.value = '1';
        }

        if (availableValue) {
            availableValue.textContent = '—';
        }

        if (unitLabel) {
            unitLabel.textContent = unitLabel.dataset.defaultLabel || unitLabel.textContent;
        }

        delete row.dataset.available;
        delete row.dataset.productName;
        delete row.dataset.productUnit;
        clearRowErrors(row);
        syncSummary();
    };

    const syncEmptyState = () => {
        const hasRows = getRows().length > 0;
        tableWrap?.classList.toggle('d-none', !hasRows);
        emptyState?.classList.toggle('d-none', hasRows);
    };

    const routeIsValid = () => {
        return Boolean(
            fromStore.value &&
            toStore.value &&
            fromStore.value !== toStore.value
        );
    };

    const syncSummary = () => {
        const selectedRows = getRows().filter(row => {
            return Boolean(row.querySelector('.product-id-input')?.value);
        });

        const total = selectedRows.reduce((sum, row) => {
            const quantity = Number(row.querySelector('.quantity-input')?.value);
            return Number.isInteger(quantity) && quantity > 0 ? sum + quantity : sum;
        }, 0);

        if (positionCount) {
            positionCount.textContent = String(selectedRows.length);
        }

        if (quantityTotal) {
            quantityTotal.textContent = String(total);
        }

        addItemButton.disabled = !fromStore.value || fromStore.disabled;
        submitButton.disabled =
            form.dataset.submitting === 'true' ||
            !routeIsValid() ||
            selectedRows.length === 0;
    };

    const updateDestinationOptions = () => {
        const sourceId = fromStore.value;

        [...toStore.options].forEach(option => {
            if (!option.value) {
                return;
            }

            option.disabled = option.value === sourceId;
        });

        if (toStore.value === sourceId) {
            toStore.value = '';
        }

        syncSummary();
    };

    const abortRowSearch = row => {
        const input = row.querySelector('.product-search-input');

        if (!input) {
            return;
        }

        const timer = searchTimers.get(input);

        if (timer) {
            window.clearTimeout(timer);
            searchTimers.delete(input);
        }

        searchControllers.get(input)?.abort();
        searchControllers.delete(input);
    };

    const removeAllRows = () => {
        getRows().forEach(abortRowSearch);
        itemsBody.replaceChildren();
        syncEmptyState();
        syncSummary();
    };

    const selectProduct = (row, product) => {
        const productId = String(product.id);

        if (selectedProductIds(row).has(productId)) {
            setProductError(row, messages.duplicateProduct);
            return;
        }

        const available = Math.max(
            0,
            Math.floor(Number(product.available_quantity ?? product.quantity ?? 0))
        );

        if (available < 1) {
            setQuantityError(row, messages.invalidQuantity);
            return;
        }

        const searchInput = row.querySelector('.product-search-input');
        const productIdInput = row.querySelector('.product-id-input');
        const quantityInput = row.querySelector('.quantity-input');
        const availableValue = row.querySelector('.transfer-available-value');
        const unitLabel = row.querySelector('.product-unit');
        const unit = String(product.unit || '');

        searchInput.value = String(product.name || '');
        productIdInput.value = productId;
        quantityInput.max = String(available);

        if (!Number.isInteger(Number(quantityInput.value)) ||
            Number(quantityInput.value) < 1 ||
            Number(quantityInput.value) > available) {
            quantityInput.value = '1';
        }

        availableValue.textContent = unit ? `${available} ${unit}` : String(available);
        unitLabel.textContent = unit || unitLabel.dataset.defaultLabel || '';
        row.dataset.available = String(available);
        row.dataset.productName = String(product.name || '');
        row.dataset.productUnit = unit;

        clearRowErrors(row);
        closeResults(row);
        syncSummary();
        announce(String(product.name || ''));
        quantityInput.focus();
        quantityInput.select();
    };

    const renderProducts = (row, products) => {
        const results = row.querySelector('.transfer-product-results');
        const duplicateIds = selectedProductIds(row);

        results.replaceChildren();

        if (!products.length) {
            showSearchState(row, messages.noProducts);
            return;
        }

        products.forEach(product => {
            const productId = String(product.id);
            const available = Math.max(
                0,
                Math.floor(Number(product.available_quantity ?? product.quantity ?? 0))
            );
            const isDuplicate = duplicateIds.has(productId);
            const button = document.createElement('button');
            const main = document.createElement('span');
            const name = document.createElement('span');
            const meta = document.createElement('span');
            const stock = document.createElement('span');
            const productMeta = [product.sku, product.barcode]
                .filter(Boolean)
                .join(' • ');

            button.type = 'button';
            button.className = 'list-group-item list-group-item-action transfer-product-result';
            button.disabled = isDuplicate || available < 1;
            button.setAttribute('role', 'option');

            main.className = 'transfer-product-result__main';
            name.className = 'transfer-product-result__name';
            meta.className = 'transfer-product-result__meta';
            stock.className = 'transfer-product-result__stock';

            name.textContent = String(product.name || '');
            meta.textContent = isDuplicate
                ? [productMeta, messages.alreadyAdded].filter(Boolean).join(' • ')
                : productMeta;
            stock.textContent = product.unit
                ? `${available} ${product.unit}`
                : String(available);

            main.append(name, meta);
            button.append(main, stock);
            button.addEventListener('click', () => selectProduct(row, product));
            results.append(button);
        });

        results.classList.remove('d-none');
    };

    const searchProducts = async (row, query) => {
        const input = row.querySelector('.product-search-input');
        const sourceStoreId = fromStore.value;
        const normalizedQuery = String(query || '').trim();

        if (!sourceStoreId) {
            showSearchState(row, messages.selectStores);
            return;
        }

        if (normalizedQuery.length < 2) {
            showSearchState(row, messages.searchHint);
            return;
        }

        searchControllers.get(input)?.abort();

        const controller = new AbortController();
        searchControllers.set(input, controller);
        showSearchState(row, messages.loading);

        try {
            const params = new URLSearchParams({
                store_id: sourceStoreId,
                q: normalizedQuery
            });
            const response = await fetch(`/transfers/products?${params.toString()}`, {
                headers: {
                    Accept: 'application/json'
                },
                signal: controller.signal
            });

            if (!response.ok) {
                throw new Error(`HTTP ${response.status}`);
            }

            const payload = await response.json();
            const products = Array.isArray(payload)
                ? payload
                : Array.isArray(payload.products)
                    ? payload.products
                    : [];

            if (
                input.value.trim() !== normalizedQuery ||
                fromStore.value !== sourceStoreId
            ) {
                return;
            }

            renderProducts(row, products);
        } catch (error) {
            if (error.name !== 'AbortError') {
                showSearchState(row, messages.searchError);
            }
        } finally {
            if (searchControllers.get(input) === controller) {
                searchControllers.delete(input);
            }
        }
    };

    const queueProductSearch = (row, immediate = false) => {
        const input = row.querySelector('.product-search-input');
        const existingTimer = searchTimers.get(input);

        if (existingTimer) {
            window.clearTimeout(existingTimer);
        }

        const delay = immediate ? 0 : 280;
        const timer = window.setTimeout(() => {
            searchTimers.delete(input);
            searchProducts(row, input.value);
        }, delay);

        searchTimers.set(input, timer);
    };

    const validateRow = (row, seenProductIds) => {
        clearRowErrors(row);

        const productId = row.querySelector('.product-id-input')?.value;
        const quantityInput = row.querySelector('.quantity-input');
        const quantity = Number(quantityInput?.value);
        const available = Number(row.dataset.available);
        let valid = true;

        if (!productId) {
            setProductError(row, messages.selectProduct);
            valid = false;
        } else if (seenProductIds.has(productId)) {
            setProductError(row, messages.duplicateProduct);
            valid = false;
        } else {
            seenProductIds.add(productId);
        }

        if (
            !Number.isInteger(quantity) ||
            quantity < 1 ||
            !Number.isInteger(available) ||
            available < 1 ||
            quantity > available
        ) {
            setQuantityError(row, messages.invalidQuantity);
            valid = false;
        }

        return valid;
    };

    const bindRow = row => {
        const searchInput = row.querySelector('.product-search-input');
        const quantityInput = row.querySelector('.quantity-input');
        const removeButton = row.querySelector('.remove-transfer-item');
        const unitLabel = row.querySelector('.product-unit');

        unitLabel.dataset.defaultLabel = unitLabel.textContent;

        searchInput.addEventListener('input', () => {
            const selectedName = row.dataset.productName || '';

            if (row.querySelector('.product-id-input').value &&
                searchInput.value !== selectedName) {
                resetProductSelection(row, true);
            }

            searchInput.classList.remove('is-invalid');
            queueProductSearch(row);
        });

        searchInput.addEventListener('focus', () => {
            closeAllResults(row);
            queueProductSearch(row, true);
        });

        searchInput.addEventListener('keydown', event => {
            const resultButtons = [
                ...row.querySelectorAll('.transfer-product-result:not(:disabled)')
            ];

            if (event.key === 'Escape') {
                closeResults(row);
                return;
            }

            if (event.key === 'ArrowDown' && resultButtons.length) {
                event.preventDefault();
                resultButtons[0].focus();
            }
        });

        quantityInput.addEventListener('input', () => {
            quantityInput.classList.remove('is-invalid');
            row.querySelector('.transfer-quantity-group')?.classList.remove('has-error');

            if (row.querySelector('.product-id-input').value) {
                const quantity = Number(quantityInput.value);
                const available = Number(row.dataset.available);

                if (
                    !Number.isInteger(quantity) ||
                    quantity < 1 ||
                    quantity > available
                ) {
                    setQuantityError(row, messages.invalidQuantity);
                }
            }

            syncSummary();
        });

        removeButton.addEventListener('click', () => {
            abortRowSearch(row);
            row.remove();
            syncEmptyState();
            syncSummary();
        });
    };

    const addRow = () => {
        if (!fromStore.value) {
            showClientError(messages.selectStores, fromStore);
            return;
        }

        clearClientError();

        const fragment = itemTemplate.content.cloneNode(true);
        const row = fragment.querySelector('.transfer-item-row');
        const productIdInput = row.querySelector('.product-id-input');
        const quantityInput = row.querySelector('.quantity-input');
        const rowIndex = nextRowIndex;

        nextRowIndex += 1;
        row.dataset.rowIndex = String(rowIndex);
        productIdInput.name = `items[${rowIndex}][product_id]`;
        quantityInput.name = `items[${rowIndex}][quantity]`;

        itemsBody.append(fragment);
        bindRow(row);
        syncEmptyState();
        syncSummary();
        row.querySelector('.product-search-input').focus();
    };

    fromStore.addEventListener('change', () => {
        const nextSourceStoreId = fromStore.value;
        const hasSelectedProducts = selectedProductIds().size > 0;

        if (
            currentSourceStoreId &&
            nextSourceStoreId !== currentSourceStoreId &&
            hasSelectedProducts &&
            !window.confirm(messages.changeSourceConfirm)
        ) {
            fromStore.value = currentSourceStoreId;
            updateDestinationOptions();
            return;
        }

        currentSourceStoreId = nextSourceStoreId;
        fromStore.classList.remove('is-invalid');
        updateDestinationOptions();
        removeAllRows();
        clearClientError();

        if (nextSourceStoreId) {
            addRow();
        }
    });

    toStore.addEventListener('change', () => {
        toStore.classList.remove('is-invalid');
        clearClientError();
        syncSummary();
    });

    swapButton?.addEventListener('click', () => {
        const sourceId = fromStore.value;
        const destinationId = toStore.value;

        if (!sourceId || !destinationId) {
            showClientError(messages.selectStores, !sourceId ? fromStore : toStore);
            return;
        }

        if (
            selectedProductIds().size > 0 &&
            !window.confirm(messages.changeSourceConfirm)
        ) {
            return;
        }

        fromStore.value = destinationId;
        currentSourceStoreId = destinationId;
        updateDestinationOptions();
        toStore.value = sourceId;
        removeAllRows();
        clearClientError();
        addRow();
    });

    addItemButton.addEventListener('click', addRow);

    document.addEventListener('click', event => {
        const activePicker = event.target.closest('.transfer-product-picker');
        const activeRow = activePicker?.closest('.transfer-item-row');
        closeAllResults(activeRow);
    });

    form.addEventListener('submit', event => {
        if (form.dataset.submitting === 'true') {
            event.preventDefault();
            return;
        }

        clearClientError();
        fromStore.classList.remove('is-invalid');
        toStore.classList.remove('is-invalid');

        if (!fromStore.value || !toStore.value) {
            event.preventDefault();
            fromStore.classList.toggle('is-invalid', !fromStore.value);
            toStore.classList.toggle('is-invalid', !toStore.value);
            showClientError(
                messages.selectStores,
                !fromStore.value ? fromStore : toStore
            );
            return;
        }

        if (fromStore.value === toStore.value) {
            event.preventDefault();
            fromStore.classList.add('is-invalid');
            toStore.classList.add('is-invalid');
            showClientError(messages.sameStore, toStore);
            return;
        }

        const rows = getRows();

        if (!rows.length) {
            event.preventDefault();
            showClientError(messages.addItem, addItemButton);
            return;
        }

        const seenProductIds = new Set();
        let valid = true;
        let firstInvalidRow = null;

        rows.forEach(row => {
            if (!validateRow(row, seenProductIds)) {
                valid = false;
                firstInvalidRow ||= row;
            }
        });

        if (!valid) {
            event.preventDefault();
            showClientError(
                messages.selectProduct,
                firstInvalidRow?.querySelector('.is-invalid')
            );
            return;
        }

        form.dataset.submitting = 'true';
        submitButton.disabled = true;
        submitSpinner?.classList.remove('d-none');
        submitIcon?.classList.add('d-none');

        if (submitText) {
            submitText.textContent = messages.submitting;
        }
    });

    updateDestinationOptions();
    syncEmptyState();
    syncSummary();
})();
