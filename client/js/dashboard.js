// Dashboard functionality
class Dashboard {
    constructor() {
        this.streamData = null;
        this.pollingInterval = null;
        this.init();
    }

    async init() {
        // Wait for authService to be ready
        let retries = 0;
        while (!window.authService && retries < 20) {
            await new Promise(resolve => setTimeout(resolve, 100));
            retries++;
        }

        // Check authentication
        if (!authService || !authService.isAuthenticated()) {
            window.location.href = '/';
            return;
        }

        // Load dashboard data
        await this.loadDashboardData();
        
        // Setup event listeners
        this.setupEventListeners();
        
        // Start polling for status updates
        this.startStatusPolling();
    }

    async loadDashboardData() {
        try {
            showLoading();
            
            // Check authentication
            if (!authService || !authService.isAuthenticated()) {
                showToast('Vui lòng đăng nhập', 'error');
                window.location.href = '/';
                return;
            }

            // Fetch stream data from database
            const response = await fetch(`/api/stream/my-stream`, {
                headers: authService.getAuthHeader()
            });

            if (response.status === 404) {
                // User hasn't created a stream yet
                showToast('Bạn chưa tạo kênh stream. Vui lòng tạo kênh từ trang chủ.', 'warning');
                setTimeout(() => {
                    window.location.href = '/';
                }, 2000);
                return;
            }

            if (!response.ok) {
                throw new Error('Failed to load stream data');
            }

            this.streamData = await response.json();
            this.displayDashboardData();
            
        } catch (error) {
            console.error('Error loading dashboard:', error);
            showToast('Lỗi tải dữ liệu dashboard', 'error');
        } finally {
            hideLoading();
        }
    }

    displayDashboardData() {
        if (!this.streamData) return;

        const {
            userName,
            title,
            streamKey,
            ingestEndpoint,
            playbackUrl,
            isLive,
            viewerCount
        } = this.streamData;

        // Display channel info
        document.getElementById('channel-username').textContent = userName || 'N/A';
        document.getElementById('stream-title-input').value = title || 'Live Stream';
        
        // Display connection info
        document.getElementById('stream-key').value = streamKey || 'N/A';
        document.getElementById('ingest-server').value = ingestEndpoint || 'N/A';
        document.getElementById('playback-url').value = playbackUrl || 'N/A';
        
        // Display status
        this.updateStreamStatus(isLive);
        this.updateViewerCount(viewerCount || 0);

        // Setup view channel link
        document.getElementById('view-channel-btn').href = `/${userName}`;
    }

    updateStreamStatus(isLive) {
        const statusElement = document.getElementById('stream-status');
        if (statusElement) {
            statusElement.textContent = isLive ? 'Live' : 'Offline';
            statusElement.className = `badge ${isLive ? 'badge-success' : 'badge-secondary'}`;
        }
    }

    updateViewerCount(count) {
        const viewerCountElement = document.getElementById('viewer-count');
        if (viewerCountElement) {
            viewerCountElement.textContent = count;
        }
    }

    setupEventListeners() {
        // Copy buttons
        document.getElementById('copy-stream-key').addEventListener('click', () => {
            this.copyToClipboard('stream-key', 'Stream key đã được copy!');
        });

        document.getElementById('copy-ingest-server').addEventListener('click', () => {
            this.copyToClipboard('ingest-server', 'Ingest server đã được copy!');
        });

        document.getElementById('copy-playback-url').addEventListener('click', () => {
            this.copyToClipboard('playback-url', 'Playback URL đã được copy!');
        });

        // Update title button
        document.getElementById('update-title-btn').addEventListener('click', () => {
            this.updateStreamTitle();
        });

        // Refresh button
        document.getElementById('refresh-data-btn').addEventListener('click', () => {
            this.loadDashboardData();
        });
    }

    copyToClipboard(elementId, successMessage) {
        const element = document.getElementById(elementId);
        element.select();
        document.execCommand('copy');
        showToast(successMessage, 'success');
    }

    async updateStreamTitle() {
        const newTitle = document.getElementById('stream-title-input').value.trim();
        
        if (!newTitle) {
            showToast('Tiêu đề không được để trống', 'error');
            return;
        }

        try {
            showLoading();
            
            const response = await fetch('/api/stream/update-title', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    ...authService.getAuthHeader()
                },
                body: JSON.stringify({ title: newTitle })
            });

            if (!response.ok) {
                throw new Error('Failed to update title');
            }

            const data = await response.json();
            this.streamData.title = newTitle;
            showToast('Cập nhật tiêu đề thành công!', 'success');
            
        } catch (error) {
            console.error('Error updating title:', error);
            showToast('Lỗi cập nhật tiêu đề', 'error');
        } finally {
            hideLoading();
        }
    }

    async startStatusPolling() {
        // Poll every 10 seconds for status updates
        this.pollingInterval = setInterval(async () => {
            try {
                if (!authService || !authService.isAuthenticated()) {
                    return;
                }

                const response = await fetch('/api/stream/status', {
                    headers: authService.getAuthHeader()
                });

                if (response.ok) {
                    const data = await response.json();
                    this.updateStreamStatus(data.isLive);
                    this.updateViewerCount(data.viewerCount || 0);
                }
            } catch (error) {
                console.error('Error polling status:', error);
            }
        }, 10000);
    }

    destroy() {
        if (this.pollingInterval) {
            clearInterval(this.pollingInterval);
        }
    }
}

// Utility functions
function showLoading() {
    document.getElementById('loading').classList.remove('hidden');
}

function hideLoading() {
    document.getElementById('loading').classList.add('hidden');
}

function showToast(message, type = 'info') {
    const container = document.getElementById('toast-container');
    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    toast.textContent = message;
    
    container.appendChild(toast);
    
    setTimeout(() => {
        toast.classList.add('show');
    }, 100);
    
    setTimeout(() => {
        toast.classList.remove('show');
        setTimeout(() => toast.remove(), 300);
    }, 3000);
}

// Initialize dashboard when DOM is ready
let dashboardInstance;
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        dashboardInstance = new Dashboard();
    });
} else {
    dashboardInstance = new Dashboard();
}

// Cleanup on page unload
window.addEventListener('beforeunload', () => {
    if (dashboardInstance) {
        dashboardInstance.destroy();
    }
});
