// Authentication Service
class AuthService {
    constructor() {
        this.currentUser = null;
        this.cognitoConfig = {
            region: 'us-east-1', // Sẽ được cấu hình từ server
            userPoolId: '',
            clientId: ''
        };
        this.refreshTokenTimer = null; // Timer for auto-refresh
        this.init();
    }

    async init() {
        // Lấy cấu hình Cognito từ server
        try {
            const response = await fetch('/api/auth/config');
            if (response.ok) {
                this.cognitoConfig = await response.json();
            }
        } catch (error) {
            console.error('Failed to load auth config:', error);
        }

        // Kiểm tra user đã đăng nhập
        this.checkAuthState();
        
        // Start auto-refresh token mechanism
        this.startAutoRefresh();
    }

    checkAuthState() {
        const token = localStorage.getItem('idToken'); // Use ID token
        const user = localStorage.getItem('currentUser');
        
        if (token && user) {
            try {
                this.currentUser = JSON.parse(user);
                this.updateUI();
            } catch (error) {
                console.error('Invalid stored user data:', error);
                this.logout();
            }
        }
    }
    
    // Auto-refresh token before expiry
    startAutoRefresh() {
        // Refresh token every 50 minutes (token expires in 60 minutes)
        const REFRESH_INTERVAL = 50 * 60 * 1000; // 50 minutes
        
        this.refreshTokenTimer = setInterval(async () => {
            if (this.isAuthenticated()) {
                console.log('Auto-refreshing token...');
                await this.refreshSession();
            }
        }, REFRESH_INTERVAL);
        
        // Also refresh on page load if token is close to expiry
        if (this.isAuthenticated()) {
            this.checkAndRefreshIfNeeded();
        }
    }
    
    // Check if token needs refresh (expires in < 10 minutes)
    async checkAndRefreshIfNeeded() {
        const tokenExpiry = localStorage.getItem('tokenExpiry');
        if (tokenExpiry) {
            const expiryTime = parseInt(tokenExpiry);
            const now = Date.now();
            const timeLeft = expiryTime - now;
            
            // Refresh if less than 10 minutes left
            if (timeLeft < 10 * 60 * 1000) {
                console.log('Token expiring soon, refreshing...');
                await this.refreshSession();
            }
        }
    }
    
