(() => {
    const searchInput = document.getElementById('customerSearch');
    const discountFilter = document.getElementById('customerDiscountFilter');
    const resetButton = document.getElementById('customerFiltersReset');
    const resetEmptyButton = document.querySelector('[data-reset-customer-filters]');
    const rows = Array.from(document.querySelectorAll('.customer-row'));
    const visibleCount = document.getElementById('customersVisibleCount');
    const tableWrap = document.getElementById('customersTableWrap');
    const noResults = document.getElementById('customersNoResults');

    const normalize = value => String(value || '')
        .toLocaleLowerCase('ru-RU')
        .replace(/\s+/g, ' ')
        .trim();

    const compact = value => normalize(value).replace(/[\s()+\-./]/g, '');

    const resetFilters = () => {
        if (searchInput) {
            searchInput.value = '';
        }

        if (discountFilter) {
            discountFilter.value = 'all';
        }

        applyFilters();
        searchInput?.focus();
    };

    const applyFilters = () => {
        if (!rows.length) {
            return;
        }

        const query = normalize(searchInput?.value);
        const compactQuery = compact(query);
        const discount = discountFilter?.value || 'all';
        let shown = 0;

        rows.forEach(row => {
            const rowText = normalize(row.textContent);
            const matchesQuery = !query
                || rowText.includes(query)
                || (compactQuery && compact(rowText).includes(compactQuery));
            const matchesDiscount = discount === 'all' || row.dataset.discount === discount;
            const isVisible = matchesQuery && matchesDiscount;

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
            resetButton.disabled = !query && discount === 'all';
        }
    };

    searchInput?.addEventListener('input', applyFilters);
    searchInput?.addEventListener('search', applyFilters);
    discountFilter?.addEventListener('change', applyFilters);
    resetButton?.addEventListener('click', resetFilters);
    resetEmptyButton?.addEventListener('click', resetFilters);

    document.querySelectorAll('.customer-archive-form').forEach(form => {
        form.addEventListener('submit', event => {
            const customerName = form.dataset.customerName || 'этого клиента';
            const confirmed = window.confirm(`Перенести клиента «${customerName}» в архив?`);

            if (!confirmed) {
                event.preventDefault();
                return;
            }

            const button = form.querySelector('button[type="submit"]');
            if (button) {
                button.disabled = true;
                button.setAttribute('aria-busy', 'true');
            }
        });
    });

    const modalElement = document.getElementById('editCustomerModal');
    const editForm = document.getElementById('editCustomerForm');
    const editFields = document.getElementById('editCustomerFields');
    const editLoading = document.getElementById('editCustomerLoading');
    const editError = document.getElementById('editCustomerError');
    const editSubmit = document.getElementById('editCustomerSubmit');
    let editRequest = null;
    let activeEditButton = null;

    const setEditButtonLoading = (button, isLoading) => {
        if (!button) {
            return;
        }

        const icon = button.querySelector('.customer-action-icon');
        const spinner = button.querySelector('.customer-action-spinner');

        button.disabled = isLoading;
        button.setAttribute('aria-busy', String(isLoading));

        if (icon) {
            icon.hidden = isLoading;
        }

        if (spinner) {
            spinner.hidden = !isLoading;
        }
    };

    const setEditState = (state, message = '') => {
        const isLoading = state === 'loading';
        const isReady = state === 'ready';
        const isError = state === 'error';

        if (editForm) {
            editForm.setAttribute('aria-busy', String(isLoading));
        }

        if (editLoading) {
            editLoading.hidden = !isLoading;
        }

        if (editError) {
            editError.hidden = !isError;
            editError.textContent = isError ? message : '';
        }

        if (editFields) {
            editFields.hidden = isLoading || isError;
            editFields.disabled = !isReady;
        }

        if (editSubmit) {
            editSubmit.disabled = !isReady;
        }
    };

    const readErrorMessage = async response => {
        try {
            const contentType = response.headers.get('content-type') || '';

            if (contentType.includes('application/json')) {
                const data = await response.json();
                return data.error || data.message || '';
            }

            return (await response.text()).trim();
        } catch (error) {
            return '';
        }
    };

    const fillEditForm = customer => {
        document.getElementById('edit_name').value = customer.name || '';
        document.getElementById('edit_phone').value = customer.phone || '';
        document.getElementById('edit_discount').value = customer.discount_percentage ?? 0;
        document.getElementById('edit_email').value = customer.email || '';
        document.getElementById('edit_comment').value = customer.comment || '';
    };

    if (modalElement && editForm && typeof bootstrap !== 'undefined') {
        const editModal = bootstrap.Modal.getOrCreateInstance(modalElement);

        document.querySelectorAll('.edit-customer-btn').forEach(button => {
            button.addEventListener('click', async () => {
                const customerId = button.dataset.id;
                if (!customerId) {
                    return;
                }

                editRequest?.abort();
                setEditButtonLoading(activeEditButton, false);

                activeEditButton = button;
                setEditButtonLoading(activeEditButton, true);
                editForm.reset();
                editForm.removeAttribute('action');
                setEditState('loading');
                editModal.show();

                const request = new AbortController();
                editRequest = request;

                try {
                    const response = await fetch(`/api/customers/${encodeURIComponent(customerId)}`, {
                        headers: {
                            Accept: 'application/json'
                        },
                        signal: request.signal
                    });

                    if (!response.ok) {
                        const message = await readErrorMessage(response);
                        throw new Error(message || 'Не удалось загрузить данные клиента.');
                    }

                    const customer = await response.json();
                    if (request.signal.aborted) {
                        return;
                    }

                    fillEditForm(customer);
                    editForm.action = `/customers/edit/${encodeURIComponent(customerId)}`;
                    setEditState('ready');
                    document.getElementById('edit_name')?.focus();
                } catch (error) {
                    if (error.name === 'AbortError') {
                        return;
                    }

                    console.error('Ошибка загрузки клиента:', error);
                    setEditState('error', error.message || 'Не удалось загрузить данные клиента.');
                } finally {
                    if (editRequest === request) {
                        editRequest = null;
                    }

                    setEditButtonLoading(button, false);
                    if (activeEditButton === button) {
                        activeEditButton = null;
                    }
                }
            });
        });

        modalElement.addEventListener('hidden.bs.modal', () => {
            editRequest?.abort();
            editRequest = null;
            setEditButtonLoading(activeEditButton, false);
            activeEditButton = null;
            editForm.reset();
            editForm.removeAttribute('action');
            setEditState('idle');
        });
    }

    document.querySelectorAll('.customer-form').forEach(form => {
        form.addEventListener('submit', () => {
            const submitButton = form.querySelector('.customer-submit');
            const label = submitButton?.querySelector('.customer-submit-label');
            const loading = submitButton?.querySelector('.customer-submit-loading');

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
