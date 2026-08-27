const searchInput = document.getElementById('product-search');
const searchResults = document.getElementById('search-results');
const imagePreview = document.getElementById('imagePreview');

let currentFocus = -1;
let receipts = []; 
let activeReceiptId = null; 
let receiptCounter = 1; 
let currentReceiptNum = 1; 
let heldReceipts = [];
let discountInputMode = 'percent';
const productSearchHistoryKey = 'retailpro:product-search-history:v1';
const productSearchHistoryLimit = 8;

function getProductSearchHistory() {
    try {
        const stored = JSON.parse(localStorage.getItem(productSearchHistoryKey) || '[]');
        return Array.isArray(stored)
            ? stored.filter(item => typeof item === 'string' && item.trim()).slice(0, productSearchHistoryLimit)
            : [];
    } catch (error) {
        return [];
    }
}

function rememberProductSearch(query) {
    const value = String(query || '').trim();
    if (value.length < 2) return;

    const history = getProductSearchHistory().filter(
        item => item.toLocaleLowerCase() !== value.toLocaleLowerCase()
    );

    try {
        localStorage.setItem(
            productSearchHistoryKey,
            JSON.stringify([value, ...history].slice(0, productSearchHistoryLimit))
        );
    } catch (error) {
        // Поиск должен работать, даже если хранилище браузера недоступно.
    }
}

function renderProductSearchHistory(filterText = '') {
    const filters = window.KeyboardLayout
        .variants(filterText)
        .map(value => value.toLocaleLowerCase());
    const history = getProductSearchHistory().filter(item => (
        !filters.length || filters.some(filter => item.toLocaleLowerCase().includes(filter))
    ));

    searchResults.replaceChildren();
    searchResults.classList.add('search-history-mode');
    currentFocus = -1;

    if (!history.length) {
        searchResults.style.display = 'none';
        return;
    }

    const header = document.createElement('div');
    const title = document.createElement('span');
    const clearButton = document.createElement('button');

    header.className = 'product-search-history-header';
    title.textContent = 'Недавние запросы';
    clearButton.type = 'button';
    clearButton.className = 'product-search-history-clear';
    clearButton.textContent = 'Очистить';
    clearButton.addEventListener('click', event => {
        event.stopPropagation();
        try {
            localStorage.removeItem(productSearchHistoryKey);
        } catch (error) {
            // Игнорируем ограничения хранилища.
        }
        closeSearchPopup();
        searchInput.focus();
    });
    header.append(title, clearButton);
    searchResults.append(header);

    history.forEach(query => {
        const item = document.createElement('button');
        const icon = document.createElement('i');
        const text = document.createElement('span');

        item.type = 'button';
        item.className = 'list-group-item list-group-item-action product-search-history-item';
        icon.className = 'bi bi-clock-history';
        icon.setAttribute('aria-hidden', 'true');
        text.textContent = query;
        item.append(icon, text);
        item.addEventListener('click', () => {
            searchInput.value = query;
            searchInput.dispatchEvent(new Event('input', { bubbles: true }));
            searchInput.focus();
        });
        searchResults.append(item);
    });

    searchResults.style.display = 'block';
}

const offlineCatalogScope = searchInput.dataset.offlineScope || 'default';

function openOfflineCatalogDatabase() {
    return new Promise((resolve, reject) => {
        if (!window.indexedDB) {
            reject(new Error('IndexedDB is unavailable'));
            return;
        }

        const request = indexedDB.open('retailpro-offline', 1);
        request.onupgradeneeded = () => {
            const database = request.result;
            if (!database.objectStoreNames.contains('catalogs')) {
                database.createObjectStore('catalogs', { keyPath: 'scope' });
            }
        };
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
    });
}

async function writeOfflineProductCatalog(products) {
    const database = await openOfflineCatalogDatabase();

    return new Promise((resolve, reject) => {
        const transaction = database.transaction('catalogs', 'readwrite');
        transaction.objectStore('catalogs').put({
            scope: offlineCatalogScope,
            updatedAt: Date.now(),
            products
        });
        transaction.oncomplete = () => {
            database.close();
            resolve();
        };
        transaction.onerror = () => {
            database.close();
            reject(transaction.error);
        };
    });
}

async function readOfflineProductCatalog() {
    const database = await openOfflineCatalogDatabase();

    return new Promise((resolve, reject) => {
        const transaction = database.transaction('catalogs', 'readonly');
        const request = transaction.objectStore('catalogs').get(offlineCatalogScope);
        request.onsuccess = () => resolve(request.result?.products || []);
        request.onerror = () => reject(request.error);
        transaction.oncomplete = () => database.close();
    });
}

async function refreshOfflineProductCatalog() {
    try {
        const response = await fetch('/api/products/catalog');
        if (!response.ok) return;
        const products = await response.json();
        if (Array.isArray(products)) await writeOfflineProductCatalog(products);
    } catch (error) {
        // Сохраняем предыдущую копию каталога до восстановления связи.
    }
}

async function searchOfflineProducts(query) {
    try {
        const products = await readOfflineProductCatalog();
        const variants = window.KeyboardLayout
            .variants(query)
            .map(value => value.toLocaleLowerCase());

        return products
            .filter(product => {
                const searchable = `${product.name || ''} ${product.sku || ''} ${product.barcode || ''}`.toLocaleLowerCase();
                return variants.some(value => searchable.includes(value));
            })
            .sort((left, right) => {
                const normalized = query.toLocaleLowerCase();
                const leftBarcode = String(left.barcode || '').toLocaleLowerCase();
                const rightBarcode = String(right.barcode || '').toLocaleLowerCase();
                const leftSku = String(left.sku || '').toLocaleLowerCase();
                const rightSku = String(right.sku || '').toLocaleLowerCase();
                const leftName = String(left.name || '').toLocaleLowerCase();
                const rightName = String(right.name || '').toLocaleLowerCase();
                const rank = (barcode, sku, name) => (
                    barcode === normalized ? 0
                        : sku === normalized ? 1
                            : name.startsWith(normalized) ? 2 : 3
                );
                return rank(leftBarcode, leftSku, leftName) - rank(rightBarcode, rightSku, rightName)
                    || leftName.localeCompare(rightName);
            })
            .slice(0, 30);
    } catch (error) {
        return [];
    }
}

refreshOfflineProductCatalog();

