(() => {
    'use strict';

    const printButton = document.querySelector('[data-print-transfer]');

    printButton?.addEventListener('click', () => {
        window.print();
    });
})();

