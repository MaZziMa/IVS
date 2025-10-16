const express = require('express');
const { IvschatClient, CreateChatTokenCommand } = require('@aws-sdk/client-ivschat');
const { authenticateToken } = require('./auth');

const router = express.Router();

// Initialize IVS Chat client
const ivsChatClient = new IvschatClient({
    region: process.env.AWS_REGION || 'us-east-1'
});

// Get chat token for authenticated user
router.post('/token', authenticateToken, async (req, res) => {
    try {
        const { roomIdentifier } = req.body;
        const userId = req.user.sub;
        const username = req.user.username || req.user.email;

        if (!roomIdentifier) {
            return res.status(400).json({
                message: 'Room identifier is required'
            });
        }

        // Create chat token
        const command = new CreateChatTokenCommand({
            roomIdentifier: roomIdentifier,
            userId: userId,
            attributes: {
                username: username
            },
            capabilities: ['SEND_MESSAGE', 'DELETE_MESSAGE']
        });

        const response = await ivsChatClient.send(command);

        res.json({
            token: response.token,
            sessionExpirationTime: response.sessionExpirationTime,
            tokenExpirationTime: response.tokenExpirationTime
        });

    } catch (error) {
        console.error('Create chat token error:', error);
        res.status(500).json({
            message: 'Không thể tạo chat token',
            error: error.message
        });
    }
});

module.exports = router;