// =========================================================
// 1. ПОИСК И ВЫБОР ТОВАРОВ
// =========================================================
searchInput.addEventListener('input', async () => {
    const query = searchInput.value.trim();
    
    if (query.length < 2) {
        renderProductSearchHistory(query);
        imagePreview.style.display = 'none';
        return;
    }

    const currentQuery = query;
    let products = [];
    let offlineSearch = false;

    try {
        const response = await fetch(`/api/products/search?q=${encodeURIComponent(query)}`);
        if (!response.ok) throw new Error('Product search is unavailable');
        products = await response.json();
        if (!Array.isArray(products)) throw new Error('Invalid product search response');
    } catch (error) {
        offlineSearch = true;
        products = await searchOfflineProducts(query);
    }
    
    if (currentQuery !== searchInput.value.trim()) return;
    
    searchResults.innerHTML = '';
    searchResults.classList.remove('search-history-mode');
    currentFocus = -1;

    if (offlineSearch) {
        const notice = document.createElement('div');
        notice.className = 'offline-search-notice';
        notice.innerHTML = '<i class="bi bi-cloud-slash" aria-hidden="true"></i><span>Офлайн-поиск по последней копии каталога</span>';
        searchResults.append(notice);
    }

    products.forEach(product => {
        const item = document.createElement('button');
        const qty = Number(product.quantity);
        const stockColor = qty > 10 ? 'success' : qty > 0 ? 'warning' : 'danger';

        item.type = 'button';
        item.className = 'list-group-item list-group-item-action py-3 position-relative';
        item.innerHTML = `
        <div class="d-flex align-items-center">
            <img src="${product.image || '/img/no-photo.png'}" alt="${product.name}" class="product-image" style="width:80px;height:80px;object-fit:contain;background:#fff;border:1px solid #dee2e6;border-radius:8px;padding:4px;">
            <div class="flex-grow-1 px-3">
                <div class="fw-bold mb-1">${product.name}</div>
                <div class="small text-muted">Арт: ${product.sku || '-'} | ШК: ${product.barcode || '-'}</div>
                <div class="small text-primary mt-1">📍 ${product.stock_info || 'Нет остатков'}</div>
            </div>
            <div class="text-end">
                <div class="fw-bold fs-5">${Number(product.sale_price).toFixed(2)} ₴</div>
                <span class="badge bg-${stockColor} mt-2">${qty} ${product.unit}</span>
            </div>
        </div>`;

        // ИЗМЕНЕННЫЙ ОБРАБОТЧИК КЛИКА (Для множественного добавления)
        item.addEventListener('click', () => {
            rememberProductSearch(currentQuery);
            addProductToInvoice(product);
            
            // UX-фишка: подсвечиваем строку зелёным на 300мс, чтобы кассир видел отклик интерфейса
            item.style.transition = 'background-color 0.1s ease';
            item.style.backgroundColor = 'rgba(25, 135, 84, 0.15)'; 
            setTimeout(() => {
                item.style.backgroundColor = '';
            }, 300);

            // НЕ закрываем поиск и НЕ очищаем инпут. Просто возвращаем фокус в поле ввода.
            //searchInput.focus();
        });

        searchResults.appendChild(item);

        const img = item.querySelector('.product-image');
        if (img) {
            img.addEventListener('mouseenter', () => {
                imagePreview.style.backgroundImage = `url('${img.src}')`;
                imagePreview.style.display = 'block';
            });
            img.addEventListener('mousemove', () => {
                imagePreview.style.left = '850px';
                imagePreview.style.top = '200px';
            });
            img.addEventListener('mouseleave', () => {
                imagePreview.style.display = 'none';
            });
        }
    });

    searchResults.style.display = products.length > 0 || offlineSearch ? 'block' : 'none';
});

searchInput.addEventListener('focus', () => {
    if (searchInput.value.trim().length < 2) {
        renderProductSearchHistory(searchInput.value);
    }
});

searchInput.addEventListener('keydown', function(e) {
    // ДОБАВИЛИ: Закрытие поиска по кнопке Escape
    if (e.key === 'Escape') {
        e.preventDefault();
        e.stopPropagation();
        searchInput.value = '';
        closeSearchPopup();
        return;
    }

    if (searchResults.style.display === 'none') return;
    const items = searchResults.getElementsByClassName('list-group-item');
    if (!items.length) return;

    if (e.key === 'ArrowDown') {
        e.preventDefault();
        currentFocus++;
        addActiveSearch(items);
        scrollToView(searchResults, items[currentFocus]);
    } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        currentFocus--;
        addActiveSearch(items);
        scrollToView(searchResults, items[currentFocus]);
    } else if (e.key === 'Enter') {
        if (currentFocus > -1 && items[currentFocus]) {
            e.preventDefault();
            items[currentFocus].click(); // Вызовет добавление и оставит список открытым!
        }
    }
});

// ГЛОБАЛЬНЫЙ КЛИК: Закрываем поиск, если кликнули мимо инпута и мимо результатов
document.addEventListener('click', function(e) {
    if (!searchInput.contains(e.target) && !searchResults.contains(e.target)) {
        closeSearchPopup();
        searchInput.value = '';
    }
});

// ВСПОМОГАТЕЛЬНАЯ ФУНКЦИЯ ДЛЯ ЧИСТОГО ЗАКРЫТИЯ ПОПАПА
function closeSearchPopup() {
    searchResults.style.display = 'none';
    searchResults.innerHTML = '';
    searchResults.classList.remove('search-history-mode');
    imagePreview.style.display = 'none';
    currentFocus = -1;
    // Если нужно полностью сбросить поле при закрытии — раскомментируй строку ниже:
    // searchInput.value = ''; 
}

function addActiveSearch(items) {
    if (!items) return false;
    for (let i = 0; i < items.length; i++) items[i].classList.remove('active');
    if (currentFocus >= items.length) currentFocus = 0;
    if (currentFocus < 0) currentFocus = items.length - 1;
    items[currentFocus].classList.add('active');
}

function scrollToView(container, item) {
    if (!item) return;
    const containerTop = container.scrollTop;
    const containerBottom = containerTop + container.clientHeight;
    const itemTop = item.offsetTop;
    const itemBottom = itemTop + item.clientHeight;

    if (itemTop < containerTop) {
        container.scrollTop = itemTop;
    } else if (itemBottom > containerBottom) {
        container.scrollTop = itemBottom - container.clientHeight;
    }
}
// =========================================================
// 2. УПРАВЛЕНИЕ КОРЗИНOЙ (ТАБЛИЦЕЙ ТОВАРОВ)
// =========================================================

function addProductToInvoice(product) {
    const currentReceipt = receipts.find(r => r.id === activeReceiptId);
    if (!currentReceipt) return;

    const productStock = parseFloat(product.quantity) || 0;
    const productStockInfo = product.stock_info || '';
    const existingItem = currentReceipt.items.find(i => String(i.id) === String(product.id));

    if (existingItem) {
        // Если товар уже есть — просто увеличиваем количество
        existingItem.qty += 1;
    } else {
        // Если товара нет — добавляем новую запись
        const price = Number(product.sale_price || 0);
        currentReceipt.items.push({
            id: String(product.id),
            name: product.name,
            unit: product.unit,
            qty: 1,
            price: price,
            purchasePrice: Number(product.purchase_price || 0),
            originalPrice: price,
            stock: productStock,
            stock_info: productStockInfo,
        });
    }

    // Рендерим твою стандартную таблицу
    renderItemsTable(currentReceipt.items);
    
    // Подсвечиваем добавленный товар
    const targetRow = document.querySelector(`.product-name[data-id="${product.id}"]`)?.closest('tr');
    if (targetRow) {
        document.querySelectorAll('#item-products tr').forEach(tr => tr.classList.remove('selected-product-row', 'table-active'));
        targetRow.classList.add('selected-product-row');
    }

    // Сразу обновляем панель остатков для этого товара
    updateSideStockPanel(product.name, productStock, productStockInfo, product.unit);
    calculateTotals();
}

