// Chat Service
class ChatService {
    constructor() {
        this.messages = [];
        this.websocket = null;
        this.reconnectAttempts = 0;
        this.maxReconnectAttempts = 5;
        this.reconnectDelay = 1000;
        this.init();
    }

    init() {
        this.setupEventListeners();
        this.connectWebSocket();
    }

    setupEventListeners() {
        const chatInput = document.getElementById('chat-input');
        const sendChatBtn = document.getElementById('send-chat');

        // Send message on button click
        sendChatBtn.addEventListener('click', () => {
            this.sendMessage();
        });

        // Send message on Enter key
        chatInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                this.sendMessage();
            }
        });
    }

    connectWebSocket() {
        try {
            // Tạo WebSocket connection
            const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
            const wsUrl = `${protocol}//${window.location.host}/ws/chat`;
            
            this.websocket = new WebSocket(wsUrl);
            
            this.websocket.onopen = () => {
                console.log('WebSocket connected');
                this.reconnectAttempts = 0;
                
                // Authenticate WebSocket connection nếu user đã đăng nhập
                if (authService.isAuthenticated()) {
                    const token = localStorage.getItem('accessToken');
                    this.websocket.send(JSON.stringify({
                        type: 'auth',
                        token: token
                    }));
                }
            };

            this.websocket.onmessage = (event) => {
                try {
                    const data = JSON.parse(event.data);
                    this.handleMessage(data);
                } catch (error) {
                    console.error('Failed to parse WebSocket message:', error);
                }
            };

            this.websocket.onclose = (event) => {
                console.log('WebSocket disconnected:', event.code, event.reason);
                this.attemptReconnect();
            };

            this.websocket.onerror = (error) => {
                console.error('WebSocket error:', error);
            };

        } catch (error) {
            console.error('Failed to create WebSocket connection:', error);
            this.attemptReconnect();
        }
    }

    attemptReconnect() {
        if (this.reconnectAttempts < this.maxReconnectAttempts) {
            this.reconnectAttempts++;
            const delay = this.reconnectDelay * Math.pow(2, this.reconnectAttempts - 1);
            
            console.log(`Attempting to reconnect in ${delay}ms (attempt ${this.reconnectAttempts})`);
            
            setTimeout(() => {
                this.connectWebSocket();
            }, delay);
        } else {
            console.error('Max reconnection attempts reached');
            this.showConnectionError();
        }
    }

    handleMessage(data) {
        switch (data.type) {
            case 'message':
                this.displayMessage(data);
                break;
            case 'userJoined':
                this.displaySystemMessage(`${data.username} đã tham gia chat`);
                break;
            case 'userLeft':
                this.displaySystemMessage(`${data.username} đã rời khỏi chat`);
                break;
            case 'error':
                showToast(data.message, 'error');
                break;
            case 'authSuccess':
                console.log('Chat authentication successful');
                break;
            case 'authFailed':
                console.log('Chat authentication failed');
                break;
            default:
                console.log('Unknown message type:', data.type);
        }
    }

    sendMessage() {
        const chatInput = document.getElementById('chat-input');
        const message = chatInput.value.trim();

        if (!message) return;

        if (!authService.isAuthenticated()) {
            showToast('Vui lòng đăng nhập để gửi tin nhắn', 'warning');
            return;
        }

        if (!this.websocket || this.websocket.readyState !== WebSocket.OPEN) {
            showToast('Không có kết nối chat', 'error');
            return;
        }

        try {
            const messageData = {
                type: 'message',
                message: message,
                timestamp: new Date().toISOString()
            };

            this.websocket.send(JSON.stringify(messageData));
            chatInput.value = '';
            
        } catch (error) {
            console.error('Failed to send message:', error);
            showToast('Không thể gửi tin nhắn', 'error');
        }
    }

    displayMessage(data) {
        const chatMessages = document.getElementById('chat-messages');
        const messageElement = document.createElement('div');
        messageElement.className = 'chat-message';

        const timestamp = new Date(data.timestamp).toLocaleTimeString('vi-VN', {
            hour: '2-digit',
            minute: '2-digit'
        });

        messageElement.innerHTML = `
            <span class="username">${this.escapeHtml(data.username || 'Anonymous')}</span>
            <span class="message-text">${this.escapeHtml(data.message)}</span>
            <span class="timestamp">${timestamp}</span>
        `;

        chatMessages.appendChild(messageElement);
        this.scrollToBottom();

        // Giới hạn số lượng tin nhắn hiển thị
        this.messages.push(data);
        if (this.messages.length > 100) {
            this.messages.shift();
            chatMessages.removeChild(chatMessages.firstChild);
        }
    }

    displaySystemMessage(message) {
        const chatMessages = document.getElementById('chat-messages');
        const messageElement = document.createElement('div');
        messageElement.className = 'chat-message system-message';
        messageElement.innerHTML = `
            <span class="system-text" style="color: #6b7280; font-style: italic;">
                ${this.escapeHtml(message)}
            </span>
        `;

        chatMessages.appendChild(messageElement);
        this.scrollToBottom();
    }

    scrollToBottom() {
        const chatMessages = document.getElementById('chat-messages');
        chatMessages.scrollTop = chatMessages.scrollHeight;
    }

    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    showConnectionError() {
        const chatMessages = document.getElementById('chat-messages');
        const errorElement = document.createElement('div');
        errorElement.className = 'chat-message error-message';
        errorElement.innerHTML = `
            <span style="color: #ef4444; font-weight: 500;">
                ⚠️ Mất kết nối chat. Vui lòng làm mới trang.
            </span>
        `;
        chatMessages.appendChild(errorElement);
        this.scrollToBottom();
    }

    // Reconnect khi user đăng nhập/đăng xuất
    onAuthStateChanged() {
        if (this.websocket && this.websocket.readyState === WebSocket.OPEN) {
            if (authService.isAuthenticated()) {
                const token = localStorage.getItem('accessToken');
                this.websocket.send(JSON.stringify({
                    type: 'auth',
                    token: token
                }));
            } else {
                this.websocket.send(JSON.stringify({
                    type: 'logout'
                }));
            }
        }
    }

    // Public methods
    clearMessages() {
        const chatMessages = document.getElementById('chat-messages');
        chatMessages.innerHTML = '';
        this.messages = [];
    }

    getMessages() {
        return this.messages;
    }

    isConnected() {
        return this.websocket && this.websocket.readyState === WebSocket.OPEN;
    }
}

// Initialize chat service
const chatService = new ChatService();

// Listen for auth state changes
document.addEventListener('authStateChanged', () => {
    chatService.onAuthStateChanged();
});