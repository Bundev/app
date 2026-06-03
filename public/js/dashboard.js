document.querySelectorAll('.invoice-row-dashboard').forEach(row => {

    row.addEventListener('click', () => {
        window.location.href =
            row.dataset.url;
    });

});