function renderItemsTable(items) {
    const tbody = document.getElementById('item-products'); 
    if (!tbody) return;
    tbody.innerHTML = '';
    
    // Если чек полностью очищен
    if (items.length === 0) { 
        tbody.innerHTML = `<tr><td colspan="5" class="empty-receipt">Чек пуст. Отсканируйте или найдите товар.</td></tr>`; 
        
        // ИСПРАВЛЕНИЕ: Сбрасываем боковую панель сразу здесь, перед досрочным выходом!
        updateSideStockPanel('Товар не выбран', 0, 'В чеке нет товаров');
        return; 
    }
    
    items.forEach((item, index) => {
        const rowNumber = index + 1;
        const price = parseFloat(item.price) || 0;
        const qty = parseFloat(item.qty) || 1;
        const lineSum = price * qty;

        const tr = document.createElement('tr');
        tr.className = "receipt-item-row align-middle";
        tr.style.cursor = "pointer";
        tr.dataset.stock = item.stock || 0;
        tr.dataset.stockInfo = item.stock_info || '';
        tr.dataset.unit = item.unit || 'шт';
        
        tr.innerHTML = `
            <td class="ps-3 text-muted text-center">${rowNumber}</td>
            <td class="product-name" data-id="${item.id}" title="${item.name}">
                ${item.name}, ${item.unit}
            </td>
            <td>
                <div class="qty-control d-flex align-items-center gap-1">
                    <button type="button" class="btn btn-sm btn-outline-secondary minus" onclick="changeQtyFromBtn('${item.id}', -1)">-</button>
                    <input type="number" class="form-control form-control-sm qty text-center" value="${qty}" min="1" style="width: 60px;" oninput="window.updateItemQty('${item.id}', this.value)">
                    <button type="button" class="btn btn-sm btn-outline-secondary plus" onclick="changeQtyFromBtn('${item.id}', 1)">+</button>
                </div>
            </td>
            <td>
                <div class="pricepoduct fw-semibold" data-price="${price}">
                    ${price.toFixed(2)} ₴
                </div>
                <small class="text-muted">
                    Сумма:<br>
                    <span class="line-sum fw-bold text-primary">${lineSum.toFixed(2)}</span> ₴
                </small>
            </td>
            <td class="text-center">
                <button type="button" class="btn btn-sm btn-outline-danger btn-remove remove" onclick="removeItem('${item.id}')">
                    <i class="bi bi-x-lg"></i>
                </button>
            </td>
        `;
        tbody.appendChild(tr);
    });

    // === АВТО-ОБНОВЛЕНИЕ БОКОВОЙ ПАНЕЛИ ОСТАТКОВ (Для непустого чека) ===
    // Так как пустой чек обработан выше, здесь всегда есть как минимум 1 товар
    const lastItem = items[items.length - 1];
    
    // Обновляем боковую панель данными последнего добавленного/измененного товара
    updateSideStockPanel(lastItem.name, lastItem.stock || 0, lastItem.stock_info || '', lastItem.unit);
    
    // Автоматически подсвечиваем активную строку в таблице
    setTimeout(() => {
        const targetRow = document.querySelector(`.product-name[data-id="${lastItem.id}"]`)?.closest('tr');
        if (targetRow) {
            document.querySelectorAll('#item-products tr').forEach(tr => tr.classList.remove('selected-product-row', 'table-active'));
            targetRow.classList.add('selected-product-row');
        }
    }, 50);
}

window.changeQtyFromBtn = function(itemId, direction) {
    const current = receipts.find(r => r.id === activeReceiptId); 
    if (!current) return;
    
    const item = current.items.find(i => i.id === itemId); 
    if (item) { 
        let newQty = (parseFloat(item.qty) || 1) + direction;
        window.updateItemQty(itemId, Math.max(1, newQty));
    } 
};

window.updateItemQty = function(itemId, newQty) { 
    const current = receipts.find(r => r.id === activeReceiptId); 
    if (!current) return;
    
    const item = current.items.find(i => i.id === itemId); 
    if (item) { 
        let parsedQty = parseFloat(newQty);
        if (isNaN(parsedQty) || parsedQty < 1) parsedQty = 1;
        
        item.qty = parsedQty; 
        
        const row = document.querySelector(`.product-name[data-id="${itemId}"]`)?.closest('tr');
        if (row) {
            const lineSumSpan = row.querySelector('.line-sum');
            const qtyInput = row.querySelector('.qty');
            if (lineSumSpan) {
                lineSumSpan.innerText = (parseFloat(item.price) * parsedQty).toFixed(2);
            }
            if (qtyInput && qtyInput.value != parsedQty) {
                qtyInput.value = parsedQty;
            }
        }
        calculateTotals(); 
    } 
};

function removeItem(itemId) { 
    const current = receipts.find(r => r.id === activeReceiptId); 
    if (!current) return;
    
    current.items = current.items.filter(i => i.id !== itemId); 
    renderItemsTable(current.items);
    
    const panel = document.getElementById('side-stock-panel');
    if (panel) panel.classList.add('d-none');
    
    calculateTotals(); 
}

// =========================================================
// 3. ФУНКЦИЯ РАСЧЕТА ИТОГОВ
// =========================================================

function calculateTotals() {
    const current = receipts.find(r => r.id === activeReceiptId); 
    if (!current) return;
    
    let subtotal = 0; 
    let purchaseTotal = 0;
    current.items.forEach(i => { 
        const quantity = parseFloat(i.qty) || 0;
        subtotal += quantity * (parseFloat(i.price) || 0);
        purchaseTotal += quantity * (parseFloat(i.purchasePrice) || 0);
    });

    const maxDiscountAmount = Math.max(0, subtotal - purchaseTotal);
    const maxDiscountPercent = subtotal > 0
        ? Math.min(100, maxDiscountAmount / subtotal * 100)
        : 0;
    const discountInput = document.getElementById('discount');
    const discountAmountInputElement = document.getElementById('discountAmount');

    if (discountInput) discountInput.max = maxDiscountPercent.toFixed(2);
    if (discountAmountInputElement) discountAmountInputElement.max = maxDiscountAmount.toFixed(2);
    
    const discountPercentRaw = document.getElementById('discount')?.value?.trim();
    const discountPercentInput = parseFloat(discountPercentRaw);
    const discountAmountInputRaw = document.getElementById('discountAmount')?.value;
    const discountAmountInput = parseFloat(discountAmountInputRaw);
    let discountPercent = Number.isFinite(discountPercentInput) ? discountPercentInput : 0;
    let discountAmount = 0;
    let shouldShowAmount = false;

    if (discountInputMode === 'amount') {
        if (Number.isFinite(discountAmountInput)) {
            discountAmount = Math.min(maxDiscountAmount, Math.max(0, discountAmountInput));
            discountPercent = subtotal > 0 ? (discountAmount / subtotal) * 100 : 0;
            if (discountAmountInputElement && discountAmountInput !== discountAmount) {
                discountAmountInputElement.value = discountAmount.toFixed(2);
            }
            if (discountInput) discountInput.value = discountPercent.toFixed(2);
            shouldShowAmount = true;
        } else {
            discountAmount = 0;
            if (document.getElementById('discount')) document.getElementById('discount').value = '';
            if (document.getElementById('discountAmount')) document.getElementById('discountAmount').value = '';
        }
    } else {
        discountInputMode = 'percent';
        if (discountPercentRaw !== '' && Number.isFinite(discountPercentInput)) {
            discountPercent = Math.min(maxDiscountPercent, Math.max(0, discountPercent));
            discountAmount = subtotal * (discountPercent / 100);
            if (discountInput && discountPercentInput !== discountPercent) {
                discountInput.value = discountPercent.toFixed(2);
            }
            shouldShowAmount = true;
        } else {
            discountPercent = 0;
            discountAmount = 0;
        }
        if (discountAmountInputElement) discountAmountInputElement.value = shouldShowAmount ? discountAmount.toFixed(2) : '';
    }

    const total = subtotal - discountAmount;
    const cashReceived = parseFloat(document.getElementById('cash')?.value) || 0; 
    const change = cashReceived > total ? cashReceived - total : 0;
    
    if(document.getElementById('subtotal-sum')) document.getElementById('subtotal-sum').innerText = subtotal.toFixed(2) + ' ₴'; 
    if(document.getElementById('discount-label')) document.getElementById('discount-label').innerText = discountPercent.toFixed(2);
    if(document.getElementById('discount-sum')) document.getElementById('discount-sum').innerText = discountAmount.toFixed(2) + ' ₴'; 
    if(document.getElementById('total-sum')) document.getElementById('total-sum').innerText = total.toFixed(2) + ' ₴'; 
    if(document.getElementById('change')) document.getElementById('change').innerText = change.toFixed(2) + ' ₴';
    
    saveCurrentUIToState();
}

