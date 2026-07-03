const searchInput = document.getElementById('product-search');
const searchResults = document.getElementById('search-results');
const imagePreview = document.getElementById('imagePreview');

// ПЕРЕМЕННАЯ ДЛЯ ХРАНЕНИЯ ИНДЕКСА ТЕКУЩЕГО ВЫБРАННОГО ТОВАРA
let currentFocus = -1;

//1. Слушатель для ввода текста (Твой код с небольшим сбросом индекса)
searchInput.addEventListener(
    'input',
    async () => {
        const query = searchInput.value.trim();
        
        if (query.length < 2) {
            searchResults.style.display = 'none';
            searchResults.innerHTML = '';
            imagePreview.style.display = 'none';
            currentFocus = -1; // Сбрасываем фокус
            return;
        }

        const currentQuery = query;

        const response = await fetch(
            `/api/products/search?q=${encodeURIComponent(query)}`
        );

        const products = await response.json();
        if (currentQuery !== searchInput.value.trim()) {
            return;
        }
        
        searchResults.innerHTML = '';
        currentFocus = -1; // Сбрасываем фокус при получении новых результатов

        products.forEach(product => {
            const item = document.createElement('button');
            const qty = Number(product.quantity);

            const stockColor =
                qty > 10
                    ? 'success'
                    : qty > 0
                    ? 'warning'
                    : 'danger';

            item.type = 'button';
            item.className = 'list-group-item list-group-item-action py-3';

            item.innerHTML =
            `
            <div class="d-flex align-items-center">
                <img
                    src="${product.image || '/img/no-photo.png'}"
                    alt="${product.name}"
                    class="product-image"
                    style="
                        width:80px;
                        height:80px;
                        object-fit:contain;
                        background:#fff;
                        border:1px solid #dee2e6;
                        border-radius:8px;
                        padding:4px;
                    ">
                <div class="flex-grow-1 px-3">
                    <div class="fw-bold mb-1">
                        ${product.name}
                    </div>
                    <div class="small text-muted">
                        Арт: ${product.sku || '-'} | ШК: ${product.barcode || '-'}
                    </div>
                    <div class="small text-primary mt-1">
                        📍 ${product.stock_info || 'Нет остатков'}
                    </div>
                </div>
                <div class="text-end">
                    <div class="fw-bold fs-5">
                        ${Number(product.sale_price).toFixed(2)} ₴
                    </div>
                    <span class="badge bg-${stockColor} mt-2">
                        ${qty} ${product.unit}
                    </span>
                </div>
            </div>
            `;

            item.addEventListener(
                'click',
                () => {
                    addProductToInvoice(product);
                    searchInput.value = '';
                    searchResults.innerHTML = '';
                    searchResults.style.display = 'none';
                    imagePreview.style.display = 'none';
                    currentFocus = -1;
                    searchInput.focus();
                }
            );

            searchResults.appendChild(item);

            // Логика картинок (Оставляем как у тебя)
            const img = item.querySelector('.product-image');
            if (img) {
                img.addEventListener('mouseenter', () => {
                    const preview = document.getElementById('imagePreview');
                    preview.style.backgroundImage = `url('${img.src}')`;
                    preview.style.display = 'block';
                });

                img.addEventListener('mousemove', e => {
                    const preview = document.getElementById('imagePreview');
                    preview.style.left = '850px';
                    preview.style.top = '200px';
                });

                img.addEventListener('mouseleave', () => {
                    document.getElementById('imagePreview').style.display = 'none';
                });
            }
        });

        searchResults.style.display = products.length > 0 ? 'block' : 'none';
    }
);


// 2. НОВЫЙ СЛУШАТЕЛЬ: Обработка кнопок Вверх, Вниз и Enter внутри инпута
searchInput.addEventListener('keydown', function(e) {
    if (searchResults.style.display === 'none') return;

    const items = searchResults.getElementsByClassName('list-group-item');
    if (!items.length) return;

    if (e.key === 'ArrowDown') {
        // Нажали СТРЕЛКУ ВНИЗ
        e.preventDefault();
        currentFocus++;
        addActive(items);
        scrollToView(searchResults, items[currentFocus]);
    } else if (e.key === 'ArrowUp') {
        // Нажали СТРЕЛКУ ВВЕРХ
        e.preventDefault();
        currentFocus--;
        addActive(items);
        scrollToView(searchResults, items[currentFocus]);
    } else if (e.key === 'Enter') {
        // Нажали ENTER
        if (currentFocus > -1 && items[currentFocus]) {
            e.preventDefault();
            items[currentFocus].click(); // Триггерим клик, который вызовет твой addProductToInvoice()
        }
    }
});

// Вспомогательная функция для навешивания класса active (Bootstrap подсветит синим)
function addActive(items) {
    if (!items) return false;
    for (let i = 0; i < items.length; i++) {
        items[i].classList.remove('active');
    }
    if (currentFocus >= items.length) currentFocus = 0;
    if (currentFocus < 0) currentFocus = items.length - 1;
    
    items[currentFocus].classList.add('active');
}

// Вспомогательная функция скролла, чтобы выбранный товар не вылетал из зоны видимости окна результатов
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

document.addEventListener(
    'click',
    e => {

        if (
            !searchInput.contains(e.target)
            &&
            !searchResults.contains(e.target)
        ) {
            searchInput.value =
                        '';
            searchResults.style.display =
                'none';

        }

    }
);

// searchInput.addEventListener(
//     'focus',
//     () => {

//         if (
//             searchInput.value.trim().length < 2
//         ) {

//             searchResults.innerHTML = '';

//             searchResults.style.display =
//                 'none';

//         }

//     }
// );

// searchInput.addEventListener(
//     'blur',
//     () => {

//         setTimeout(() => {

//             searchResults.innerHTML = '';

//             searchResults.style.display =
//                 'none';

//         }, 150);

//     }
// );

