document.addEventListener('DOMContentLoaded', () => {
    const filterInvoice = document.getElementById('filterInvoice');
    const filterCustomer = document.getElementById('filterCustomer');
    const filterCashier = document.getElementById('filterCashier');
    const filterStore = document.getElementById('filterStore');
    const filterItems = document.getElementById('filterItems');
    const filterAmount = document.getElementById('filterAmount');
    const filterStatus = document.getElementById('filterStatus');
    const filterDate = document.getElementById('filterDate');

    function filterSales() {
        const invoice = (filterInvoice.value || '').toLowerCase().trim();
        const customer = (filterCustomer.value || '').toLowerCase().trim();
        const cashier = (filterCashier.value || '').toLowerCase().trim();
        const store = (filterStore.value || '').toLowerCase().trim();
        const items = filterItems.value ? Number(filterItems.value) : null;
        const amount = filterAmount.value ? Number(filterAmount.value) : null;
        const status = filterStatus.value;
        const date = filterDate.value;

        // Фильтруем только строки внутри tbody, чтобы не зацепить шапку таблицы
        document.querySelectorAll('#salesTable .invoice-row').forEach(row => {
            // Безопасное приведение к строке через || '' на случай null в базе данных
            const rowInvoice = (row.dataset.invoice || '').toLowerCase();
            const rowCustomer = (row.dataset.customer || '').toLowerCase();
            const rowCashier = (row.dataset.cashier || '').toLowerCase();
            const rowStore = (row.dataset.store || '').toLowerCase();
            const rowItems = Number(row.dataset.items || 0);
            const rowAmount = Number(row.dataset.total || 0);
            const rowStatus = row.dataset.status || '';
            const rowDate = row.dataset.date || '';

            // 1. Фильтр по датам
            const dateMatch = !date || rowDate === date;

            // 2. Проверка остальных условий
            const invoiceMatch  = rowInvoice.includes(invoice);
            const customerMatch = rowCustomer.includes(customer);
            const cashierMatch  = rowCashier.includes(cashier);
            const storeMatch    = rowStore.includes(store);
            const itemsMatch    = items === null || rowItems >= items;
            const amountMatch   = amount === null || rowAmount >= amount;
            const statusMatch   = !status || rowStatus === status;

            // Итоговый результат видимости строки
            if (
                invoiceMatch && customerMatch && cashierMatch && storeMatch &&
                itemsMatch && amountMatch && statusMatch && dateMatch
            ) {
                row.style.display = '';
            } else {
                row.style.display = 'none';
            }
        });
    }

    // Слушатели событий
    filterInvoice.addEventListener('input', filterSales);
    filterCustomer.addEventListener('input', filterSales);
    filterCashier.addEventListener('input', filterSales);
    filterStore.addEventListener('input', filterSales);
    filterItems.addEventListener('input', filterSales);
    filterAmount.addEventListener('input', filterSales);
    filterStatus.addEventListener('change', filterSales);
    filterDate.addEventListener('change', filterSales);
});


// Автообновление чеков
let lastSaleId = Number(document.querySelector('#salesTable')?.dataset.lastId || 0);

