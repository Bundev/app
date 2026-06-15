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







let scanner = null;

document
    .getElementById('scanBtn')
    .addEventListener(
        'click',
        async () => {

            document
                .getElementById(
                    'scannerModal'
                )
                .style.display =
                'flex';

            const reader =
                document.getElementById(
                    'reader'
                );

            reader.innerHTML = '';

            scanner =
                new Html5Qrcode(
                    'reader'
                );

            await scanner.start(
                {
                    facingMode:
                        'environment'
                },
                {
                    fps: 10,
                    qrbox: 250
                },
                async decodedText => {
                    document.getElementById('barcode').value = '';
                    document.getElementById('barcode').value = decodedText;

                    await scanner.stop();

                    document
                        .getElementById(
                            'scannerModal'
                        )
                        .style.display =
                        'none';

                    
                    
                    

                    

                }
            );

        }
    );

document
    .getElementById(
        'closeScanner'
    )
    .addEventListener(
        'click',
        async () => {

            if (scanner) {

                try {

                    await scanner.stop();

                } catch (e) {}

            }

            document
                .getElementById(
                    'scannerModal'
                )
                .style.display =
                'none';

        }
    );