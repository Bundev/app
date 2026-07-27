document.addEventListener('DOMContentLoaded', () => {
    const numberInput = document.getElementById('filterReturn');
    const customerInput = document.getElementById('filterReturnCustomer');
    const fromInput = document.getElementById('filterReturnFrom');
    const toInput = document.getElementById('filterReturnTo');
    const resetButton = document.getElementById('resetReturnFilters');
    const rows = document.querySelectorAll('.returns-row');

    const filterReturns = () => {
        const number = numberInput.value.trim().toLowerCase();
        const customer = customerInput.value.trim().toLowerCase();
        const from = fromInput.value;
        const to = toInput.value;

        rows.forEach(row => {
            const numberMatches = !number ||
                row.dataset.number.toLowerCase().includes(number) ||
                row.dataset.invoice.toLowerCase().includes(number);
            const customerMatches = !customer ||
                row.dataset.customer.toLowerCase().includes(customer);
            const dateMatches = (!from || row.dataset.date >= from) &&
                (!to || row.dataset.date <= to);

            row.classList.toggle(
                'd-none',
                !(numberMatches && customerMatches && dateMatches)
            );
        });
    };

    [numberInput, customerInput, fromInput, toInput].forEach(input => {
        input.addEventListener(
            input.type === 'date' ? 'change' : 'input',
            filterReturns
        );
    });

    resetButton.addEventListener('click', () => {
        [numberInput, customerInput, fromInput, toInput].forEach(input => {
            input.value = '';
        });
        filterReturns();
    });

    rows.forEach(row => {
        row.addEventListener('click', () => {
            window.location.href = row.dataset.url;
        });
    });
});
