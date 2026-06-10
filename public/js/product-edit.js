function generateBarcode() {

    document
        .getElementById(
            'barcode'
        )
        .value =
        Date.now();

}

document
    .querySelector(
        '[name="image"]'
    )
    .addEventListener(
        'change',
        e => {

            const file =
                e.target.files[0];

            if (!file)
                return;

            document
                .getElementById(
                    'preview'
                )
                .src =
                URL.createObjectURL(
                    file
                );

        }
    );

