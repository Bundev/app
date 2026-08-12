
let productSearchRows = [];
let productSearchFrame = null;

function normalizeProductSearch(value) {
    return String(value || '').toLocaleLowerCase().trim();
}

function refreshProductSearchRow(row) {
    const cachedRow = productSearchRows.find(item => item.row === row);
    if (!cachedRow) return;
    cachedRow.searchableText = normalizeProductSearch([
        row.dataset.name,
        row.dataset.sku,
        row.dataset.barcode,
        row.dataset.category
    ].join(' '));
}

function filterProducts() {
    if (productSearchFrame) cancelAnimationFrame(productSearchFrame);

    productSearchFrame = requestAnimationFrame(() => {
        const input = document.getElementById('search-product');
        const count = document.getElementById('products-count');
        const search = normalizeProductSearch(input?.value);
        let visibleCount = 0;

        productSearchRows.forEach(({ row, searchableText }) => {
            const found = !search || searchableText.includes(search);
            row.hidden = !found;
            if (found) visibleCount++;
        });

        if (count) count.textContent = visibleCount;
        productSearchFrame = null;
    });
}

function enableFastProductSearch() {
    const input = document.getElementById('search-product');
    if (!input) return;

    productSearchRows = [...document.querySelectorAll('#products-table tr')].map(row => ({
        row,
        searchableText: normalizeProductSearch([
            row.dataset.name,
            row.dataset.sku,
            row.dataset.barcode,
            row.dataset.category
        ].join(' '))
    }));

    input.addEventListener('input', filterProducts);
    document.addEventListener('keydown', event => {
        if (event.key !== '/' || event.ctrlKey || event.metaKey || event.altKey) return;
        if (event.target.matches('input, textarea, select, [contenteditable="true"]')) return;
        event.preventDefault();
        input.focus();
        input.select();
    });
}

document.addEventListener('DOMContentLoaded', enableFastProductSearch);

function renderSkuValue(cell, sku) {

    const button = document.createElement('button');

    button.type = 'button';
    button.className = 'sku-value';
    button.setAttribute('aria-label', 'Изменить артикул');

    const value = document.createElement('code');
    value.textContent = sku || 'Добавить';

    button.append(value);
    cell.replaceChildren(button);
}

function enableSkuEditing() {

    document.querySelectorAll('.sku-cell').forEach(cell => {

        cell.addEventListener('click', event => {

            if (event.target.closest('.sku-input')) return;

            const currentSku = cell.dataset.sku || '';
            const input = document.createElement('input');

            input.type = 'text';
            input.className = 'form-control form-control-sm sku-input';
            input.value = currentSku;
            input.placeholder = 'Артикул';
            input.setAttribute('aria-label', 'Артикул');

            cell.replaceChildren(input);
            input.focus();
            input.select();

            let completed = false;

            const cancel = () => {

                if (completed) return;

                completed = true;
                renderSkuValue(cell, currentSku);
            };

            const save = async () => {

                if (completed) return;

                const sku = input.value.trim();

                if (sku === currentSku) {
                    cancel();
                    return;
                }

                completed = true;
                input.disabled = true;

                try {

                    const response = await fetch(
                        `/products/sku/${cell.dataset.id}`,
                        {
                            method: 'POST',
                            headers: {
                                'Content-Type': 'application/json'
                            },
                            body: JSON.stringify({ sku })
                        }
                    );

                    const result = await response.json();

                    if (!response.ok || !result.success) {
                        throw new Error('Не удалось сохранить артикул');
                    }

                    cell.dataset.sku = sku;
                    const row = cell.closest('tr');

                    if (row) row.dataset.sku = sku;

                    refreshProductSearchRow(row);

                    renderSkuValue(cell, sku);

                } catch (error) {

                    completed = false;
                    input.disabled = false;
                    input.focus();
                    alert(error.message);
                }
            };

            input.addEventListener('keydown', event => {

                if (event.key === 'Enter') {
                    event.preventDefault();
                    save();
                }

                if (event.key === 'Escape') {
                    event.preventDefault();
                    cancel();
                }
            });

            input.addEventListener('blur', save);
        });
    });
}