searchInput.addEventListener(
    'keydown',
    e => {

        if (
            e.key === 'Enter'
        ) {

            const first =
                searchResults.querySelector(
                    '.list-group-item'
                );

            if (first) {

                first.click();

            }

        }

    }
);
// --- ГЛОБАЛЬНЫЕ ГОРЯЧИЕ КЛАВИШИ ---
document.addEventListener('keydown', function(event) {
    
    // 1. Клавиша F2 — Фокус на строку поиска товаров
    if (event.key === 'F2') {
        event.preventDefault(); // Отменяем системное действие браузера
        const searchInput = document.getElementById('product-search');
        if (searchInput) {
            searchInput.focus();
            searchInput.select(); // Выделяем текст, чтобы сразу перезаписать, если нужно
        }
    }

    // 2. Нажатие F4 — Открытие модального окна добавления клиента
    if (event.key === 'F4') {
        event.preventDefault();
        const customerModalElement = document.getElementById('addCustomerModal');
        if (customerModalElement) {
            const modal = new bootstrap.Modal(customerModalElement);
            modal.show();
        }
    }

    // 3. Комбинация Alt + C (или Cmd + C для Mac) — Поиск клиента
    if ((event.altKey && event.key.toLowerCase() === 'c') || event.key === 'F3') {
        event.preventDefault();
        const customerInput = document.getElementById('customer_name');
        if (customerInput) {
            customerInput.focus();
            customerInput.select(); // Сразу выделяем текст, чтобы начать писать заново
        }
    }
    // 4. Клавиша F8 — Фокус на поле «Получено» денег от клиента
    if (event.key === 'F8') {
        event.preventDefault();
        const cashInput = document.getElementById('cash');
        if (cashInput) {
            cashInput.focus();
            cashInput.select();
        }
    }

    // 5. Комбинация Alt + D — Фокус на инпут общей "Скидки %"
    if ((event.altKey || event.metaKey) && event.code === 'KeyD') {
        const discountInput = document.getElementById('discount');
        if (discountInput) {
            event.preventDefault();
            discountInput.focus();
            discountInput.select(); // Выделяем текст для быстрого изменения
        }
    }

    // 6. Выбор способа оплаты через Alt + Цифры (Alt+1, Alt+2, Alt+3)
    if (event.altKey) {
        const paymentSelect = document.querySelector('select[name="paymentMethod"]');
        if (paymentSelect) {
            if (event.code === 'Digit1') {
                event.preventDefault();
                paymentSelect.value = 'cash'; // Наличные
                paymentSelect.dispatchEvent(new Event('change'));
                paymentSelect.focus();
            } else if (event.code === 'Digit2') {
                event.preventDefault();
                paymentSelect.value = 'card'; // Карта
                paymentSelect.dispatchEvent(new Event('change'));
                paymentSelect.focus();
            } else if (event.code === 'Digit3') {
                event.preventDefault();
                paymentSelect.value = 'transfer'; // Перевод
                paymentSelect.dispatchEvent(new Event('change'));
                paymentSelect.focus();
            }
        }
    }

    // Клавиша F7 — Начать выбор товаров в таблице (выделяет самую нижнюю/последнюю строку)
    if (event.key === 'F7') {
        event.preventDefault();
        
        // Снимаем старое выделение, если оно было
        document.querySelector('tr.selected-product-row')?.classList.remove('selected-product-row');
        
        // Находим все строки товаров в теле таблицы (tbody tr)
        const rows = document.querySelectorAll('table tbody tr');
        if (rows.length > 0) {
            const lastRow = rows[rows.length - 1];
            lastRow.classList.add('selected-product-row');
            lastRow.scrollIntoView({ block: 'nearest' });
            
            // Убираем фокус из поиска, чтобы клавиатура переключилась на таблицу
            document.activeElement.blur(); 
        }
    }

    // Проверяем, если сейчас активирован режим выбора строки в таблице (горит серый фон)
    const selectedRow = document.querySelector('tr.selected-product-row');
    if (selectedRow) {
        const rows = Array.from(document.querySelectorAll('table tbody tr'));
        const currentIndex = rows.indexOf(selectedRow);
        
        // Находим инпут количества внутри этой конкретной серой строки
        const qtyInput = selectedRow.querySelector('.qty');

        // 1. СТРЕЛКА ВВЕРХ — Переключиться на товар выше
        if (event.key === 'ArrowUp') {
            event.preventDefault();
            if (currentIndex > 0) {
                selectedRow.classList.remove('selected-product-row');
                rows[currentIndex - 1].classList.add('selected-product-row');
                rows[currentIndex - 1].scrollIntoView({ block: 'nearest' });
            }
        }

        // 2. СТРЕЛКА ВНИЗ — Переключиться на товар ниже
        if (event.key === 'ArrowDown') {
            event.preventDefault();
            if (currentIndex < rows.length - 1) {
                selectedRow.classList.remove('selected-product-row');
                rows[currentIndex + 1].classList.add('selected-product-row');
                rows[currentIndex + 1].scrollIntoView({ block: 'nearest' });
            }
        }

        // Внутри вашего обработчика клавиатурных событий (например, event)

        // 3. СТРЕЛКА ВПРАВО — Увеличение количества товара (+1)
        if (event.key === 'ArrowRight') {
            if (qtyInput) {
                event.preventDefault();
                let currentVal = parseInt(qtyInput.value) || 1;
                let newVal = currentVal + 1;
                qtyInput.value = newVal; // Обновляем цифру в самом поле
                
                // Находим ID товара из этой же строки таблицы
                const row = qtyInput.closest('tr');
                const itemId = row?.querySelector('.product-name')?.getAttribute('data-id');
                
                if (itemId) {
                    // Вызываем вашу рабочую функцию! Она сама обновит массив, строку и правый блок
                    window.updateItemQty(itemId, newVal); 
                }
            }
        }

        // 4. СТРЕЛКА ВЛЕВО — Уменьшение количества товара (-1)
        if (event.key === 'ArrowLeft') {
            if (qtyInput) {
                event.preventDefault();
                let currentVal = parseInt(qtyInput.value) || 1;
                if (currentVal > 1) { // Защита от нуля и минуса
                    let newVal = currentVal - 1;
                    qtyInput.value = newVal; // Обновляем цифру в самом поле
                    
                    // Находим ID товара из этой же строки таблицы
                    const row = qtyInput.closest('tr');
                    const itemId = row?.querySelector('.product-name')?.getAttribute('data-id');
                    
                    if (itemId) {
                        // Вызываем вашу рабочую функцию!
                        window.updateItemQty(itemId, newVal);
                    }
                }
            }
        }

        // 5. Клавиша DELETE — Удалить выбранный сейчас товар
        if (event.key === 'Delete') {
            event.preventDefault();
            const deleteBtn = selectedRow.querySelector('.remove');
            if (deleteBtn) {
                deleteBtn.click();
                setTimeout(() => {
                    const remainingRows = document.querySelectorAll('table tbody tr');
                    if (remainingRows.length > 0) {
                        const nextIndex = currentIndex < remainingRows.length ? currentIndex : remainingRows.length - 1;
                        remainingRows[nextIndex].classList.add('selected-product-row');
                    } else {
                        document.getElementById('product-search')?.focus();
                    }
                }, 50);
            }
        }

        // 6. Клавиша Escape или Enter — Выйти из режима выбора строк обратно в поиск товаров
        if (event.key === 'Escape' || event.key === 'Enter') {
            event.preventDefault();
            selectedRow.classList.remove('selected-product-row');
            document.getElementById('product-search')?.focus();
        }


    }



    // Нажатие Enter внутри инпута количества возвращает кассира обратно в поиск товаров
    if (event.key === 'Enter' && event.target.classList.contains('qty')) {
        event.preventDefault();
        const searchInput = document.getElementById('product-search'); // Твой инпут поиска
        if (searchInput) {
            searchInput.focus();
            searchInput.select();
        }
    }

    // 7. Комбинация Ctrl + Enter — Автоматическое сохранение чека
    if (event.ctrlKey && event.key === 'Enter') {
        event.preventDefault();
        if (typeof saveInvoice === 'function') {
            saveInvoice();
        }
    }

    // 8. Клавиша Escape — Закрыть поиск или модалку сканера
    if (event.key === 'Escape') {
        // Убираем фокус из поиска, если он там
        if (document.activeElement.id === 'product-search') {
            document.activeElement.blur();
        }
        // Если открыто окно сканера — имитируем клик по крестику закрытия
        const closeScannerBtn = document.getElementById('closeScanner');
        if (closeScannerBtn) {
            closeScannerBtn.click();
        }
    }
    // Alt + N — Создать новый чек (вкладку)
    if (event.altKey && event.code === 'KeyN') {
        event.preventDefault(); // Отменяем стандартное поведение браузера
        
        if (typeof createNewReceipt === 'function') {
            createNewReceipt();
            
            // Сразу переводим фокус на поиск товара в новом чеке
            setTimeout(() => {
                document.getElementById('product-search')?.focus();
            }, 50);
        }
    }
    // Alt + Стрелка Вправо — Переключить на СЛЕДУЮЩУЮ вкладку
    if (event.altKey && event.code === 'ArrowRight') {
        event.preventDefault();
        if (typeof receipts !== 'undefined' && receipts.length > 1) {
            const currentIndex = receipts.findIndex(r => r.id === activeReceiptId);
            const nextIndex = (currentIndex + 1) % receipts.length; // Зацикливаем переключение
            activeReceiptId = receipts[nextIndex].id;
            
            if (typeof loadReceiptToUI === 'function') loadReceiptToUI(activeReceiptId);
            if (typeof renderReceiptTabs === 'function') renderReceiptTabs();
        }
    }

    // Alt + Стрелка Влево — Переключить на ПРЕДЫДУЩУЮ вкладку
    if (event.altKey && event.code === 'ArrowLeft') {
        event.preventDefault();
        if (typeof receipts !== 'undefined' && receipts.length > 1) {
            const currentIndex = receipts.findIndex(r => r.id === activeReceiptId);
            const prevIndex = (currentIndex - 1 + receipts.length) % receipts.length; // Зацикливаем в обратную сторону
            activeReceiptId = receipts[prevIndex].id;
            
            if (typeof loadReceiptToUI === 'function') loadReceiptToUI(activeReceiptId);
            if (typeof renderReceiptTabs === 'function') renderReceiptTabs();
        }
    }

    //  Alt + Q — Закрыть ТЕКУЩУЮ вкладку (удалить чек без сохранения)
    if (event.altKey && event.code === 'KeyQ') {
        event.preventDefault();
        
        if (typeof receipts !== 'undefined' && activeReceiptId) {
            // Подтверждение закрытия, если в чеке уже есть товары (защита от случайного нажатия)
            const currentReceipt = receipts.find(r => r.id === activeReceiptId);
            if (currentReceipt && currentReceipt.items.length > 0) {
                if (!confirm('В чеке есть товары. Вы уверены, что хотите закрыть его без сохранения?')) {
                    return;
                }
            }

            const currentIndex = receipts.findIndex(r => r.id === activeReceiptId);
            
            // Удаляем чек из массива
            receipts = receipts.filter(r => r.id !== activeReceiptId);

            if (receipts.length > 0) {
                // Если остались другие вкладки, переходим на соседнюю
                const nextActiveIndex = currentIndex < receipts.length ? currentIndex : receipts.length - 1;
                activeReceiptId = receipts[nextActiveIndex].id;
                if (typeof loadReceiptToUI === 'function') loadReceiptToUI(activeReceiptId);
            } else {
                // Если закрыли единственную вкладку, создаем новую пустую
                activeReceiptId = null;
                if (typeof createNewReceipt === 'function') createNewReceipt();
            }

            // Перерисовываем интерфейс
            if (typeof renderReceiptTabs === 'function') renderReceiptTabs();
            if (typeof updateTotals === 'function') updateTotals();
        }
    }
});


