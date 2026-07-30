(() => {
    const searchInput = document.getElementById('purchaseSearch');
    const statusFilter = document.getElementById('purchaseStatusFilter');
    const resetButton = document.getElementById('purchaseFiltersReset');
    const resetEmptyButton = document.querySelector('[data-reset-purchase-filters]');
    const rows = Array.from(document.querySelectorAll('.purchase-row'));
    const visibleCount = document.getElementById('purchasesVisibleCount');
    const tableWrap = document.getElementById('purchasesTableWrap');
    const noResults = document.getElementById('purchasesNoResults');

    const normalize = value => String(value || '')
        .toLocaleLowerCase('ru-RU')
        .replace(/\s+/g, ' ')
        .trim();

    const compact = value => normalize(value).replace(/[\s()+\-./№]/g, '');

    const applyFilters = () => {
        if (!rows.length) {
            return;
        }

        const query = normalize(searchInput?.value);
        const compactQuery = compact(query);
        const status = statusFilter?.value || 'all';
        let shown = 0;

        rows.forEach(row => {
            const rowText = normalize(row.textContent);
            const matchesQuery = !query
                || rowText.includes(query)
                || (compactQuery && compact(rowText).includes(compactQuery));
            const matchesStatus = status === 'all' || row.dataset.status === status;
            const isVisible = matchesQuery && matchesStatus;

            row.hidden = !isVisible;
            if (isVisible) {
                shown += 1;
            }
        });

        if (visibleCount) {
            visibleCount.textContent = `Показано ${shown} из ${rows.length}`;
        }

        if (tableWrap) {
            tableWrap.hidden = shown === 0;
        }

        if (noResults) {
            noResults.hidden = shown !== 0;
        }

        if (resetButton) {
            resetButton.disabled = !query && status === 'all';
        }
    };

    const resetFilters = () => {
        if (searchInput) {
            searchInput.value = '';
        }

        if (statusFilter) {
            statusFilter.value = 'all';
        }

        applyFilters();
        searchInput?.focus();
    };

    searchInput?.addEventListener('input', applyFilters);
    searchInput?.addEventListener('search', applyFilters);
    statusFilter?.addEventListener('change', applyFilters);
    resetButton?.addEventListener('click', resetFilters);
    resetEmptyButton?.addEventListener('click', resetFilters);
})();
