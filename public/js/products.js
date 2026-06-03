
function filterProducts() {

    const search =
        document
            .getElementById('search-product')
            .value
            .toLowerCase();

    let count = 0;

    document
        .querySelectorAll('#products-table tr')
        .forEach(row => {

            const text =
                row.textContent.toLowerCase();

            const visible =
                text.includes(search);

            row.style.display =
                visible ? '' : 'none';

            if (visible) count++;

        });

    document
        .getElementById('products-count')
        .textContent = count;

}