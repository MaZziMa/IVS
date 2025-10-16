// Channel page logic

let player = null;
let hls = null;
let channelUsername = null;
let isOwner = false;

// Get username from URL
function getChannelUsernameFromURL() {
    const path = window.location.pathname;
    const username = path.substring(1); // Remove leading slash
    return username || null;
}

// Initialize channel page
async function initChannel() {
    channelUsername = getChannelUsernameFromURL();
    if (!channelUsername) {
        showToast('Invalid channel', 'error');
        window.location.href = '/';
        return;
    }

    // Wait for auth to load
    let retries = 0;
    while (!authService && retries < 10) {
        await new Promise(resolve => setTimeout(resolve, 100));
        retries++;
    }

    // Check if current user is the owner
    if (authService && authService.currentUser) {
        isOwner = authService.currentUser.username === channelUsername;
        console.log('Current user:', authService.currentUser.username, 'Channel:', channelUsername, 'Is owner:', isOwner);
    }

    // Load channel data
    await loadChannelData();

    // Start polling for stream status updates after initial load
    startStatusPolling();
}

function startStatusPolling() {
    // Poll for stream status updates every 10 seconds
    setInterval(async () => {
        try {
            let response;
            
            // Use appropriate endpoint based on ownership
            if (isOwner && authService && authService.isAuthenticated()) {
                // Owner: use /my-stream (Query - fast & consistent)
                response = await fetch('/api/stream/my-stream', {
                    headers: authService.getAuthHeader()
                });
                
                // If 401, fallback to public endpoint
                if (response.status === 401) {
                    console.log('Polling: Token expired, using public endpoint');
                    response = await fetch(`/api/stream/channel/${channelUsername}`);
                }
            } else {
                // Viewer: use /channel/:username (Scan)
                response = await fetch(`/api/stream/channel/${channelUsername}`);
            }
            
            if (response.ok) {
                const data = await response.json();
                
                // Update viewer count
                if (data.viewerCount !== undefined) {
                    const viewerCountEl = document.getElementById('viewer-count');
                    if (viewerCountEl) {
                        viewerCountEl.textContent = `${data.viewerCount} viewers`;
                    }
                }
                
                // Update LIVE badge
                const liveBadge = document.getElementById('live-badge');
                if (liveBadge) {
                    if (data.isLive) {
                        liveBadge.classList.remove('hidden');
                    } else {
                        liveBadge.classList.add('hidden');
                    }
                }
                
                // Update live status and video player
                if (data.isLive && data.playbackUrl) {
                    const videoElement = document.getElementById('video-player');
                    if (videoElement && (!videoElement.src || videoElement.paused)) {
                        loadVideo(data.playbackUrl);
                    }
                } else {
                    // Stream went offline
                    const videoElement = document.getElementById('video-player');
                    if (videoElement && videoElement.src) {
                        videoElement.pause();
                        videoElement.poster = '/img/offline.png';
                    }
                }
            } else if (response.status === 404) {
                // Channel not found yet, this is normal during initial load
                // Don't show error, just skip this poll cycle
                console.log('Channel data not available yet, will retry...');
            } else if (response.status === 401) {
                // Token expired during polling - just skip, don't show error
                console.log('Polling: Unauthorized, skipping cycle');
            }
        } catch (error) {
            // Network error or other issues, just log and continue
            console.warn('Polling error (will retry):', error.message);
        }
    }, 10000); // Poll every 10 seconds
}