document.getElementById('addCustomerModal').addEventListener('shown.bs.modal', function () {
    document.getElementById('customerName').focus();
});

// Как только инпут поиска товаров получает фокус — убираем выделение со строк таблицы
document.getElementById('product-search')?.addEventListener('focus', function() {
    document.querySelector('tr.selected-product-row')?.classList.remove('selected-product-row');
});

// Клик мышкой по строке товара активирует режим выбора
document.querySelector('table tbody').addEventListener('click', function(event) {
    // Находим строку tr, по которой кликнули (исключая клики по кнопкам или инпутам, чтобы не мешать им)
    const row = event.target.closest('tr');
    
    if (row && !event.target.closest('.remove') && !event.target.closest('.qty')) {
        // Снимаем выделение с предыдущей выделенной строки
        document.querySelector('tr.selected-product-row')?.classList.remove('selected-product-row');
        
        // Добавляем серый фон текущей строке
        row.classList.add('selected-product-row');
        
        // Убираем фокус из поиска, чтобы кнопка Delete понимала, что мы работаем с таблицей
        document.activeElement.blur();
    }
});


// Сброс выделения строки при клике в любую другую область экрана
document.addEventListener('click', function(event) {
    // Находим нашу таблицу товаров (или ее tbody)
    const tableBody = document.querySelector('table tbody');
    
    // Если таблица есть, и клик произошел ВНЕ этой таблицы
    if (tableBody && !tableBody.contains(event.target)) {
        // Находим выделенную строку и убираем у нее серый фон
        const selectedRow = document.querySelector('tr.selected-product-row');
        if (selectedRow) {
            selectedRow.classList.remove('selected-product-row');
            console.log('Выделение строки сброшено кликом по пустой области');
        }
    }
});

function updateTotals() {
    let subtotal = 0;

    // Сначала пробуем посчитать сумму на основе массива товаров активного чека (это надёжнее всего)
    if (typeof receipts !== 'undefined' && activeReceiptId) {
        const currentReceipt = receipts.find(r => r.id === activeReceiptId);
        if (currentReceipt && currentReceipt.items && currentReceipt.items.length > 0) {
            currentReceipt.items.forEach(item => {
                subtotal += Number(item.qty) * Number(item.price);
            });
        } else {
            // Если массив пустой, но в DOM физически есть строки (например, при добавлении напрямую через HTML)
            document.querySelectorAll('.line-sum').forEach(cell => {
                subtotal += Number(cell.textContent) || 0;
            });
        }
    } else {
        // Запасной вариант (ваш старый метод), если мультичеки ещё не инициализировались
        document.querySelectorAll('.line-sum').forEach(cell => {
            subtotal += Number(cell.textContent) || 0;
        });
    }

    // Получаем процент скидки
    const discountInput = document.getElementById('discount');
    const discountPercent = discountInput ? (Number(discountInput.value) || 0) : 0;

    const discountLabel = document.getElementById('discount-label');
    if (discountLabel) discountLabel.textContent = discountPercent;

    // Считаем итоги
    const discountAmount = (subtotal * discountPercent) / 100;
    const total = subtotal - discountAmount;

    // Выводим результаты в интерфейс с проверкой на существование элементов
    const discountSumEl = document.getElementById('discount-sum');
    if (discountSumEl) discountSumEl.textContent = discountAmount.toFixed(2) + ' ₴';

    const totalSumEl = document.getElementById('total-sum');
    if (totalSumEl) totalSumEl.textContent = total.toFixed(2) + ' ₴';

    const subtotalSumEl = document.getElementById('subtotal-sum');
    if (subtotalSumEl) subtotalSumEl.textContent = subtotal.toFixed(2) + ' ₴';

    // РАССЧИТЫВАЕМ СДАЧУ ПРЯМО ТУТ (чтобы не было рассинхронизации)
    const cashInput = document.getElementById('cash');
    const cashReceived = cashInput ? (parseFloat(cashInput.value) || 0) : 0;
    
    const changeEl = document.getElementById('change');
    if (changeEl) {
        if (cashReceived > total) {
            changeEl.textContent = (cashReceived - total).toFixed(2) + ' ₴';
        } else {
            changeEl.textContent = '0.00 ₴';
        }
    }

    // Сохраняем актуальное состояние в массив мультичеков, чтобы данные не терялись при переключении
    if (typeof saveCurrentUIToState === 'function') {
        saveCurrentUIToState();
    }
}
document.getElementById('cash')?.addEventListener('input', updateTotals);
// скрипт скидки
document
    .getElementById('discount')
    .addEventListener(
        'input',
        updateTotals
    );

function updateRowNumbers() {

document
    .querySelectorAll('#item-products tr')
    .forEach((row, index) => {

        row.cells[0].textContent = index + 1;

    });
}


function addProductToInvoice(product) {
    // 1. Ищем активный чек в глобальном массиве состояний
    const currentReceipt = receipts.find(r => r.id === activeReceiptId);
    if (!currentReceipt) {
        console.error("Активный чек не найден!");
        return;
    }

    // 2. Чистим заглушку "Чек пуст", если она есть в таблице
    const emptyRow = document.querySelector('#item-products tr td[colspan]');
    if (emptyRow) {
        emptyRow.parentElement.remove();
    }

    // 3. Проверяем, есть ли уже этот товар в МАССИВЕ активного чека
    const existingItem = currentReceipt.items.find(i => String(i.id) === String(product.id));

    if (existingItem) {
        // Если товар есть, увеличиваем его количество в массиве
        existingItem.qty += 1;
        
        // Находим строку этого товара в DOM, чтобы визуально обновить инпут
        const rows = document.querySelectorAll('#item-products tr');
        for (const row of rows) {
            const nameEl = row.querySelector('.product-name');
            if (nameEl && nameEl.getAttribute('data-id') === String(product.id)) {
                const qtyInput = row.querySelector('.qty');
                if (qtyInput) {
                    qtyInput.value = existingItem.qty;
                    
                    // Обновляем визуальную сумму строки (line-sum)
                    const lineSumEl = row.querySelector('.line-sum');
                    if (lineSumEl) {
                        lineSumEl.textContent = (existingItem.qty * existingItem.price).toFixed(2);
                    }
                }
                break;
            }
        }
    } else {
        // 4. Если товара нет в чеке, добавляем его в МАССИВ состояний
        const price = Number(product.sale_price || 0);
        const newItem = {
            id: String(product.id),
            name: product.name,
            unit: product.unit,
            qty: 1,
            price: price
        };
        currentReceipt.items.push(newItem);

        // Генерируем новую строку в таблицу
        const rowNumber = currentReceipt.items.length;
        const html = `
            <tr>
                <td class="ps-3 text-muted">${rowNumber}</td>
                <td class="product-name" data-id="${newItem.id}" title="${newItem.name}" data-name="${newItem.name+','+newItem.unit}">
                    ${newItem.name+','+newItem.unit}
                </td>
                <td>
                    <div class="qty-control d-flex align-items-center gap-1">
                        <button type="button" class="btn btn-sm btn-outline-secondary minus" onclick="changeQtyFromBtn('${newItem.id}', -1)">-</button>
                        <input type="number" class="form-control form-control-sm qty text-center" value="1" min="1" style="width: 60px;" oninput="updateItemQtyDirectly('${newItem.id}', this.value)">
                        <button type="button" class="btn btn-sm btn-outline-secondary plus" onclick="changeQtyFromBtn('${newItem.id}', 1)">+</button>
                    </div>
                </td>
                <td>
                    <div class="pricepoduct fw-semibold" data-price="${price}">
                        ${price.toFixed(2)} ₴
                    </div>
                    <small class="text-muted">
                        Сумма:<br>
                        <span class="line-sum fw-bold text-primary">${price.toFixed(2)}</span> ₴
                    </small>
                </td>
                <td class="text-center">
                    <button type="button" class="btn btn-sm btn-outline-danger btn-remove remove" onclick="removeItemDirectly('${newItem.id}')">
                        <i class="bi bi-x-lg"></i>
                    </button>
                </td>
            </tr>
        `;

        const tbody = document.getElementById('item-products');
        if (tbody) {
            tbody.insertAdjacentHTML('beforeend', html);
        }
    }

    // 5. Пересчитываем глобальные итоги (теперь массив не пустой, и обнуления не будет!)
    updateTotals();
    if (typeof updateRowNumbers === 'function') updateRowNumbers();
}

