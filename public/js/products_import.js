document
    .getElementById('previewBtn')
    .addEventListener(
        'click',
        async () => {

            const formData =
                new FormData();

            formData.append(
                'excel',
                document
                    .getElementById('excelFile')
                    .files[0]
            );

            const response =
                await fetch(
                    '/products/import/preview',
                    {
                        method: 'POST',
                        body: formData
                    }
                );

            const result =
                await response.json();

            let html =
                '<table class="table table-bordered table-hover">';

            result.rows.forEach(
                row => {

                    html += '<tr>';

                    row.forEach(
                        cell => {

                            html += `
                                <td>
                                    ${cell || ''}
                                </td>
                            `;

                        }
                    );

                    html += '</tr>';

                }
            );

            html += '</table>';

            document
                .getElementById(
                    'preview'
                )
                .innerHTML = html;

            document
                .getElementById(
                    'startImport'
                )
                .classList
                .remove('d-none');

        }
    );

document
    .getElementById('startImport')
    .addEventListener(
        'click',
        () => {

            document
                .getElementById(
                    'importForm'
                )
                .submit();

        }
    );