async function loadLatestSales() {
    try {
        const response = await fetch('/sales/latest');
        const sales = await response.json();

        if (!sales || !sales.length) return;

        // Фильтруем только новые продажи
        const newSales = sales.filter(sale => sale.id > lastSaleId);
        if (!newSales.length) return;

        const tbody = document.getElementById('salesTable');
        if (!tbody) return;

        // Разворачиваем массив, чтобы добавлять элементы сверху поочередно (от старых к самым новым)
        newSales.reverse().forEach(sale => {
            // Формируемbadge статуса в новом дизайне
            let statusBadge = '';
            if (sale.status === 'returned') {
                statusBadge = `
                    <span class="sale-status sale-status--returned">
                        <i class="bi bi-arrow-return-left"></i>Полный возврат
                    </span>`;
            } else if (sale.status === 'partial_return') {
                statusBadge = `
                    <span class="sale-status sale-status--partial">
                        <i class="bi bi-arrow-return-left"></i>Частичный возврат
                    </span>`;
            } else {
                statusBadge = `
                    <span class="sale-status sale-status--completed">
                        <i class="bi bi-check2-circle"></i>Продажа
                    </span>`;
            }

            // Рендерим строку таблицы строго по новой верстке
            const rowHtml = `
                <tr class="invoice-row"
                    data-id="${sale.id}"
                    data-url="/sales/${sale.id}"
                    data-invoice="${sale.invoice_number}"
                    data-customer="${sale.customer_name || ''}"
                    data-cashier="${sale.user_name || ''}"
                    data-store="${sale.store_name || ''}"
                    data-items="${sale.item_count || 0}"
                    data-total="${sale.total}"
                    data-status="${sale.status}"
                    data-date="${new Date(sale.created_at).toISOString().split('T')[0]}">
                    
                    <td class="ps-3">
                        <span class="badge bg-light text-dark border fw-medium px-2 py-1.5">
                            ${sale.invoice_number}
                        </span>
                    </td>

                    <td>
                        <span class="fw-semibold text-dark">
                            ${new Date(sale.created_at).toLocaleDateString('ru-RU')}
                            <i class="bi bi-clock ms-1 me-1" style="font-size: 11px;"></i>${new Date(sale.created_at).toLocaleTimeString('ru-RU', { timeZone: 'Europe/Kyiv', hour: '2-digit', minute: '2-digit' })}
                        </span>
                    </td>

                    <td>
                        <div class="fw-medium text-dark">
                            <i class="bi bi-person text-muted me-1"></i>${sale.customer_name || 'Розничный покупатель'}
                        </div>
                    </td>

                    <td>
                        <span class="text-muted">
                            <i class="bi bi-person-badge me-1"></i>${sale.user_name || 'Не указан'}
                        </span>
                    </td>

                    <td>
                        <span class="text-muted">
                            <i class="bi bi-shop me-1"></i>${sale.store_name || 'Не указан'}
                        </span>
                    </td>

                    <td class="text-center">
                        <span class="badge bg-light text-dark border">
                            <i class="bi bi-box-seam me-1"></i>${Number(sale.item_count || 0)}
                        </span>
                    </td>

                    <td class="text-end fw-bold text-dark">
                        ${Number(sale.total).toFixed(2)} ₴
                    </td>

                    <td class="text-center">
                        ${statusBadge}
                    </td>

                    
                </tr>
            `;

            // Вставляем в самое начало таблицы (сверху)
            tbody.insertAdjacentHTML('afterbegin', rowHtml);
        });

        // Обновляем ID последней известной продажи (берем первую из ответа сервера, так как она самая свежая)
        lastSaleId = sales[0].id;
        tbody.dataset.lastId = lastSaleId;

    } catch (error) {
        console.error('Ошибка автообновления чеков:', error);
    }
}

// Запуск интервала (каждые 5 секунд)
setInterval(loadLatestSales, 5000);



document.addEventListener('click', async (e) => {
    // Ищем клик по кнопке принтера или по самой иконке внутри неё
    const printBtn = e.target.closest('a[href*="/sales/print/"]') || e.target.closest('button[data-print-id]');
    
    if (printBtn) {
        e.preventDefault(); // Отменяем стандартный переход по ссылке, если это тег <a>

        // Достаем ID продажи из ссылки (например, из "/sales/print/112" заберем "112")
        const href = printBtn.getAttribute('href');
        const saleId = href ? href.split('/').pop() : printBtn.dataset.printId;

        if (!saleId) return;

        try {
            // 1. Делаем быстрый запрос к бэкенду за данными конкретно этого чека
            // Убедитесь, что у вас есть такой API эндпоинт, либо создайте его (Шаг 2)
            const response = await fetch(`/api/sales/${saleId}`);
            if (!response.ok) throw new Error('Не удалось загрузить данные чека');
            
            const saleData = await response.json();

            // 2. Открываем чек в новой вкладке и печатаем
            openReceiptInNewTab(saleData.invoice_number, saleData);

        } catch (error) {
            console.error(error);
            alert('Ошибка при подготовке к печати: ' + error.message);
        }
    }
});