// ВСПОМОГАТЕЛЬНАЯ ФУНКЦИЯ: Изменение количества из инпута
function updateItemQtyDirectly(itemId, value) {
    const currentReceipt = receipts.find(r => r.id === activeReceiptId);
    if (!currentReceipt) return;
    
    const item = currentReceipt.items.find(i => String(i.id) === String(itemId));
    if (item) {
        item.qty = Math.max(1, parseFloat(value) || 1);
        
        // Обновляем line-sum в DOM
        const rows = document.querySelectorAll('#item-products tr');
        for (const row of rows) {
            const nameEl = row.querySelector('.product-name');
            if (nameEl && nameEl.getAttribute('data-id') === String(itemId)) {
                const lineSumEl = row.querySelector('.line-sum');
                if (lineSumEl) lineSumEl.textContent = (item.qty * item.price).toFixed(2);
                break;
            }
        }
    }
    updateTotals();
}

// ВСПОМОГАТЕЛЬНАЯ ФУНКЦИЯ: Кнопки + и -
function changeQtyFromBtn(itemId, direction) {
    const currentReceipt = receipts.find(r => r.id === activeReceiptId);
    if (!currentReceipt) return;
    
    const item = currentReceipt.items.find(i => String(i.id) === String(itemId));
    if (item) {
        item.qty = Math.max(1, item.qty + direction);
        
        // Обновляем инпут и сумму в DOM
        const rows = document.querySelectorAll('#item-products tr');
        for (const row of rows) {
            const nameEl = row.querySelector('.product-name');
            if (nameEl && nameEl.getAttribute('data-id') === String(itemId)) {
                const qtyInput = row.querySelector('.qty');
                const lineSumEl = row.querySelector('.line-sum');
                if (qtyInput) qtyInput.value = item.qty;
                if (lineSumEl) lineSumEl.textContent = (item.qty * item.price).toFixed(2);
                break;
            }
        }
    }
    updateTotals();
}

// НАДЁЖНАЯ ФУНКЦИЯ УДАЛЕНИЯ ТОВАРА
function removeItemDirectly(itemId) {
    const currentReceipt = receipts.find(r => r.id === activeReceiptId);
    if (!currentReceipt) return;
    
    // 1. Удаляем товар из глобального массива активного чека
    currentReceipt.items = currentReceipt.items.filter(i => String(i.id) !== String(itemId));
    
    // 2. Находим строку этого товара в DOM по data-id и удаляем её
    const row = document.querySelector(`.product-name[data-id="${itemId}"]`)?.closest('tr');
    if (row) {
        row.remove();
    }
    
    // 3. Проверяем, остались ли ещё товары в таблице
    const tbody = document.getElementById('item-products');
    if (tbody) {
        const remainingRows = tbody.querySelectorAll('tr');
        
        // Если товаров больше нет — выводим нормальную красивую заглушку
        if (remainingRows.length === 0) {
            tbody.innerHTML = `<tr><td colspan="5" class="text-center p-4 text-muted">Чек пуст. Отсканируйте или найдите товар.</td></tr>`;
        } else {
            // Если товары остались, просто пересчитываем их номера № (1, 2, 3...)
            updateRowNumbers();
        }
    }
    
    // 4. Пересчитываем общую сумму чека справа
    updateTotals();
}




function updateChange() {

    const cash =
        parseFloat(
            document.getElementById('cash').value
        ) || 0;

    const total =
        parseFloat(
            document
                .getElementById('total-sum')
                .textContent
                .replace('₴', '')
                .trim()
        ) || 0;

    const change =
        cash - total;

    document.getElementById(
        'change'
    ).textContent =
        change > 0
            ? change.toFixed(2) + ' ₴'
            : '0.00 ₴';

}

document
    .getElementById('cash')
    .addEventListener(
        'input',
        updateChange
    );



// document.addEventListener('click', e => {
//     const removeBtn = e.target.closest('.remove');

//     if (removeBtn) {
//         const tbody = document.getElementById('item-products');
//         const row = removeBtn.closest('tr');
        
//         // 1. Сначала удаляем саму строчку товара
//         if (row) {
//             row.remove();
//         }
        
//         // 2. Проверяем, остались ли ещё товары в таблице
//         if (tbody) {
//             const remainingRows = tbody.querySelectorAll('tr');
            
//             // Если строк больше нет — выводим нормальную заглушку во всю ширину (colspan="5")
//             if (remainingRows.length === 0) {
//                 tbody.innerHTML = `<tr><td colspan="5" class="text-center p-4 text-muted">Чек пуст. Отсканируйте или найдите товар.</td></tr>`;
//             } else {
//                 // Если товары остались, просто пересчитываем их номера № (1, 2, 3...)
//                 updateRowNumbers();
//             }
//         }

//         // 3. Синхронизируем состояние с глобальным массивом receipts (чтобы при переключении табов товар не вернулся)
//         if (typeof receipts !== 'undefined' && activeReceiptId) {
//             const currentReceipt = receipts.find(r => r.id === activeReceiptId);
//             if (currentReceipt) {
//                 // Находим ID удаленного товара из data-id ячейки .product-name, если строка еще доступна, 
//                 // или просто пересобираем массив на основе оставшихся в DOM строк
//                 const currentDomIds = Array.from(tbody.querySelectorAll('.product-name')).map(el => String(el.getAttribute('data-id')));
//                 currentReceipt.items = currentReceipt.items.filter(item => currentDomIds.includes(String(item.id)));
//             }
//         }
        
//         // 4. Пересчитываем общую сумму чека
//         updateTotals();
//     }
// });


function updateQuantity(input) {

    if (input.value < 1) {

        input.value = 1;

    }

    const row =
        input.closest('tr');

    const qty =
        Number(input.value);

    const price =
        Number(
            row.querySelector('.pricepoduct')
                .dataset.price
        );

    const sum =
        qty * price;

    row.querySelector('.line-sum')
        .textContent =
        sum.toFixed(2);

    // const mobileSum =
    //     row.querySelector('.sum-mobile');

    // if (mobileSum) {

    //     mobileSum.textContent =
    //         sum.toFixed(2);

    // }

    updateTotals();

}

document.addEventListener('input', (e) => {

    if (!e.target.classList.contains('qty')) {
        return;
    }

    updateQuantity(e.target);

});
//Скрипт для конопок плюс и минус 
document.addEventListener('click', e => {

    if (e.target.classList.contains('plus')) {

        const input =
            e.target.parentNode.querySelector('.qty');

        input.value =
            Number(input.value) + 1;

        updateQuantity(input);
    }

    if (e.target.classList.contains('minus')) {

        const input =
            e.target.parentNode.querySelector('.qty');

        if (input.value > 1) {

            input.value =
                Number(input.value) - 1;

            updateQuantity(input);
        }
    }

});

// Сохраняет чек
// async function saveInvoice() {
//     let subtotal = 0;

//     document
//         .querySelectorAll('.line-sum')
//         .forEach(cell => {
//             subtotal += Number(cell.textContent);
//         });

//     try {
//         const items = [];

//         document
//             .querySelectorAll('#item-products tr')
//             .forEach(row => {
//                 if (row.querySelector('td[colspan]')) return; // Пропускаем заглушку

//                 items.push({
//                     product_id: Number(
//                         row.querySelector('.product-name').dataset.id
//                     ),
//                     quantity: Number(
//                         row.querySelector('.qty').value
//                     ),
//                     price: Number(
//                         row.querySelector('.pricepoduct').dataset.price
//                     )
//                 });
//             });

//         if (!items.length) {
//             alert('Добавьте товары в чек');
//             return;
//         }

//         const total = Number(
//             document
//                 .getElementById('total-sum')
//                 .textContent
//                 .replace('₴', '')
//                 .trim()
//         );

//         const discountPercent = Number(
//             document.getElementById('discount').value
//         ) || 0;

//         const discountAmount = subtotal * discountPercent / 100;

