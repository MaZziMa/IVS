const express = require('express');
const cors = require('cors');
const path = require('path');
require('dotenv').config();

const { router: authRoutes } = require('./routes/auth');
const streamRoutes = require('./routes/stream');
const userRoutes = require('./routes/user');
const chatRoutes = require('./routes/chat');
const { initializeWebSocket } = require('./websocket/chat');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors({
    origin: process.env.FRONTEND_URL || 'http://localhost:3001',
    credentials: true
}));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Static files (serve frontend)
app.use(express.static(path.join(__dirname, '../client')));

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/stream', streamRoutes);
app.use('/api/user', userRoutes);
app.use('/api/chat', chatRoutes);

// Health check endpoint
app.get('/api/health', (req, res) => {
    res.json({
        status: 'OK',
        timestamp: new Date().toISOString(),
        version: process.env.npm_package_version || '1.0.0'
    });
});


// Serve channel.html for /:username (not API, not static file)
app.get('/:username', (req, res, next) => {
    const username = req.params.username;
    // Ignore API and static files
    if (username.startsWith('api') || username.includes('.') || username === 'favicon.ico') {
        return next();
    }
    res.sendFile(path.join(__dirname, '../client/channel.html'));
});

// Serve frontend for all other routes (SPA)
app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, '../client/index.html'));
});

// Error handling middleware
app.use((error, req, res, next) => {
    console.error('Server error:', error);
    
    res.status(error.status || 500).json({
        message: error.message || 'Đã xảy ra lỗi server',
        error: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
});

// 404 handler
app.use((req, res) => {
    res.status(404).json({
        message: 'Không tìm thấy endpoint'
    });
});

// Start server
const server = app.listen(PORT, () => {
    console.log(`🚀 Server running on port ${PORT}`);
    console.log(`📱 Frontend: http://localhost:${PORT}`);
    console.log(`🔧 API: http://localhost:${PORT}/api`);
});

// Initialize WebSocket for chat
initializeWebSocket(server);

// Graceful shutdown
process.on('SIGTERM', () => {
    console.log('SIGTERM received, shutting down gracefully');
    server.close(() => {
        console.log('Server closed');
        process.exit(0);
    });
});

process.on('SIGINT', () => {
    console.log('SIGINT received, shutting down gracefully');
    server.close(() => {
        console.log('Server closed');
        process.exit(0);
    });
});

module.exports = app;