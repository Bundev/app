document.querySelectorAll('.invoice-row-dashboard').forEach(row => {
    row.addEventListener('click', (e) => {

        if (e.ctrlKey) {
            window.open(row.dataset.url, '_blank');
        } else {
            window.location.href = row.dataset.url;
        }

    });
});