//         const saveBtn = document.querySelector('button[onclick="saveInvoice()"]');
//         if (saveBtn) saveBtn.disabled = true;

//         const response = await fetch(
//             '/sales/save',
//             {
//                 method: 'POST',
//                 headers: {
//                     'Content-Type': 'application/json'
//                 },
//                 body: JSON.stringify({
//                     customer_id: document.querySelector('#customer_id')?.value || null,
//                     payment_method: activeReceipt.paymentMethod,
//                     total,
//                     discount_percent: discountPercent,
//                     discount_amount: discountAmount,
//                     items
//                 })
//             }
//         );

//         const result = await response.json();

//         if (!result.success) {
//             alert(result.error || 'Ошибка сохранения');
//             if (saveBtn) saveBtn.disabled = false;
//             return;
//         }

//         // --- ЛОГИКА УСПЕШНОГО ЗАКРЫТИЯ ИЛИ ОБНОВЛЕНИЯ ЕДИНСТВЕННОГО ЧЕКА ---
//         //alert('Чек успешно сохранен!');

//         // Глобально обновляем номер для генерации будущих вкладок
//         if (result.next_num) {
//             currentReceiptNum = result.next_num;
//         }

//         if (typeof receipts !== 'undefined' && activeReceiptId) {
            
//             if (receipts.length > 1) {
//                 // ВАРИАНТ А: Вкладок несколько -> Полностью закрываем сохраненную
//                 const currentIndex = receipts.findIndex(r => r.id === activeReceiptId);
//                 receipts = receipts.filter(r => r.id !== activeReceiptId);

//                 // Переключаемся на соседний открытый чек
//                 const nextActiveIndex = currentIndex < receipts.length ? currentIndex : receipts.length - 1;
//                 activeReceiptId = receipts[nextActiveIndex].id;
                
//                 if (typeof loadReceiptToUI === 'function') {
//                     loadReceiptToUI(activeReceiptId);
//                 }
                
//             } else {
//                 // ВАРИАНТ Б: Вкладка ВСЕГО ОДНА -> Обновляем её номер без закрытия
//                 const currentReceipt = receipts.find(r => r.id === activeReceiptId);
//                 if (currentReceipt) {
//                     currentReceipt.items = []; 
//                     currentReceipt.cashReceived = ''; 
//                     currentReceipt.discountPercent = 0; 
//                     currentReceipt.customer = { id: '', name: 'Основной покупатель' }; 
                    
//                     // Обновляем номер вкладки
//                     if (result.next_num) {
//                         currentReceipt.num = result.next_num;
//                     }
//                 }
                
//                 // Сбрасываем интерфейс таблицы товаров
//                 const tbody = document.getElementById('item-products');
//                 if (tbody) {
//                     tbody.innerHTML = `<tr><td colspan="5" class="text-center p-4 text-muted">Чек пуст. Отсканируйте или найдите товар.</td></tr>`;
//                 }

//                 // Сбрасываем поля ввода
//                 if (document.getElementById('cash')) document.getElementById('cash').value = '';
//                 if (document.getElementById('discount')) document.getElementById('discount').value = '0';
//                 if (document.getElementById('customer_id')) document.getElementById('customer_id').value = '';
//                 if (document.getElementById('customer_name')) document.getElementById('customer_name').value = 'Основной покупатель';
//             }
//         }

//         // Перерисовываем вкладки на экране — теперь номер точно обновится!
//         if (typeof renderReceiptTabs === 'function') {
//             renderReceiptTabs();
//         }

//         // Пересчитываем итоги (все обнулится)
//         updateTotals();

//         if (saveBtn) saveBtn.disabled = false;
//         document.getElementById('product-search')?.focus();

//     } catch (error) {
//         console.error(error);
//         alert('Ошибка соединения с сервером');
//         const saveBtn = document.querySelector('button[onclick="saveInvoice()"]');
//         if (saveBtn) saveBtn.disabled = false;
//     }
// }

// Сохраняет чек
async function saveInvoice() {
    // 1. Находим активный чек (это исправляет вашу ошибку)
    const activeReceipt = receipts.find(r => r.id === activeReceiptId);
    
    if (!activeReceipt) {
        alert('Ошибка: Чек не найден');
        return;
    }

    if (!activeReceipt.items || activeReceipt.items.length === 0) {
        alert('Добавьте товары в чек');
        return;
    }

    // 2. Считаем данные из объекта, а не из DOM
    let subtotal = 0;
    activeReceipt.items.forEach(i => {
        subtotal += (Number(i.price) || 0) * (Number(i.qty) || 0);
    });

    const discountPercent = Number(activeReceipt.discountPercent) || 0;
    const discountAmount = subtotal * discountPercent / 100;
    const total = subtotal - discountAmount;

    // 3. Подготовка данных
    const saveBtn = document.querySelector('button[onclick="saveInvoice()"]');
    if (saveBtn) saveBtn.disabled = true;

    try {
        const response = await fetch('/sales/save', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                customer_id: activeReceipt.customer.id || null,
                payment_method: activeReceipt.paymentMethod, // Берем из объекта
                comment: activeReceipt.comment || null,
                total: total,
                discount_percent: discountPercent,
                discount_amount: discountAmount,
                items: activeReceipt.items.map(i => ({
                    product_id: Number(i.id),
                    quantity: Number(i.qty),
                    price: Number(i.price)
                }))
            })
        });

        const result = await response.json();

        if (!result.success) {
            alert(result.error || 'Ошибка сохранения');
            if (saveBtn) saveBtn.disabled = false;
            return;
        }



        // 4. Логика обновления после успешного сохранения
        if (receipts.length > 1) {
            // Находим индекс чека, который только что сохранили
            const currentIndex = receipts.findIndex(r => r.id === activeReceiptId);
            
            // Удаляем сохраненный чек из памяти
            receipts = receipts.filter(r => r.id !== activeReceiptId);
            
            // Переключаем фокус на соседний чек
            activeReceiptId = receipts[Math.min(currentIndex, receipts.length - 1)].id;
            
            // Сначала перерисовываем вкладки, чтобы их номера (Чек #1, #2) обновились в памяти
            if (typeof renderReceiptTabs === 'function') renderReceiptTabs();
            
            // И только потом загружаем данные активного чека в UI
            loadReceiptToUI(activeReceiptId);
        } else {
            // Очистка единственного чека (подготовка к новой продаже)
            activeReceipt.items = [];
            activeReceipt.cashReceived = '';
            activeReceipt.discountPercent = 0;
            activeReceipt.customer = { id: '', name: 'Основной покупатель' };
            //if (result.next_num) activeReceipt.num = result.next_num;
            
            // СБРОС новых полей в объекте к дефолтным значениям
            activeReceipt.comment = '';
            activeReceipt.paymentMethod = 'cash';
            
            // Сбрасываем интерфейс
            loadReceiptToUI(activeReceiptId);
            
            // Перерисовываем вкладки (чтобы обновить имя, если это необходимо)
            if (typeof renderReceiptTabs === 'function') renderReceiptTabs();
        }

        // Обновляем общие итоги (суммы, скидки) на экране
        if (typeof updateTotals === 'function') updateTotals();

        // Возвращаем фокус в поле поиска товаров
        document.getElementById('product-search')?.focus();

    } catch (error) {
        console.error(error);
        alert('Ошибка соединения с сервером');
    } finally {
        if (saveBtn) saveBtn.disabled = false;
    }
}
        
let scanner = null;

document
    .getElementById('scanBtn')
    .addEventListener(
        'click',
        async () => {

            document
                .getElementById(
                    'scannerModal'
                )
                .style.display =
                'flex';

            const reader =
                document.getElementById(
                    'reader'
                );

            reader.innerHTML = '';

            scanner =
                new Html5Qrcode(
                    'reader'
                );

            await scanner.start(
                {
                    facingMode:
                        'environment'
                },
                {
                    fps: 10,
                    qrbox: 250
                },
                async decodedText => {

                    document
                        .getElementById(
                            'product-search'
                        )
                        .value =
                        decodedText;

                    await scanner.stop();

                    document
                        .getElementById(
                            'scannerModal'
                        )
                        .style.display =
                        'none';

                    // если есть функция поиска
                    const response =
                        await fetch(
                            `/api/products/search?q=${encodeURIComponent(decodedText)}`
                        );

                    const products =
                        await response.json();

                    if (products.length) {

                        addProductToInvoice(
                            products[0]
                        );
                        const searchInput =
                            document.getElementById(
                                'product-search'
                            );

                        searchInput.value = '';

                        document
                            .getElementById(
                                'search-results'
                            )
                            .style.display =
                            'none';

                        // searchInput.focus();

                    } else {

                        alert(
                            'Товар не найден!'
                        );

                    }

                }
            );

        }
    );

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

