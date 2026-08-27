(() => {
    const form = document.getElementById('purchaseForm');
    const list = document.getElementById('purchaseItemsList');
    const template = document.getElementById('purchaseItemTemplate');
    const catalogElement = document.getElementById('purchaseProductsData');
    const addButton = document.getElementById('addPurchaseItem');
    const submitButton = document.getElementById('purchaseSubmit');
    const itemCount = document.getElementById('purchaseItemCount');
    const grandTotal = document.getElementById('purchaseGrandTotal');

    if (!form || !list || !template || !catalogElement) {
        return;
    }

    let products = [];

    try {
        const parsedProducts = JSON.parse(catalogElement.textContent || '[]');
        products = Array.isArray(parsedProducts)
            ? parsedProducts.filter(product => (
                Number.isSafeInteger(Number(product.id))
                && Number(product.id) > 0
                && typeof product.name === 'string'
            ))
            : [];
    } catch (error) {
        console.error('Не удалось прочитать каталог товаров:', error);
    }

    const productById = new Map(
        products.map(product => [String(product.id), product])
    );

    const moneyFormatter = new Intl.NumberFormat('ru-RU', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
    });

    const normalize = value => String(value || '')
        .toLocaleLowerCase('ru-RU')
        .replace(/\s+/g, ' ')
        .trim();

    const compact = value => normalize(value).replace(/[\s()+\-./]/g, '');
    const formatMoney = value => `${moneyFormatter.format(Number(value) || 0)} ₴`;
    const rows = () => Array.from(list.querySelectorAll('.purchase-item-row'));

    let rowKey = 0;

    const closeOptions = row => {
        const input = row.querySelector('.purchase-product-search');
        const options = row.querySelector('.purchase-product-options');

        options.hidden = true;
        options.replaceChildren();
        input.setAttribute('aria-expanded', 'false');
        row.dataset.activeOption = '-1';
    };

    const closeAllOptions = exceptRow => {
        rows().forEach(row => {
            if (row !== exceptRow) {
                closeOptions(row);
            }
        });
    };

    const selectedProductIds = exceptRow => new Set(
        rows()
            .filter(row => row !== exceptRow)
            .map(row => row.querySelector('.purchase-product-id').value)
            .filter(Boolean)
    );

    const setProductError = (row, message = '', showMessage = true) => {
        const input = row.querySelector('.purchase-product-search');
        const error = row.querySelector('.purchase-item-error');
        const isVisible = Boolean(message) && showMessage;

        input.setCustomValidity(message);
        input.classList.toggle('is-invalid', isVisible);
        error.textContent = isVisible ? message : '';
    };

    const updateTotals = () => {
        let total = 0;
        let selectedCount = 0;

        rows().forEach(row => {
            const quantity = Number(row.querySelector('.purchase-quantity').value);
            const price = Number(row.querySelector('.purchase-price').value);
            const lineTotal = (
                Number.isFinite(quantity)
                && Number.isFinite(price)
                && quantity > 0
                && price >= 0
            )
                ? quantity * price
                : 0;

            row.querySelector('.purchase-row-total').textContent = formatMoney(lineTotal);
            total += lineTotal;

            if (row.querySelector('.purchase-product-id').value) {
                selectedCount += 1;
            }
        });

        if (itemCount) {
            itemCount.textContent = String(selectedCount);
        }

        if (grandTotal) {
            grandTotal.textContent = formatMoney(total);
        }
    };

    const reindexRows = () => {
        rows().forEach((row, index) => {
            row.dataset.index = String(index);
            row.setAttribute('aria-label', `Позиция ${index + 1}`);
            row.querySelector('.purchase-row-number').textContent = String(index + 1);
            row.querySelector('.purchase-product-id').name = `items[${index}][product_id]`;
            row.querySelector('.purchase-quantity').name = `items[${index}][quantity]`;
            row.querySelector('.purchase-price').name = `items[${index}][price]`;
        });

        if (addButton) {
            addButton.disabled = !products.length || rows().length >= 100;
        }
    };

    const clearProduct = (row, keepSearchText = false) => {
        const input = row.querySelector('.purchase-product-search');
        const hidden = row.querySelector('.purchase-product-id');
        const clearButton = row.querySelector('.purchase-product-clear');
        const priceInput = row.querySelector('.purchase-price');

        if (!keepSearchText) {
            input.value = '';
        }

        delete input.dataset.selectedName;
        hidden.value = '';
        clearButton.hidden = !input.value;
        priceInput.value = '0.00';
        setProductError(row, input.value ? 'Выберите товар из списка.' : 'Выберите товар.');
        updateTotals();
    };

    const selectProduct = (row, product) => {
        if (!product) {
            return;
        }

        const duplicateIds = selectedProductIds(row);
        if (duplicateIds.has(String(product.id))) {
            setProductError(row, 'Этот товар уже добавлен в накладную.');
            row.querySelector('.purchase-product-search').reportValidity();
            return;
        }

        const input = row.querySelector('.purchase-product-search');
        const hidden = row.querySelector('.purchase-product-id');
        const clearButton = row.querySelector('.purchase-product-clear');
        const priceInput = row.querySelector('.purchase-price');
        const purchasePrice = Number(product.purchasePrice);

        input.value = product.name;
        input.dataset.selectedName = product.name;
        hidden.value = String(product.id);
        clearButton.hidden = false;
        priceInput.value = Number.isFinite(purchasePrice) && purchasePrice >= 0
            ? purchasePrice.toFixed(2)
            : '0.00';

        setProductError(row);
        closeOptions(row);
        updateTotals();
    };

    const matchingProducts = query => {
        const queryVariants = window.KeyboardLayout.variants(query);

        if (!queryVariants.length) {
            return products.slice(0, 50);
        }

        return products
            .filter(product => {
                const searchable = normalize(`${product.name} ${product.sku || ''}`);
                const compactSearchable = compact(searchable);

                return queryVariants.some(variant => {
                    const normalizedQuery = normalize(variant);
                    const compactQuery = compact(variant);

                    return searchable.includes(normalizedQuery)
                        || (compactQuery && compactSearchable.includes(compactQuery));
                });
            })
            .slice(0, 50);
    };

    const renderOptions = row => {
        const input = row.querySelector('.purchase-product-search');
        const options = row.querySelector('.purchase-product-options');
        const unavailableIds = selectedProductIds(row);
        const matches = matchingProducts(input.value);

        closeAllOptions(row);
        options.replaceChildren();
        row.dataset.activeOption = '-1';

        if (!matches.length) {
            const empty = document.createElement('div');
            empty.className = 'purchase-product-no-results';
            empty.textContent = 'Товары не найдены';
            options.append(empty);
        } else {
            matches.forEach(product => {
                const option = document.createElement('button');
                const copy = document.createElement('span');
                const name = document.createElement('strong');
                const meta = document.createElement('small');
                const price = document.createElement('span');
                const isUnavailable = unavailableIds.has(String(product.id));
                const metaParts = [
                    product.sku ? `SKU: ${product.sku}` : '',
                    product.unit || '',
                    isUnavailable ? 'Уже добавлен' : ''
                ].filter(Boolean);

                option.type = 'button';
                option.className = 'purchase-product-option';
                option.dataset.productId = String(product.id);
                option.setAttribute('role', 'option');
                option.disabled = isUnavailable;

                copy.className = 'purchase-product-option-copy';
                name.textContent = product.name;
                meta.textContent = metaParts.join(' · ') || 'Без артикула';

                price.className = 'purchase-product-option-price';
                price.textContent = formatMoney(product.purchasePrice);

                copy.append(name, meta);
                option.append(copy, price);
                option.addEventListener('click', () => selectProduct(row, product));
                options.append(option);
            });
        }

        options.hidden = false;
        input.setAttribute('aria-expanded', 'true');
    };

    const moveActiveOption = (row, direction) => {
        const options = Array.from(
            row.querySelectorAll('.purchase-product-option:not(:disabled)')
        );

        if (!options.length) {
            return;
        }

        let activeIndex = Number(row.dataset.activeOption || -1);
        activeIndex = (activeIndex + direction + options.length) % options.length;
        row.dataset.activeOption = String(activeIndex);

        options.forEach((option, index) => {
            option.classList.toggle('is-active', index === activeIndex);
        });

        options[activeIndex].scrollIntoView({ block: 'nearest' });
    };

    const bindRow = row => {
        const input = row.querySelector('.purchase-product-search');
        const hidden = row.querySelector('.purchase-product-id');
        const clearButton = row.querySelector('.purchase-product-clear');
        const quantityInput = row.querySelector('.purchase-quantity');
        const priceInput = row.querySelector('.purchase-price');
        const removeButton = row.querySelector('.purchase-remove-item');
        const options = row.querySelector('.purchase-product-options');
        const optionsId = `purchaseProductOptions-${rowKey}`;

        options.id = optionsId;
        input.setAttribute('aria-controls', optionsId);
        setProductError(row, 'Выберите товар.', false);

        input.addEventListener('focus', () => {
            if (products.length) {
                renderOptions(row);
            }
        });

        input.addEventListener('input', () => {
            const selectedName = input.dataset.selectedName || '';

            if (hidden.value && input.value !== selectedName) {
                clearProduct(row, true);
            } else if (!hidden.value) {
                setProductError(row, input.value ? 'Выберите товар из списка.' : 'Выберите товар.');
            }

            clearButton.hidden = !input.value;

            if (products.length) {
                renderOptions(row);
            }
        });

        input.addEventListener('keydown', event => {
            if (event.key === 'ArrowDown') {
                event.preventDefault();
                if (options.hidden) {
                    renderOptions(row);
                }
                moveActiveOption(row, 1);
            } else if (event.key === 'ArrowUp') {
                event.preventDefault();
                if (options.hidden) {
                    renderOptions(row);
                }
                moveActiveOption(row, -1);
            } else if (event.key === 'Enter' && !options.hidden) {
                const availableOptions = Array.from(
                    options.querySelectorAll('.purchase-product-option:not(:disabled)')
                );
                const activeIndex = Number(row.dataset.activeOption || -1);
                const option = availableOptions[activeIndex >= 0 ? activeIndex : 0];

                if (option) {
                    event.preventDefault();
                    option.click();
                }
            } else if (event.key === 'Escape') {
                event.preventDefault();
                clearProduct(row);
                closeOptions(row);
            }
        });

        clearButton.addEventListener('click', () => {
            clearProduct(row);
            input.focus();
            if (products.length) {
                renderOptions(row);
            }
        });

        quantityInput.addEventListener('input', updateTotals);
        priceInput.addEventListener('input', updateTotals);

        removeButton.addEventListener('click', () => {
            if (rows().length === 1) {
                clearProduct(row);
                quantityInput.value = '1';
                priceInput.value = '0.00';
                input.focus();
            } else {
                row.remove();
                reindexRows();
                updateTotals();
            }
        });
    };

    const createRow = ({ focus = false } = {}) => {
        const fragment = template.content.cloneNode(true);
        const row = fragment.querySelector('.purchase-item-row');

        row.dataset.rowKey = String(rowKey);
        rowKey += 1;
        list.append(fragment);
        bindRow(row);
        reindexRows();
        updateTotals();

        if (focus) {
            row.querySelector('.purchase-product-search').focus();
        }

        return row;
    };

    addButton?.addEventListener('click', () => {
        if (rows().length < 100) {
            createRow({ focus: true });
        }
    });

    document.addEventListener('click', event => {
        if (!event.target.closest('.purchase-product-picker')) {
            closeAllOptions();
        }
    });

    form.addEventListener('submit', event => {
        let valid = true;
        const seenProducts = new Set();

        rows().forEach(row => {
            const productId = row.querySelector('.purchase-product-id').value;
            const input = row.querySelector('.purchase-product-search');

            if (!productId || !productById.has(productId)) {
                setProductError(row, 'Выберите товар из списка.');
                valid = false;
            } else if (seenProducts.has(productId)) {
                setProductError(row, 'Товар не должен повторяться.');
                valid = false;
            } else {
                seenProducts.add(productId);
                setProductError(row);
            }

            if (!input.value.trim()) {
                valid = false;
            }
        });

        if (!valid || !form.checkValidity()) {
            event.preventDefault();
            form.reportValidity();
            form.querySelector(':invalid')?.focus();
            return;
        }

        if (submitButton) {
            submitButton.disabled = true;
            submitButton.setAttribute('aria-busy', 'true');
            submitButton.querySelector('.purchase-submit-label').hidden = true;
            submitButton.querySelector('.purchase-submit-loading').hidden = false;
        }

        if (addButton) {
            addButton.disabled = true;
        }
    });

    createRow();

    if (!products.length) {
        const firstInput = list.querySelector('.purchase-product-search');
        firstInput.disabled = true;
        firstInput.placeholder = 'Нет доступных товаров';
    }
})();
