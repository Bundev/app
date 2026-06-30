// const filterInvoice =
//     document.getElementById(
//         'filterInvoice'
//     );

// const filterCustomer =
//     document.getElementById(
//         'filterCustomer'
//     );

// const filterAmount =
//     document.getElementById(
//         'filterAmount'
//     );

// const filterStatus =
//     document.getElementById(
//         'filterStatus'
//     );

// const dateFrom =
//     document.getElementById(
//         'dateFrom'
//     );

// const dateTo =
//     document.getElementById(
//         'dateTo'
//     );

// function filterSales() {

//     const invoice =
//         filterInvoice.value
//             .toLowerCase();

//     const customer =
//         filterCustomer.value
//             .toLowerCase();

//     const amount =
//         filterAmount.value;

//     const status =
//         filterStatus.value;

//     const from =
//         dateFrom.value;

//     const to =
//         dateTo.value;

//     document
//         .querySelectorAll(
//             '#salesTable tr'
//         )
//         .forEach(row => {

//             const rowInvoice =
//                 row.dataset.invoice
//                     .toLowerCase();

//             const rowCustomer =
//                 row.dataset.customer
//                     .toLowerCase();

//             const rowAmount =
//                 Number(
//                     row.dataset.total
//                 );

//             const rowStatus =
//                 row.dataset.status;

//             const rowDate =
//                 row.dataset.date;

//             let dateMatch =
//                 true;

//             if (from) {

//                 dateMatch =
//                     rowDate >= from;

//             }

//             if (to) {

//                 dateMatch =
//                     dateMatch &&
//                     rowDate <= to;

//             }

//             const visible =

//                 rowInvoice.includes(
//                     invoice
//                 )

//                 &&

//                 rowCustomer.includes(
//                     customer
//                 )

//                 &&

//                 (
//                     !amount
//                     ||
//                     rowAmount >=
//                     Number(amount)
//                 )

//                 &&

//                 (
//                     !status
//                     ||
//                     rowStatus === status
//                 )

//                 &&

//                 dateMatch;

//             row.style.display =
//                 visible
//                     ? ''
//                     : 'none';

//         });

// }

// filterInvoice.addEventListener(
//     'input',
//     filterSales
// );

// filterCustomer.addEventListener(
//     'input',
//     filterSales
// );

// filterAmount.addEventListener(
//     'input',
//     filterSales
// );

// filterStatus.addEventListener(
//     'change',
//     filterSales
// );

// dateFrom.addEventListener(
//     'change',
//     filterSales
// );

// dateTo.addEventListener(
//     'change',
//     filterSales
// );

document.addEventListener('DOMContentLoaded', () => {
    const filterInvoice = document.getElementById('filterInvoice');
    const filterCustomer = document.getElementById('filterCustomer');
    const filterAmount = document.getElementById('filterAmount');
    const filterStatus = document.getElementById('filterStatus');
    const dateFrom = document.getElementById('dateFrom');
    const dateTo = document.getElementById('dateTo');

    function filterSales() {
        const invoice = (filterInvoice.value || '').toLowerCase().trim();
        const customer = (filterCustomer.value || '').toLowerCase().trim();
        const amount = filterAmount.value ? Number(filterAmount.value) : null;
        const status = filterStatus.value;
        const from = dateFrom.value;
        const to = dateTo.value;

        // Фильтруем только строки внутри tbody, чтобы не зацепить шапку таблицы
        document.querySelectorAll('#salesTable .invoice-row').forEach(row => {
            // Безопасное приведение к строке через || '' на случай null в базе данных
            const rowInvoice = (row.dataset.invoice || '').toLowerCase();
            const rowCustomer = (row.dataset.customer || '').toLowerCase();
            const rowAmount = Number(row.dataset.total || 0);
            const rowStatus = row.dataset.status || '';
            const rowDate = row.dataset.date || '';

            // 1. Фильтр по датам
            let dateMatch = true;
            if (from) dateMatch = rowDate >= from;
            if (to)   dateMatch = dateMatch && (rowDate <= to);

            // 2. Проверка остальных условий
            const invoiceMatch  = rowInvoice.includes(invoice);
            const customerMatch = rowCustomer.includes(customer);
            const amountMatch   = amount === null || rowAmount >= amount;
            const statusMatch   = !status || rowStatus === status;

            // Итоговый результат видимости строки
            if (invoiceMatch && customerMatch && amountMatch && statusMatch && dateMatch) {
                row.style.display = '';
            } else {
                row.style.display = 'none';
            }
        });
    }

    // Слушатели событий
    filterInvoice.addEventListener('input', filterSales);
    filterCustomer.addEventListener('input', filterSales);
    filterAmount.addEventListener('input', filterSales);
    filterStatus.addEventListener('change', filterSales);
    dateFrom.addEventListener('change', filterSales);
    dateTo.addEventListener('change', filterSales);
});