document.addEventListener('DOMContentLoaded', enableSkuEditing);

function getEditableDisplay(field, value) {

    if (field === 'quantity') {

        const quantity = Number(value);

        if (quantity <= 0) return 'Нет';

        return String(value);
    }

    if (field === 'purchase_price') return `Закупка: ${value} ₴`;
    if (field === 'sale_price') return `${value} ₴`;

    return value;
}

function renderProductField(button, value) {

    const field = button.dataset.field;

    button.replaceChildren();

    if (field === 'name') {

        const name = document.createElement('span');
        name.className = 'fw-semibold product-name';
        name.textContent = `${value}, ${button.dataset.unit}`;
        button.append(name);
        return;
    }

    if (field === 'category_id') {

        button.textContent = value;
        return;
    }

    if (field === 'quantity') {

        const quantity = Number(value);
        const badge = document.createElement('span');

        if (quantity <= 0) {
            badge.className = 'badge bg-danger';
            badge.textContent = 'Нет';
        } else if (quantity < 5) {
            badge.className = 'badge bg-warning text-dark';
            badge.textContent = String(value);
        } else {
            badge.className = 'badge bg-success';
            badge.textContent = String(value);
        }

        button.append(badge);
        return;
    }

    button.append(document.createTextNode(getEditableDisplay(field, value)));
}

function openInlineCategoryEditor(button) {

    const originalValue = button.dataset.value || '';
    const editor = document.createElement('div');
    const inputGroup = document.createElement('div');
    const input = document.createElement('input');
    const createButton = document.createElement('button');
    const list = document.createElement('div');
    let creatingCategory = false;
    let completed = false;
    let matchingCategories = [];
    let activeCategoryIndex = -1;

    editor.className = 'category-inline-editor';
    inputGroup.className = 'input-group input-group-sm';
    input.type = 'text';
    input.className = 'form-control';
    input.placeholder = 'Категория';
    input.autocomplete = 'off';
    input.value = (window.productCategories || []).find(
        category => String(category.id) === originalValue
    )?.name || '';
    createButton.type = 'button';
    createButton.className = 'btn btn-primary';
    createButton.innerHTML = '<i class="bi bi-plus-lg"></i>';
    createButton.setAttribute('aria-label', 'Создать категорию');
    list.className = 'list-group category-inline-list';

    inputGroup.append(input, createButton);
    editor.append(inputGroup, list);
    button.replaceWith(editor);
    input.focus();
    input.select();

    const restore = () => {

        if (completed) return;

        completed = true;
        button.dataset.editing = 'false';
        editor.replaceWith(button);
    };

    const save = async (categoryId, categoryName) => {

        if (completed) return;

        completed = true;
        input.disabled = true;
        createButton.disabled = true;

        try {

            const savedValue = await saveProductField(button, categoryId);
            const row = button.closest('tr');

            button.dataset.value = savedValue ?? '';

            if (row) row.dataset.category = categoryName;

            renderProductField(button, categoryName);
            button.dataset.editing = 'false';
            editor.replaceWith(button);

        } catch (error) {

            completed = false;
            input.disabled = false;
            createButton.disabled = false;
            input.focus();
            alert(error.message);
        }
    };

    const drawList = () => {

        list.replaceChildren();

        matchingCategories.forEach((category, index) => {

                const item = document.createElement('button');

                item.type = 'button';
                item.className = 'list-group-item list-group-item-action';
                item.classList.toggle('active', index === activeCategoryIndex);
                item.textContent = category.name;
                item.addEventListener('mousedown', event => event.preventDefault());
                item.addEventListener('click', () => {
                    save(String(category.id), category.name);
                });

                list.append(item);
            });
    };

    const renderList = (query = '') => {

        const normalizedQuery = query.toLowerCase().trim();

        activeCategoryIndex = -1;
        matchingCategories = creatingCategory
            ? []
            : (window.productCategories || []).filter(category =>
                category.name.toLowerCase().includes(normalizedQuery)
            );

        drawList();
    };

    const createCategory = async () => {

        const name = input.value.trim();

        if (!name) {
            input.focus();
            return;
        }

        createButton.disabled = true;

        try {

            const response = await fetch(
                '/categories/ajax-create',
                {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({ name })
                }
            );
            const result = await response.json();

            if (!response.ok || !result.success) {
                throw new Error(result.message || 'Не удалось создать категорию');
            }

            window.productCategories.push({ id: result.id, name: result.name });
            save(String(result.id), result.name);

        } catch (error) {

            createButton.disabled = false;
            alert(error.message);
        }
    };

    input.addEventListener('input', () => {

        renderList(input.value);
    });

    input.addEventListener('keydown', event => {

        if (event.key === 'Escape') {
            event.preventDefault();
            restore();
        }

        if (event.key === 'Enter') {
            event.preventDefault();

            if (creatingCategory) {
                createCategory();
                return;
            }

            if (activeCategoryIndex >= 0) {
                const category = matchingCategories[activeCategoryIndex];

                save(String(category.id), category.name);
                return;
            }

            const exactCategory = (window.productCategories || []).find(
                category => category.name.toLowerCase() === input.value.trim().toLowerCase()
            );

            if (exactCategory) {
                save(String(exactCategory.id), exactCategory.name);
            }
        }

        if (
            (event.key === 'ArrowDown' || event.key === 'ArrowUp') &&
            !creatingCategory &&
            matchingCategories.length
        ) {
            event.preventDefault();

            const direction = event.key === 'ArrowDown' ? 1 : -1;

            activeCategoryIndex =
                (activeCategoryIndex + direction + matchingCategories.length) %
                matchingCategories.length;

            drawList();
        }
    });

    input.addEventListener('blur', () => {

        setTimeout(() => {

            if (completed) return;

            if (!input.value.trim()) {
                save('', 'Без категории');
            } else {
                restore();
            }
        }, 150);
    });

    createButton.addEventListener('mousedown', event => event.preventDefault());
    createButton.addEventListener('click', () => {

        if (creatingCategory) {
            createCategory();
            return;
        }

        creatingCategory = true;
        input.value = '';
        input.placeholder = 'Название новой категории';
        createButton.innerHTML = '<i class="bi bi-check-lg"></i>';
        list.replaceChildren();
        input.focus();
    });

    renderList(input.value);
}