    // Refresh session using refresh token
    async refreshSession() {
        try {
            const refreshToken = localStorage.getItem('refreshToken');
            if (!refreshToken) {
                console.error('No refresh token available');
                return false;
            }
            
            const response = await fetch('/api/auth/refresh', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ refreshToken })
            });
            
            if (response.ok) {
                const result = await response.json();
                
                // Update tokens
                localStorage.setItem('idToken', result.tokens.IdToken);
                localStorage.setItem('accessToken', result.tokens.AccessToken);
                
                // Set expiry time (1 hour from now)
                const expiryTime = Date.now() + (60 * 60 * 1000);
                localStorage.setItem('tokenExpiry', expiryTime.toString());
                
                console.log('Token refreshed successfully');
                return true;
            } else {
                console.error('Failed to refresh token');
                // If refresh fails, logout user
                this.logout();
                return false;
            }
        } catch (error) {
            console.error('Error refreshing token:', error);
            return false;
        }
    }

    async register(username, email, password) {
        try {
            showLoading(true);
            
            const response = await fetch('/api/auth/register', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ username, email, password })
            });

            const result = await response.json();
            
            if (response.ok) {
                showToast('Đăng ký thành công! Bạn có thể đăng nhập ngay.', 'success');
                return { success: true, needConfirmation: false, email, password }; // Return credentials for auto-login
            } else {
                throw new Error(result.message || 'Đăng ký thất bại');
            }
        } catch (error) {
            console.error('Registration error:', error);
            showToast(error.message, 'error');
            return { success: false, error: error.message };
        } finally {
            showLoading(false);
        }
    }

    async confirmRegistration(username, confirmationCode) {
        try {
            showLoading(true);
            
            const response = await fetch('/api/auth/confirm', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ username, confirmationCode })
            });

            const result = await response.json();
            
            if (response.ok) {
                showToast('Xác nhận thành công! Bạn có thể đăng nhập ngay.', 'success');
                return { success: true };
            } else {
                throw new Error(result.message || 'Xác nhận thất bại');
            }
        } catch (error) {
            console.error('Confirmation error:', error);
            showToast(error.message, 'error');
            return { success: false, error: error.message };
        } finally {
            showLoading(false);
        }
    }

    async login(email, password) {
        try {
            showLoading(true);
            
            const response = await fetch('/api/auth/login', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ email, password })
            });

            const result = await response.json();
            
            if (response.ok) {
                this.currentUser = result.user;
                localStorage.setItem('idToken', result.tokens.IdToken); // Store ID token for API calls
                localStorage.setItem('accessToken', result.tokens.AccessToken);
                localStorage.setItem('refreshToken', result.tokens.RefreshToken);
                localStorage.setItem('currentUser', JSON.stringify(result.user));
                
                // Set token expiry (1 hour from now)
                const expiryTime = Date.now() + (60 * 60 * 1000);
                localStorage.setItem('tokenExpiry', expiryTime.toString());
                
                this.updateUI();
                showToast('Đăng nhập thành công!', 'success');
                return { success: true };
            } else {
                throw new Error(result.message || 'Đăng nhập thất bại');
            }
        } catch (error) {
            console.error('Login error:', error);
            showToast(error.message, 'error');
            return { success: false, error: error.message };
        } finally {
            showLoading(false);
        }
    }

    async logout() {
        try {
            // Gọi API logout trên server
            const token = localStorage.getItem('accessToken'); // Use access token for logout
            if (token) {
                await fetch('/api/auth/logout', {
                    method: 'POST',
                    headers: {
                        'Authorization': `Bearer ${token}`
                    }
                });
            }
        } catch (error) {
            console.error('Logout error:', error);
        } finally {
            // Clear auto-refresh timer
            if (this.refreshTokenTimer) {
                clearInterval(this.refreshTokenTimer);
                this.refreshTokenTimer = null;
            }
            
            // Xóa dữ liệu local
            localStorage.removeItem('idToken'); // Remove ID token too
            localStorage.removeItem('accessToken');
            localStorage.removeItem('refreshToken');
            localStorage.removeItem('tokenExpiry');
            localStorage.removeItem('currentUser');
            this.currentUser = null;
            this.updateUI();
            showToast('Đã đăng xuất', 'success');

            // Disconnect from chat
            if (typeof chatService !== 'undefined') {
                chatService.disconnectFromChat();
            }
        }
    }

    updateUI() {
        const authSection = document.getElementById('auth-section');
        const userSection = document.getElementById('user-section');
        const streamManagement = document.getElementById('stream-management');
        const chatInput = document.getElementById('chat-input');
        const sendChat = document.getElementById('send-chat');
        const userNameEl = document.getElementById('user-name');

        if (this.currentUser) {
            if (authSection) authSection.classList.add('hidden');
            if (userSection) userSection.classList.remove('hidden');
            if (streamManagement) streamManagement.classList.remove('hidden');
            
            if (userNameEl) userNameEl.textContent = this.currentUser.username || this.currentUser.email;
            
            // Enable chat
            if (chatInput) {
                chatInput.disabled = false;
                chatInput.placeholder = 'Nhập tin nhắn...';
            }
            if (sendChat) sendChat.disabled = false;
        } else {
            if (authSection) authSection.classList.remove('hidden');
            if (userSection) userSection.classList.add('hidden');
            if (streamManagement) streamManagement.classList.add('hidden');
            
            // Disable chat
            if (chatInput) {
                chatInput.disabled = true;
                chatInput.placeholder = 'Đăng nhập để chat...';
            }
            if (sendChat) sendChat.disabled = true;
        }
    }

    isAuthenticated() {
        const token = localStorage.getItem('idToken'); // Use ID token
        return this.currentUser !== null && token !== null;
    }

    getCurrentUser() {
        return this.currentUser;
    }

    getAuthHeader() {
        const token = localStorage.getItem('idToken'); // Use ID token for API calls
        return token ? { 'Authorization': `Bearer ${token}` } : {};
    }
}

// Initialize auth service
const authService = new AuthService();