function updateSideStockPanel(name, stock, stockInfo, unit = 'шт') {
    const panelQty = document.getElementById('stock-panel-qty'); // ID общего количества (например, "4 шт")
    const panelDetails = document.getElementById('stock-panel-details'); // ID блока с разбивкой по складам ("Южный (-): 4")
    
    if (panelQty) {
        if (name === 'Товар не выбран') {
            panelQty.innerHTML = ''; // Если товар не выбран, не пишем "0 шт" крупным зеленым цветом
        } else {
            panelQty.innerHTML = `Всего доступно: <span class="fw-bold text-success">${stock} ${unit === 'м' ? 'м' : 'шт'}</span>`; // Сделай под свой HTML layout
        }
    }
    
    if (panelDetails) {
        // Выводим информацию по складам или пишем, что товаров нет
        panelDetails.innerHTML = stockInfo || 'Нет информации об остатках';
    }
}

document.getElementById('item-products')?.addEventListener('click', (e) => {
    const row = e.target.closest('.receipt-item-row');
    if (!row || e.target.closest('.remove') || e.target.closest('.qty-control')) return;

    const nameEl = row.querySelector('.product-name');
    const name = nameEl ? nameEl.getAttribute('title') : 'Товар';
    const stock = parseFloat(row.dataset.stock) || 0;
    const stockInfo = row.dataset.stockInfo || '';
    const unit = row.dataset.unit || 'шт';

    document.querySelectorAll('#item-products tr').forEach(tr => tr.classList.remove('selected-product-row', 'table-active'));
    row.classList.add('selected-product-row');

    updateSideStockPanel(name, stock, stockInfo, unit);
});

// Снимаем выделение товара, когда пользователь кликает вне корзины.
document.addEventListener('click', (e) => {
    if (e.target.closest('#item-products')) return;

    document.querySelectorAll('#item-products tr').forEach(tr => {
        tr.classList.remove('selected-product-row', 'table-active');
    });
});

// =========================================================
// 4. МУЛЬТИЧЕКИ (ВКЛАДКИ)
// =========================================================

function createNewReceipt() {
    let receiptSaleNum;
    if (receipts.length === 0) {
        receiptSaleNum = currentReceiptNum;
    } else {
        const maxCurrentNum = Math.max(...receipts.map(r => Number(r.num) || 0));
        receiptSaleNum = maxCurrentNum + 1; 
    }

    const simpleId = 'receipt_' + receiptCounter++; 
    const newReceipt = {
        id: simpleId, 
        num: receiptSaleNum, 
        customer: { id: '', name: 'Основной покупатель' }, 
        items: [],
        paymentMethod: 'cash', 
        cashReceived: '', 
        discountPercent: 0,
        discountAmount: 0,
        comment: ''
    };
    
    receipts.push(newReceipt); 
    activeReceiptId = newReceipt.id;
    renderReceiptTabs(); 
    loadReceiptToUI(activeReceiptId);
}

function renderReceiptTabs() {
    const container = document.getElementById('receipt-tabs'); 
    if (!container) return;
    container.innerHTML = '';
    
    receipts.forEach((r, index) => {
        const li = document.createElement('li'); 
        li.className = 'nav-item';
        const isActive = r.id === activeReceiptId;
        const closeBtn = receipts.length > 1 
            ? `<button type="button" class="close-receipt" onclick="closeReceipt(event, '${r.id}')"><i class="bi bi-x-lg"></i></button>` 
            : '';
        
        li.innerHTML = `<button class="nav-link ${isActive ? 'active' : ''}" onclick="switchReceipt('${r.id}')">Чек #${index + 1} ${closeBtn}</button>`;
        container.appendChild(li);
    });
}

function switchReceipt(id) { 
    saveCurrentUIToState(); 
    activeReceiptId = id; 
    renderReceiptTabs(); 
    loadReceiptToUI(id); 
}

// Добавили третий параметр forceClose, по умолчанию он равен false
function closeReceipt(event, id, forceClose = false) { 
    if (event) event.stopPropagation(); 
    const index = receipts.findIndex(r => r.id === id); 
    if (index === -1) return; 
    
    const currentReceipt = receipts[index];
    
    // Проверяем на товары, ТОЛЬКО если мы закрываем вручную (!forceClose)
    if (currentReceipt.items.length > 0 && !forceClose) {
        if (!confirm('В чеке есть товары. Вы уверены, что хотите закрыть его без сохранения?')) return;
    }

    receipts.splice(index, 1); 
    
    if (receipts.length > 0) {
        if (activeReceiptId === id) activeReceiptId = receipts[Math.max(0, index - 1)].id; 
    } else {
        activeReceiptId = null;
        createNewReceipt();
        return;
    }
    renderReceiptTabs(); 
    loadReceiptToUI(activeReceiptId); 
}

function saveCurrentUIToState() {
    const current = receipts.find(r => r.id === activeReceiptId); 
    if (!current) return;
    
    current.customer.id = document.getElementById('customer_id')?.value || ''; 
    current.customer.name = document.getElementById('customer_name')?.value || 'Основной покупатель';
    current.cashReceived = document.getElementById('cash')?.value || '';
    current.discountPercent = parseFloat(document.getElementById('discount')?.value) || 0; 
    current.discountAmount = parseFloat(document.getElementById('discountAmount')?.value) || 0;
    current.comment = document.getElementById('invoice_comment')?.value || '';

    const paymentSelect = document.getElementById('payment-method');
    if (paymentSelect) current.paymentMethod = paymentSelect.value;
}

