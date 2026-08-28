const menuBtn = document.getElementById('menuToggle');
const sidebar = document.getElementById('sidebar');
const overlay = document.getElementById('overlay');
const sidebarClose = document.querySelector('.app-sidebar-close');

const closeSidebar = () => {
    sidebar?.classList.remove('show');
    overlay?.classList.remove('show');
};

menuBtn?.addEventListener('click', () => {
    sidebar.classList.toggle('show');
    overlay?.classList.toggle('show');
});

overlay?.addEventListener('click', () => {
    closeSidebar();
});

sidebarClose?.addEventListener('click', closeSidebar);

// Глобальный индикатор связи для всех страниц системы.
(() => {
    const notification = document.createElement('div');
    const icon = document.createElement('i');
    const message = document.createElement('span');
    let connectionState = navigator.onLine ? 'unknown' : 'offline';
    let hideTimer = null;
    let checking = false;

    notification.id = 'connection-notification';
    notification.className = 'connection-notification';
    notification.setAttribute('role', 'status');
    notification.setAttribute('aria-live', 'polite');
    notification.append(icon, message);
    document.body.append(notification);

    const showNotification = (type, text) => {
        window.clearTimeout(hideTimer);
        notification.className = `connection-notification connection-notification--${type} is-visible`;
        icon.className = type === 'online'
            ? 'bi bi-wifi'
            : 'bi bi-wifi-off';
        icon.setAttribute('aria-hidden', 'true');
        message.textContent = text;

        if (type === 'online') {
            hideTimer = window.setTimeout(() => {
                notification.classList.remove('is-visible');
            }, 4000);
        }
    };

    const setConnectionState = isOnline => {
        const nextState = isOnline ? 'online' : 'offline';
        if (connectionState === nextState) return;

        const previousState = connectionState;
        connectionState = nextState;

        if (isOnline) {
            if (previousState === 'offline') {
                showNotification('online', 'Соединение восстановлено');
            }
        } else {
            showNotification('offline', 'Нет сети — офлайн-режим');
        }
    };

    const checkConnection = async () => {
        if (checking) return;
        if (!navigator.onLine) {
            setConnectionState(false);
            return;
        }

        checking = true;
        const controller = new AbortController();
        const timeout = window.setTimeout(() => controller.abort(), 5000);

        try {
            const response = await fetch('/api/connection-status', {
                method: 'GET',
                cache: 'no-store',
                signal: controller.signal
            });
            setConnectionState(response.ok);
        } catch (error) {
            setConnectionState(false);
        } finally {
            window.clearTimeout(timeout);
            checking = false;
        }
    };

    window.addEventListener('offline', () => setConnectionState(false));
    window.addEventListener('online', checkConnection);
    document.addEventListener('visibilitychange', () => {
        if (!document.hidden) checkConnection();
    });

    if (connectionState === 'offline') {
        showNotification('offline', 'Нет сети — офлайн-режим');
    } else {
        checkConnection();
    }

    window.setInterval(checkConnection, 30000);
})();

