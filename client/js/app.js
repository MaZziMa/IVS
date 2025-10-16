// Main Application Controller
class App {
    constructor() {
        this.init();
    }

    async init() {
        // Wait for DOM to be fully loaded
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', () => this.start());
        } else {
            this.start();
        }
    }

    start() {
        console.log('AWS IVS Streaming App initialized');
        
        // Initialize error handling
        this.setupErrorHandling();
        
        // Initialize service event listeners
        this.setupServiceListeners();
        
        // Load initial data
        this.loadInitialData();
        
        // Setup periodic updates
        this.setupPeriodicUpdates();
    }

    setupErrorHandling() {
        // Global error handler
        window.addEventListener('error', (event) => {
            console.error('Global error:', event.error);
            showToast('Đã xảy ra lỗi không mong muốn', 'error');
        });

        // Unhandled promise rejection handler
        window.addEventListener('unhandledrejection', (event) => {
            console.error('Unhandled promise rejection:', event.reason);
            showToast('Đã xảy ra lỗi không mong muốn', 'error');
            event.preventDefault();
        });
    }

    setupServiceListeners() {
        // Listen for authentication state changes
        document.addEventListener('authStateChanged', () => {
            this.onAuthStateChanged();
        });

        // Listen for stream state changes
        document.addEventListener('streamStateChanged', (event) => {
            this.onStreamStateChanged(event.detail);
        });
    }

    async loadInitialData() {
        try {
            // Load stream information nếu có
            if (streamService) {
                await streamService.checkStreamStatus();
            }
        } catch (error) {
            console.error('Failed to load initial data:', error);
        }
    }

    setupPeriodicUpdates() {
        // Update viewer count every 15 seconds
        setInterval(() => {
            if (streamService && streamService.isStreamLive()) {
                this.updateViewerCount();
            }
        }, 15000);

        // Check connection status every 30 seconds
        setInterval(() => {
            this.checkConnectionStatus();
        }, 30000);
    }

    onAuthStateChanged() {
        // Emit custom event for other components
        const event = new CustomEvent('authStateChanged');
        document.dispatchEvent(event);

        // Update UI based on auth state
        if (authService && authService.isAuthenticated()) {
            this.onUserLogin();
        } else {
            this.onUserLogout();
        }
    }

    onUserLogin() {
        console.log('User logged in');
        
        // Enable chat
        if (chatService) {
            chatService.onAuthStateChanged();
        }
        
        // Load user-specific data
        this.loadUserData();
    }

    onUserLogout() {
        console.log('User logged out');
        
        // Clear chat
        if (chatService) {
            chatService.clearMessages();
            chatService.onAuthStateChanged();
        }
        
        // Clear any cached data
        this.clearUserData();
    }

    onStreamStateChanged(streamState) {
        console.log('Stream state changed:', streamState);
        
        // Update UI based on stream state
        if (streamState.isLive) {
            this.onStreamStart(streamState);
        } else {
            this.onStreamEnd();
        }
    }

    onStreamStart(streamState) {
        console.log('Stream started');
        
        // Update viewer count
        if (streamState.viewerCount !== undefined) {
            streamService.updateViewerCount();
        }
    }

    onStreamEnd() {
        console.log('Stream ended');
        
        // Reset viewer count
        document.getElementById('viewer-count').textContent = '0 người xem';
    }

    async loadUserData() {
        if (!authService.isAuthenticated()) return;

        try {
            // Load user streams
            const response = await fetch('/api/user/streams', {
                headers: authService.getAuthHeader()
            });

            if (response.ok) {
                const streams = await response.json();
                console.log('User streams:', streams);
            }
        } catch (error) {
            console.error('Failed to load user data:', error);
        }
    }

    clearUserData() {
        // Clear any cached user data
        console.log('Clearing user data');
    }

    async updateViewerCount() {
        try {
            const response = await fetch('/api/stream/viewers');
            if (response.ok) {
                const data = await response.json();
                if (data.viewerCount !== undefined) {
                    streamService.viewerCount = data.viewerCount;
                    streamService.updateViewerCount();
                }
            }
        } catch (error) {
            console.error('Failed to update viewer count:', error);
        }
    }

    checkConnectionStatus() {
        // Check if services are connected
        const isOnline = navigator.onLine;
        
        if (!isOnline) {
            showToast('Mất kết nối internet', 'error');
            return;
        }

        // Check chat connection
        if (chatService && !chatService.isConnected()) {
            console.warn('Chat service disconnected, attempting to reconnect...');
            chatService.connectWebSocket();
        }
    }
}

// Utility Functions
function showLoading(show = true) {
    const loadingElement = document.getElementById('loading');
    if (loadingElement) {
        if (show) {
            loadingElement.classList.remove('hidden');
        } else {
            loadingElement.classList.add('hidden');
        }
    }
}

function showToast(message, type = 'info', duration = 5000) {
    const container = document.getElementById('toast-container');
    if (!container) return;

    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.innerHTML = `
        <div class="toast-message">${escapeHtml(message)}</div>
    `;

    container.appendChild(toast);

    // Auto remove after duration
    setTimeout(() => {
        if (toast.parentNode) {
            toast.style.animation = 'slideOut 0.3s ease';
            setTimeout(() => {
                if (toast.parentNode) {
                    container.removeChild(toast);
                }
            }, 300);
        }
    }, duration);

    // Allow manual close
    toast.addEventListener('click', () => {
        if (toast.parentNode) {
            container.removeChild(toast);
        }
    });
}

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

function formatTimestamp(timestamp) {
    return new Date(timestamp).toLocaleTimeString('vi-VN', {
        hour: '2-digit',
        minute: '2-digit'
    });
}

function debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
        const later = () => {
            clearTimeout(timeout);
            func(...args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
    };
}

// Network status monitoring
window.addEventListener('online', () => {
    showToast('Đã khôi phục kết nối internet', 'success');
});

window.addEventListener('offline', () => {
    showToast('Mất kết nối internet', 'error');
});

// Initialize the application
const app = new App();

// Export for global access if needed
window.app = app;