// DOM Event Listeners
document.addEventListener('DOMContentLoaded', () => {
    // Modal elements
    const authModal = document.getElementById('auth-modal');
    const closeModal = document.querySelector('.close');
    const loginForm = document.getElementById('login-form');
    const registerForm = document.getElementById('register-form');
    const confirmForm = document.getElementById('confirm-form');

    // Auth buttons (may not exist on all pages like dashboard)
    const loginBtn = document.getElementById('login-btn');
    const registerBtn = document.getElementById('register-btn');
    const logoutBtn = document.getElementById('logout-btn');

    // Form switch links
    const switchToRegister = document.getElementById('switch-to-register');
    const switchToLogin = document.getElementById('switch-to-login');

    // Modal controls
    if (loginBtn) {
        loginBtn.addEventListener('click', () => {
            showLoginForm();
            authModal.classList.remove('hidden');
        });
    }

    if (registerBtn) {
        registerBtn.addEventListener('click', () => {
            showRegisterForm();
            authModal.classList.remove('hidden');
        });
    }

    if (logoutBtn) {
        logoutBtn.addEventListener('click', () => {
            authService.logout();
        });
    }

    if (closeModal) {
        closeModal.addEventListener('click', () => {
            authModal.classList.add('hidden');
        });
    }

    if (switchToRegister) {
        switchToRegister.addEventListener('click', (e) => {
            e.preventDefault();
            showRegisterForm();
        });
    }

    if (switchToLogin) {
        switchToLogin.addEventListener('click', (e) => {
            e.preventDefault();
            showLoginForm();
        });
    }

    // Close modal when clicking outside
    if (authModal) {
        window.addEventListener('click', (e) => {
            if (e.target === authModal) {
                authModal.classList.add('hidden');
            }
        });
    }

    // Form submissions
    const loginFormElement = document.getElementById('login-form-element');
    if (loginFormElement) {
        loginFormElement.addEventListener('submit', async (e) => {
            e.preventDefault();
            
            const email = document.getElementById('login-email').value;
            const password = document.getElementById('login-password').value;

            const result = await authService.login(email, password);
            if (result.success && authModal) {
                authModal.classList.add('hidden');
            }
        });
    }

    const registerFormElement = document.getElementById('register-form-element');
    if (registerFormElement) {
        registerFormElement.addEventListener('submit', async (e) => {
            e.preventDefault();
            
            const username = document.getElementById('register-username').value;
            const email = document.getElementById('register-email').value;
            const password = document.getElementById('register-password').value;

            const result = await authService.register(username, email, password);
            if (result.success) {
                // Auto-login after successful registration
                showToast('Đang tự động đăng nhập...', 'info');
                setTimeout(async () => {
                    const loginResult = await authService.login(email, password);
                    if (loginResult.success) {
                        closeAuthModal();
                    } else {
                        // If auto-login fails, show login form
                        showLoginForm();
                        showToast('Vui lòng đăng nhập với tài khoản vừa tạo', 'info');
                    }
                }, 1000);
            }
        });
    }

    const confirmFormElement = document.getElementById('confirm-form-element');
    if (confirmFormElement) {
        confirmFormElement.addEventListener('submit', async (e) => {
            e.preventDefault();
            
            const username = sessionStorage.getItem('pendingUsername');
            const confirmationCode = document.getElementById('confirm-code').value;

            const result = await authService.confirmRegistration(username, confirmationCode);
            if (result.success) {
                sessionStorage.removeItem('pendingUsername');
                showLoginForm();
            }
        });
    }

    function showLoginForm() {
        if (loginForm) loginForm.classList.remove('hidden');
        if (registerForm) registerForm.classList.add('hidden');
        if (confirmForm) confirmForm.classList.add('hidden');
    }

    function showRegisterForm() {
        if (loginForm) loginForm.classList.add('hidden');
        if (registerForm) registerForm.classList.remove('hidden');
        if (confirmForm) confirmForm.classList.add('hidden');
    }

    function showConfirmForm() {
        if (loginForm) loginForm.classList.add('hidden');
        if (registerForm) registerForm.classList.add('hidden');
        if (confirmForm) confirmForm.classList.remove('hidden');
    }

    function closeAuthModal() {
        if (authModal) {
            authModal.classList.add('hidden');
        }
    }

    function showConfirmForm() {
        if (loginForm) loginForm.classList.add('hidden');
        if (registerForm) registerForm.classList.add('hidden');
        if (confirmForm) confirmForm.classList.remove('hidden');
    }
});