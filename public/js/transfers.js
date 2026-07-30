(() => {
    'use strict';

    const page = document.getElementById('transfersPage');

    if (!page) {
        return;
    }

    const searchInput = document.getElementById('transferSearch');
    const resetButton = document.getElementById('resetTransferFilters');
    const resultCount = document.getElementById('transferResultCount');
    const emptyResult = document.getElementById('transferFilterEmpty');
    const rows = [...document.querySelectorAll('.transfer-row')];

    if (!searchInput || !rows.length) {
        return;
    }

    const normalize = value => String(value || '').trim().toLocaleLowerCase();

    const applyFilter = () => {
        const query = normalize(searchInput.value);
        let visibleCount = 0;

        rows.forEach(row => {
            const matches = !query || normalize(row.dataset.search).includes(query);
            row.classList.toggle('d-none', !matches);

            if (matches) {
                visibleCount += 1;
            }
        });

        if (resultCount) {
            resultCount.textContent =
                `${page.dataset.shownLabel}: ${visibleCount} ${page.dataset.ofLabel} ${rows.length}`;
        }

        emptyResult?.classList.toggle('d-none', visibleCount !== 0);
    };

    searchInput.addEventListener('input', applyFilter);

    searchInput.addEventListener('keydown', event => {
        if (event.key === 'Escape' && searchInput.value) {
            searchInput.value = '';
            applyFilter();
        }
    });

    resetButton?.addEventListener('click', () => {
        searchInput.value = '';
        applyFilter();
        searchInput.focus();
    });

    applyFilter();
})();

