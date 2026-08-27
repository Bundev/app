(() => {
    const retryButton = document.getElementById('retryConnection');
    const countdown = document.getElementById('retryCountdown');
    const autoRetry = document.body.dataset.autoRetry === 'true';
    const retryUrl = document.body.dataset.retryUrl || '/';
    let seconds = 5;
    let checking = false;

    const retry = async () => {
        if (checking) return;
        checking = true;
        retryButton.disabled = true;
        retryButton.classList.add('is-checking');

        try {
            const response = await fetch('/api/connection-status', {
                cache: 'no-store'
            });

            if (response.ok) {
                window.location.replace(retryUrl);
                return;
            }
        } catch (error) {
            // Остаёмся на странице и пробуем снова.
        }

        checking = false;
        retryButton.disabled = false;
        retryButton.classList.remove('is-checking');
        seconds = 5;
        if (countdown) countdown.textContent = String(seconds);
    };

    retryButton.addEventListener('click', retry);

    if (autoRetry) {
        window.setInterval(() => {
            if (checking) return;
            seconds -= 1;
            if (countdown) countdown.textContent = String(Math.max(seconds, 0));
            if (seconds <= 0) retry();
        }, 1000);
    }
})();
