const WebSocket = require('ws');
const { CognitoJwtVerifier } = require('aws-jwt-verify');

// Initialize JWT verifier for ID tokens (to get preferred_username)
const verifier = CognitoJwtVerifier.create({
    userPoolId: process.env.COGNITO_USER_POOL_ID,
    tokenUse: 'id', // Changed from 'access' to 'id'
    clientId: process.env.COGNITO_CLIENT_ID
});

// Store connected clients
const clients = new Map();
const rooms = new Map(); // channelArn -> Set of client IDs

function initializeWebSocket(server) {
    const wss = new WebSocket.Server({ 
        server,
        path: '/ws/chat'
    });

    wss.on('connection', (ws, req) => {
        const clientId = generateClientId();
        const clientInfo = {
            id: clientId,
            ws: ws,
            user: null,
            room: null,
            joinedAt: new Date().toISOString()
        };

        clients.set(clientId, clientInfo);
        console.log(`Client connected: ${clientId}`);

        // Send welcome message
        ws.send(JSON.stringify({
            type: 'connected',
            clientId: clientId,
            message: 'Kết nối chat thành công'
        }));

        ws.on('message', async (data) => {
            try {
                const message = JSON.parse(data.toString());
                await handleMessage(clientId, message);
            } catch (error) {
                console.error('WebSocket message error:', error);
                sendToClient(clientId, {
                    type: 'error',
                    message: 'Lỗi xử lý tin nhắn'
                });
            }
        });

        ws.on('close', (code, reason) => {
            console.log(`Client disconnected: ${clientId}, code: ${code}, reason: ${reason}`);
            handleClientDisconnect(clientId);
        });

        ws.on('error', (error) => {
            console.error(`WebSocket error for client ${clientId}:`, error);
            handleClientDisconnect(clientId);
        });

        // Ping/Pong for connection health
        ws.on('pong', () => {
            if (clients.has(clientId)) {
                clients.get(clientId).lastPong = Date.now();
            }
        });
    });

    // Ping clients periodically to check connection health
    const pingInterval = setInterval(() => {
        const now = Date.now();
        clients.forEach((client, clientId) => {
            if (client.ws.readyState === WebSocket.OPEN) {
                // Check if client responded to last ping
                if (client.lastPing && now - client.lastPing > 30000 && (!client.lastPong || client.lastPong < client.lastPing)) {
                    console.log(`Client ${clientId} failed ping check, disconnecting`);
                    client.ws.terminate();
                    handleClientDisconnect(clientId);
                } else {
                    client.lastPing = now;
                    client.ws.ping();
                }
            } else {
                handleClientDisconnect(clientId);
            }
        });
    }, 30000);

    // Cleanup on server shutdown
    wss.on('close', () => {
        clearInterval(pingInterval);
    });

    console.log('WebSocket server initialized for chat');
}

async function handleMessage(clientId, message) {
    const client = clients.get(clientId);
    if (!client) return;

    switch (message.type) {
        case 'auth':
            await handleAuth(clientId, message);
            break;
        case 'join':
            await handleJoinRoom(clientId, message);
            break;
        case 'leave':
            handleLeaveRoom(clientId);
            break;
        case 'message':
            await handleChatMessage(clientId, message);
            break;
        case 'logout':
            handleLogout(clientId);
            break;
        default:
            sendToClient(clientId, {
                type: 'error',
                message: 'Loại tin nhắn không hỗ trợ'
            });
    }
}

async function handleAuth(clientId, message) {
    const client = clients.get(clientId);
    if (!client) return;

    console.log(`[AUTH] Received auth request from client ${clientId}`);

    try {
        const { token } = message;
        
        if (!token) {
            console.log(`[AUTH] No token provided by client ${clientId}`);
            sendToClient(clientId, {
                type: 'authFailed',
                message: 'Thiếu token xác thực'
            });
            return;
        }

        console.log(`[AUTH] Verifying token for client ${clientId}...`);
        // Verify JWT token with Cognito
        const payload = await verifier.verify(token);
        
        console.log(`[AUTH] Token verified successfully for client ${clientId}`, payload.sub);
        
        client.user = {
            sub: payload.sub,
            username: payload.preferred_username || payload['cognito:username'] || payload.email,
            email: payload.email,
            emailVerified: payload.email_verified
        };

        sendToClient(clientId, {
            type: 'authSuccess',
            message: 'Xác thực thành công',
            user: {
                username: client.user.username || client.user.email,
                email: client.user.email
            }
        });

        console.log(`Client ${clientId} authenticated as ${client.user.username || client.user.email}`);

    } catch (error) {
        console.error('Auth error:', error);
        sendToClient(clientId, {
            type: 'authFailed',
            message: 'Token không hợp lệ'
        });
    }
}