// Та самая функция генерации чека во вкладке (адаптированная под структуру из БД)
function openReceiptInNewTab(invoiceNumber, receiptData) {
    const printWindow = window.open('', '_blank');
    
    const cashierName = receiptData.cashier_name || 'Администратор';
    const paymentMethodText = receiptData.payment_method === 'card' ? 'Карта' : 'Наличные';
    
    let itemsHtml = '';
    receiptData.items.forEach(item => {
        let name = item.name;
        // Очищаем "шт/м" из названия
        const unitMatch = name.match(/[,.\s]+([шШ][тТ]\.?|[мМ]\.?)$/);
        if (unitMatch) {
            name = name.replace(/[,.\s]+([шШ][тТ]\.?|[мМ]\.?)$/, '').trim();
        }
        
        itemsHtml += `
            <tr>
                <td style="max-width: 35mm; word-break: break-all;">${name}</td>
                <td style="text-align: center;">${item.quantity}</td>
                <td style="text-align: right;">${(Number(item.quantity) * Number(item.price)).toFixed(2)}</td>
            </tr>
        `;
    });

    let discountHtml = '';
    if (Number(receiptData.discount_amount) > 0) {
        discountHtml = `
            <tr>
                <td>Скидка:</td>
                <td style="text-align: right;" colspan="2">-${Number(receiptData.discount_amount).toFixed(2)} ₴</td>
            </tr>
        `;
    }

    // Форматируем дату из базы
    const formattedDate = new Date(receiptData.created_at || receiptData.date).toLocaleString('sv-SE', { timeZone: 'Europe/Kyiv' });

    printWindow.document.write(`
        <!DOCTYPE html>
        <html>
        <head>
            <title>Чек ${invoiceNumber}</title>
            <style>
                body { margin: 0; padding: 10px; font-family: 'Courier New', Courier, monospace; font-size: 12px; color: #000; width: 58mm; }
                .centered { text-align: center; }
                .separator { border-top: 1px dashed #000; margin: 5px 0; }
                table { width: 100%; border-collapse: collapse; }
                th, td { font-size: 11px; vertical-align: top; }
                @page { margin: 0; }
            </style>
        </head>
        <body>
            <div class="centered">
                <h3 style="margin: 5px 0;">MY CRM UA</h3>
                <p style="margin: 2px 0;"><b>ЧЕК: ${invoiceNumber}</b></p>
                <p style="margin: 2px 0; font-size: 10px;">${formattedDate}</p>
            </div>
            <div class="separator"></div>
            <p style="margin: 3px 0;">Кассир: ${cashierName}</p>
            <div class="separator"></div>
            <table>
                <thead>
                    <tr>
                        <th style="text-align: left;">Товар</th>
                        <th style="text-align: center;">Кол.</th>
                        <th style="text-align: right;">Сумма</th>
                    </tr>
                </thead>
                <tbody>${itemsHtml}</tbody>
            </table>
            <div class="separator"></div>
            <table>
                <tr>
                    <td><b>ИТОГО:</b></td>
                    <td style="text-align: right; font-weight: bold;" colspan="2">${Number(receiptData.total || receiptData.amount).toFixed(2)} ₴</td>
                </tr>
                ${discountHtml}
                <tr>
                    <td>Оплата:</td>
                    <td style="text-align: right;" colspan="2">${paymentMethodText}</td>
                </tr>
            </table>
            <div class="separator"></div>
            <div class="centered"><p style="margin: 5px 0;">Спасибо за покупку!</p></div>
            <script>
                window.onload = function() {
                    window.print();
                    setTimeout(function() { window.close(); }, 300);
                }
            <\/script>
        </body>
        </html>
    `);
    printWindow.document.close();
}



// =========================================
// Запоминаем открытый чек
// =========================================

document.addEventListener('click', (e) => {
    const row = e.target.closest('#salesTable .invoice-row');
    if (!row) return;

    const openInNewTab = e.ctrlKey || e.metaKey;
    if (openInNewTab) {
        const newTab = window.open(row.dataset.url, '_blank');
        if (newTab) {
            newTab.opener = null;
            newTab.focus();
        }
    }

    sessionStorage.setItem('selectedSaleId', row.dataset.id);

    document.querySelectorAll('.invoice-row.active-row').forEach(activeRow => {
        activeRow.classList.remove('active-row');
    });
    row.classList.add('active-row');

    if (openInNewTab) return;

    window.location.assign(row.dataset.url);
});


// =========================================
// Восстановление положения списка
// =========================================

function restoreSelectedRow() {

    const selectedId = sessionStorage.getItem('selectedSaleId');

    if (!selectedId) return;

    const row = document.querySelector(
        `.invoice-row[data-id="${selectedId}"]`
    );

    // Удаляем ID сразу, чтобы при следующем открытии страницы
    // ничего не подсвечивалось
    sessionStorage.removeItem('selectedSaleId');

    if (!row) return;

    document.querySelectorAll('.invoice-row.active-row').forEach(r => {
        r.classList.remove('active-row');
    });

    row.scrollIntoView({
        behavior: 'smooth',
        block: 'center'
    });

    row.classList.add('active-row');

}

document.addEventListener('DOMContentLoaded', restoreSelectedRow);

window.addEventListener('pageshow', restoreSelectedRow);
