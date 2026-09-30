document.addEventListener('click', async event => {
    const button = event.target.closest('[data-copy-product-name]');
    if (!button) return;

    const productName = button.dataset.copyProductName || '';
    if (!productName) return;

    try {
        if (navigator.clipboard?.writeText) {
            await navigator.clipboard.writeText(productName);
        } else {
            const input = document.createElement('textarea');
            input.value = productName;
            input.setAttribute('readonly', '');
            input.style.position = 'fixed';
            input.style.opacity = '0';
            document.body.append(input);
            input.select();
            document.execCommand('copy');
            input.remove();
        }

        button.classList.add('is-copied');
        button.title = 'Скопировано';
        const icon = button.querySelector('.bi');
        icon?.classList.replace('bi-copy', 'bi-check2');
        window.setTimeout(() => {
            button.classList.remove('is-copied');
            button.title = 'Скопировать название товара';
            icon?.classList.replace('bi-check2', 'bi-copy');
        }, 1400);
    } catch (error) {
        console.error('Не удалось скопировать название товара:', error);
    }
});
