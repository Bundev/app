(() => {
    const printButton = document.getElementById('printPurchaseButton');

    printButton?.addEventListener('click', () => {
        window.print();
    });
})();
