// Authentication Service
class AuthService {
    constructor() {
        this.currentUser = null;
        this.cognitoConfig = {
            region: 'us-east-1', // Sẽ được cấu hình từ server
            userPoolId: '',
            clientId: ''
        };
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
    }

    checkAuthState() {
        const token = localStorage.getItem('accessToken');
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
                showToast('Đăng ký thành công! Vui lòng kiểm tra email để xác nhận.', 'success');
                return { success: true, needConfirmation: true, username };
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
                localStorage.setItem('accessToken', result.tokens.AccessToken);
                localStorage.setItem('refreshToken', result.tokens.RefreshToken);
                localStorage.setItem('currentUser', JSON.stringify(result.user));
                
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
            const token = localStorage.getItem('accessToken');
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
            // Xóa dữ liệu local
            localStorage.removeItem('accessToken');
            localStorage.removeItem('refreshToken');
            localStorage.removeItem('currentUser');
            this.currentUser = null;
            this.updateUI();
            showToast('Đã đăng xuất', 'success');
        }
    }

    updateUI() {
        const authSection = document.getElementById('auth-section');
        const userSection = document.getElementById('user-section');
        const streamManagement = document.getElementById('stream-management');
        const chatInput = document.getElementById('chat-input');
        const sendChat = document.getElementById('send-chat');

        if (this.currentUser) {
            authSection.classList.add('hidden');
            userSection.classList.remove('hidden');
            streamManagement.classList.remove('hidden');
            
            document.getElementById('user-name').textContent = this.currentUser.username || this.currentUser.email;
            
            // Enable chat
            chatInput.disabled = false;
            chatInput.placeholder = 'Nhập tin nhắn...';
            sendChat.disabled = false;
        } else {
            authSection.classList.remove('hidden');
            userSection.classList.add('hidden');
            streamManagement.classList.add('hidden');
            
            // Disable chat
            chatInput.disabled = true;
            chatInput.placeholder = 'Đăng nhập để chat...';
            sendChat.disabled = true;
        }
    }

    isAuthenticated() {
        return this.currentUser !== null;
    }

    getCurrentUser() {
        return this.currentUser;
    }

    getAuthHeader() {
        const token = localStorage.getItem('accessToken');
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

    // Auth buttons
    const loginBtn = document.getElementById('login-btn');
    const registerBtn = document.getElementById('register-btn');
    const logoutBtn = document.getElementById('logout-btn');

    // Form switch links
    const switchToRegister = document.getElementById('switch-to-register');
    const switchToLogin = document.getElementById('switch-to-login');

    // Modal controls
    loginBtn.addEventListener('click', () => {
        showLoginForm();
        authModal.classList.remove('hidden');
    });

    registerBtn.addEventListener('click', () => {
        showRegisterForm();
        authModal.classList.remove('hidden');
    });

    logoutBtn.addEventListener('click', () => {
        authService.logout();
    });

    closeModal.addEventListener('click', () => {
        authModal.classList.add('hidden');
    });

    switchToRegister.addEventListener('click', (e) => {
        e.preventDefault();
        showRegisterForm();
    });

    switchToLogin.addEventListener('click', (e) => {
        e.preventDefault();
        showLoginForm();
    });

    // Close modal when clicking outside
    window.addEventListener('click', (e) => {
        if (e.target === authModal) {
            authModal.classList.add('hidden');
        }
    });

    // Form submissions
    document.getElementById('login-form-element').addEventListener('submit', async (e) => {
        e.preventDefault();
        
        const email = document.getElementById('login-email').value;
        const password = document.getElementById('login-password').value;

        const result = await authService.login(email, password);
        if (result.success) {
            authModal.classList.add('hidden');
        }
    });

    document.getElementById('register-form-element').addEventListener('submit', async (e) => {
        e.preventDefault();
        
        const username = document.getElementById('register-username').value;
        const email = document.getElementById('register-email').value;
        const password = document.getElementById('register-password').value;

        const result = await authService.register(username, email, password);
        if (result.success && result.needConfirmation) {
            // Store username for confirmation
            sessionStorage.setItem('pendingUsername', username);
            showConfirmForm();
        }
    });

    document.getElementById('confirm-form-element').addEventListener('submit', async (e) => {
        e.preventDefault();
        
        const username = sessionStorage.getItem('pendingUsername');
        const confirmationCode = document.getElementById('confirm-code').value;

        const result = await authService.confirmRegistration(username, confirmationCode);
        if (result.success) {
            sessionStorage.removeItem('pendingUsername');
            showLoginForm();
        }
    });

    function showLoginForm() {
        loginForm.classList.remove('hidden');
        registerForm.classList.add('hidden');
        confirmForm.classList.add('hidden');
    }

    function showRegisterForm() {
        loginForm.classList.add('hidden');
        registerForm.classList.remove('hidden');
        confirmForm.classList.add('hidden');
    }

    function showConfirmForm() {
        loginForm.classList.add('hidden');
        registerForm.classList.add('hidden');
        confirmForm.classList.remove('hidden');
    }
});