// Автообновлеие чеков
let lastSaleId =
    Number(
        document
            .querySelector('#salesTable')
            .dataset.lastId || 0
    );

async function loadLatestSales() {

    try {

        const response =
            await fetch('/sales/latest');

        const sales =
            await response.json();

        if (!sales.length) {
            return;
        }

        const newSales =
            sales.filter(
                sale =>
                    sale.id > lastSaleId
            );

        if (!newSales.length) {
            return;
        }

        const tbody =
            document.getElementById(
                'salesTable'
            );

        newSales.reverse()
            .forEach(sale => {

                const status =
                    sale.status === 'returned'
                        ? `
                        <span class="badge bg-danger">
                            Возврат
                        </span>
                        `
                        : sale.status === 'partial_return'
                            ? `
                            <span class="badge bg-warning text-dark">
                                Частичный возврат
                            </span>
                            `
                            : `
                            <span class="badge bg-success">
                                Продажа
                            </span>
                            `;

                tbody.insertAdjacentHTML(
                    'afterbegin',
                    `
                    <tr
                        class="invoice-row"
                        data-url="/sale/${sale.id}"
                        data-invoice="${sale.invoice_number}"
                        data-customer="${sale.customer_name || ''}"
                        data-total="${sale.total}"
                        data-status="${sale.status}"
                        sale.status="${new Date(sale.created_at).toISOString().split('T')[0]}">

                        <td>

                            <span class="invoice-badge">

                                ${sale.invoice_number}

                            </span>

                        </td>

                        <td>

                            <div class="fw-semibold">
                                ${new Date(sale.created_at).toLocaleDateString('ru-RU')}
                            </div>

                            <small class="text-muted">
                                ${new Date(sale.created_at).toLocaleTimeString(
                                    'ru-RU',
                                    {
                                        timeZone: 'Europe/Kyiv',
                                        hour: '2-digit',
                                        minute: '2-digit'
                                    }
                                )}
                            </small>

                        </td>

                        <td>
                            <div class="customer-name">
                                ${sale.customer_name ||
                                    'Розничный покупатель'}
                            </div>

                        </td>

                        <td class="text-end">
                            <span class="sale-sum">
                                ${Number(
                                    sale.total
                                ).toFixed(2)} ₴
                            </span>
                        </td>

                        <td class="text-center">

                            ${status}

                        </td>

                        <td>

                            <div class="btn-group">

                                <a
                                    href="/sale/${sale.id}"
                                    class="btn btn-outline-primary btn-sm" target="_blank" title="Просмотр">

                                    <i class="bi bi-eye"></i>

                                </a>

                                <a
                                    href="/sales/print/${sale.id}"
                                    class="btn btn-outline-success btn-sm" target="_blank" title="Печать" >

                                    <i class="bi bi-printer"></i>

                                </a>

                            </div>

                        </td>

                    </tr>
                    `
                );

            });

        lastSaleId =
            sales[0].id;

    } catch (error) {

        console.error(error);

    }

}

setInterval(
    loadLatestSales,
    5000
);


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