// Копирует название товара
document.addEventListener('click', async e => {
    const cell = e.target.closest('.product-name');
    if (!cell) {
        return;
    }

    try {
        // 1. Берем видимый текст ячейки вместо data-name, 
        // чтобы кавычки дюймов (1/2") не ломали HTML-атрибуты
        let name = cell.textContent;

        // 2. Схлопываем лишние пробелы, табы и переносы строк в один пробел
        name = name.replace(/\s+/g, ' ').trim();

        // 3. Убираем единицы измерения на конце (например: ", шт"), если они есть
        name = name.replace(/,\s*(шт|м|кг|уп|л)\s*$/i, '');

        // 4. Записываем чистый текст в буфер
        await navigator.clipboard.writeText(name);

        

    } catch (err) {
        console.error('Ошибка при копировании названия:', err);
    }
});

async function createCustomer(event) {
    event.preventDefault(); // Защита от перезагрузки страницы

    const name = document.getElementById('customerName').value.trim();
    const phone = document.getElementById('customerPhone').value.trim();
    const email = document.getElementById('customerEmail').value.trim(); // Получаем email
    const discount = document.getElementById('customerDiscount').value || 0;

    try {
        const response = await fetch('/api/customers', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ 
                name, 
                phone, 
                email,                         // Передаем email на бэкенд
                discount_percentage: discount 
            })
        });

        const result = await response.json();

        if (response.ok && result.success) {
            const newClientData = result.client;

            // Вызываем общую функцию обновления данных, которую мы создали шагом выше
            if (typeof window.refreshCustomersData === 'function') {
                window.refreshCustomersData(newClientData);
            }

            // Закрываем модалку и чистим форму
            const modal = bootstrap.Modal.getInstance(document.getElementById('addCustomerModal'));
            if (modal) modal.hide();
            document.getElementById('addCustomerForm').reset();
            
            // Если нужно, запускаем перерасчет скидки чека
            updateTotals(newClientData.discount_percentage);
        } else {
            alert('Ошибка при создании клиента: ' + (result.message || 'Неизвестная ошибка'));
        }
    } catch (error) {
        console.error('Ошибка AJAX:', error);
        alert('Не удалось связаться с сервером');
    }
}

document.addEventListener('DOMContentLoaded', () => {
    const inputName = document.getElementById('customer_name');
    const inputId = document.getElementById('customer_id');
    const listContainer = document.getElementById('customerList');
    const clearBtn = document.getElementById('clearCustomerBtn');
    
    let customersData = []; 
    let currentFocus = -1; // Индекс текущего подсвеченного элемента

    // Загрузка клиентов с сервера
    async function fetchCustomers() {
        try {
            const response = await fetch('/api/customers');
            const result = await response.json();
            if (response.ok && result.success) {
                customersData = result.customers;
            }
        } catch (error) {
            console.error('Ошибка при запросе клиентов:', error);
        }
    }
    fetchCustomers();

    // Отрисовка списка
    function renderCustomerList(filterText = '') {
        const text = filterText.toLowerCase().trim();
        currentFocus = -1; // Сбрасываем фокус при изменении текста
        
        const filtered = customersData.filter(cust => 
            cust.name.toLowerCase().includes(text) || 
            (cust.phone && cust.phone.includes(text))
        );

        if (filtered.length === 0 || text === '') {
            listContainer.innerHTML = '';
            listContainer.classList.add('d-none');
            toggleClearButton();
            return;
        }

        listContainer.innerHTML = filtered.map((cust, index) => {
            const displayPhone = cust.phone ? ` (${cust.phone})` : '';
            return `
                <button type="button" 
                        class="list-group-item list-group-item-action text-start py-2 customer-item" 
                        data-index="${index}"
                        data-id="${cust.id}" 
                        data-name="${cust.name}${displayPhone}"
                        data-discount="${cust.discount_percentage || 0}">
                    ${cust.name}${displayPhone}
                </button>
            `;
        }).join('');

        listContainer.classList.remove('d-none');
        toggleClearButton();
    }

    // Функция выбора конкретного клиента
    function selectCustomer(id, name, discount) {
        inputName.value = name;
        inputId.value = id;
        listContainer.innerHTML = '';
        listContainer.classList.add('d-none');
        toggleClearButton();
        
        console.log(`Выбран клиент: ${name}, Скидка: ${discount}%`);

        // --- АВТОМАТИЧЕСКОЕ ПРИМЕНЕНИЕ СКИДКИ ---
        const orderDiscountInput = document.getElementById('discount');
        if (orderDiscountInput) {
            // Подставляем процент скидки клиента в инпут скидки чека
            // Если скидка 0 (или это "Основной покупатель"), ставим пустую строку или 0
            orderDiscountInput.value = discount > 0 ? discount : '';
            
            // Важно! Вызываем событие 'input' или 'change', чтобы сработали ваши встроенные 
            // функции пересчета итоговых сумм (subtotal, total-sum, discount-sum), которые уже написаны на фронтенде
            orderDiscountInput.dispatchEvent(new Event('input'));
            orderDiscountInput.dispatchEvent(new Event('change'));
        }

        // Автоматический перевод фокуса на поиск товара
        const productSearchInput = document.getElementById('product-search');
        if (productSearchInput) {
            productSearchInput.focus();
        }
    }

    // Показываем/скрываем крестик очистки
    const editBtn = document.getElementById('editCustomerBtn');

    function toggleClearButton() {
        if (inputName.value && inputName.value !== 'Основной покупатель') {
            clearBtn.style.display = 'block';
            editBtn.style.display = 'block'; // Показываем карандаш
        } else {
            clearBtn.style.display = 'none';
            editBtn.style.display = 'none';  // Прячем карандаш
        }
    }

    editBtn.addEventListener('click', () => {
        const currentId = inputId.value;
        if (!currentId) return;

        // Находим данные текущего выбранного клиента из глобального массива customersData
        const customer = customersData.find(c => c.id == currentId);
        
        if (customer) {
            // Заполняем поля модалки текущими данными
            document.getElementById('edit_customer_id').value = customer.id;
            document.getElementById('edit_customer_name').value = customer.name;
            document.getElementById('edit_customer_phone').value = customer.phone || '';
            document.getElementById('edit_customer_email').value = customer.email || '';
            document.getElementById('edit_customer_discount').value = customer.discount_percentage || 0;

            // Показываем модалку редактирования
            const editModal = new bootstrap.Modal(document.getElementById('editCustomerModal'));
            editModal.show();
        }
    });

    document.getElementById('editCustomerForm').addEventListener('submit', async function(e) {
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
                // Закрываем модалку
                const modalEl = document.getElementById('editCustomerModal');
                const modal = bootstrap.Modal.getInstance(modalEl);
                if (modal) modal.hide();

                // Перезапрашиваем базу клиентов и обновляем инпут на странице
                if (typeof window.refreshCustomersData === 'function') {
                    window.refreshCustomersData(result.client);
                }
            } else {
                alert('Ошибка при сохранении: ' + result.message);
            }
        } catch (error) {
            console.error('Ошибка отправки изменений:', error);
        }
    });

    // Функция для управления активным элементом (подсветка синим)
    function addActive(items) {
        if (!items || items.length === 0) return false;
        removeActive(items);
        
        if (currentFocus >= items.length) currentFocus = 0;
        if (currentFocus < 0) currentFocus = items.length - 1;
        
        items[currentFocus].classList.add('active');
        // Автопрокрутка списка к активному элементу
        items[currentFocus].scrollIntoView({ block: 'nearest' });
    }

    function removeActive(items) {
        for (let i = 0; i < items.length; i++) {
            items[i].classList.remove('active');
        }
    }

    // --- ОБРАБОТЧИКИ СОБЫТИЙ ---

    // 1. Управление клавишами (Вверх, Вниз, Enter, Escape)
    inputName.addEventListener('keydown', function(e) {
        const items = listContainer.querySelectorAll('.customer-item');
        
        if (listContainer.classList.contains('d-none') || items.length === 0) {
            if (e.key === 'ArrowDown') { // Если список скрыт, по стрелке вниз открываем его
                renderCustomerList(this.value);
            }
            return;
        }

        if (e.key === 'ArrowDown') {
            e.preventDefault();
            currentFocus++;
            addActive(items);
        } else if (e.key === 'ArrowUp') {
            e.preventDefault();
            currentFocus--;
            addActive(items);
        } else if (e.key === 'Enter') {
            e.preventDefault();
            if (currentFocus > -1 && items[currentFocus]) {
                items[currentFocus].click(); // Эмулируем клик по активному элементу
            }
        } else if (e.key === 'Escape') {
            listContainer.classList.add('d-none');
            if (!inputId.value) {
                inputName.value = 'Основной покупатель';
            }
        }
    });

    // Обычный ввод текста
    inputName.addEventListener('input', (e) => {
        inputId.value = ''; 
        renderCustomerList(e.target.value);
    });

    // Клик мышкой по элементу списка
    listContainer.addEventListener('click', (e) => {
        const button = e.target.closest('.list-group-item');
        if (!button) return;

        selectCustomer(
            button.getAttribute('data-id'),
            button.getAttribute('data-name'),
            parseFloat(button.getAttribute('data-discount')) || 0
        );
    });

    // Клик на кнопку «Крестик» (Сброс в розницу)
    clearBtn.addEventListener('click', () => {
        selectCustomer('', 'Основной покупатель', 0);
        inputName.focus();
    });

    // Закрытие при клике мимо
    document.addEventListener('click', (e) => {
        if (!inputName.contains(e.target) && !listContainer.contains(e.target) && !clearBtn.contains(e.target)) {
            listContainer.classList.add('d-none');
            if (!inputId.value) {
                inputName.value = 'Основной покупатель';
                toggleClearButton();
            }
        }
    });

    inputName.addEventListener('focus', (e) => {
        if (e.target.value === 'Основной покупатель') {
            e.target.value = ''; 
        } else {
            renderCustomerList(e.target.value);
        }
    });
    
    // Глобальная функция обновления для модалок (создания и редактирования)
    window.refreshCustomersData = async function(client) {
        await fetchCustomers(); // Перезапрашиваем актуальную базу клиентов с сервера
        
        const displayPhone = client.phone ? ` (${client.phone})` : '';
        const fullName = `${client.name}${displayPhone}`;
        
        // Передаем ID, отформатированное Имя и СККИДКУ, чтобы она тут же применилась к чеку
        selectCustomer(client.id, fullName, parseFloat(client.discount_percentage) || 0);
    }
});