async function loadChannelData() {
    try {
        let response;
        
        // If viewing own channel, use /my-stream (faster, uses Query instead of Scan)
        if (isOwner && authService && authService.isAuthenticated()) {
            console.log('Loading own channel via /my-stream');
            response = await fetch('/api/stream/my-stream', {
                headers: authService.getAuthHeader()
            });
            
            // If 401 (token expired), fallback to public endpoint
            if (response.status === 401) {
                console.log('Token expired, falling back to public endpoint');
                showToast('Session expired, loading as viewer...', 'warning');
                response = await fetch(`/api/stream/channel/${channelUsername}`);
            }
        } else {
            // Viewing someone else's channel
            console.log('Loading channel via /channel/:username');
            response = await fetch(`/api/stream/channel/${channelUsername}`);
        }
        
        if (!response.ok) {
            // If channel not found
            if (response.status === 404) {
                if (isOwner && authService && authService.isAuthenticated()) {
                    // Owner visiting their own channel but stream not created yet
                    showToast('Bạn chưa tạo kênh stream. Vui lòng tạo kênh từ trang chủ hoặc Dashboard.', 'warning');
                    setTimeout(() => {
                        window.location.href = '/';
                    }, 2000);
                    return;
                } else {
                    // Viewer trying to access channel - show offline message instead of redirecting
                    console.log('Channel not found or offline for viewer');
                    showToast('Kênh này đang offline hoặc chưa được tạo', 'info');
                    
                    // Display basic channel info for viewer
                    document.getElementById('channel-username').textContent = channelUsername;
                    document.getElementById('stream-title').textContent = 'Channel Offline';
                    document.getElementById('stream-category').textContent = 'Offline';
                    
                    const videoElement = document.getElementById('video-player');
                    if (videoElement) {
                        videoElement.poster = '/img/offline.png';
                    }
                    
                    // Don't redirect viewer - let them stay on the page
                    return;
                }
            }
            
            if (response.status === 401) {
                // Unauthorized - only redirect if owner
                if (isOwner) {
                    showToast('Vui lòng đăng nhập lại', 'error');
                    setTimeout(() => {
                        window.location.href = '/';
                    }, 2000);
                    return;
                } else {
                    // Viewer doesn't need to be authenticated - try again without auth
                    console.log('401 for viewer, retrying without auth');
                    response = await fetch(`/api/stream/channel/${channelUsername}`);
                    if (response.ok) {
                        const data = await response.json();
                        displayChannelData(data);
                        return;
                    }
                }
            }
            
            throw new Error('Channel not found');
        }

        const data = await response.json();
        displayChannelData(data);

    } catch (error) {
        console.error('Failed to load channel:', error);
        showToast(error.message || 'Failed to load channel', 'error');
    }
}

function displayChannelData(data) {
    console.log('Channel data:', data);
    
    // Update UI
    document.getElementById('channel-username').textContent = channelUsername;
    document.getElementById('stream-title').textContent = data.title || 'Live Stream';
    
    if (data.viewerCount !== undefined) {
        const viewerCountEl = document.getElementById('viewer-count');
        if (viewerCountEl) {
            viewerCountEl.innerHTML = `
                <svg width="16" height="16" viewBox="0 0 20 20">
                    <path fill="currentColor" d="M10 10a2 2 0 100-4 2 2 0 000 4zm0 1a7 7 0 00-7 7v1h14v-1a7 7 0 00-7-7z"/>
                </svg>
                ${data.viewerCount} viewers
            `;
        }
    }

    // Update stream info
    currentStreamData = {
        title: data.title || 'Live Stream',
        category: data.category || 'Just Chatting',
        tags: data.tags || [],
        language: data.language || 'vi'
    };
    
    // Update stream info display
    document.getElementById('stream-category').textContent = currentStreamData.category;
    
    const tagsContainer = document.getElementById('stream-tags');
    if (tagsContainer && currentStreamData.tags.length > 0) {
        tagsContainer.innerHTML = currentStreamData.tags.map(tag => 
            `<span class="stream-tag">${tag}</span>`
        ).join('');
    }
    
    // Show edit button for owners
    if (isOwner) {
        const editBtn = document.getElementById('edit-stream-btn');
        if (editBtn) {
            editBtn.classList.remove('hidden');
        }
    }

    // Show/hide live badge
    const liveBadge = document.getElementById('live-badge');
    if (liveBadge) {
        if (data.isLive) {
            liveBadge.classList.remove('hidden');
        } else {
            liveBadge.classList.add('hidden');
        }
    }

    // Load video if live
    if (data.isLive && data.playbackUrl) {
        loadVideo(data.playbackUrl);
    } else {
        const videoElement = document.getElementById('video-player');
        if (videoElement) {
            videoElement.poster = '/img/offline.png';
        }
        showToast('Channel is offline', 'info');
    }

    // Connect to chat if available
    if (data.chatRoomArn && authService && authService.isAuthenticated()) {
        // TODO: Connect to IVS chat
    }
}

