  const searchInput = document.getElementById('search');
  const resultsDiv = document.getElementById('results');
  const productSearchResult = document.getElementById('searchresults');

  let timer;

  searchInput.addEventListener('input', () => {
    clearTimeout(timer);

    timer = setTimeout(async () => {
      const q = searchInput.value;

      if (q.length < 2) {
        resultsDiv.innerHTML = '';
        productSearchResult.style.display = 'none';
        return;
      }

      const response = await fetch(
        `/search?q=${encodeURIComponent(q)}`
      );

      const products = await response.json();

      if (products.length === 0) {
        resultsDiv.innerHTML = '';
        productSearchResult.style.display = 'none';
        return;
      }
      
      resultsDiv.innerHTML = products.map(product => `
        <div class="product">
          <div class="nomin" data-name='${product.name}' title='${product.name}'  data-price="${product.price}">${product.name}</div>
          <div class="price">${product.price}</div>
        </div>
      `).join('');
      productSearchResult.style.display = 'block';
    }, 300);
  });

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

function addProduct(product) {
  const rows = document.querySelectorAll('#item-products tr');

    for (const row of rows) {

        const productName =
            row.querySelector('.product-name').textContent.trim();

        if (productName === product.name.trim()) {

            const qtyInput = row.querySelector('.qty');

            qtyInput.value = Number(qtyInput.value) + 1;

            updateQuantity(qtyInput);

            return;
        }
    }

  const rowNumber =
      document.querySelectorAll('#item-products tr').length + 1;
  const html = `
<tr>

    <td>${rowNumber}</td>

    <td
        class="product-name"
        data-name='${product.name}'
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

    <td>Шт</td>

    <td class="pricepoduct">
        ${product.price.toFixed(2)}
    </td>

    <td class="sum">
        ${product.price.toFixed(2)}
    </td>

    <td>
        <button
            type="button"
            class="btn btn-outline-danger btn-sm remove">
            ✕
        </button>
    </td>

</tr>
`;

  document
      .getElementById('item-products')
      .insertAdjacentHTML('beforeend', html);

  updateTotals();
  updateRowNumbers()
}

resultsDiv.addEventListener('click', (e) => {

      const item = e.target.closest('.nomin');

      if (!item) return;
     
      addProduct({
          
          name: item.dataset.name,
          price: Number(item.dataset.price)
      });

  });


  

  document.addEventListener('click', (e) => {

  const product = e.target.closest('.product-name');
  if (!product) return;
  const text = product.dataset.name;
  const textarea = document.createElement('textarea');
  textarea.value = text;
  document.body.appendChild(textarea);
  textarea.select();
  document.execCommand('copy');
  document.body.removeChild(textarea);
  
 
  // console.log('Скопировано:', text);
});

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
// Удаление текста в пойске
document.getElementById('clearSearch').addEventListener('click', () => {
    const input = document.getElementById('search');

    input.value = '';
    input.dispatchEvent(new Event('input'));
    input.focus();
});

const search = document.getElementById('search');

search.addEventListener('click', function () {
    this.select();
});

// Добовляет дату в новом чеке
document.getElementById('invoiceDate').value =
    new Date().toISOString().split('T')[0];
// Сохранение чека
async function saveInvoice() {

    const items = [];

    document
        .querySelectorAll('#item-products tr')
        .forEach(row => {

            items.push({
                name: row.querySelector('.product-name')
                    .dataset.name,

                qty: Number(
                    row.querySelector('.qty').value
                ),

                price: Number(
                    row.querySelector('.pricepoduct')
                        .textContent
                ),

                sum: Number(
                    row.querySelector('.sum')
                        .textContent
                )
            });

            

        });

        if (items.length === 0) {
            alert('Добавьте хотя бы один товар');
            return;

        }

        if (!document.getElementById('customer').value) {

            alert('Выберите покупателя');

            return;

        }

        if (!document.getElementById('status').value) {

            alert('Выберите статус');

            return;

        }

    const invoice = {

        customer:
            document.getElementById('customer')
                ?.value || '',

        status:
            document.getElementById('status')
                ?.value || '',

        date:
            document.getElementById('invoiceDate')
                ?.value || '',

        total:
            Number(
                document.getElementById('total-sum')
                    .textContent
            ),

        items

    };

    const response = await fetch(
        '/save-invoice',
        {
            method: 'POST',
            headers: {
                'Content-Type':
                    'application/json'
            },
            body: JSON.stringify(invoice)
        }
    );

    const result = await response.json();

    if (result.success) {
        window.location.href = '/sales';
    }

}