async function saveProductField(button, value) {

    const response = await fetch(
        `/products/quick-edit/${button.dataset.id}`,
        {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                field: button.dataset.field,
                value
            })
        }
    );

    const result = await response.json();

    if (!response.ok || !result.success) {
        throw new Error(result.message || 'Не удалось сохранить изменения');
    }

    return result.value;
}

let stockModal;
let activeStockButton;

async function openStockModal(button) {

    activeStockButton = button;

    const row = button.closest('tr');
    const productName = row?.dataset.name || 'Товар';
    const storesList = document.getElementById('stockStoresList');
    const saveButton = document.getElementById('saveStockButton');

    document.getElementById('stockProductName').textContent = productName;
    storesList.innerHTML = '<div class="text-center text-muted py-3">Загрузка магазинов...</div>';
    saveButton.disabled = true;

    stockModal.show();

    try {

        const response = await fetch(`/products/stocks/${button.dataset.id}`);
        const result = await response.json();

        if (!response.ok || !result.success) {
            throw new Error(result.message || 'Не удалось загрузить остатки');
        }

        storesList.replaceChildren();

        result.stores.forEach(store => {

            const field = document.createElement('div');
            field.className = 'mb-3';

            const label = document.createElement('label');
            label.className = 'form-label';
            label.textContent = store.name;

            const input = document.createElement('input');
            input.type = 'number';
            input.className = 'form-control stock-store-input';
            input.min = '0';
            input.step = '0.01';
            input.inputMode = 'decimal';
            input.value = store.quantity;
            input.dataset.storeId = store.id;
            input.setAttribute('aria-label', `Остаток в магазине ${store.name}`);

            field.append(label, input);
            storesList.append(field);
        });

        if (!result.stores.length) {
            storesList.textContent = 'Для компании ещё не создано ни одного магазина.';
        } else {
            saveButton.disabled = false;
            storesList.querySelector('input')?.focus();
        }

    } catch (error) {

        storesList.textContent = error.message;
    }
}