function loadVideo(playbackUrl) {
    const videoElement = document.getElementById('video-player');
    
    if (!videoElement) return;

    // Try IVS Player first (best for AWS IVS)
    if (window.IVSPlayer && typeof window.IVSPlayer.isPlayerSupported === 'function' && window.IVSPlayer.isPlayerSupported()) {
        if (player) {
            player.delete();
        }
        
        player = window.IVSPlayer.create();
        player.attachHTMLVideoElement(videoElement);
        
        // Set live configuration for low latency
        player.setAutoplay(true);
        player.setLiveLowLatencyEnabled(true);
        
        // Load and play
        player.load(playbackUrl);
        player.play();
        
        // Event listeners
        player.addEventListener(window.IVSPlayer.PlayerState.PLAYING, () => {
            console.log('Stream is playing');
        });
        
        player.addEventListener(window.IVSPlayer.PlayerState.IDLE, () => {
            console.log('Stream ended or error');
        });
        
        player.addEventListener(window.IVSPlayer.PlayerEventType.ERROR, (error) => {
            console.error('Player error:', error);
        });
        
    } else if (window.Hls && window.Hls.isSupported()) {
        // Fallback to HLS.js
        if (hls) {
            hls.destroy();
        }
        
        hls = new Hls({
            debug: false,
            enableWorker: true,
            lowLatencyMode: true,
            
            // Buffer config for live streaming
            maxBufferLength: 30, // Max buffer 30s (default)
            maxBufferSize: 60 * 1000 * 1000, // 60MB
            maxBufferHole: 0.5, // Skip gaps smaller than 0.5s
            
            // Live sync
            liveSyncDurationCount: 3, // Stay 3 segments behind live edge
            liveMaxLatencyDurationCount: 10, // Max 10 segments behind
            liveDurationInfinity: true, // Treat live as infinite duration
            
            // Playback
            highBufferWatchdogPeriod: 2, // Check buffer every 2s
            nudgeOffset: 0.1, // Small nudge to prevent stalling
            nudgeMaxRetry: 3,
            
            // Fragment loading
            maxMaxBufferLength: 600, // Max 10 min buffer
            startFragPrefetch: true, // Prefetch next fragment
            testBandwidth: true,
            
            // Error handling
            fragLoadingTimeOut: 20000, // 20s timeout
            manifestLoadingTimeOut: 10000, // 10s timeout
            fragLoadingMaxRetry: 6,
            fragLoadingMaxRetryTimeout: 64000,
            levelLoadingMaxRetry: 6,
            levelLoadingMaxRetryTimeout: 64000
        });
        
        hls.loadSource(playbackUrl);
        hls.attachMedia(videoElement);
        
        hls.on(Hls.Events.MANIFEST_PARSED, () => {
            videoElement.play().catch(err => {
                console.log('Autoplay blocked:', err);
                // Show unmute button if needed
                showUnmuteOverlay();
            });
        });
        
        // Handle buffer stall recovery
        hls.on(Hls.Events.ERROR, (event, data) => {
            // Only log fatal errors, ignore non-fatal buffer issues
            if (data.fatal) {
                console.error('HLS fatal error:', data);
                switch (data.type) {
                    case Hls.ErrorTypes.NETWORK_ERROR:
                        console.log('Network error, trying to recover...');
                        hls.startLoad();
                        break;
                    case Hls.ErrorTypes.MEDIA_ERROR:
                        console.log('Media error, trying to recover...');
                        hls.recoverMediaError();
                        break;
                    default:
                        hls.destroy();
                        showToast('Video playback error. Please refresh.', 'error');
                        break;
                }
            } else if (data.details === 'bufferStalledError') {
                // Non-fatal buffer stall - ignore, HLS.js will handle it
                console.log('Buffer stall detected, HLS.js recovering...');
            }
        });
        
        // Monitor buffer health
        let bufferCheckInterval;
        hls.on(Hls.Events.MEDIA_ATTACHED, () => {
            bufferCheckInterval = setInterval(() => {
                if (videoElement.buffered.length > 0) {
                    const bufferEnd = videoElement.buffered.end(videoElement.buffered.length - 1);
                    const currentTime = videoElement.currentTime;
                    const bufferLength = bufferEnd - currentTime;
                    
                    // If buffer is very low and video is paused, try to play
                    if (bufferLength < 0.5 && videoElement.paused && !videoElement.seeking) {
                        console.log('Low buffer, attempting to resume playback...');
                        videoElement.play().catch(() => {});
                    }
                }
            }, 2000);
        });
        
        hls.on(Hls.Events.MEDIA_DETACHED, () => {
            if (bufferCheckInterval) {
                clearInterval(bufferCheckInterval);
            }
        });
        
    } else if (videoElement.canPlayType('application/vnd.apple.mpegurl')) {
        // Native HLS support (Safari)
        videoElement.src = playbackUrl;
        videoElement.load();
        videoElement.play().catch(err => {
            console.log('Autoplay blocked:', err);
            showUnmuteOverlay();
        });
    } else {
        showToast('Browser does not support video playback', 'error');
    }
}