function loadReceiptToUI(id) {
    const current = receipts.find(r => r.id === id); 
    if (!current) return;
    
    // Очистка поиска при смене вкладок
    if (typeof searchInput !== 'undefined' && searchInput) searchInput.value = ''; 
    if (typeof searchResults !== 'undefined' && searchResults) {
        searchResults.style.display = 'none';
        searchResults.innerHTML = '';
    }
    if (typeof imagePreview !== 'undefined' && imagePreview) imagePreview.style.display = 'none';
    if (typeof currentFocus !== 'undefined') currentFocus = -1;

    // Заполнение полей чека
    if (document.getElementById('customer_id')) document.getElementById('customer_id').value = current.customer.id;
    if (document.getElementById('customer_name')) document.getElementById('customer_name').value = current.customer.name;
    window.syncCustomerPicker?.();
    if (document.getElementById('cash')) document.getElementById('cash').value = current.cashReceived;
    if (document.getElementById('discount')) document.getElementById('discount').value = current.discountPercent || '';
    if (document.getElementById('discountAmount')) document.getElementById('discountAmount').value = current.discountAmount || '';
    discountInputMode = 'percent';
    if (document.getElementById('invoice_comment')) document.getElementById('invoice_comment').value = current.comment || '';

    // Старый селект (если он есть)
    const paymentSelect = document.getElementById('payment-method');
    if (paymentSelect) paymentSelect.value = current.paymentMethod || 'cash';

    // === ИСПРАВЛЕНИЕ: Обновляем визуальный текст кнопки выпадающего списка ===
    const paymentBtn = document.getElementById('paymentMethod') || document.querySelector('.dropdown-toggle');
    if (paymentBtn) {
        const method = current.paymentMethod || 'cash';
        if (method === 'card') {
            paymentBtn.innerHTML = '💳 Карта';
        } else if (method === 'transfer') {
            paymentBtn.innerHTML = '🏦 Перевод';
        } else {
            paymentBtn.innerHTML = '💵 Наличные';
        }
    }

    renderItemsTable(current.items); 
    calculateTotals();

    // При переключении на вкладку показываем остатки последнего товара (или сбрасываем, если чек пустой)
    if (current.items.length > 0) {
        const lastItem = current.items[current.items.length - 1];
        updateSideStockPanel(lastItem.name, lastItem.stock || 0, lastItem.stock_info || '', lastItem.unit);
    } else {
        updateSideStockPanel('Товар не выбран', 0, 'В чеке нет товаров');
    }
}

// =========================================================
// 5. КЛИЕНТЫ И МОДАЛКИ
// =========================================================

