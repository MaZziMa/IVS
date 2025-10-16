const express = require('express');
const { DynamoDBClient } = require('@aws-sdk/client-dynamodb');
const { DynamoDBDocumentClient, GetCommand, UpdateCommand, QueryCommand } = require('@aws-sdk/lib-dynamodb');
const { authenticateToken } = require('./auth');

const router = express.Router();

// Initialize DynamoDB client
const ddbClient = new DynamoDBClient({
    region: process.env.AWS_REGION || 'us-east-1'
});
const docClient = DynamoDBDocumentClient.from(ddbClient);

const USERS_TABLE = process.env.DYNAMODB_USERS_TABLE || 'ivs_users';
const STREAMS_TABLE = process.env.DYNAMODB_STREAMS_TABLE || 'ivs_streams';

// Get user profile
router.get('/profile', authenticateToken, async (req, res) => {
    try {
        const userId = req.user.sub;

        // Get user profile from DynamoDB
        const getParams = {
            TableName: USERS_TABLE,
            Key: {
                userId: userId
            }
        };

        const result = await docClient.send(new GetCommand(getParams));
        
        let userProfile;
        if (result.Item) {
            userProfile = result.Item;
        } else {
            // Create new user profile
            userProfile = {
                userId: userId,
                username: req.user.username || req.user.email,
                email: req.user.email,
                displayName: req.user.username || req.user.email,
                createdAt: new Date().toISOString(),
                lastLogin: new Date().toISOString(),
                streamCount: 0,
                totalViewers: 0,
                settings: {
                    notifications: true,
                    publicProfile: true
                }
            };

            // Save to DynamoDB
            const putParams = {
                TableName: USERS_TABLE,
                Item: userProfile
            };

            await docClient.send(new UpdateCommand({
                TableName: USERS_TABLE,
                Key: { userId: userId },
                UpdateExpression: 'SET username = :username, email = :email, displayName = :displayName, createdAt = :createdAt, lastLogin = :lastLogin, streamCount = :streamCount, totalViewers = :totalViewers, settings = :settings',
                ExpressionAttributeValues: {
                    ':username': userProfile.username,
                    ':email': userProfile.email,
                    ':displayName': userProfile.displayName,
                    ':createdAt': userProfile.createdAt,
                    ':lastLogin': userProfile.lastLogin,
                    ':streamCount': userProfile.streamCount,
                    ':totalViewers': userProfile.totalViewers,
                    ':settings': userProfile.settings
                }
            }));
        }

        // Update last login
        const updateParams = {
            TableName: USERS_TABLE,
            Key: {
                userId: userId
            },
            UpdateExpression: 'SET lastLogin = :lastLogin',
            ExpressionAttributeValues: {
                ':lastLogin': new Date().toISOString()
            }
        };

        await docClient.send(new UpdateCommand(updateParams));

        res.json({
            profile: userProfile
        });

    } catch (error) {
        console.error('Get profile error:', error);
        res.status(500).json({
            message: 'Không thể lấy thông tin profile'
        });
    }
});

// Update user profile
router.put('/profile', authenticateToken, async (req, res) => {
    try {
        const userId = req.user.sub;
        const { displayName, settings } = req.body;

        const updateExpression = [];
        const expressionAttributeValues = {};

        if (displayName) {
            updateExpression.push('displayName = :displayName');
            expressionAttributeValues[':displayName'] = displayName;
        }

        if (settings) {
            updateExpression.push('settings = :settings');
            expressionAttributeValues[':settings'] = settings;
        }

        if (updateExpression.length === 0) {
            return res.status(400).json({
                message: 'Không có thông tin để cập nhật'
            });
        }

        updateExpression.push('lastUpdated = :lastUpdated');
        expressionAttributeValues[':lastUpdated'] = new Date().toISOString();

        const updateParams = {
            TableName: USERS_TABLE,
            Key: {
                userId: userId
            },
            UpdateExpression: 'SET ' + updateExpression.join(', '),
            ExpressionAttributeValues: expressionAttributeValues,
            ReturnValues: 'ALL_NEW'
        };

        const result = await docClient.send(new UpdateCommand(updateParams));

        res.json({
            message: 'Cập nhật profile thành công',
            profile: result.Attributes
        });

    } catch (error) {
        console.error('Update profile error:', error);
        res.status(500).json({
            message: 'Không thể cập nhật profile'
        });
    }
});

