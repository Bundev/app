const productSearchResult = document.getElementById('searchresults');
const searchInput = document.getElementById('product-search');
const searchResults = document.getElementById('search-results');

searchInput.addEventListener(
    'input',
    async () => {

        const query =
            searchInput.value.trim();

        if (query.length < 2) {

            searchResults.style.display =
                'none';

            return;

        }

        const response =
            await fetch(
                `/api/products/search?q=${encodeURIComponent(query)}`
            );

        const products =
            await response.json();

        searchResults.innerHTML =
            '';

        products.forEach(product => {

            const item =
                document.createElement(
                    'button'
                );

            item.type =
                'button';

            item.className =
                'list-group-item list-group-item-action';

            item.innerHTML =
                `
                <div class="d-flex justify-content-between">

                    <div>

                        <strong>
                            ${product.name}
                        </strong>

                        <br>

                        <small class="text-muted">

                            Арт:
                            ${product.sku || '-'}

                            |
                            ШК:
                            ${product.barcode || '-'}

                        </small>

                    </div>

                    <div class="text-end">

                        <strong>

                            ${product.sale_price} ₴

                        </strong>

                        <br>

                        <small>

                            Остаток:
                            ${product.quantity}

                        </small>

                    </div>

                </div>
                `;

            item.addEventListener(
                'click',
                () => {

                    addProductToInvoice(
                        product
                    );

                    searchInput.value =
                        '';

                    searchResults.style.display =
                        'none';
                    searchInput.focus();

                }
            );

            searchResults.appendChild(
                item
            );

        });

        searchResults.style.display =
            products.length
                ? 'block'
                : 'none';

    }
);

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



function updateTotals() {

  let total = 0;

  document.querySelectorAll('.sum').forEach(item => {
      total += Number(item.textContent);
  });

  document.getElementById('total-sum').textContent =
      total.toFixed(2);
}

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
                title='${product.name}'>
                ${product.name}

            </td>

            <td>

                <input
                    type="number"
                    class="form-control qty"
                    value="1"
                    min="1">

            </td>


            <td class="pricepoduct" data-price="${price}">

                ${price.toFixed(2)}

            </td>

            <td class="sum">

                ${price.toFixed(2)}

            </td>

            <td>

               <button
            type="button"
            class="btn btn-outline-danger btn-sm btn-remove remove">

            <i class="bi bi-trash"></i>

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










const cashInput = document.getElementById('cash');

cashInput.addEventListener('input', calculateChange);

function calculateChange() {

    const cashInput = document.getElementById('cash');

    if (!cashInput.value) {

        document.getElementById('change').textContent = '0.00 ₴';

        return;
    }

    const total = Number(
        document.getElementById('total-sum').textContent
    );

    const cash = Number(cashInput.value);

    
    document.getElementById('change').textContent =
    Math.max(cash - total, 0).toFixed(2)+ ' ₴';
}

document.addEventListener('click', e => {

    if (e.target.classList.contains('remove')) {

        e.target.closest('tr').remove();
        updateRowNumbers();
        updateTotals();
    }
});

function updateQuantity(input) {

    if (input.value < 1) {
        input.value = 1;
    }

    const row = input.closest('tr');

    const qty = Number(input.value);

    const price = Number(
        row.querySelector('.pricepoduct').textContent
    );

    row.querySelector('.sum').textContent =
        (qty * price).toFixed(2);

    updateTotals();
}

document.addEventListener('input', (e) => {

    if (!e.target.classList.contains('qty')) {
        return;
    }

    updateQuantity(e.target);

});

// Добовляет дату в новом чеке
document.getElementById('invoiceDate').value =
    new Date().toISOString().split('T')[0];
async function saveInvoice() {

    try {

        const items = [];

        document
            .querySelectorAll('#item-products tr')
            .forEach(row => {

                items.push({

                    product_id:
                        Number(
                            row.querySelector('.product-name')
                                .dataset.id
                        ),

                    quantity:
                        Number(
                            row.querySelector('.qty')
                                .value
                        ),

                    price:
                        Number(
                            row.querySelector('.pricepoduct')
                                .dataset.price
                        )

                });

            });

        if (!items.length) {

            alert('Добавьте товары в чек');

            return;

        }

        const response =
            await fetch('/sales/save', {

                method: 'POST',

                headers: {
                    'Content-Type':
                        'application/json'
                },

                body: JSON.stringify({

                    customer_id:
                        document.querySelector('#customer')
                            ?.value || null,

                    payment_method:
                        document.querySelector(
                            '[name="paymentMethod"]'
                        ).value,

                    total:
                        Number(
                            document.getElementById(
                                'total-sum'
                            ).textContent
                        ),

                    items

                })

            });

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
            '/sales';

    } catch (error) {

        console.error(error);

        alert(
            'Ошибка соединения с сервером'
        );

    }

}