let receipts = []; 
let activeReceiptId = null; 
let receiptCounter = 1; // Счетчик для ID вкладок в JS

// В эту переменную бэкенд должен передать просто стартовое число (например, 69)
let currentReceiptNum = 1; 

function createNewReceipt() {
    let receiptSaleNum;

    if (receipts.length === 0) {
        // Первый чек берет номер напрямую из бэкенда
        receiptSaleNum = currentReceiptNum;
    } else {
        // НАДЁЖНЫЙ ВАРИАНТ: ищем самый большой номер среди открытых вкладок
        const maxCurrentNum = Math.max(...receipts.map(r => Number(r.num) || 0));

        // Прибавляем единицу к максимальному существующему (69 -> 70 -> 71...)
        receiptSaleNum = maxCurrentNum + 1; 
    }

    // Генерируем обычный последовательный ID (receipt_1, receipt_2...)
    const simpleId = 'receipt_' + receiptCounter;
    receiptCounter++; 

    const newReceipt = {
        id: simpleId, 
        num: receiptSaleNum, // Здесь теперь будет просто чистое число (например, 70)
        customer: { id: '', name: 'Основной покупатель' }, 
        items: [],
        paymentMethod: 'cash', 
        cashReceived: '', 
        discountPercent: 0,
        
        comment: ''
    };
    
    receipts.push(newReceipt); 
    activeReceiptId = newReceipt.id;
    renderReceiptTabs(); 
    loadReceiptToUI(activeReceiptId);
}

function renderReceiptTabs() {
    const container = document.getElementById('receipt-tabs'); 
    container.innerHTML = '';
    
    // Добавляем 'index' в параметры, чтобы считать вкладки с 0
    receipts.forEach((r, index) => {
        const li = document.createElement('li'); 
        li.className = 'nav-item';
        const isActive = r.id === activeReceiptId;
        const closeBtn = receipts.length > 1 
            ? `<button type="button" class="close-receipt" onclick="closeReceipt(event, '${r.id}')"><i class="bi bi-x-lg"></i></button>` 
            : '';
        
        // Формируем красивое имя чека (индекс + 1, чтобы вместо Чек #0 был Чек #1)
        const tabTitle = `Чек #${index + 1}`;
        
        // Подставляем tabTitle вместо полного r.num
        li.innerHTML = `<button class="nav-link ${isActive ? 'active' : ''}" onclick="switchReceipt('${r.id}')">${tabTitle} ${closeBtn}</button>`;
        container.appendChild(li);
    });
}

function switchReceipt(id) { 
    saveCurrentUIToState(); 
    activeReceiptId = id; 
    renderReceiptTabs(); 
    loadReceiptToUI(id); 
}

function closeReceipt(event, id) { 
    event.stopPropagation(); 
    const index = receipts.findIndex(r => r.id === id); 
    if (index === -1) return; 
    
    receipts.splice(index, 1); 
    
    if (activeReceiptId === id && receipts.length > 0) { 
        activeReceiptId = receipts[Math.max(0, index - 1)].id; 
    } 
    renderReceiptTabs(); 
    loadReceiptToUI(activeReceiptId); 
}

// =========================================================
// СИНХРОНИЗАЦИЯ СПОСОБОВ ОПЛАТЫ ДЛЯ КАЖДОЙ ВКЛАДКИ ЧЕКА
// =========================================================

// СОХРАНЕНИЕ: берем значение прямо из <select>
function saveCurrentUIToState() {
    const current = receipts.find(r => r.id === activeReceiptId); 
    if (!current) return;
    
    // ... другие поля ...
    current.customer.id = document.getElementById('customer_id')?.value || ''; 
    current.customer.name = document.getElementById('customer_name')?.value || 'Основной покупатель';
    current.cashReceived = document.getElementById('cash')?.value || '';
    current.discountPercent = parseInt(document.getElementById('discount')?.value) || 0; 
    // СОХРАНЯЕМ новые поля
    
    current.comment = document.getElementById('invoice_comment')?.value || '';

    // Берем метод оплаты из нового селекта
    const paymentSelect = document.getElementById('payment-method');
    if (paymentSelect) {
        current.paymentMethod = paymentSelect.value;
    }

    
}

// ЗАГРУЗКА: устанавливаем значение в <select>
function loadReceiptToUI(id) {
    const current = receipts.find(r => r.id === id); 
    if (!current) return;
    
    // ... другие поля ...
    if (document.getElementById('customer_id')) document.getElementById('customer_id').value = current.customer.id;
    if (document.getElementById('customer_name')) document.getElementById('customer_name').value = current.customer.name;
    if (document.getElementById('cash')) document.getElementById('cash').value = current.cashReceived;
    if (document.getElementById('discount')) document.getElementById('discount').value = current.discountPercent || '';
    
    // ЗАГРУЖАЕМ новые поля
    // const warehouseEl = document.getElementById('invoice_warehouse');
    // if (warehouseEl) warehouseEl.value = current.warehouse || 'main';

    const commentEl = document.getElementById('invoice_comment');
    if (commentEl) commentEl.value = current.comment || '';

    // Устанавливаем метод оплаты
    const paymentSelect = document.getElementById('payment-method');
    if (paymentSelect) {
        paymentSelect.value = current.paymentMethod || 'cash';
    }



    renderItemsTable(current.items); 
    calculateTotals();
}


// СОХРАНЕНИЕ: записываем способ оплаты в массив при изменении в UI
const paymentMethodSelect = document.getElementById('payment-method');

if (paymentMethodSelect) {
    paymentMethodSelect.addEventListener('change', () => {
        // Ищем в массиве тот чек, который сейчас открыт на экране
        const currentActiveReceipt = receipts.find(r => r.id === activeReceiptId);
        if (currentActiveReceipt) {
            // Сохраняем новое значение ('cash', 'card' и т.д.) прямо в этот чек
            currentActiveReceipt.paymentMethod = paymentMethodSelect.value;
        }
    });
}


