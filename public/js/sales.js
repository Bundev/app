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