function enableStockModal() {

    const modalElement = document.getElementById('stockModal');

    if (!modalElement) return;

    stockModal = bootstrap.Modal.getOrCreateInstance(modalElement);

    document.getElementById('saveStockButton').addEventListener('click', async () => {

        if (!activeStockButton) return;

        const saveButton = document.getElementById('saveStockButton');
        const inputs = [...document.querySelectorAll('.stock-store-input')];
        const stocks = {};

        for (const input of inputs) {

            const value = input.value.trim();

            if (!value || !Number.isFinite(Number(value)) || Number(value) < 0) {
                alert('Введите остаток для каждого магазина числом не меньше нуля');
                input.focus();
                return;
            }

            stocks[input.dataset.storeId] = value;
        }

        saveButton.disabled = true;
        inputs.forEach(input => input.disabled = true);

        try {

            const response = await fetch(
                `/products/stocks/${activeStockButton.dataset.id}`,
                {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({ stocks })
                }
            );

            const result = await response.json();

            if (!response.ok || !result.success) {
                throw new Error(result.message || 'Не удалось сохранить остатки');
            }

            const savedValue = result.totalQuantity;

            activeStockButton.dataset.value = savedValue;
            renderProductField(activeStockButton, savedValue);
            stockModal.hide();

        } catch (error) {

            alert(error.message);

        } finally {

            saveButton.disabled = false;
            inputs.forEach(input => input.disabled = false);
        }
    });

    modalElement.addEventListener('hidden.bs.modal', () => {
        activeStockButton = null;
    });
}

function enableProductFieldEditing() {

    document.querySelectorAll('.editable-value').forEach(button => {

        button.addEventListener('click', () => {

            if (button.dataset.editing === 'true') return;

            if (button.dataset.field === 'quantity') {
                openStockModal(button);
                return;
            }

            if (button.dataset.field === 'category_id') {
                openInlineCategoryEditor(button);
                return;
            }

            button.dataset.editing = 'true';

            const isCategory = button.classList.contains('editable-category');
            const isNumber = button.classList.contains('editable-number');
            const originalValue = button.dataset.value || '';
            const control = document.createElement(isCategory ? 'select' : 'input');

            control.className = 'form-select form-select-sm editable-input';

            if (isCategory) {

                const emptyOption = new Option('Без категории', '');
                control.append(emptyOption);

                (window.productCategories || []).forEach(category => {
                    control.append(new Option(category.name, category.id));
                });

            } else {

                control.type = isNumber ? 'number' : 'text';
                control.value = originalValue;

                if (isNumber) {
                    control.step = '0.01';
                    control.min = '0';
                }
            }

            control.value = originalValue;
            button.replaceWith(control);
            control.focus();

            if (!isCategory) control.select();

            let completed = false;

            const restore = () => {

                if (completed) return;

                completed = true;
                button.dataset.editing = 'false';
                control.replaceWith(button);
            };

            const save = async () => {

                if (completed) return;

                const value = control.value.trim();

                if (value === originalValue) {
                    restore();
                    return;
                }

                completed = true;
                control.disabled = true;

                try {

                    const savedValue = await saveProductField(button, value);

                    button.dataset.value = savedValue ?? '';
                    button.dataset.editing = 'false';
                    const row = button.closest('tr');

                    if (isCategory) {
                        const categoryName = control.selectedOptions[0].textContent;

                        if (row) row.dataset.category = categoryName;

                        renderProductField(
                            button,
                            categoryName
                        );
                    } else {

                        if (row && button.dataset.field === 'name') {
                            row.dataset.name = savedValue;
                        }

                        renderProductField(button, savedValue);
                    }

                    refreshProductSearchRow(row);

                    control.replaceWith(button);

                } catch (error) {

                    completed = false;
                    control.disabled = false;
                    control.focus();
                    alert(error.message);
                }
            };

            control.addEventListener('keydown', event => {

                if (event.key === 'Enter') {
                    event.preventDefault();
                    save();
                }

                if (event.key === 'Escape') {
                    event.preventDefault();
                    restore();
                }
            });

            control.addEventListener('change', () => {

                if (isCategory) save();
            });

            control.addEventListener('blur', save);
        });
    });
}

