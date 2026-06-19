const filterInvoice =
    document.getElementById(
        'filterInvoice'
    );

const filterCustomer =
    document.getElementById(
        'filterCustomer'
    );

const filterAmount =
    document.getElementById(
        'filterAmount'
    );

const filterStatus =
    document.getElementById(
        'filterStatus'
    );

const dateFrom =
    document.getElementById(
        'dateFrom'
    );

const dateTo =
    document.getElementById(
        'dateTo'
    );

function filterSales() {

    const invoice =
        filterInvoice.value
            .toLowerCase();

    const customer =
        filterCustomer.value
            .toLowerCase();

    const amount =
        filterAmount.value;

    const status =
        filterStatus.value;

    const from =
        dateFrom.value;

    const to =
        dateTo.value;

    document
        .querySelectorAll(
            '#salesTable tr'
        )
        .forEach(row => {

            const rowInvoice =
                row.dataset.invoice
                    .toLowerCase();

            const rowCustomer =
                row.dataset.customer
                    .toLowerCase();

            const rowAmount =
                Number(
                    row.dataset.total
                );

            const rowStatus =
                row.dataset.status;

            const rowDate =
                row.dataset.date;

            let dateMatch =
                true;

            if (from) {

                dateMatch =
                    rowDate >= from;

            }

            if (to) {

                dateMatch =
                    dateMatch &&
                    rowDate <= to;

            }

            const visible =

                rowInvoice.includes(
                    invoice
                )

                &&

                rowCustomer.includes(
                    customer
                )

                &&

                (
                    !amount
                    ||
                    rowAmount >=
                    Number(amount)
                )

                &&

                (
                    !status
                    ||
                    rowStatus === status
                )

                &&

                dateMatch;

            row.style.display =
                visible
                    ? ''
                    : 'none';

        });

}

filterInvoice.addEventListener(
    'input',
    filterSales
);

filterCustomer.addEventListener(
    'input',
    filterSales
);

filterAmount.addEventListener(
    'input',
    filterSales
);

filterStatus.addEventListener(
    'change',
    filterSales
);

dateFrom.addEventListener(
    'change',
    filterSales
);

dateTo.addEventListener(
    'change',
    filterSales
);



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