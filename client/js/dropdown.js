// Dropdown logic for user account

document.addEventListener('DOMContentLoaded', () => {
    const dropdownBtn = document.getElementById('user-dropdown-btn');
    const dropdownMenu = document.getElementById('user-dropdown-menu');
    const myChannelLink = document.getElementById('my-channel-link');
    const dashboardLink = document.getElementById('dashboard-link');
    const myChannelInfo = document.getElementById('my-channel-info');
    const streamKeySpan = document.getElementById('dropdown-stream-key');
    const ingestServerSpan = document.getElementById('dropdown-ingest-server');

    if (!dropdownBtn) return;

    dropdownBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        dropdownMenu.classList.toggle('hidden');
    });

    // Link to personal channel
    if (myChannelLink) {
        myChannelLink.addEventListener('click', (e) => {
            e.preventDefault();
            if (authService && authService.currentUser) {
                window.location.href = `/${authService.currentUser.username}`;
            }
        });
    }

    // Link to dashboard
    if (dashboardLink) {
        dashboardLink.addEventListener('click', (e) => {
            e.preventDefault();
            window.location.href = '/dashboard.html';
        });
    }

    // Close dropdown when clicking outside
    document.addEventListener('click', (e) => {
        if (!dropdownMenu.classList.contains('hidden')) {
            dropdownMenu.classList.add('hidden');
        }
    });
});
