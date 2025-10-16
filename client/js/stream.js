// Stream Management Service
class StreamService {
    constructor() {
        this.player = null;
        this.isLive = false;
        this.viewerCount = 0;
        this.streamData = null;
        this.init();
    }

    async init() {
        this.initPlayer();
        this.setupEventListeners();
        await this.checkStreamStatus();
    }

    initPlayer() {
        const videoElement = document.getElementById('video-player');
        
        if (window.IVSPlayer && window.IVSPlayer.isPlayerSupported()) {
            this.player = window.IVSPlayer.create();
            this.player.attachHTMLVideoElement(videoElement);
            
            // Player event listeners
            this.player.addEventListener(window.IVSPlayer.PlayerState.READY, () => {
                console.log('Player is ready');
            });

            this.player.addEventListener(window.IVSPlayer.PlayerState.PLAYING, () => {
                console.log('Stream is playing');
                this.updateStreamStatus(true);
            });

            this.player.addEventListener(window.IVSPlayer.PlayerState.ENDED, () => {
                console.log('Stream ended');
                this.updateStreamStatus(false);
            });

            this.player.addEventListener(window.IVSPlayer.PlayerEventType.ERROR, (error) => {
                console.error('Player error:', error);
                showToast('Lỗi phát video', 'error');
            });

        } else {
            console.warn('IVS Player not supported, falling back to native video');
            this.setupFallbackPlayer(videoElement);
        }
    }

    setupFallbackPlayer(videoElement) {
        // Fallback cho trình duyệt không hỗ trợ IVS Player
        videoElement.addEventListener('loadstart', () => {
            console.log('Video loading started');
        });

        videoElement.addEventListener('canplay', () => {
            console.log('Video can play');
            this.updateStreamStatus(true);
        });

        videoElement.addEventListener('ended', () => {
            console.log('Video ended');
            this.updateStreamStatus(false);
        });

        videoElement.addEventListener('error', (error) => {
            console.error('Video error:', error);
            this.updateStreamStatus(false);
        });
    }

    setupEventListeners() {
        const startStreamBtn = document.getElementById('start-stream');
        const stopStreamBtn = document.getElementById('stop-stream');
        const copyKeyBtn = document.getElementById('copy-key');

        startStreamBtn.addEventListener('click', () => this.startStream());
        stopStreamBtn.addEventListener('click', () => this.stopStream());
        copyKeyBtn.addEventListener('click', () => this.copyStreamKey());

        // Tự động kiểm tra trạng thái stream
        setInterval(() => {
            if (authService.isAuthenticated()) {
                this.checkStreamStatus();
            }
        }, 30000); // Kiểm tra mỗi 30 giây
    }

    async checkStreamStatus() {
        try {
            const response = await fetch('/api/stream/status', {
                headers: authService.getAuthHeader()
            });

            if (response.ok) {
                const data = await response.json();
                this.streamData = data;
                this.updateUI(data);
                
                // Nếu có playback URL, load stream
                if (data.playbackUrl && !this.isLive) {
                    this.loadStream(data.playbackUrl);
                }
            }
        } catch (error) {
            console.error('Failed to check stream status:', error);
        }
    }

    async startStream() {
        if (!authService.isAuthenticated()) {
            showToast('Vui lòng đăng nhập để bắt đầu stream', 'warning');
            return;
        }

        try {
            showLoading(true);
            
            const response = await fetch('/api/stream/start', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    ...authService.getAuthHeader()
                }
            });

            const result = await response.json();
            
            if (response.ok) {
                this.streamData = result.stream;
                this.updateUI(result.stream);
                showToast('Stream đã được tạo thành công!', 'success');
            } else {
                throw new Error(result.message || 'Không thể tạo stream');
            }
        } catch (error) {
            console.error('Start stream error:', error);
            showToast(error.message, 'error');
        } finally {
            showLoading(false);
        }
    }

    async stopStream() {
        if (!authService.isAuthenticated()) {
            return;
        }

        try {
            showLoading(true);
            
            const response = await fetch('/api/stream/stop', {
                method: 'POST',
                headers: authService.getAuthHeader()
            });

            if (response.ok) {
                this.isLive = false;
                this.updateStreamStatus(false);
                showToast('Stream đã được dừng', 'success');
            } else {
                const result = await response.json();
                throw new Error(result.message || 'Không thể dừng stream');
            }
        } catch (error) {
            console.error('Stop stream error:', error);
            showToast(error.message, 'error');
        } finally {
            showLoading(false);
        }
    }

    loadStream(playbackUrl) {
        if (!playbackUrl) return;

        try {
            if (this.player && this.player.load) {
                this.player.load(playbackUrl);
                this.player.setAutoplay(true);
            } else {
                // Fallback cho native video
                const videoElement = document.getElementById('video-player');
                videoElement.src = playbackUrl;
                videoElement.load();
            }
        } catch (error) {
            console.error('Failed to load stream:', error);
            showToast('Không thể tải stream', 'error');
        }
    }

    updateUI(streamData) {
        const startBtn = document.getElementById('start-stream');
        const stopBtn = document.getElementById('stop-stream');
        const streamKey = document.getElementById('stream-key');
        const streamTitle = document.getElementById('stream-title');

        if (streamData) {
            // Cập nhật stream key
            if (streamData.streamKey) {
                streamKey.value = streamData.streamKey;
            }

            // Cập nhật tiêu đề
            if (streamData.title) {
                streamTitle.textContent = streamData.title;
            }

            // Cập nhật trạng thái buttons
            if (streamData.isLive) {
                startBtn.disabled = true;
                stopBtn.disabled = false;
                this.updateStreamStatus(true);
            } else {
                startBtn.disabled = false;
                stopBtn.disabled = true;
                this.updateStreamStatus(false);
            }

            // Cập nhật viewer count
            if (streamData.viewerCount !== undefined) {
                this.viewerCount = streamData.viewerCount;
                this.updateViewerCount();
            }
        }
    }

    updateStreamStatus(isLive) {
        this.isLive = isLive;
        const statusElement = document.getElementById('stream-status');
        
        if (isLive) {
            statusElement.textContent = 'Live';
            statusElement.className = 'stream-status online';
        } else {
            statusElement.textContent = 'Offline';
            statusElement.className = 'stream-status offline';
        }
    }

    updateViewerCount() {
        const viewerCountElement = document.getElementById('viewer-count');
        viewerCountElement.textContent = `${this.viewerCount} người xem`;
    }

    copyStreamKey() {
        const streamKey = document.getElementById('stream-key');
        
        if (streamKey.value) {
            navigator.clipboard.writeText(streamKey.value).then(() => {
                showToast('Stream key đã được sao chép!', 'success');
            }).catch((error) => {
                console.error('Failed to copy stream key:', error);
                showToast('Không thể sao chép stream key', 'error');
            });
        } else {
            showToast('Không có stream key để sao chép', 'warning');
        }
    }

    // Public methods cho các component khác sử dụng
    getCurrentStreamData() {
        return this.streamData;
    }

    isStreamLive() {
        return this.isLive;
    }

    getViewerCount() {
        return this.viewerCount;
    }
}

// Initialize stream service
const streamService = new StreamService();