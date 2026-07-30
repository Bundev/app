(() => {
    const searchInput = document.getElementById('supplierSearch');
    const contactFilter = document.getElementById('supplierContactFilter');
    const resetButton = document.getElementById('supplierFiltersReset');
    const resetEmptyButton = document.querySelector('[data-reset-supplier-filters]');
    const rows = Array.from(document.querySelectorAll('.supplier-row'));
    const visibleCount = document.getElementById('suppliersVisibleCount');
    const tableWrap = document.getElementById('suppliersTableWrap');
    const noResults = document.getElementById('suppliersNoResults');

    const normalize = value => String(value || '')
        .toLocaleLowerCase('ru-RU')
        .replace(/\s+/g, ' ')
        .trim();

    const compact = value => normalize(value).replace(/[\s()+\-./]/g, '');

    const applyFilters = () => {
        if (!rows.length) {
            return;
        }

        const query = normalize(searchInput?.value);
        const compactQuery = compact(query);
        const contact = contactFilter?.value || 'all';
        let shown = 0;

        rows.forEach(row => {
            const rowText = normalize(row.textContent);
            const matchesQuery = !query
                || rowText.includes(query)
                || (compactQuery && compact(rowText).includes(compactQuery));
            const matchesContact = contact === 'all' || row.dataset.contact === contact;
            const isVisible = matchesQuery && matchesContact;

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
            resetButton.disabled = !query && contact === 'all';
        }
    };

    const resetFilters = () => {
        if (searchInput) {
            searchInput.value = '';
        }

        if (contactFilter) {
            contactFilter.value = 'all';
        }

        applyFilters();
        searchInput?.focus();
    };

    searchInput?.addEventListener('input', applyFilters);
    searchInput?.addEventListener('search', applyFilters);
    contactFilter?.addEventListener('change', applyFilters);
    resetButton?.addEventListener('click', resetFilters);
    resetEmptyButton?.addEventListener('click', resetFilters);

    const editModal = document.getElementById('editSupplierModal');
    const editForm = document.getElementById('editSupplierForm');

    editModal?.addEventListener('show.bs.modal', event => {
        const trigger = event.relatedTarget;
        const supplierId = trigger?.dataset.id;

        if (!supplierId || !editForm) {
            event.preventDefault();
            return;
        }

        editForm.action = `/suppliers/edit/${encodeURIComponent(supplierId)}`;
        document.getElementById('edit_supplier_name').value = trigger.dataset.name || '';
        document.getElementById('edit_supplier_phone').value = trigger.dataset.phone || '';
        document.getElementById('edit_supplier_email').value = trigger.dataset.email || '';
        document.getElementById('edit_supplier_address').value = trigger.dataset.address || '';
    });

    editModal?.addEventListener('hidden.bs.modal', () => {
        editForm?.reset();
        editForm?.removeAttribute('action');
    });

    document.querySelectorAll('.supplier-archive-form').forEach(form => {
        form.addEventListener('submit', event => {
            const supplierName = form.dataset.supplierName || 'этого поставщика';
            const confirmed = window.confirm(`Перенести поставщика «${supplierName}» в архив?`);

            if (!confirmed) {
                event.preventDefault();
                return;
            }

            const submitButton = form.querySelector('button[type="submit"]');
            if (submitButton) {
                submitButton.disabled = true;
                submitButton.setAttribute('aria-busy', 'true');
            }
        });
    });

    document.querySelectorAll('.supplier-form').forEach(form => {
        form.addEventListener('submit', () => {
            const submitButton = form.querySelector('.supplier-submit');
            const label = submitButton?.querySelector('.supplier-submit-label');
            const loading = submitButton?.querySelector('.supplier-submit-loading');

            if (!submitButton) {
                return;
            }

            submitButton.disabled = true;
            submitButton.setAttribute('aria-busy', 'true');

            if (label) {
                label.hidden = true;
            }

            if (loading) {
                loading.hidden = false;
            }
        });
    });
})();
