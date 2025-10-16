// home.js - Load live streamers for homepage

async function loadLiveList() {
    const listDiv = document.getElementById('live-list');
    const sidebarList = document.getElementById('sidebar-list');
    
    listDiv.innerHTML = '<div>Đang tải danh sách streamer...</div>';
    if (sidebarList) sidebarList.innerHTML = '';
    
    try {
        const res = await fetch('/api/stream/live');
        const data = await res.json();
        if (!data.streams || data.streams.length === 0) {
            listDiv.innerHTML = '<div>Không có streamer nào đang phát trực tiếp.</div>';
            if (sidebarList) {
                sidebarList.innerHTML = '<li style="padding:1rem;color:#9ca3af;text-align:center;">Không có kênh nào đang live</li>';
            }
            return;
        }
        listDiv.innerHTML = '';
        
        // Populate main grid
        data.streams.forEach(stream => {
            const el = document.createElement('div');
            el.className = 'live-stream-item';
            el.innerHTML = `
                <a href="/${stream.userName}" class="live-link">
                    <div class="live-thumb">
                        <img src="/img/default-avatar.png" alt="avatar" />
                        <span class="live-badge">LIVE</span>
                    </div>
                    <div class="live-info">
                        <div class="live-title">${stream.title || 'Live Stream'}</div>
                        <div class="live-user">${stream.userName}</div>
                        <div class="live-viewers">${stream.viewerCount} viewers</div>
                    </div>
                </a>
            `;
            listDiv.appendChild(el);
        });
        
        // Populate sidebar with live channels
        if (sidebarList) {
            data.streams.forEach(stream => {
                const li = document.createElement('li');
                li.className = 'sidebar-channel';
                li.innerHTML = `
                    <span class="dot-live"></span> 
                    <a href="/${stream.userName}" style="color:inherit;text-decoration:none;flex:1;">${stream.userName}</a> 
                    <span class="sidebar-viewers">${stream.viewerCount}</span>
                `;
                sidebarList.appendChild(li);
            });
        }

// Add live badge style
const style = document.createElement('style');
style.innerHTML = `
.live-badge {
    position: absolute;
    top: 10px;
    left: 10px;
    background: #ef4444;
    color: #fff;
    font-size: 0.85em;
    font-weight: bold;
    padding: 2px 8px;
    border-radius: 6px;
    letter-spacing: 1px;
    z-index: 2;
}
`;
document.head.appendChild(style);
    } catch (err) {
        listDiv.innerHTML = '<div>Lỗi tải danh sách streamer.</div>';
        console.error('Failed to load live list:', err);
    }
}

window.addEventListener('DOMContentLoaded', loadLiveList);
