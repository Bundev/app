
const searchInput = document.getElementById('product-search');
const searchResults = document.getElementById('search-results');
const imagePreview = document.getElementById('imagePreview');

searchInput.addEventListener(
    'input',
    async () => {

        const query =
            searchInput.value.trim();
        
        if (query.length < 2) {
            
            searchResults.style.display =
                'none';
            searchResults.innerHTML = '';

            return;

        }

        const currentQuery = query;

        const response =
            await fetch(
                `/api/products/search?q=${encodeURIComponent(query)}`
            );

        const products =
            await response.json();
            if (
                    currentQuery !==
                    searchInput.value.trim()
                ) {

                    return;

            }
        searchResults.innerHTML =
            '';

        products.forEach(product => {

            const item =
                document.createElement(
                    'button'
                );

            const qty = Number(product.quantity);

            const stockColor =
                qty > 10
                    ? 'success'
                    : qty > 0
                    ? 'warning'
                    : 'danger';

            item.type = 'button';

            item.className =
                'list-group-item list-group-item-action py-3';

            item.innerHTML =
            `
            <div class="d-flex align-items-center">

                <img
                    src="${product.image || '/img/no-photo.png'}"
                    alt="${product.name}"
                    class="product-image"
                    style="
                        width:80px;
                        height:80px;
                        object-fit:contain;
                        background:#fff;
                        border:1px solid #dee2e6;
                        border-radius:8px;
                        padding:4px;
                    ">

                <div class="flex-grow-1 px-3">

                    <div class="fw-bold mb-1">

                        ${product.name}

                    </div>

                    <div class="small text-muted">

                        Арт:
                        ${product.sku || '-'}

                        |
                        ШК:
                        ${product.barcode || '-'}

                    </div>

                    <div class="small text-primary mt-1">

                        📍 ${product.stock_info || 'Нет остатков'}

                    </div>

                </div>

                <div class="text-end">

                    <div class="fw-bold fs-5">

                        ${Number(product.sale_price).toFixed(2)} ₴

                    </div>

                    <span class="badge bg-${stockColor} mt-2">

                        ${qty} шт

                    </span>

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
                    searchResults.innerHTML = '';

                    searchResults.style.display =
                        'none';
                    imagePreview.style.display = 'none';
                    searchInput.focus();

                }
            );

            searchResults.appendChild(
                item
            );


            const img =
                item.querySelector('.product-image');

            if (img) {

                img.addEventListener('mouseenter', () => {

                    const preview =
                        document.getElementById(
                            'imagePreview'
                        );

                    preview.style.backgroundImage =
                        `url('${img.src}')`;

                    preview.style.display =
                        'block';

                });

                img.addEventListener('mousemove', e => {

                    const preview =
                        document.getElementById(
                            'imagePreview'
                        );

                    preview.style.left = '850px';
                    preview.style.top = '200px';

                });

                img.addEventListener('mouseleave', () => {

                    document.getElementById(
                        'imagePreview'
                    ).style.display = 'none';

                });

            }

        });

        searchResults.style.display =
            products.length > 0
                ? 'block'
                : 'none';

    }
);

document.addEventListener(
    'click',
    e => {

        if (
            !searchInput.contains(e.target)
            &&
            !searchResults.contains(e.target)
        ) {
            searchInput.value =
                        '';
            searchResults.style.display =
                'none';

        }

    }
);

// searchInput.addEventListener(
//     'focus',
//     () => {

//         if (
//             searchInput.value.trim().length < 2
//         ) {

//             searchResults.innerHTML = '';

//             searchResults.style.display =
//                 'none';

//         }

//     }
// );

// searchInput.addEventListener(
//     'blur',
//     () => {

//         setTimeout(() => {

//             searchResults.innerHTML = '';

//             searchResults.style.display =
//                 'none';

//         }, 150);

//     }
// );

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

document.addEventListener(
    'keydown',
    e => {

        if (e.key === 'F2') {

            document
                .getElementById('product-search')
                .focus();

        }

    }
);



function updateTotals() {

    let subtotal = 0;

    document
        .querySelectorAll('.line-sum')
        .forEach(cell => {

            subtotal += Number(
                cell.textContent
            );

        });

    const discountPercent =
        Number(
            document.getElementById(
                'discount'
            ).value
        ) || 0;

        document.getElementById(
    'discount-label'
).textContent =
    discountPercent;

    const discountAmount =
        subtotal *
        discountPercent / 100;

    const total =
        subtotal -
        discountAmount;

    document.getElementById(
        'discount-sum'
    ).textContent =
        discountAmount.toFixed(2) + ' ₴';

    document.getElementById(
        'total-sum'
    ).textContent =
        total.toFixed(2) + ' ₴';
    document.getElementById(
        'subtotal-sum'
    ).textContent =
        subtotal.toFixed(2) + ' ₴';
        updateChange();
}
// скрипт скидки
document
    .getElementById('discount')
    .addEventListener(
        'input',
        updateTotals
    );

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
                title='${product.name}' data-name='${product.name}'>
                ${product.name}

            </td>

            <td>
                <div class="qty-control">
                    <button
                        type="button"
                        class="btn btn-outline-secondary minus">-
                    </button>
                    <input
                        type="number"
                        class="form-control qty"
                        value="1"
                        min="1">
                    <button
                        type="button"
                        class="btn btn-outline-secondary plus">

                        +

                    </button>
                </div>

            </td>


            <td >

                <div class="pricepoduct" data-price="${price}">
                    ${price.toFixed(2)} ₴
                </div>

                <small class="text-muted">

                    Сумма:<br>
                    <span class="line-sum">

                        ${price.toFixed(2)}

                    </span> ₴

                </small>

            </td>

            

            <td>
               <button
                    type="button"
                    class="btn btn-outline-danger btn-sm btn-remove remove">

                    <i class="bi bi-x"></i>

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


function updateChange() {

    const cash =
        parseFloat(
            document.getElementById('cash').value
        ) || 0;

    const total =
        parseFloat(
            document
                .getElementById('total-sum')
                .textContent
                .replace('₴', '')
                .trim()
        ) || 0;

    const change =
        cash - total;

    document.getElementById(
        'change'
    ).textContent =
        change > 0
            ? change.toFixed(2) + ' ₴'
            : '0.00 ₴';

}

document
    .getElementById('cash')
    .addEventListener(
        'input',
        updateChange
    );



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

    const row =
        input.closest('tr');

    const qty =
        Number(input.value);

    const price =
        Number(
            row.querySelector('.pricepoduct')
                .dataset.price
        );

    const sum =
        qty * price;

    row.querySelector('.line-sum')
        .textContent =
        sum.toFixed(2);

    // const mobileSum =
    //     row.querySelector('.sum-mobile');

    // if (mobileSum) {

    //     mobileSum.textContent =
    //         sum.toFixed(2);

    // }

    updateTotals();

}

document.addEventListener('input', (e) => {

    if (!e.target.classList.contains('qty')) {
        return;
    }

    updateQuantity(e.target);

});
//Скрипт для конопок плюс и минус 
document.addEventListener('click', e => {

    if (e.target.classList.contains('plus')) {

        const input =
            e.target.parentNode.querySelector('.qty');

        input.value =
            Number(input.value) + 1;

        updateQuantity(input);
    }

    if (e.target.classList.contains('minus')) {

        const input =
            e.target.parentNode.querySelector('.qty');

        if (input.value > 1) {

            input.value =
                Number(input.value) - 1;

            updateQuantity(input);
        }
    }

});

// Сохраняет чек
async function saveInvoice() {
    let subtotal = 0;

    document
        .querySelectorAll('.line-sum')
        .forEach(cell => {

            subtotal += Number(
                cell.textContent
            );

    });

    try {

        const items = [];

        document
            .querySelectorAll(
                '#item-products tr'
            )
            .forEach(row => {

                items.push({

                    product_id:
                        Number(
                            row.querySelector(
                                '.product-name'
                            ).dataset.id
                        ),

                    quantity:
                        Number(
                            row.querySelector(
                                '.qty'
                            ).value
                        ),

                    price:
                        Number(
                            row.querySelector(
                                '.pricepoduct'
                            ).dataset.price
                        )

                });

            });

        if (!items.length) {

            alert(
                'Добавьте товары в чек'
            );

            return;

        }

        const total =
            Number(
                document
                    .getElementById(
                        'total-sum'
                    )
                    .textContent
                    .replace('₴', '')
                    .trim()
            );

        const discountPercent =
            Number(
                document.getElementById(
                    'discount'
                ).value
            ) || 0;

        const discountAmount =
            subtotal *
            discountPercent / 100;

        const response =
            await fetch(
                '/sales/save',
                {

                    method: 'POST',

                    headers: {
                        'Content-Type':
                            'application/json'
                    },

                    body: JSON.stringify({

                        customer_id:
                            document.querySelector(
                                '#customer'
                            )?.value || null,

                        payment_method:
                            document.querySelector(
                                '[name="paymentMethod"]'
                            ).value,

                        total,
                        discount_percent:
                            discountPercent,

                        discount_amount:
                            discountAmount,

                        items

                    })

                }
            );

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
            `/new`;

    } catch (error) {

        console.error(error);

        alert(
            'Ошибка соединения с сервером'
        );

    }

}


        
let scanner = null;

document
    .getElementById('scanBtn')
    .addEventListener(
        'click',
        async () => {

            document
                .getElementById(
                    'scannerModal'
                )
                .style.display =
                'flex';

            const reader =
                document.getElementById(
                    'reader'
                );

            reader.innerHTML = '';

            scanner =
                new Html5Qrcode(
                    'reader'
                );

            await scanner.start(
                {
                    facingMode:
                        'environment'
                },
                {
                    fps: 10,
                    qrbox: 250
                },
                async decodedText => {

                    document
                        .getElementById(
                            'product-search'
                        )
                        .value =
                        decodedText;

                    await scanner.stop();

                    document
                        .getElementById(
                            'scannerModal'
                        )
                        .style.display =
                        'none';

                    // если есть функция поиска
                    const response =
                        await fetch(
                            `/api/products/search?q=${encodeURIComponent(decodedText)}`
                        );

                    const products =
                        await response.json();

                    if (products.length) {

                        addProductToInvoice(
                            products[0]
                        );
                        const searchInput =
                            document.getElementById(
                                'product-search'
                            );

                        searchInput.value = '';

                        document
                            .getElementById(
                                'search-results'
                            )
                            .style.display =
                            'none';

                        // searchInput.focus();

                    } else {

                        alert(
                            'Товар не найден!'
                        );

                    }

                }
            );

        }
    );

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

// Копирует название товара
document.addEventListener(
    'click',
    async e => {

        const cell =
            e.target.closest(
                '.product-name'
            );

        if (!cell) {
            return;
        }

        try {

            let name =
                (cell.dataset.name ||
                 cell.textContent)
                .trim();

            name = name.replace(
                /,\s*(шт|м|кг|уп|л)\s*$/i,
                ''
            );

            await navigator.clipboard
                .writeText(name);

            cell.classList.add(
                'copied'
            );

            setTimeout(() => {

                cell.classList.remove(
                    'copied'
                );

            }, 1000);

        } catch (err) {

            console.error(err);

        }

    }
);