document.addEventListener('DOMContentLoaded', enableProductFieldEditing);
document.addEventListener('DOMContentLoaded', enableStockModal);
document.addEventListener('DOMContentLoaded', enableLocationModal);

function enableLocationModal() {
    const modalElement = document.getElementById('locationModal');
    if (!modalElement) return;

    const modal = bootstrap.Modal.getOrCreateInstance(modalElement);
    const storesList = document.getElementById('locationStoresList');
    const saveButton = document.getElementById('saveLocationButton');
    let activeProductId = null;

    document.querySelectorAll('.product-location-button').forEach(button => {
        button.addEventListener('click', async () => {
            activeProductId = button.dataset.id;
            document.getElementById('locationProductName').textContent = button.dataset.name || '';
            storesList.innerHTML = '<div class="text-center text-muted py-3">Загрузка складов...</div>';
            saveButton.disabled = true;
            modal.show();

            try {
                const response = await fetch(`/products/stocks/${activeProductId}`);
                const result = await response.json();
                if (!response.ok || !result.success) throw new Error(result.message || 'Не удалось загрузить склады');

                storesList.replaceChildren();
                result.stores.forEach(store => {
                    const field = document.createElement('div');
                    field.className = 'location-store-field';

                    const label = document.createElement('label');
                    label.className = 'form-label fw-semibold';
                    label.htmlFor = `location-store-${store.id}`;
                    label.textContent = store.name;

                    const input = document.createElement('input');
                    input.id = `location-store-${store.id}`;
                    input.type = 'text';
                    input.className = 'form-control location-store-input';
                    input.value = store.location || '';
                    input.placeholder = 'Например: ряд 2, стеллаж 4, полка 1';
                    input.dataset.storeId = store.id;

                    field.append(label, input);
                    storesList.append(field);
                });

                if (!result.stores.length) {
                    storesList.textContent = 'Для компании ещё не создано ни одного склада.';
                } else {
                    saveButton.disabled = false;
                    storesList.querySelector('input')?.focus();
                }
            } catch (error) {
                storesList.textContent = error.message;
            }
        });
    });

    saveButton.addEventListener('click', async () => {
        if (!activeProductId) return;
        const inputs = [...storesList.querySelectorAll('.location-store-input')];
        const locations = {};
        inputs.forEach(input => { locations[input.dataset.storeId] = input.value; });

        saveButton.disabled = true;
        try {
            const response = await fetch(`/products/locations/${activeProductId}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ locations })
            });
            const result = await response.json();
            if (!response.ok || !result.success) throw new Error(result.message || 'Не удалось сохранить местонахождение');
            modal.hide();
        } catch (error) {
            alert(error.message);
        } finally {
            saveButton.disabled = false;
        }
    });

    modalElement.addEventListener('hidden.bs.modal', () => { activeProductId = null; });
}



document.addEventListener(
    'DOMContentLoaded',
    () => {

        const toast =
            document.getElementById(
                'importSuccess'
            );

        if (!toast) return;

        setTimeout(
            () => {

                toast.style.transition =
                    'all .4s ease';

                toast.style.opacity = '0';

                toast.style.transform =
                    'translateX(30px)';

                setTimeout(
                    () => {

                        toast.remove();

                    },
                    400
                );

            },
            5000
        );

    }
);


document.addEventListener(
    'DOMContentLoaded',
    () => {

        const toast =
            document.getElementById(
                'productSuccess'
            );

        if (!toast) return;

        setTimeout(
            () => {

                toast.style.transition =
                    'all .4s ease';

                toast.style.opacity = '0';

                toast.style.transform =
                    'translateX(30px)';

                setTimeout(
                    () => {

                        toast.remove();

                    },
                    400
                );

            },
            5000
        );

    }
);







       
// Обновлени штрихкода

document
    .querySelectorAll('.barcode-cell')
    .forEach(cell => {

        cell.addEventListener(
            'click',
            event => {

                if (event.target.closest('.barcode-input')) return;

                if (!window.matchMedia('(max-width: 767.98px)').matches) {
                    openBarcodeInput(cell);
                    return;
                }

                currentProductId =
                    cell.dataset.id;

                document
                    .getElementById(
                        'scannerModal'
                    )
                    .style.display =
                    'flex';

                startBarcodeScanner();

            }
        );

    });

function renderBarcodeCell(cell, barcode) {
    const code = document.createElement('code');
    code.textContent = barcode || 'Штрихкод';
    cell.replaceChildren(code);
}

function openBarcodeInput(cell) {
    if (cell.querySelector('.barcode-input')) return;

    const row = cell.closest('tr');
    const originalBarcode = row?.dataset.barcode || '';
    const input = document.createElement('input');
    input.type = 'text';
    input.className = 'form-control form-control-sm barcode-input';
    input.value = originalBarcode;
    input.placeholder = 'Штрихкод';
    input.setAttribute('aria-label', 'Штрихкод товара');
    cell.replaceChildren(input);
    input.focus();
    input.select();

    let completed = false;
    const restore = () => {
        if (completed) return;
        completed = true;
        renderBarcodeCell(cell, originalBarcode);
    };
    const save = async () => {
        if (completed) return;
        const barcode = input.value.trim();
        if (barcode === originalBarcode) {
            restore();
            return;
        }

        completed = true;
        input.disabled = true;
        try {
            await saveBarcode(cell.dataset.id, barcode, false);
        } catch (error) {
            completed = false;
            input.disabled = false;
            input.focus();
            alert(error.message);
        }
    };

    input.addEventListener('keydown', event => {
        if (event.key === 'Enter') {
            event.preventDefault();
            save();
        } else if (event.key === 'Escape') {
            event.preventDefault();
            restore();
        }
    });
    input.addEventListener('blur', save);
}

let currentProductId = null;
let scanner = null;

function startBarcodeScanner() {

    scanner =
        new Html5Qrcode(
            'reader'
        );

    scanner.start(
        {
            facingMode:
                'environment'
        },
        {
            fps: 10,
            qrbox: (viewfinderWidth, viewfinderHeight) => ({
                width: Math.min(360, Math.floor(viewfinderWidth * 0.76)),
                height: Math.min(160, Math.floor(viewfinderHeight * 0.4))
            })
        },
        async (barcode) => {

            await saveBarcode(
                currentProductId,
                barcode
            );

        }
    );

}
async function saveBarcode(
    productId,
    barcode,
    closeScanner = true
) {

    const response =
        await fetch(
            `/products/barcode/${productId}`,
            {
                method: 'POST',

                headers: {
                    'Content-Type':
                        'application/json'
                },

                body: JSON.stringify({
                    barcode
                })
            }
        );

    const result =
        await response.json();

    if (!response.ok || !result.success) {
        throw new Error('Не удалось сохранить штрихкод');
    }

        const cell =
            document.querySelector(
                `.barcode-cell[data-id="${productId}"]`
            );

        renderBarcodeCell(cell, barcode);

        cell.closest('tr').dataset.barcode = barcode;
        refreshProductSearchRow(cell.closest('tr'));

        if (closeScanner && scanner) await scanner.stop();

        if (closeScanner) {
            document.getElementById('scannerModal').style.display = 'none';
        }

}
document
    .getElementById(
        'closeScanner'
    )
    .addEventListener(
        'click',
        async () => {

            if (scanner) {

                try {

                    await scanner.stop();

                } catch (e) {}

            }

            document
                .getElementById(
                    'scannerModal'
                )
                .style.display =
                'none';

        }
    );
