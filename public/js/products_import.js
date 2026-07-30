(() => {
    const form = document.getElementById('importForm');

    if (!form) {
        return;
    }

    const fileInput = document.getElementById('excelFile');
    const dropzone = document.getElementById('importDropzone');
    const selectedFile = document.getElementById('selectedFile');
    const selectedFileName = document.getElementById('selectedFileName');
    const selectedFileSize = document.getElementById('selectedFileSize');
    const removeFileButton = document.getElementById('removeFile');
    const previewButton = document.getElementById('previewBtn');
    const importButton = document.getElementById('startImport');
    const previewSection = document.getElementById('previewSection');
    const previewContainer = document.getElementById('preview');
    const previewMeta = document.getElementById('previewMeta');
    const message = document.getElementById('importMessage');
    const storeSelect = document.getElementById('store_id');
    const actionTitle = document.getElementById('importActionTitle');
    const actionHint = document.getElementById('importActionHint');
    const steps = Array.from(
        document.querySelectorAll('[data-import-step]')
    );

    let previewReady = false;
    let previewController = null;

    const formatFileSize = bytes => {
        if (!Number.isFinite(bytes) || bytes <= 0) {
            return 'Размер файла не определён';
        }

        const units = ['Б', 'КБ', 'МБ', 'ГБ'];
        const unitIndex = Math.min(
            Math.floor(Math.log(bytes) / Math.log(1024)),
            units.length - 1
        );
        const value = bytes / (1024 ** unitIndex);

        return `${value.toFixed(unitIndex === 0 ? 0 : 1)} ${units[unitIndex]}`;
    };

    const isExcelFile = file =>
        Boolean(file && /\.(xlsx|xls)$/i.test(file.name));

    const setStep = currentStep => {
        steps.forEach(step => {
            const stepNumber = Number(step.dataset.importStep);

            step.classList.toggle(
                'is-complete',
                stepNumber < currentStep
            );
            step.classList.toggle(
                'is-active',
                stepNumber === currentStep
            );

            if (stepNumber === currentStep) {
                step.setAttribute('aria-current', 'step');
            } else {
                step.removeAttribute('aria-current');
            }
        });
    };

    const hideMessage = () => {
        message.textContent = '';
        message.classList.add('d-none');
    };

    const showMessage = text => {
        message.textContent = text;
        message.classList.remove('d-none');
        message.focus();
    };

    const setPreviewLoading = isLoading => {
        const icon = previewButton.querySelector('i');
        const label = previewButton.querySelector('span');

        previewButton.disabled = isLoading || storeSelect.disabled;
        previewButton.setAttribute('aria-busy', String(isLoading));

        if (isLoading) {
            icon.className = 'bi bi-arrow-repeat products-import-spinner';
            label.textContent = 'Читаем файл...';
        } else {
            icon.className = 'bi bi-eye';
            label.textContent = 'Предпросмотр';
        }
    };

    const resetPreview = () => {
        previewReady = false;

        if (previewController) {
            previewController.abort();
            previewController = null;
        }

        previewContainer.replaceChildren();
        previewSection.classList.add('d-none');
        importButton.classList.add('d-none');
        importButton.disabled = false;
        actionTitle.textContent = 'Сначала проверьте файл';
        actionHint.textContent =
            'Импорт станет доступен после успешного предпросмотра.';
        setPreviewLoading(false);
        hideMessage();
    };

    const showSelectedFile = file => {
        selectedFileName.textContent = file.name;
        selectedFileSize.textContent = formatFileSize(file.size);
        selectedFile.classList.remove('d-none');
        dropzone.classList.add('is-selected');
        setStep(2);
    };

    const clearSelectedFile = () => {
        fileInput.value = '';
        selectedFileName.textContent = '';
        selectedFileSize.textContent = '';
        selectedFile.classList.add('d-none');
        dropzone.classList.remove('is-selected', 'is-dragover');
        resetPreview();
        setStep(1);
    };

    const handleSelectedFile = () => {
        const file = fileInput.files[0];

        resetPreview();

        if (!file) {
            clearSelectedFile();
            return;
        }

        if (!isExcelFile(file)) {
            clearSelectedFile();
            showMessage('Выберите файл в формате XLSX или XLS.');
            return;
        }

        showSelectedFile(file);
    };

    const createPreviewTable = rows => {
        const normalizedRows = rows.map(row =>
            Array.isArray(row) ? row : [row]
        );
        const columnCount = Math.max(
            ...normalizedRows.map(row => row.length),
            1
        );

        const table = document.createElement('table');
        table.className = 'table table-hover align-middle';

        const thead = document.createElement('thead');
        const headerRow = document.createElement('tr');
        const rowNumberHeader = document.createElement('th');
        rowNumberHeader.className = 'products-import-row-number';
        rowNumberHeader.scope = 'col';
        rowNumberHeader.textContent = '#';
        headerRow.append(rowNumberHeader);

        for (let columnIndex = 0; columnIndex < columnCount; columnIndex += 1) {
            const header = document.createElement('th');
            header.scope = 'col';
            header.textContent = `Колонка ${columnIndex + 1}`;
            headerRow.append(header);
        }

        thead.append(headerRow);
        table.append(thead);

        const tbody = document.createElement('tbody');

        normalizedRows.forEach((row, rowIndex) => {
            const tableRow = document.createElement('tr');
            const rowNumber = document.createElement('td');
            rowNumber.className = 'products-import-row-number';
            rowNumber.textContent = String(rowIndex + 1);
            tableRow.append(rowNumber);

            for (
                let columnIndex = 0;
                columnIndex < columnCount;
                columnIndex += 1
            ) {
                const cell = document.createElement('td');
                const value = row[columnIndex];
                cell.textContent =
                    value === null || value === undefined
                        ? ''
                        : String(value);
                tableRow.append(cell);
            }

            tbody.append(tableRow);
        });

        table.append(tbody);

        return table;
    };

    const renderEmptyPreview = () => {
        const emptyState = document.createElement('div');
        emptyState.className = 'products-import-preview-empty';

        const icon = document.createElement('i');
        icon.className = 'bi bi-inbox';

        const text = document.createElement('span');
        text.textContent = 'В файле не найдено строк для импорта.';

        emptyState.append(icon, text);
        previewContainer.replaceChildren(emptyState);
        previewMeta.textContent = 'Нет данных для отображения';
        previewSection.classList.remove('d-none');
    };

    const readResponse = async response => {
        const contentType = response.headers.get('content-type') || '';

        if (contentType.includes('application/json')) {
            return response.json();
        }

        const text = await response.text();

        return {
            success: false,
            error: text || 'Сервер вернул неизвестную ошибку'
        };
    };

    fileInput.addEventListener('change', handleSelectedFile);

    removeFileButton.addEventListener('click', () => {
        clearSelectedFile();
        fileInput.focus();
    });

    dropzone.addEventListener('keydown', event => {
        if (event.key === 'Enter' || event.key === ' ') {
            event.preventDefault();
            fileInput.click();
        }
    });

    ['dragenter', 'dragover'].forEach(eventName => {
        dropzone.addEventListener(eventName, event => {
            event.preventDefault();
            dropzone.classList.add('is-dragover');
        });
    });

    ['dragleave', 'dragend'].forEach(eventName => {
        dropzone.addEventListener(eventName, () => {
            dropzone.classList.remove('is-dragover');
        });
    });

    dropzone.addEventListener('drop', event => {
        event.preventDefault();
        dropzone.classList.remove('is-dragover');

        if (event.dataTransfer.files.length !== 1) {
            clearSelectedFile();
            showMessage('Выберите только один Excel-файл.');
            return;
        }

        const file = event.dataTransfer.files[0];

        if (!isExcelFile(file)) {
            clearSelectedFile();
            showMessage('Перетащите файл в формате XLSX или XLS.');
            return;
        }

        try {
            const transfer = new DataTransfer();
            transfer.items.add(file);
            fileInput.files = transfer.files;
            handleSelectedFile();
        } catch (error) {
            showMessage(
                'Не удалось добавить файл перетаскиванием. Выберите его через проводник.'
            );
        }
    });

    previewButton.addEventListener('click', async () => {
        hideMessage();

        if (!form.reportValidity()) {
            return;
        }

        const file = fileInput.files[0];

        if (!isExcelFile(file)) {
            showMessage('Выберите Excel-файл для предпросмотра.');
            return;
        }

        resetPreview();
        setPreviewLoading(true);
        const controller = new AbortController();
        previewController = controller;

        const formData = new FormData();
        formData.append('excel', file);

        try {
            const response = await fetch('/products/import/preview', {
                method: 'POST',
                body: formData,
                signal: controller.signal
            });
            const result = await readResponse(response);

            if (!response.ok || result.success === false) {
                throw new Error(
                    result.error || 'Не удалось прочитать Excel-файл'
                );
            }

            if (!Array.isArray(result.rows)) {
                throw new Error('Сервер вернул некорректный предпросмотр');
            }

            if (!result.rows.length) {
                renderEmptyPreview();
                showMessage('В выбранном файле нет товаров для импорта.');
                setStep(2);
                return;
            }

            const table = createPreviewTable(result.rows);
            const totalRows = Number(result.totalRows);
            const hasTotalRows =
                Number.isFinite(totalRows) &&
                totalRows >= result.rows.length;

            previewContainer.replaceChildren(table);
            previewMeta.textContent = hasTotalRows
                ? `Показано ${result.rows.length} из ${totalRows} строк`
                : `Показано строк: ${result.rows.length}`;
            previewSection.classList.remove('d-none');
            importButton.classList.remove('d-none');
            actionTitle.textContent = 'Файл готов к импорту';
            actionHint.textContent =
                'Проверьте параметры и запустите обновление склада.';
            previewReady = true;
            setStep(3);
            document.getElementById('previewTitle').focus({
                preventScroll: true
            });

            previewSection.scrollIntoView({
                behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches
                    ? 'auto'
                    : 'smooth',
                block: 'start'
            });
        } catch (error) {
            if (error.name !== 'AbortError') {
                showMessage(
                    error.message ||
                    'Не удалось выполнить предпросмотр файла.'
                );
                setStep(2);
            }
        } finally {
            if (previewController === controller) {
                previewController = null;
                setPreviewLoading(false);
            }
        }
    });

    form.addEventListener('submit', event => {
        if (!previewReady) {
            event.preventDefault();
            showMessage(
                'Сначала выполните предпросмотр выбранного файла.'
            );
            return;
        }

        const icon = importButton.querySelector('i');
        const label = importButton.querySelector('span');

        previewButton.disabled = true;
        importButton.disabled = true;
        importButton.setAttribute('aria-busy', 'true');
        icon.className = 'bi bi-arrow-repeat products-import-spinner';
        label.textContent = 'Импортируем...';
    });

    setPreviewLoading(false);
    setStep(1);
})();