function renderItemsTable(items) {
    const tbody = document.getElementById('item-products'); 
    if (!tbody) return;
    tbody.innerHTML = '';
    
    if (items.length === 0) { 
        tbody.innerHTML = `<tr><td colspan="5" class="text-center p-4 text-muted">Чек пуст. Отсканируйте или найдите товар.</td></tr>`; 
        return; 
    }
    
    items.forEach((item, index) => {
        const rowNumber = index + 1;
        const price = parseFloat(item.price) || 0;
        const qty = parseFloat(item.qty) || 1;
        const lineSum = price * qty;

        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td class="ps-3 text-muted">${rowNumber}</td>
            <td class="product-name" data-id="${item.id}" title="${item.name}" data-name="${item.name+','+item.unit}">
                ${item.name+','+item.unit}
            </td>
            <td>
                <div class="qty-control d-flex align-items-center gap-1">
                    <button type="button" class="btn btn-sm btn-outline-secondary minus" onclick="changeQtyFromBtn('${item.id}', -1)">-</button>
                    <input type="number" class="form-control form-control-sm qty text-center" value="${qty}" min="1" style="width: 60px;" oninput="updateItemQty('${item.id}', this.value)">
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
}

// Кнопки + и - (вправо и влево)
window.changeQtyFromBtn = function(itemId, direction) {
    const current = receipts.find(r => r.id === activeReceiptId); 
    if (!current) return;
    
    const item = current.items.find(i => i.id === itemId); 
    if (item) { 
        let newQty = (parseFloat(item.qty) || 1) + direction;
        if (newQty < 1) newQty = 1; 
        
        item.qty = newQty;
        
        // Перерисовываем таблицу, чтобы обновилось число в инпуте и Сумма строки
        renderItemsTable(current.items);
        calculateTotals(); 
    } 
};

// Сохраняем метод оплаты в текущий чек при его изменении кассиром
function changePaymentMethod(method) {
    if (typeof receipts !== 'undefined' && activeReceiptId) {
        const currentReceipt = receipts.find(r => r.id === activeReceiptId);
        if (currentReceipt) {
            currentReceipt.paymentMethod = method; // Перезаписываем 'cash' или 'card'
        }
    }
}

// Прямой ввод цифр в инпут
window.updateItemQty = function(itemId, newQty) { 
    const current = receipts.find(r => r.id === activeReceiptId); 
    if (!current) return;
    
    const item = current.items.find(i => i.id === itemId); 
    if (item) { 
        let parsedQty = parseFloat(newQty);
        if (isNaN(parsedQty) || parsedQty < 1) parsedQty = 1;
        
        // Важно: сохраняем новое количество в состояние чека!
        item.qty = parsedQty; 
        
        // Обновляем сумму строки на лету (без перерисовки, чтобы не терять фокус)
        const row = document.querySelector(`.product-name[data-id="${itemId}"]`)?.closest('tr');
        if (row) {
            const lineSumSpan = row.querySelector('.line-sum');
            if (lineSumSpan) {
                const price = parseFloat(item.price) || 0;
                lineSumSpan.innerText = (price * parsedQty).toFixed(2);
            }
        }
        
        calculateTotals(); 
    } 
};

function removeItem(itemId) { 
    const current = receipts.find(r => r.id === activeReceiptId); 
    if (!current) return;
    
    // 1. Удаляем товар из массива текущего чека
    current.items = current.items.filter(i => i.id !== itemId); 
    
    // 2. Находим и удаляем строку товара из DOM-дерева таблицы
    const row = document.querySelector(`.product-name[data-id="${itemId}"]`)?.closest('tr');
    if (row) {
        row.remove();
    }
    
    // 3. Проверяем, остались ли вообще товары в этом чеке
    const tbody = document.getElementById('item-products');
    if (tbody) {
        // Если массив товаров пуст — жестко затираем всё содержимое и пишем заглушку
        if (!current.items || current.items.length === 0) {
            tbody.innerHTML = `<tr><td colspan="5" class="text-center p-4 text-muted">Чек пуст. Отсканируйте или найдите товар.</td></tr>`;
        } else {
            // Если товары еще есть, заново собираем все оставшиеся строки <tr>
            const rows = tbody.querySelectorAll('tr');
            
            // На всякий случай проверяем и количество реальных строк в DOM
            if (rows.length === 0) {
                tbody.innerHTML = `<tr><td colspan="5" class="text-center p-4 text-muted">Чек пуст. Отсканируйте или найдите товар.</td></tr>`;
            } else {
                // Корректно пересчитываем номера № (1, 2, 3...) для оставшихся строк
                rows.forEach((tr, index) => {
                    const numCell = tr.querySelector('td:first-child');
                    if (numCell) {
                        numCell.innerText = index + 1;
                    }
                });
            }
        }
    }
    
    // 4. Пересчитываем общие итоги в правой панели (они станут по нулям)
    calculateTotals(); 
}

function calculateTotals() {
    const current = receipts.find(r => r.id === activeReceiptId); 
    if (!current) return;
    
    let subtotal = 0; 
    // Считаем сумму на основе актуального состояния массива items
    current.items.forEach(i => { 
        subtotal += (parseFloat(i.qty) || 0) * (parseFloat(i.price) || 0); 
    });
    
    // Получаем актуальную скидку
    const discountPercent = parseInt(document.getElementById('discount')?.value) || 0; 
    const discountSum = subtotal * (discountPercent / 100); 
    const total = subtotal - discountSum;
    
    // Считаем сдачу
    const cashReceived = parseFloat(document.getElementById('cash')?.value) || 0; 
    const change = cashReceived > total ? cashReceived - total : 0;
    
    // Выводим все данные в правый блок интерфейса
    if(document.getElementById('subtotal-sum')) {
        document.getElementById('subtotal-sum').innerText = subtotal.toFixed(2) + ' ₴'; 
    }
    if(document.getElementById('discount-label')) {
        document.getElementById('discount-label').innerText = discountPercent;
    }
    if(document.getElementById('discount-sum')) {
        document.getElementById('discount-sum').innerText = discountSum.toFixed(2) + ' ₴'; 
    }
    if(document.getElementById('total-sum')) {
        document.getElementById('total-sum').innerText = total.toFixed(2) + ' ₴'; 
    }
    if(document.getElementById('change')) {
        document.getElementById('change').innerText = change.toFixed(2) + ' ₴';
    }
    
}

document.addEventListener('DOMContentLoaded', () => {
    document.getElementById('add-receipt-btn')?.addEventListener('click', createNewReceipt);
    document.getElementById('discount')?.addEventListener('input', calculateTotals); 
    document.getElementById('cash')?.addEventListener('input', calculateTotals);
    
    document.querySelectorAll('.fast-cash-btn').forEach(btn => { 
        btn.addEventListener('click', function() { 
            const val = this.getAttribute('data-value'); 
            const cashInput = document.getElementById('cash');
            if (cashInput) {
                cashInput.value = val; 
                calculateTotals(); 
            }
        }); 
    });
    
    createNewReceipt();
});

// --- ЖЕЛЕЗНЫЙ ПЕРЕХВАТ КЛИКА МЫШКОЙ ПО СПОСОБУ ОПЛАТЫ ---
document.addEventListener('click', function(e) {
    // Ищем пункт выпадающего меню, по которому кликнули (в Bootstrap это обычно .dropdown-item)
    const dropdownItem = e.target.closest('.dropdown-item, .dropdown-menu a, .dropdown-menu button');
    if (!dropdownItem) return;

    const text = dropdownItem.innerText.toLowerCase();
    let method = '';

    // Определяем выбранный метод по тексту пункта меню
    if (text.includes('карт')) method = 'card';
    else if (text.includes('перевод') || text.includes('безнал')) method = 'transfer';
    else if (text.includes('налич')) method = 'cash';

    if (method) {
        e.preventDefault(); // Блокируем перезагрузку страницы, если это ссылка <a>
        
        // 1. Записываем способ оплаты прямо в память АКТИВНОГО чека
        if (typeof receipts !== 'undefined' && activeReceiptId) {
            const currentReceipt = receipts.find(r => r.id === activeReceiptId);
            if (currentReceipt) {
                currentReceipt.paymentMethod = method;
            }
        }
        
        // 2. Визуально меняем текст на главной кнопке
        const paymentBtn = document.getElementById('paymentMethod') || 
                           dropdownItem.closest('.payment-params, .card')?.querySelector('.dropdown-toggle') ||
                           document.querySelector('.dropdown-toggle');
                           
        if (paymentBtn) {
            if (method === 'card') paymentBtn.innerHTML = '💳 Карта';
            else if (method === 'transfer') paymentBtn.innerHTML = '📱 Перевод';
            else paymentBtn.innerHTML = '💵 Наличные';
        }
        
        // 3. Запускаем сохранение состояния
        if (typeof saveCurrentUIToState === 'function') saveCurrentUIToState();
    }
});