async function handleJoinRoom(clientId, message) {
    const client = clients.get(clientId);
    if (!client || !client.user) {
        sendToClient(clientId, {
            type: 'error',
            message: 'Vui lòng đăng nhập trước'
        });
        return;
    }

    const { room } = message;
    if (!room) {
        sendToClient(clientId, {
            type: 'error',
            message: 'Thiếu thông tin phòng chat'
        });
        return;
    }

    // Leave current room if any
    if (client.room) {
        handleLeaveRoom(clientId);
    }

    // Join new room
    client.room = room;
    
    if (!rooms.has(room)) {
        rooms.set(room, new Set());
    }
    rooms.get(room).add(clientId);

    // Notify room members
    broadcastToRoom(room, {
        type: 'userJoined',
        username: client.user.username || client.user.email,
        message: `${client.user.username || client.user.email} đã tham gia chat`,
        timestamp: new Date().toISOString()
    }, clientId);

    sendToClient(clientId, {
        type: 'joinedRoom',
        room: room,
        message: `Đã tham gia phòng chat: ${room}`
    });

    console.log(`Client ${clientId} joined room: ${room}`);
}

function handleLeaveRoom(clientId) {
    const client = clients.get(clientId);
    if (!client || !client.room) return;

    const room = client.room;
    const roomClients = rooms.get(room);
    
    if (roomClients) {
        roomClients.delete(clientId);
        
        // Notify remaining room members
        if (client.user) {
            broadcastToRoom(room, {
                type: 'userLeft',
                username: client.user.username || client.user.email,
                message: `${client.user.username || client.user.email} đã rời khỏi chat`,
                timestamp: new Date().toISOString()
            }, clientId);
        }

        // Remove room if empty
        if (roomClients.size === 0) {
            rooms.delete(room);
        }
    }

    client.room = null;
    console.log(`Client ${clientId} left room: ${room}`);
}

async function handleChatMessage(clientId, message) {
    const client = clients.get(clientId);
    if (!client || !client.user) {
        sendToClient(clientId, {
            type: 'error',
            message: 'Vui lòng đăng nhập để gửi tin nhắn'
        });
        return;
    }

    if (!client.room) {
        sendToClient(clientId, {
            type: 'error',
            message: 'Vui lòng tham gia phòng chat'
        });
        return;
    }

    const { message: messageText } = message;
    if (!messageText || messageText.trim().length === 0) {
        sendToClient(clientId, {
            type: 'error',
            message: 'Tin nhắn không được để trống'
        });
        return;
    }

    // Check message length
    if (messageText.length > 500) {
        sendToClient(clientId, {
            type: 'error',
            message: 'Tin nhắn quá dài (tối đa 500 ký tự)'
        });
        return;
    }

    // Create chat message
    const chatMessage = {
        type: 'message',
        id: generateMessageId(),
        username: client.user.username || client.user.email,
        message: messageText.trim(),
        timestamp: new Date().toISOString(),
        room: client.room
    };

    // Broadcast to all clients in the room
    broadcastToRoom(client.room, chatMessage);

    console.log(`Chat message from ${client.user.username || client.user.email} in ${client.room}: ${messageText}`);
}

function handleLogout(clientId) {
    const client = clients.get(clientId);
    if (!client) return;

    // Leave room if in one
    if (client.room) {
        handleLeaveRoom(clientId);
    }

    // Clear user info
    client.user = null;

    sendToClient(clientId, {
        type: 'loggedOut',
        message: 'Đã đăng xuất khỏi chat'
    });

    console.log(`Client ${clientId} logged out from chat`);
}

function handleClientDisconnect(clientId) {
    const client = clients.get(clientId);
    if (!client) return;

    // Leave room if in one
    if (client.room) {
        handleLeaveRoom(clientId);
    }

    // Remove client
    clients.delete(clientId);
    console.log(`Client ${clientId} cleaned up`);
}

function sendToClient(clientId, message) {
    const client = clients.get(clientId);
    if (client && client.ws.readyState === WebSocket.OPEN) {
        try {
            client.ws.send(JSON.stringify(message));
        } catch (error) {
            console.error(`Failed to send message to client ${clientId}:`, error);
            handleClientDisconnect(clientId);
        }
    }
}

function broadcastToRoom(room, message, excludeClientId = null) {
    const roomClients = rooms.get(room);
    if (!roomClients) return;

    roomClients.forEach(clientId => {
        if (clientId !== excludeClientId) {
            sendToClient(clientId, message);
        }
    });
}

function generateClientId() {
    return 'client_' + Math.random().toString(36).substr(2, 9) + '_' + Date.now();
}

function generateMessageId() {
    return 'msg_' + Math.random().toString(36).substr(2, 9) + '_' + Date.now();
}

// Get connected clients count for a room
function getRoomStats(room) {
    const roomClients = rooms.get(room);
    return {
        room: room,
        clientCount: roomClients ? roomClients.size : 0,
        clients: roomClients ? Array.from(roomClients).map(id => {
            const client = clients.get(id);
            return {
                id: id,
                username: client?.user?.username || client?.user?.email || 'Anonymous',
                joinedAt: client?.joinedAt
            };
        }) : []
    };
}

// Get all rooms stats
function getAllRoomsStats() {
    const stats = [];
    rooms.forEach((clients, room) => {
        stats.push(getRoomStats(room));
    });
    return stats;
}

module.exports = {
    initializeWebSocket,
    getRoomStats,
    getAllRoomsStats,
    broadcastToRoom
};