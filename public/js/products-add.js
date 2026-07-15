async function generateBarcode() {

    const response =
        await fetch(
            '/api/barcode/generate'
        );

    const data =
        await response.json();

    document.getElementById(
        'barcode'
    ).value =
        data.barcode;

}

document
    .querySelector(
        '[name="image"]'
    )
    .addEventListener(
        'change',
        e => {

            const file =
                e.target.files[0];

            if (!file)
                return;

            document
                .getElementById(
                    'preview'
                )
                .src =
                URL.createObjectURL(
                    file
                );

        }
    );







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
                    document.getElementById('barcode').value = '';
                    document.getElementById('barcode').value = decodedText;

                    await scanner.stop();

                    document
                        .getElementById(
                            'scannerModal'
                        )
                        .style.display =
                        'none';

                    
                    
                    

                    

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

//Виподающий список категорий
const input = document.getElementById('category_name');
const list = document.getElementById('categoryList');

input.addEventListener('input', function() {



    const value = this.value.toLowerCase();

    list.innerHTML = '';

    if (!value) {
        list.classList.add('d-none');
        return;
    }

    const filtered = categories.filter(c =>
        c.name.toLowerCase().includes(value)
    );

    if (filtered.length === 0) {
        list.classList.add('d-none');
        return;
    }

    filtered.forEach(category => {

        const item = document.createElement('button');

        item.type = 'button';
        item.className = 'list-group-item list-group-item-action';

        item.textContent = category.name;

        item.onclick = () => {

            input.value = category.name;

            document.getElementById('category_id').value =
                category.id;

            list.classList.add('d-none');
        };

        list.appendChild(item);
    });

    list.classList.remove('d-none');
});

document.addEventListener('click', function(e) {

    if (
        !input.contains(e.target) &&
        !list.contains(e.target)
    ) {
        list.classList.add('d-none');
    }

});



// Создает новую категорию

document
.getElementById('saveCategoryBtn')
.addEventListener('click', async () => {

    const name =
        document.getElementById('newCategoryName').value;

    const response = await fetch(
        '/categories/ajax-create',
        {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ name })
        }
    );

    const result = await response.json();

    if(result.success){

        categories.push({
            id: result.id,
            name: result.name
        });

        document.getElementById('category_name').value =
            result.name;

        document.getElementById('category_id').value =
            result.id;

        bootstrap.Modal
            .getInstance(
                document.getElementById('categoryModal')
            )
            .hide();

        document.getElementById('newCategoryName').value = '';

    }

});


//Автопересчет цены

document.addEventListener(
    'DOMContentLoaded',
    () => {

        const purchaseInput =
            document.getElementById(
                'purchase_price'
            );

        const saleInput =
            document.getElementById(
                'sale_price'
            );

        const markupElement =
            document.getElementById(
                'markup_percent'
            );

        const profitElement =
            document.getElementById(
                'profit_amount'
            );

        const profitStatus =
            document.getElementById(
                'profitStatus'
            );

        function calculateMargin() {

            const purchase =
                parseFloat(
                    purchaseInput.value
                ) || 0;

            const sale =
                parseFloat(
                    saleInput.value
                ) || 0;

            const profit =
                sale - purchase;

            let markup = 0;

            if (purchase > 0) {

                markup =
                    (
                        profit /
                        purchase
                    ) * 100;

            }

            // Наценка
            markupElement.textContent =
                markup.toFixed(1) + '%';

            markupElement.classList.remove(
                'text-success',
                'text-warning',
                'text-danger'
            );

            if (markup >= 30) {

                markupElement.classList.add(
                    'text-success'
                );

            }
            else if (markup >= 10) {

                markupElement.classList.add(
                    'text-warning'
                );

            }
            else {

                markupElement.classList.add(
                    'text-danger'
                );

            }

            // Прибыль
            profitElement.textContent =
                profit.toFixed(2) +
                ' ₴';

            profitElement.classList.remove(
                'text-success',
                'text-danger',
                'text-secondary'
            );

            if (profit > 0) {

                profitElement.classList.add(
                    'text-success'
                );

                profitStatus.innerHTML =
                    '🟢 Прибыльный товар';

            }
            else if (profit < 0) {

                profitElement.classList.add(
                    'text-danger'
                );

                profitStatus.innerHTML =
                    '🔴 Продажа ниже закупки';

            }
            else {

                profitElement.classList.add(
                    'text-secondary'
                );

                profitStatus.innerHTML =
                    '⚪ Без прибыли';

            }

        }

        purchaseInput.addEventListener(
            'input',
            calculateMargin
        );

        saleInput.addEventListener(
            'input',
            calculateMargin
        );

        calculateMargin();

    }
);