function showUnmuteOverlay() {
    // Show unmute button for autoplay blocked
    const videoElement = document.getElementById('video-player');
    if (videoElement) {
        videoElement.muted = true;
        videoElement.play().then(() => {
            showToast('Video đang phát (muted). Click để bật âm thanh.', 'info');
        });
    }
}

// Stream Info Edit Modal
let currentStreamData = {
    title: '',
    category: 'Just Chatting',
    tags: [],
    language: 'vi'
};

const defaultCategories = [
    'Just Chatting',
    'Music',
    'Art',
    'Gaming',
    'Coding',
    'IRL',
    'Sports',
    'Food & Drink',
    'Science & Technology',
    'Travel & Outdoors'
];

function initStreamInfoModal() {
    const editBtn = document.getElementById('edit-stream-btn');
    const modal = document.getElementById('edit-stream-modal');
    const closeBtn = document.querySelector('.close-broadcast-modal');
    const cancelBtn = document.getElementById('cancel-edit-btn');
    const saveBtn = document.getElementById('save-stream-info-btn');
    
    if (!editBtn || !modal) return;
    
    // Show modal
    editBtn.addEventListener('click', () => {
        // Load current data
        document.getElementById('edit-title').value = currentStreamData.title;
        document.getElementById('edit-category').value = currentStreamData.category;
        document.getElementById('edit-language').value = currentStreamData.language;
        updateTitleCharCount();
        renderSelectedTags();
        modal.classList.remove('hidden');
    });
    
    // Close modal
    const closeModal = () => {
        modal.classList.add('hidden');
    };
    
    closeBtn.addEventListener('click', closeModal);
    cancelBtn.addEventListener('click', closeModal);
    
    // Click outside to close
    modal.addEventListener('click', (e) => {
        if (e.target === modal) {
            closeModal();
        }
    });
    
    // Title character count
    const titleInput = document.getElementById('edit-title');
    titleInput.addEventListener('input', updateTitleCharCount);
    
    // Category autocomplete
    const categoryInput = document.getElementById('edit-category');
    const categoryList = document.getElementById('category-suggestions');
    
    categoryInput.addEventListener('input', (e) => {
        const value = e.target.value.toLowerCase();
        if (value.length === 0) {
            categoryList.classList.add('hidden');
            return;
        }
        
        const matches = defaultCategories.filter(cat => 
            cat.toLowerCase().includes(value)
        );
        
        if (matches.length > 0) {
            categoryList.innerHTML = matches.map(cat => 
                `<div class="category-item" data-category="${cat}">${cat}</div>`
            ).join('');
            categoryList.classList.remove('hidden');
        } else {
            categoryList.classList.add('hidden');
        }
    });
    
    // Category selection
    categoryList.addEventListener('click', (e) => {
        if (e.target.classList.contains('category-item')) {
            const category = e.target.dataset.category;
            categoryInput.value = category;
            categoryList.classList.add('hidden');
        }
    });
    
    // Tags input
    const tagsInput = document.getElementById('edit-tags');
    tagsInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            addTag(tagsInput.value.trim());
            tagsInput.value = '';
        }
    });
    
    // Save changes
    saveBtn.addEventListener('click', async () => {
        const title = document.getElementById('edit-title').value.trim();
        const category = document.getElementById('edit-category').value.trim();
        const language = document.getElementById('edit-language').value;
        
        if (!title) {
            showToast('Title is required', 'error');
            return;
        }
        
        currentStreamData = {
            title,
            category: category || 'Just Chatting',
            tags: currentStreamData.tags,
            language
        };
        
        // Update UI
        updateStreamInfoDisplay();
        
        // Save to server
        await saveStreamInfo();
        
        closeModal();
    });
}

