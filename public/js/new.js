const searchInput = document.getElementById('product-search');
const searchResults = document.getElementById('search-results');
const imagePreview = document.getElementById('imagePreview');

// ПЕРЕМЕННАЯ ДЛЯ ХРАНЕНИЯ ИНДЕКСА ТЕКУЩЕГО ВЫБРАННОГО ТОВАРA
let currentFocus = -1;

// 1. Слушатель для ввода текста (Твой код с небольшим сбросом индекса)
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
                        ${qty} шт
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

        // 3. СТРЕЛКА ВПРАВО — Увеличение количества товара (+1)
        if (event.key === 'ArrowRight') {
            if (qtyInput) {
                event.preventDefault();
                let currentVal = parseInt(qtyInput.value) || 1;
                qtyInput.value = currentVal + 1;
                
                // Вызываем твою функцию для пересчета строки и чека!
                updateQuantity(qtyInput); 
            }
        }

        // 4. СТРЕЛКА ВЛЕВО — Уменьшение количества товара (-1)
        if (event.key === 'ArrowLeft') {
            if (qtyInput) {
                event.preventDefault();
                let currentVal = parseInt(qtyInput.value) || 1;
                if (currentVal > 1) { // Защита, чтобы не уйти в ноль
                    qtyInput.value = currentVal - 1;
                    
                    // Вызываем твою функцию для пересчета строки и чека!
                    updateQuantity(qtyInput);
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

    document
        .querySelectorAll('.line-sum')
        .forEach(cell => {

            subtotal += Number(
                cell.textContent
            );

        });

    const discountPercent =
        Number(
            document.getElementById(
                'discount'
            ).value
        ) || 0;

        document.getElementById(
    'discount-label'
).textContent =
    discountPercent;

    const discountAmount =
        subtotal *
        discountPercent / 100;

    const total =
        subtotal -
        discountAmount;

    document.getElementById(
        'discount-sum'
    ).textContent =
        discountAmount.toFixed(2) + ' ₴';

    document.getElementById(
        'total-sum'
    ).textContent =
        total.toFixed(2) + ' ₴';
    document.getElementById(
        'subtotal-sum'
    ).textContent =
        subtotal.toFixed(2) + ' ₴';
        updateChange();
}
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

    const rows =
        document.querySelectorAll(
            '#item-products tr'
        );

    for (const row of rows) {

        const productName =
            row.querySelector(
                '.product-name'
            ).textContent.trim();

        if (
            productName ===
            product.name.trim()
        ) {

            const qtyInput =
                row.querySelector(
                    '.qty'
                );

            qtyInput.value =
                Number(qtyInput.value) + 1;

            updateQuantity(
                qtyInput
            );

            return;

        }

    }

    const rowNumber =
        document.querySelectorAll(
            '#item-products tr'
        ).length + 1;

    const price =
        Number(
            product.sale_price || 0
        );



    const html =
        `
        <tr>

            <td>
                ${rowNumber}
            </td>

            <td
                class="product-name"
                data-id="${product.id}"
                title='${product.name}' data-name='${product.name}'>
                ${product.name}

            </td>

            <td>
                <div class="qty-control">
                    <button
                        type="button"
                        class="btn btn-outline-secondary minus">-
                    </button>
                    <input
                        type="number"
                        class="form-control qty"
                        value="1"
                        min="1">
                    <button
                        type="button"
                        class="btn btn-outline-secondary plus">

                        +

                    </button>
                </div>

            </td>


            <td >

                <div class="pricepoduct" data-price="${price}">
                    ${price.toFixed(2)} ₴
                </div>

                <small class="text-muted">

                    Сумма:<br>
                    <span class="line-sum">

                        ${price.toFixed(2)}

                    </span> ₴

                </small>

            </td>

            

            <td>
               <button
                    type="button"
                    class="btn btn-outline-danger btn-sm btn-remove remove">

                    <i class="bi bi-x"></i>

                </button>
            </td>

        </tr>
        `;



    document
        .getElementById(
            'item-products'
        )
        .insertAdjacentHTML(
            'beforeend',
            html
        );

    updateTotals();

    updateRowNumbers();

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



document.addEventListener('click', e => {
    // Находим кнопку с классом .remove, даже если кликнули по иконке внутри неё
    const removeBtn = e.target.closest('.remove');

    if (removeBtn) {
        // Находим строку таблицы, в которой лежит эта кнопка, и удаляем её
        removeBtn.closest('tr').remove();
        
        updateRowNumbers();
        updateTotals();
    }
});

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
async function saveInvoice() {
    let subtotal = 0;

    document
        .querySelectorAll('.line-sum')
        .forEach(cell => {

            subtotal += Number(
                cell.textContent
            );

    });

    try {

        const items = [];

        document
            .querySelectorAll(
                '#item-products tr'
            )
            .forEach(row => {

                items.push({

                    product_id:
                        Number(
                            row.querySelector(
                                '.product-name'
                            ).dataset.id
                        ),

                    quantity:
                        Number(
                            row.querySelector(
                                '.qty'
                            ).value
                        ),

                    price:
                        Number(
                            row.querySelector(
                                '.pricepoduct'
                            ).dataset.price
                        )

                });

            });

        if (!items.length) {

            alert(
                'Добавьте товары в чек'
            );

            return;

        }

        const total =
            Number(
                document
                    .getElementById(
                        'total-sum'
                    )
                    .textContent
                    .replace('₴', '')
                    .trim()
            );

        const discountPercent =
            Number(
                document.getElementById(
                    'discount'
                ).value
            ) || 0;

        const discountAmount =
            subtotal *
            discountPercent / 100;

        const response =
            await fetch(
                '/sales/save',
                {

                    method: 'POST',

                    headers: {
                        'Content-Type':
                            'application/json'
                    },

                    body: JSON.stringify({

                        customer_id:
                            document.querySelector(
                                '#customer_id'
                            )?.value || null,

                        payment_method:
                            document.querySelector(
                                '[name="paymentMethod"]'
                            ).value,

                        total,
                        discount_percent:
                            discountPercent,

                        discount_amount:
                            discountAmount,

                        items

                    })

                }
            );

        const result =
            await response.json();

        if (!result.success) {

            alert(
                result.error ||
                'Ошибка сохранения'
            );

            return;

        }

        window.location =
            `/new`;

    } catch (error) {

        console.error(error);

        alert(
            'Ошибка соединения с сервером'
        );

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
document.addEventListener(
    'click',
    async e => {

        const cell =
            e.target.closest(
                '.product-name'
            );

        if (!cell) {
            return;
        }

        try {

            let name =
                (cell.dataset.name ||
                 cell.textContent)
                .trim();

            name = name.replace(
                /,\s*(шт|м|кг|уп|л)\s*$/i,
                ''
            );

            await navigator.clipboard
                .writeText(name);

            cell.classList.add(
                'copied'
            );

            setTimeout(() => {

                cell.classList.remove(
                    'copied'
                );

            }, 1000);

        } catch (err) {

            console.error(err);

        }

    }
);

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