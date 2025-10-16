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
        
        // Chỉ check stream status nếu đã đăng nhập
        if (authService && authService.isAuthenticated()) {
            await this.checkStreamStatus();
        }
    }

    initPlayer() {
        const videoElement = document.getElementById('video-player');
        
        if (
            window.IVSPlayer &&
            typeof window.IVSPlayer.isPlayerSupported === 'function' &&
            window.IVSPlayer.isPlayerSupported()
        ) {
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
        // Fallback: Sử dụng HLS.js nếu có
        console.log('Setting up fallback player');
        
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
            // Chỉ log error, không hiển thị toast vì có thể là do chưa có stream
            console.log('Video playback error (stream may not be live yet):', error);
        });
    }

    setupEventListeners() {
        const startStreamBtn = document.getElementById('start-stream');
        const stopStreamBtn = document.getElementById('stop-stream');
        const copyKeyBtn = document.getElementById('copy-key');
        const playBtn = document.getElementById('play-btn');
        const pauseBtn = document.getElementById('pause-btn');
        const videoElement = document.getElementById('video-player');

        startStreamBtn.addEventListener('click', () => this.startStream());
        stopStreamBtn.addEventListener('click', () => this.stopStream());
        copyKeyBtn.addEventListener('click', () => this.copyStreamKey());

        // Play/Pause controls
        if (playBtn && pauseBtn && videoElement) {
            playBtn.addEventListener('click', () => {
                // Nếu có buffered, tua đến cuối để giảm delay
                if (videoElement.buffered && videoElement.buffered.length > 0) {
                    const latest = videoElement.buffered.end(videoElement.buffered.length - 1);
                    videoElement.currentTime = latest;
                }
                videoElement.play();
            });
            pauseBtn.addEventListener('click', () => {
                videoElement.pause();
            });
        }

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
                
                // Load stream khi đang live (bỏ kiểm tra !this.isLive)
                if (data.playbackUrl && data.isLive) {
                    console.log('Loading stream from checkStreamStatus:', data.playbackUrl);
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
            console.log('loadStream called with URL:', playbackUrl);
            
            if (this.player && this.player.load) {
                console.log('Using IVS Player');
                this.player.load(playbackUrl);
                this.player.setAutoplay(true);
                this.player.play();
            } else {
                // Fallback: Sử dụng HLS.js nếu có
                const videoElement = document.getElementById('video-player');
                
                if (window.Hls && Hls.isSupported()) {
                    console.log('Using HLS.js');
                    
                    // Destroy existing HLS instance if any
                    if (this.hls) {
                        this.hls.destroy();
                    }
                    
                    this.hls = new Hls({
                        enableWorker: true,
                        lowLatencyMode: true
                    });
                    
                    this.hls.loadSource(playbackUrl);
                    this.hls.attachMedia(videoElement);
                    
                    this.hls.on(Hls.Events.MANIFEST_PARSED, () => {
                        console.log('HLS manifest parsed, starting playback');
                        videoElement.play().catch(err => {
                            console.log('Autoplay blocked, user interaction required:', err);
                        });
                    });
                    
                    this.hls.on(Hls.Events.ERROR, (event, data) => {
                        console.error('HLS error:', data);
                        // Nếu lỗi bufferStalledError, tua về cuối stream
                        if (data.details === 'bufferStalledError') {
                            const videoElement = document.getElementById('video-player');
                            if (videoElement.buffered && videoElement.buffered.length > 0) {
                                const latest = videoElement.buffered.end(videoElement.buffered.length - 1);
                                videoElement.currentTime = latest;
                                videoElement.play();
                                console.log('Auto seek to live edge due to bufferStalledError:', latest);
                            }
                        }
                        if (data.fatal) {
                            switch (data.type) {
                                case Hls.ErrorTypes.NETWORK_ERROR:
                                    console.error('Fatal network error, trying to recover');
                                    this.hls.startLoad();
                                    break;
                                case Hls.ErrorTypes.MEDIA_ERROR:
                                    console.error('Fatal media error, trying to recover');
                                    this.hls.recoverMediaError();
                                    break;
                                default:
                                    console.error('Fatal error, cannot recover');
                                    this.hls.destroy();
                                    break;
                            }
                        }
                    });
                } else if (videoElement.canPlayType('application/vnd.apple.mpegurl')) {
                    // Native HLS support (Safari)
                    console.log('Using native HLS support');
                    videoElement.src = playbackUrl;
                    videoElement.load();
                    videoElement.play().catch(err => {
                        console.log('Autoplay blocked, user interaction required:', err);
                    });
                } else {
                    console.error('No HLS support available');
                    showToast('Trình duyệt không hỗ trợ phát video này', 'error');
                }
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
    const ingestServer = document.getElementById('ingest-server');
    const copyIngestBtn = document.getElementById('copy-ingest');

        if (streamData) {
            // Cập nhật stream key
            if (streamData.streamKey) {
                streamKey.value = streamData.streamKey;
            }

            // Cập nhật ingest server cho OBS (IVS sử dụng RTMPS với port 443)
            if (streamData.ingestEndpoint) {
                ingestServer.value = `rtmps://${streamData.ingestEndpoint}:443/app/`;
            } else {
                ingestServer.value = '';
            }

            // Cập nhật tiêu đề
            if (streamData.title) {
                streamTitle.textContent = streamData.title;
            }

            // Sự kiện copy ingest server
            if (copyIngestBtn) {
                copyIngestBtn.onclick = () => {
                    if (ingestServer.value) {
                        navigator.clipboard.writeText(ingestServer.value).then(() => {
                            showToast('Ingest server đã được sao chép!', 'success');
                        }).catch((error) => {
                            showToast('Không thể sao chép ingest server', 'error');
                        });
                    } else {
                        showToast('Không có ingest server để sao chép', 'warning');
                    }
                };
            }

            // Cập nhật trạng thái buttons
            if (streamData.isLive) {
                startBtn.disabled = true;
                stopBtn.disabled = false;
                this.updateStreamStatus(true);
                
                // Load stream khi đang live (bỏ kiểm tra !this.isLive)
                if (streamData.playbackUrl) {
                    console.log('Loading stream from updateUI:', streamData.playbackUrl);
                    this.loadStream(streamData.playbackUrl);
                }
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

// Initialize stream service after DOM and IVS Player are ready
let streamService;

function initStreamService() {
    if (!streamService) {
        streamService = new StreamService();
    }
}

// Wait for DOM and IVS Player script to be ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        // Give IVS Player script time to load
        setTimeout(initStreamService, 100);
    });
} else {
    // DOM already loaded, init immediately
    setTimeout(initStreamService, 100);
}