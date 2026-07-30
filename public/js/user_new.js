(() => {
    const avatarInput = document.getElementById('employee-avatar');
    const avatarPreview = document.getElementById('employee-avatar-preview');

    if (!avatarInput || !avatarPreview) {
        return;
    }

    const initialAvatar = avatarPreview.src;
    const allowedTypes = new Set([
        'image/jpeg',
        'image/png',
        'image/webp'
    ]);
    const maxFileSize = 5 * 1024 * 1024;
    let previewUrl = null;

    const revokePreviewUrl = () => {
        if (previewUrl) {
            URL.revokeObjectURL(previewUrl);
            previewUrl = null;
        }
    };

    const rejectFile = message => {
        avatarInput.value = '';
        avatarPreview.src = initialAvatar;
        avatarInput.setCustomValidity(message);
        avatarInput.reportValidity();

        window.setTimeout(() => {
            avatarInput.setCustomValidity('');
        }, 0);
    };

    avatarInput.addEventListener('change', () => {
        const file = avatarInput.files[0];

        revokePreviewUrl();
        avatarInput.setCustomValidity('');

        if (!file) {
            avatarPreview.src = initialAvatar;
            return;
        }

        if (!allowedTypes.has(file.type)) {
            rejectFile('Выберите изображение JPG, PNG или WEBP.');
            return;
        }

        if (file.size > maxFileSize) {
            rejectFile('Размер изображения не должен превышать 5 МБ.');
            return;
        }

        previewUrl = URL.createObjectURL(file);
        avatarPreview.src = previewUrl;
    });

    window.addEventListener('pagehide', revokePreviewUrl);
})();