document.addEventListener('DOMContentLoaded', () => {
    const inputName = document.getElementById('customer_name');
    const inputId = document.getElementById('customer_id');
    const listContainer = document.getElementById('customerList');
    const clearBtn = document.getElementById('clearCustomerBtn');
    const editBtn = document.getElementById('editCustomerBtn');

    if (!inputName || !inputId || !listContainer) return;

    const defaultCustomerName = 'Основной покупатель';
    let customersData = [];
    let custFocus = -1;

    async function fetchCustomers() {
        try {
            const response = await fetch('/api/customers');
            const result = await response.json();
            if (response.ok && result.success) {
                customersData = Array.isArray(result.customers) ? result.customers : [];
                if (document.activeElement === inputName) {
                    renderCustomerList(inputName.value);
                }
            }
        } catch (error) {
            console.error('Не удалось загрузить покупателей:', error);
        }
    }
    fetchCustomers();

    function renderCustomerList(filterText = '') {
        const variants = window.KeyboardLayout
            .variants(filterText)
            .map(value => value.toLocaleLowerCase());
        custFocus = -1;

        const filtered = customersData.filter(customer => {
            if (!variants.length) return true;
            const searchable = `${customer.name || ''} ${customer.phone || ''}`.toLocaleLowerCase();
            return variants.some(value => searchable.includes(value));
        }).slice(0, 50);

        listContainer.replaceChildren();

        if (!variants.length) {
            listContainer.append(createCustomerOption({ name: defaultCustomerName }, 'Без привязки к клиентской базе'));
        }

        filtered.forEach(customer => listContainer.append(createCustomerOption(customer)));

        if (!listContainer.children.length) {
            const empty = document.createElement('div');
            empty.className = 'list-group-item text-muted py-3';
            empty.textContent = 'Покупатели не найдены';
            listContainer.append(empty);
        }

        listContainer.classList.remove('d-none');
        inputName.setAttribute('aria-expanded', 'true');
    }

    function createCustomerOption(customer, customMeta = '') {
        const button = document.createElement('button');
        const title = document.createElement('span');
        const meta = document.createElement('span');
        const discount = Number(customer.discount_percentage) || 0;

        button.type = 'button';
        button.className = 'list-group-item list-group-item-action text-start customer-item py-2 px-3';
        button.dataset.id = String(customer.id || '');
        button.dataset.name = String(customer.name || defaultCustomerName);
        button.dataset.discount = String(discount);
        button.setAttribute('role', 'option');
        title.className = 'd-block fw-semibold';
        title.textContent = customer.name || defaultCustomerName;
        meta.className = 'customer-meta d-block mt-1';
        meta.textContent = customMeta || [
            customer.phone || '',
            discount > 0 ? `Скидка ${discount}%` : ''
        ].filter(Boolean).join(' • ') || 'Без телефона';
        button.append(title, meta);
        return button;
    }

    function closeCustomerList() {
        listContainer.classList.add('d-none');
        inputName.setAttribute('aria-expanded', 'false');
        custFocus = -1;
    }

    function selectCustomer(id, name, discount) {
        inputName.value = name || defaultCustomerName;
        inputId.value = id || '';
        closeCustomerList();
        toggleCustomerActions();
        
        const orderDiscountInput = document.getElementById('discount');
        if (orderDiscountInput) {
            orderDiscountInput.value = discount > 0 ? discount : '';
            orderDiscountInput.dispatchEvent(new Event('input'));
        }
        document.getElementById('product-search')?.focus();
    }

    function toggleCustomerActions() {
        const hasCustomer = Boolean(inputId.value);
        clearBtn?.classList.toggle('d-none', !hasCustomer);
        editBtn?.classList.toggle('d-none', !hasCustomer);
    }

    if (editBtn) {
        editBtn.addEventListener('click', () => {
            const currentId = inputId.value;
            if (!currentId) return;
            const customer = customersData.find(c => c.id == currentId);
            if (customer) {
                document.getElementById('edit_customer_id').value = customer.id;
                document.getElementById('edit_customer_name').value = customer.name;
                document.getElementById('edit_customer_phone').value = customer.phone || '';
                document.getElementById('edit_customer_email').value = customer.email || '';
                document.getElementById('edit_customer_discount').value = customer.discount_percentage || 0;
                new bootstrap.Modal(document.getElementById('editCustomerModal')).show();
            }
        });
    }

    document.getElementById('editCustomerForm')?.addEventListener('submit', async function(e) {
        e.preventDefault();
        const id = document.getElementById('edit_customer_id').value;
        const name = document.getElementById('edit_customer_name').value;
        const phone = document.getElementById('edit_customer_phone').value;
        const email = document.getElementById('edit_customer_email').value;
        const discount_percentage = document.getElementById('edit_customer_discount').value;

        try {
            const response = await fetch(`/api/customers/${id}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ name, phone, email, discount_percentage })
            });
            const result = await response.json();
            if (response.ok && result.success) {
                bootstrap.Modal.getInstance(document.getElementById('editCustomerModal'))?.hide();
                if (typeof window.refreshCustomersData === 'function') window.refreshCustomersData(result.client);
            }
        } catch (error) {
            console.error(error);
        }
    });

    inputName.addEventListener('keydown', function(e) {
        const items = listContainer.querySelectorAll('.customer-item');

        if (e.key === 'Escape') {
            e.preventDefault();
            e.stopPropagation();
            selectCustomer('', defaultCustomerName, 0);
            return;
        }

        if (listContainer.classList.contains('d-none') || items.length === 0) return;

        if (e.key === 'ArrowDown') { e.preventDefault(); custFocus++; addActiveCust(items); }
        else if (e.key === 'ArrowUp') { e.preventDefault(); custFocus--; addActiveCust(items); }
        else if (e.key === 'Enter') {
            e.preventDefault();
            (items[custFocus > -1 ? custFocus : 0])?.click();
        }
    });

    inputName.addEventListener('input', event => {
        inputId.value = '';
        toggleCustomerActions();
        renderCustomerList(event.target.value);
    });

    inputName.addEventListener('focus', event => {
        toggleCustomerActions();
        if (inputId.value) {
            event.target.select();
            renderCustomerList('');
            return;
        }
        if (!inputId.value && event.target.value === defaultCustomerName) {
            event.target.value = '';
        }
        renderCustomerList(event.target.value);
    });

    function addActiveCust(items) {
        for (let i = 0; i < items.length; i++) items[i].classList.remove('active');
        if (custFocus >= items.length) custFocus = 0;
        if (custFocus < 0) custFocus = items.length - 1;
        items[custFocus].classList.add('active');
        items[custFocus].scrollIntoView({ block: 'nearest' });
    }

    listContainer.addEventListener('click', (e) => {
        const button = e.target.closest('.customer-item');
        if (button) selectCustomer(button.getAttribute('data-id'), button.getAttribute('data-name'), parseFloat(button.getAttribute('data-discount')) || 0);
    });

    clearBtn?.addEventListener('click', () => selectCustomer('', defaultCustomerName, 0));

    document.addEventListener('click', event => {
        if (event.target.closest('.customer-picker')) return;
        closeCustomerList();
        if (!inputId.value) {
            inputName.value = defaultCustomerName;
        }
    });

    window.refreshCustomersData = async function(client) {
        await fetchCustomers();
        selectCustomer(client.id, client.name, parseFloat(client.discount_percentage) || 0);
    };

    window.syncCustomerPicker = toggleCustomerActions;
    toggleCustomerActions();
});

// =========================================================
// 6. СОХРАНЕНИЕ ЧЕКА НА СЕРВЕР
// =========================================================

async function saveInvoice() {

    // ПРИНУДИТЕЛЬНО сохраняем все поля из UI в объект текущего чека перед отправкой
    saveCurrentUIToState();

    const activeReceipt = receipts.find(r => r.id === activeReceiptId);
    if (!activeReceipt || !activeReceipt.items.length) {
        alert('Добавьте товары в чек');
        return;
    }

    let subtotal = 0;
    activeReceipt.items.forEach(i => subtotal += (Number(i.price) || 0) * (Number(i.qty) || 0));
    const discountPercent = Number(activeReceipt.discountPercent) || 0;
    let discountAmount = Number(activeReceipt.discountAmount);
    if (!Number.isFinite(discountAmount) || discountAmount < 0) {
        discountAmount = subtotal * discountPercent / 100;
    }
    discountAmount = Math.max(0, discountAmount);

    const saveBtn = document.querySelector('button[onclick="saveInvoice()"]');
    if (saveBtn) saveBtn.disabled = true;

    try {
        const response = await fetch('/sales/save', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                customer_id: activeReceipt.customer.id || null,
                payment_method: activeReceipt.paymentMethod,
                comment: activeReceipt.comment || null,
                total: subtotal - discountAmount,
                discount_percent: discountPercent,
                discount_amount: discountAmount,
                items: activeReceipt.items.map(i => ({ product_id: Number(i.id), quantity: Number(i.qty), price: Number(i.price) }))
            })
        });

        const result = await response.json();
        if (!result.success) {
            alert(result.error || 'Ошибка сохранения');
            return;
        }

        if (receipts.length > 1) {
            closeReceipt(null, activeReceiptId, true);
        } else {
            activeReceipt.items = [];
            activeReceipt.cashReceived = '';
            activeReceipt.discountPercent = 0;
            activeReceipt.customer = { id: '', name: 'Основной покупатель' };
            activeReceipt.comment = '';
            activeReceipt.paymentMethod = 'cash';
            loadReceiptToUI(activeReceiptId);
            renderReceiptTabs();
        }
        document.getElementById('product-search')?.focus();
    } catch (error) {
        alert('Ошибка соединения с сервером');
    } finally {
        if (saveBtn) saveBtn.disabled = false;
    }
}

// =========================================================
// 7. ОТЛОЖЕННЫЕ ЧЕКИ
// =========================================================

function escapeHtml(value) {
    return String(value || '').replace(/[&<>'"]/g, character => ({
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        "'": '&#39;',
        '"': '&quot;'
    }[character]));
}

function updateHeldReceiptsCount() {
    const count = document.getElementById('held-receipts-count');
    if (count) count.textContent = heldReceipts.length;
}

function renderHeldReceipts() {
    const container = document.getElementById('held-receipts-list');
    if (!container) return;

    if (!heldReceipts.length) {
        container.innerHTML = '<div class="p-5 text-center text-muted"><i class="bi bi-inbox fs-2 d-block mb-2"></i>Нет отложенных чеков</div>';
        return;
    }

    container.innerHTML = heldReceipts.map(receipt => {
        const items = Array.isArray(receipt.items) ? receipt.items : [];
        const total = items.reduce((sum, item) => sum + (Number(item.price) || 0) * (Number(item.qty) || 0), 0)
            * (1 - (Number(receipt.discount_percent) || 0) / 100);
        const date = receipt.updated_at ? new Date(receipt.updated_at).toLocaleString('ru-RU') : '';

        return `
            <div class="p-3 border-bottom">
                <div class="d-flex justify-content-between gap-3 mb-1">
                    <strong>${escapeHtml(receipt.customer_name || 'Основной покупатель')}</strong>
                    <span class="text-primary fw-bold text-nowrap">${total.toFixed(2)} ₴</span>
                </div>
                <div class="small text-muted mb-3">${items.length} поз. · ${escapeHtml(date)}</div>
                <div class="d-flex gap-2">
                    <button type="button" class="btn btn-sm btn-primary" onclick="restoreHeldReceipt(${Number(receipt.id)})">Продолжить</button>
                    <button type="button" class="btn btn-sm btn-outline-danger" onclick="discardHeldReceipt(${Number(receipt.id)})">Отменить</button>
                </div>
            </div>`;
    }).join('');
}

async function loadHeldReceipts() {
    const container = document.getElementById('held-receipts-list');

    try {
        const response = await fetch('/sales/held');
        const result = await response.json();
        if (!result.success) throw new Error(result.error);

        heldReceipts = result.receipts || [];
        updateHeldReceiptsCount();
        renderHeldReceipts();
    } catch (error) {
        if (container) container.innerHTML = '<div class="p-4 text-center text-danger">Не удалось загрузить отложенные чеки.</div>';
    }
}

async function holdInvoice() {
    saveCurrentUIToState();

    const activeReceipt = receipts.find(receipt => receipt.id === activeReceiptId);
    if (!activeReceipt || !activeReceipt.items.length) {
        alert('Добавьте товары в чек, прежде чем откладывать его.');
        return;
    }

    const button = document.getElementById('holdInvoice');
    if (button) button.disabled = true;

    try {
        const response = await fetch('/sales/held', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                customer_id: activeReceipt.customer.id || null,
                customer_name: activeReceipt.customer.name || 'Основной покупатель',
                items: activeReceipt.items,
                payment_method: activeReceipt.paymentMethod,
                cash_received: activeReceipt.cashReceived,
                discount_percent: activeReceipt.discountPercent,
                comment: activeReceipt.comment || null
            })
        });
        const result = await response.json();
        if (!result.success) throw new Error(result.error);

        closeReceipt(null, activeReceiptId, true);
        await loadHeldReceipts();
        document.getElementById('product-search')?.focus();
    } catch (error) {
        alert(error.message || 'Не удалось отложить чек.');
    } finally {
        if (button) button.disabled = false;
    }
}

async function removeHeldReceipt(id) {
    const response = await fetch(`/sales/held/${id}`, { method: 'DELETE' });
    const result = await response.json();
    if (!result.success) throw new Error(result.error);
}

async function restoreHeldReceipt(id) {
    const heldReceipt = heldReceipts.find(receipt => Number(receipt.id) === Number(id));
    if (!heldReceipt) return;

    try {
        await removeHeldReceipt(id);

        const nextNumber = receipts.length
            ? Math.max(...receipts.map(receipt => Number(receipt.num) || 0)) + 1
            : currentReceiptNum;
        const restoredReceipt = {
            id: `receipt_${receiptCounter++}`,
            num: nextNumber,
            customer: {
                id: heldReceipt.customer_id || '',
                name: heldReceipt.customer_name || 'Основной покупатель'
            },
            items: Array.isArray(heldReceipt.items) ? heldReceipt.items : [],
            paymentMethod: heldReceipt.payment_method || 'cash',
            cashReceived: heldReceipt.cash_received || '',
            discountPercent: Number(heldReceipt.discount_percent) || 0,
            comment: heldReceipt.comment || ''
        };

        receipts.push(restoredReceipt);
        activeReceiptId = restoredReceipt.id;
        renderReceiptTabs();
        loadReceiptToUI(activeReceiptId);
        await loadHeldReceipts();
        bootstrap.Modal.getInstance(document.getElementById('heldReceiptsModal'))?.hide();
    } catch (error) {
        alert(error.message || 'Не удалось восстановить чек.');
    }
}

async function discardHeldReceipt(id) {
    if (!confirm('Отменить отложенный чек? Товары не будут списаны.')) return;

    try {
        await removeHeldReceipt(id);
        await loadHeldReceipts();
    } catch (error) {
        alert(error.message || 'Не удалось отменить отложенный чек.');
    }
}

// =========================================================
// 7. СКАНИРОВАНИЕ И ГОРЯЧИЕ КЛАВИШИ (ОБНОВЛЕННАЯ ЛОГИКА)
// =========================================================

let scanner = null;
document.getElementById('scanBtn')?.addEventListener('click', async () => {
    document.getElementById('scannerModal').style.display = 'flex';
    const reader = document.getElementById('reader');
    if (reader) reader.innerHTML = '';
    scanner = new Html5Qrcode('reader');

    await scanner.start({ facingMode: 'environment' }, {
        fps: 10,
        qrbox: (viewfinderWidth, viewfinderHeight) => ({
            width: Math.min(360, Math.floor(viewfinderWidth * 0.76)),
            height: Math.min(160, Math.floor(viewfinderHeight * 0.4))
        })
    }, async decodedText => {
        document.getElementById('product-search').value = decodedText;
        await scanner.stop();
        document.getElementById('scannerModal').style.display = 'none';

        const response = await fetch(`/api/products/search?q=${encodeURIComponent(decodedText)}`);
        const products = await response.json();

        if (products.length) {
            addProductToInvoice(products[0]);
            document.getElementById('product-search').value = '';
            document.getElementById('search-results').style.display = 'none';
        } else {
            alert('Товар не найден!');
        }
    });
});

document.getElementById('closeScanner')?.addEventListener('click', async () => {
    if (scanner) { try { await scanner.stop(); } catch (e) {} }
    document.getElementById('scannerModal').style.display = 'none';
});

// ГЛОБАЛЬНЫЙ ПЕРЕХВАТ КЛАВИАТУРЫ
document.addEventListener('keydown', function(event) {
    if (event.key === 'F2') {
        event.preventDefault();
        searchInput?.focus();
        searchInput?.select();
    }
    if (event.key === 'F4') {
        event.preventDefault();
        const modal = document.getElementById('addCustomerModal');
        if (modal) new bootstrap.Modal(modal).show();
    }
    if ((event.altKey && event.key.toLowerCase() === 'c') || event.key === 'F3') {
        event.preventDefault();
        document.getElementById('customer_name')?.focus();
        document.getElementById('customer_name')?.select();
    }
    if (event.key === 'F8') {
        event.preventDefault();
        document.getElementById('cash')?.focus();
        document.getElementById('cash')?.select();
    }
    if (event.key === 'F7') {
        event.preventDefault();
        document.querySelector('tr.selected-product-row')?.classList.remove('selected-product-row');
        const rows = document.querySelectorAll('#item-products tr.receipt-item-row');
        if (rows.length > 0) {
            const lastRow = rows[rows.length - 1];
            lastRow.classList.add('selected-product-row');
            lastRow.scrollIntoView({ block: 'nearest' });
            document.activeElement.blur(); 
        }
    }

    const selectedRow = document.querySelector('tr.selected-product-row') || document.querySelector('tr.table-active');
    
    if (selectedRow && selectedRow.classList.contains('receipt-item-row')) {
        const rows = Array.from(document.querySelectorAll('#item-products tr.receipt-item-row'));
        const currentIndex = rows.indexOf(selectedRow);
        const qtyInput = selectedRow.querySelector('.qty');
        const itemId = selectedRow.querySelector('.product-name')?.getAttribute('data-id');

        if (event.key === 'ArrowUp') {
            event.preventDefault();
            if (currentIndex > 0) {
                selectedRow.classList.remove('selected-product-row', 'table-active');
                const prevRow = rows[currentIndex - 1];
                prevRow.classList.add('selected-product-row');
                prevRow.scrollIntoView({ block: 'nearest' });
                prevRow.click();
            }
        }
        if (event.key === 'ArrowDown') {
            event.preventDefault();
            if (currentIndex < rows.length - 1) {
                selectedRow.classList.remove('selected-product-row', 'table-active');
                const nextRow = rows[currentIndex + 1];
                nextRow.classList.add('selected-product-row');
                nextRow.scrollIntoView({ block: 'nearest' });
                nextRow.click();
            }
        }
        if (event.key === 'ArrowRight') {
            if (qtyInput && itemId) {
                event.preventDefault();
                let newVal = (parseInt(qtyInput.value) || 1) + 1;
                window.updateItemQty(itemId, newVal); 
            }
        }
        if (event.key === 'ArrowLeft') {
            if (qtyInput && itemId) {
                event.preventDefault();
                let newVal = (parseInt(qtyInput.value) || 1) - 1;
                if (newVal >= 1) window.updateItemQty(itemId, newVal);
            }
        }
        if (event.key === 'Delete') {
            event.preventDefault();
            if (itemId) {
                removeItem(itemId);
                setTimeout(() => {
                    const remainingRows = document.querySelectorAll('#item-products tr.receipt-item-row');
                    if (remainingRows.length > 0) {
                        const nextIndex = currentIndex < remainingRows.length ? currentIndex : remainingRows.length - 1;
                        remainingRows[nextIndex].classList.add('selected-product-row');
                        remainingRows[nextIndex].click();
                    } else {
                        searchInput?.focus();
                    }
                }, 50);
            }
        }
        if (event.key === 'Escape' || (event.key === 'Enter' && event.target.id !== 'invoice_comment')) {
            event.preventDefault();
            selectedRow.classList.remove('selected-product-row');
            searchInput?.focus();
        }
    }

    if (event.ctrlKey && event.key === 'Enter') {
        event.preventDefault();
        saveInvoice();
    }
    if (event.key === 'Escape' && !selectedRow) {
        if (document.activeElement.id === 'product-search') document.activeElement.blur();
        document.getElementById('closeScanner')?.click();
    }
    if (event.altKey && event.code === 'KeyN') {
        event.preventDefault();
        createNewReceipt();
    }
    if (event.altKey && event.code === 'ArrowRight') {
        event.preventDefault();
        if (receipts.length > 1) {
            const idx = receipts.findIndex(r => r.id === activeReceiptId);
            switchReceipt(receipts[(idx + 1) % receipts.length].id);
        }
    }
    if (event.altKey && event.code === 'ArrowLeft') {
        event.preventDefault();
        if (receipts.length > 1) {
            const idx = receipts.findIndex(r => r.id === activeReceiptId);
            switchReceipt(receipts[(idx - 1 + receipts.length) % receipts.length].id);
        }
    }
    if (event.altKey && event.code === 'KeyQ') {
        event.preventDefault();
        closeReceipt(null, activeReceiptId);
    }
});

// Сброс выделения при фокусе в поиск
searchInput?.addEventListener('focus', () => {
    document.querySelectorAll('#item-products tr').forEach(tr => tr.classList.remove('selected-product-row', 'table-active'));
});

// Клик по выпадающему списку методов оплаты
document.addEventListener('click', function(e) {
    const dropdownItem = e.target.closest('.dropdown-menu .dropdown-item');
    if (!dropdownItem) return;

    const text = dropdownItem.innerText.toLowerCase();
    let method = '';

    if (text.includes('карт')) method = 'card';
    else if (text.includes('перевод') || text.includes('безнал')) method = 'transfer';
    else if (text.includes('налич')) method = 'cash';

    if (method) {
        e.preventDefault();
        if (receipts.length && activeReceiptId) {
            const currentReceipt = receipts.find(r => r.id === activeReceiptId);
            if (currentReceipt) currentReceipt.paymentMethod = method;
        }
        
        const paymentBtn = document.getElementById('paymentMethod') || document.querySelector('.dropdown-toggle');
        if (paymentBtn) {
            if (method === 'card') paymentBtn.innerHTML = '💳 Карта';
            else if (method === 'transfer') paymentBtn.innerHTML = '📱 Перевод';
            else paymentBtn.innerHTML = '💵 Наличные';
        }
        saveCurrentUIToState();
    }
});

// Инициализация интерфейса
document.addEventListener('DOMContentLoaded', () => {
    document.getElementById('add-receipt-btn')?.addEventListener('click', createNewReceipt);
    document.getElementById('held-receipts-btn')?.addEventListener('click', loadHeldReceipts);
    document.getElementById('discount')?.addEventListener('input', () => { discountInputMode = 'percent'; calculateTotals(); }); 
    document.getElementById('discountAmount')?.addEventListener('input', () => { discountInputMode = 'amount'; calculateTotals(); }); 
    document.getElementById('cash')?.addEventListener('input', calculateTotals);
    
    document.querySelectorAll('.fast-cash-btn').forEach(btn => { 
        btn.addEventListener('click', function() { 
            const val = this.getAttribute('data-value'); 
            const cashInput = document.getElementById('cash');
            if (cashInput) { cashInput.value = val; calculateTotals(); }
        }); 
    });

    createNewReceipt();
    loadHeldReceipts();
});

// Копирование названия по клику на ячейку
document.getElementById('item-products')?.addEventListener('click', async e => {
    const cell = e.target.closest('.product-name');
    if (!cell) return;
    try {
        let name = cell.textContent.replace(/\s+/g, ' ').trim();
        name = name.replace(/,\s*(шт|м|кг|уп|л)\s*$/i, '');
        await navigator.clipboard.writeText(name);
    } catch (err) {
        console.error('Ошибка копирования:', err);
    }
});


// Отслеживание изменения способа оплаты в обычном select
document.getElementById('payment-method')?.addEventListener('change', function() {
    const currentReceipt = receipts.find(r => r.id === activeReceiptId);
    if (currentReceipt) {
        currentReceipt.paymentMethod = this.value;
    }
});


function applyMarkup() {

    const percent = Number(document.getElementById('markup').value) || 0;

    const current = receipts.find(r => r.id === activeReceiptId);
    if (!current) return;

    current.items.forEach(item => {

        // Запоминаем первоначальную цену
        if (item.originalPrice === undefined) {
            item.originalPrice = Number(item.price);
        }

        item.price = Number(
            (item.originalPrice * (1 + percent / 100)).toFixed(2)
        );

    });

    renderItemsTable(current.items);
    calculateTotals();
}

function syncReceiptTableHeight() {
    const tableScroll = document.getElementById('receipt-items-scroll');
    const paymentPanel = document.getElementById('payment-panel');
    if (!tableScroll || !paymentPanel) return;

    if (window.innerWidth <= 768) {
        tableScroll.style.height = '';
        return;
    }

    tableScroll.style.height = `${Math.max(360, Math.round(paymentPanel.getBoundingClientRect().height))}px`;
}

document.addEventListener('DOMContentLoaded', () => {
    const paymentPanel = document.getElementById('payment-panel');

    syncReceiptTableHeight();
    window.addEventListener('resize', syncReceiptTableHeight);

    if (paymentPanel && typeof ResizeObserver !== 'undefined') {
        new ResizeObserver(syncReceiptTableHeight).observe(paymentPanel);
    }
});
