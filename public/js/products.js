
function filterProducts() {

    const search =
        document
            .getElementById(
                'search-product'
            )
            .value
            .toLowerCase()
            .trim();

    const rows =
        document.querySelectorAll(
            '#products-table tr'
        );

    let visibleCount = 0;

    rows.forEach(row => {

        const name =
            row.dataset.name
                ?.toLowerCase() || '';

        const sku =
            row.dataset.sku
                ?.toLowerCase() || '';

        const barcode =
            row.dataset.barcode
                ?.toLowerCase() || '';

        const category =
            row.dataset.category
                ?.toLowerCase() || '';

        const found =
            name.includes(search) ||
            sku.includes(search) ||
            barcode.includes(search) ||
            category.includes(search);

        row.style.display =
            found
                ? ''
                : 'none';

        if (found)
            visibleCount++;

    });

    document.getElementById(
        'products-count'
    ).textContent =
        visibleCount;

}



document.addEventListener(
    'DOMContentLoaded',
    () => {

        const toast =
            document.getElementById(
                'importSuccess'
            );

        if (!toast) return;

        setTimeout(
            () => {

                toast.style.transition =
                    'all .4s ease';

                toast.style.opacity = '0';

                toast.style.transform =
                    'translateX(30px)';

                setTimeout(
                    () => {

                        toast.remove();

                    },
                    400
                );

            },
            5000
        );

    }
);