// Get user's streams
router.get('/streams', authenticateToken, async (req, res) => {
    try {
        const userId = req.user.sub;

        // Query user's streams from DynamoDB
        const queryParams = {
            TableName: STREAMS_TABLE,
            KeyConditionExpression: 'userId = :userId',
            ExpressionAttributeValues: {
                ':userId': userId
            },
            ScanIndexForward: false // Sort by sort key descending
        };

        const result = await docClient.send(new QueryCommand(queryParams));
        const streams = result.Items || [];

        res.json({
            streams: streams
        });

    } catch (error) {
        console.error('Get user streams error:', error);
        res.status(500).json({
            message: 'Không thể lấy danh sách stream'
        });
    }
});

// Get user statistics
router.get('/stats', authenticateToken, async (req, res) => {
    try {
        const userId = req.user.sub;

        // Get user profile
        const profileParams = {
            TableName: USERS_TABLE,
            Key: {
                userId: userId
            }
        };

        const profileResult = await docClient.send(new GetCommand(profileParams));
        const profile = profileResult.Item || {};

        // Get user's streams
        const streamsParams = {
            TableName: STREAMS_TABLE,
            KeyConditionExpression: 'userId = :userId',
            ExpressionAttributeValues: {
                ':userId': userId
            }
        };

        const streamsResult = await docClient.send(new QueryCommand(streamsParams));
        const streams = streamsResult.Items || [];

        // Calculate statistics
        const totalStreams = streams.length;
        const totalViewers = streams.reduce((sum, stream) => sum + (stream.viewerCount || 0), 0);
        const averageViewers = totalStreams > 0 ? Math.round(totalViewers / totalStreams) : 0;
        const activeStreams = streams.filter(stream => stream.isLive).length;

        // Recent activity
        const recentStreams = streams
            .sort((a, b) => new Date(b.lastUpdated) - new Date(a.lastUpdated))
            .slice(0, 5);

        const stats = {
            totalStreams,
            totalViewers,
            averageViewers,
            activeStreams,
            recentStreams,
            memberSince: profile.createdAt,
            lastActive: profile.lastLogin
        };

        res.json({
            stats: stats
        });

    } catch (error) {
        console.error('Get user stats error:', error);
        res.status(500).json({
            message: 'Không thể lấy thống kê'
        });
    }
});

// Delete user account (soft delete)
router.delete('/account', authenticateToken, async (req, res) => {
    try {
        const userId = req.user.sub;

        // Mark user as deleted instead of actually deleting
        const updateParams = {
            TableName: USERS_TABLE,
            Key: {
                userId: userId
            },
            UpdateExpression: 'SET isDeleted = :isDeleted, deletedAt = :deletedAt',
            ExpressionAttributeValues: {
                ':isDeleted': true,
                ':deletedAt': new Date().toISOString()
            }
        };

        await docClient.send(new UpdateCommand(updateParams));

        // Mark user's streams as inactive
        const streamsParams = {
            TableName: STREAMS_TABLE,
            KeyConditionExpression: 'userId = :userId',
            ExpressionAttributeValues: {
                ':userId': userId
            }
        };

        const streamsResult = await docClient.send(new QueryCommand(streamsParams));
        const streams = streamsResult.Items || [];

        // Update each stream
        for (const stream of streams) {
            const updateStreamParams = {
                TableName: STREAMS_TABLE,
                Key: {
                    userId: userId,
                    createdAt: stream.createdAt
                },
                UpdateExpression: 'SET isActive = :isActive, isLive = :isLive',
                ExpressionAttributeValues: {
                    ':isActive': false,
                    ':isLive': false
                }
            };

            await docClient.send(new UpdateCommand(updateStreamParams));
        }

        res.json({
            message: 'Tài khoản đã được xóa thành công'
        });

    } catch (error) {
        console.error('Delete account error:', error);
        res.status(500).json({
            message: 'Không thể xóa tài khoản'
        });
    }
});

module.exports = router;