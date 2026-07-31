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