function updateTitleCharCount() {
    const titleInput = document.getElementById('edit-title');
    const charCount = document.getElementById('title-char-count');
    if (titleInput && charCount) {
        charCount.textContent = titleInput.value.length;
    }
}

function addTag(tagText) {
    if (!tagText) return;
    
    // Validate tag
    if (tagText.length > 25) {
        showToast('Tag must be 25 characters or less', 'error');
        return;
    }
    
    if (currentStreamData.tags.length >= 25) {
        showToast('Maximum 25 tags allowed', 'error');
        return;
    }
    
    if (currentStreamData.tags.includes(tagText)) {
        showToast('Tag already added', 'warning');
        return;
    }
    
    currentStreamData.tags.push(tagText);
    renderSelectedTags();
}

function removeTag(tagText) {
    currentStreamData.tags = currentStreamData.tags.filter(t => t !== tagText);
    renderSelectedTags();
}

function renderSelectedTags() {
    const container = document.getElementById('selected-tags');
    const tagCount = document.getElementById('tag-count');
    
    if (!container) return;
    
    container.innerHTML = currentStreamData.tags.map(tag => `
        <div class="tag-item">
            <span>${tag}</span>
            <button onclick="removeTag('${tag}')">&times;</button>
        </div>
    `).join('');
    
    if (tagCount) {
        tagCount.textContent = currentStreamData.tags.length;
    }
}

function updateStreamInfoDisplay() {
    // Update title
    document.getElementById('stream-title').textContent = currentStreamData.title;
    
    // Update category
    document.getElementById('stream-category').textContent = currentStreamData.category;
    
    // Update tags
    const tagsContainer = document.getElementById('stream-tags');
    if (tagsContainer) {
        tagsContainer.innerHTML = currentStreamData.tags.map(tag => 
            `<span class="stream-tag">${tag}</span>`
        ).join('');
    }
}

async function saveStreamInfo() {
    try {
        if (!authService || !authService.isAuthenticated()) {
            showToast('Please login to update stream info', 'error');
            return;
        }
        
        const response = await fetch('/api/stream/update-info', {
            method: 'POST',
            headers: {
                ...authService.getAuthHeader(),
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(currentStreamData)
        });
        
        if (response.ok) {
            showToast('Stream info updated!', 'success');
        } else {
            throw new Error('Failed to update stream info');
        }
    } catch (error) {
        console.error('Save stream info error:', error);
        showToast('Failed to save changes', 'error');
    }
}

// Make removeTag globally accessible
window.removeTag = removeTag;

// Initialize when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        setTimeout(() => {
            initChannel();
            initStreamInfoModal();
        }, 100);
    });
} else {
    setTimeout(() => {
        initChannel();
        initStreamInfoModal();
    }, 100);
}
