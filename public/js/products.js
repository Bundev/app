
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


document.addEventListener(
    'DOMContentLoaded',
    () => {

        const toast =
            document.getElementById(
                'productSuccess'
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







       
// Обновлени штрихкода

document
    .querySelectorAll('.barcode-cell')
    .forEach(cell => {

        cell.addEventListener(
            'dblclick',
            () => {

                currentProductId =
                    cell.dataset.id;

                document
                    .getElementById(
                        'scannerModal'
                    )
                    .style.display =
                    'flex';

                startBarcodeScanner();

            }
        );

    });

let currentProductId = null;
let scanner = null;

function startBarcodeScanner() {

    scanner =
        new Html5Qrcode(
            'reader'
        );

    scanner.start(
        {
            facingMode:
                'environment'
        },
        {
            fps: 10,
            qrbox: 250
        },
        async (barcode) => {

            await saveBarcode(
                currentProductId,
                barcode
            );

        }
    );

}
async function saveBarcode(
    productId,
    barcode
) {

    const response =
        await fetch(
            `/products/barcode/${productId}`,
            {
                method: 'POST',

                headers: {
                    'Content-Type':
                        'application/json'
                },

                body: JSON.stringify({
                    barcode
                })
            }
        );

    const result =
        await response.json();

    if (result.success) {

        const cell =
            document.querySelector(
                `.barcode-cell[data-id="${productId}"]`
            );

        cell.innerHTML =
            '<code>'+barcode+'</code>';

        await scanner.stop();

        document
            .getElementById(
                'scannerModal'
            )
            .style.display =
            'none';

    }

}
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