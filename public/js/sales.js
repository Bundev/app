const filters = [
    'filter-number',
    'filter-date',
    'filter-customer',
    'filter-status',
    'filter-sum'
];

filters.forEach(id => {

    document
        .getElementById(id)
        .addEventListener('input', filterInvoices);

});

function filterInvoices() {

    const number =
        document.getElementById('filter-number')
            .value
            .toLowerCase();

    const date =
        document.getElementById('filter-date')
            .value;

    const customer =
        document.getElementById('filter-customer')
            .value
            .toLowerCase();

    const status =
        document.getElementById('filter-status')
            .value;

    const sum =
        Number(
            document.getElementById('filter-sum')
                .value
        ) || 0;

    document
        .querySelectorAll('#invoice-table tr')
        .forEach(row => {

            const rowNumber =
                row.cells[0].textContent.toLowerCase();

            const rowDate =
                row.cells[1].dataset.date;

            const rowCustomer =
                row.cells[2].textContent.toLowerCase();

            const rowSum =
                parseFloat(
                    row.cells[3].textContent
                );

            const rowStatus =
                row.cells[4].textContent.trim();

            const visible =

                rowNumber.includes(number) &&

                (!date || rowDate === date) &&

                rowCustomer.includes(customer) &&

                (!status || rowStatus === status) &&

                rowSum >= sum;

            row.style.display =
                visible ? '' : 'none';

        });

}

function clearFilters() {
    filters.forEach(id => {
        document.getElementById(id).value = '';
    });
    filterInvoices();
}

document.querySelectorAll('.invoice-row').forEach(row => {
    row.addEventListener('click', (e) => {

        if (e.ctrlKey) {
            window.open(row.dataset.url, '_blank');
        } else {
            window.location.href = row.dataset.url;
        }

    });
});