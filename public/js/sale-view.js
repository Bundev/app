document
    .querySelectorAll('.product-name-copy')
    .forEach(cell => {

        cell.addEventListener(
            'click',
            async () => {

                let name =
                    cell.dataset.name.trim();

                // убрать ", шт", ", м", ", кг" и т.д.
                name =
                    name.replace(
                        /,\s*(шт|м|кг|уп|л)\s*$/i,
                        ''
                    );

                await navigator.clipboard.writeText(
                    name
                );

                cell.classList.add(
                    'table-success'
                );

                setTimeout(() => {

                    cell.classList.remove(
                        'table-success'
                    );

                }, 1000);

            }
        );

    });