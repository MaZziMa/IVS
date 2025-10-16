const express = require('express');
const { IVSClient, CreateChannelCommand, GetChannelCommand, StopStreamCommand, GetStreamCommand, ListStreamsCommand } = require('@aws-sdk/client-ivs');
const { DynamoDBClient } = require('@aws-sdk/client-dynamodb');
const { DynamoDBDocumentClient, PutCommand, GetCommand, UpdateCommand, QueryCommand } = require('@aws-sdk/lib-dynamodb');
const { authenticateToken } = require('./auth');

const router = express.Router();

// Initialize AWS clients
const ivsClient = new IVSClient({
    region: process.env.AWS_REGION || 'us-east-1'
});

const ddbClient = new DynamoDBClient({
    region: process.env.AWS_REGION || 'us-east-1'
});
const docClient = DynamoDBDocumentClient.from(ddbClient);

const STREAMS_TABLE = process.env.DYNAMODB_STREAMS_TABLE || 'ivs_streams';

// Get stream status
router.get('/status', authenticateToken, async (req, res) => {
    try {
        const userId = req.user.sub;

        // Get user's stream from DynamoDB
        const getParams = {
            TableName: STREAMS_TABLE,
            Key: {
                userId: userId
            }
        };

        const result = await docClient.send(new GetCommand(getParams));
        
        if (!result.Item) {
            return res.json({
                hasStream: false,
                message: 'Chưa có stream nào được tạo'
            });
        }

        const streamData = result.Item;

        // Check current stream status from IVS
        try {
            const channelParams = {
                arn: streamData.channelArn
            };

            const channelResult = await ivsClient.send(new GetChannelCommand(channelParams));
            const channel = channelResult.channel;

            // Get current stream info
            let streamInfo = null;
            try {
                const streamParams = {
                    channelArn: streamData.channelArn
                };
                const streamResult = await ivsClient.send(new GetStreamCommand(streamParams));
                streamInfo = streamResult.stream;
            } catch (streamError) {
                // No active stream
                streamInfo = null;
            }

            const response = {
                hasStream: true,
                channelArn: streamData.channelArn,
                streamKey: streamData.streamKey,
                playbackUrl: channel.playbackUrl,
                ingestEndpoint: channel.ingestEndpoint,
                isLive: streamInfo && streamInfo.state === 'LIVE',
                streamInfo: streamInfo,
                title: streamData.title || 'Live Stream',
                viewerCount: streamInfo ? streamInfo.viewerCount || 0 : 0,
                createdAt: streamData.createdAt,
                lastUpdated: new Date().toISOString()
            };

            // Update stream status in DynamoDB
            const updateParams = {
                TableName: STREAMS_TABLE,
                Key: {
                    userId: userId
                },
                UpdateExpression: 'SET isLive = :isLive, lastChecked = :lastChecked, viewerCount = :viewerCount',
                ExpressionAttributeValues: {
                    ':isLive': response.isLive,
                    ':lastChecked': response.lastUpdated,
                    ':viewerCount': response.viewerCount
                }
            };

            await docClient.send(new UpdateCommand(updateParams));

            res.json(response);

        } catch (ivsError) {
            console.error('IVS API error:', ivsError);
            res.status(500).json({
                message: 'Không thể kiểm tra trạng thái stream từ AWS IVS'
            });
        }

    } catch (error) {
        console.error('Stream status error:', error);
        res.status(500).json({
            message: 'Lỗi khi kiểm tra trạng thái stream'
        });
    }
});

// Start/Create stream
router.post('/start', authenticateToken, async (req, res) => {
    try {
        const userId = req.user.sub;
        const { title = 'Live Stream' } = req.body;

        // Check if user already has a stream
        const getParams = {
            TableName: STREAMS_TABLE,
            Key: {
                userId: userId
            }
        };

        const existingResult = await docClient.send(new GetCommand(getParams));
        
        if (existingResult.Item) {
            // User already has a stream, return existing data
            const streamData = existingResult.Item;
            
            // Get channel info from IVS
            const channelParams = {
                arn: streamData.channelArn
            };

            const channelResult = await ivsClient.send(new GetChannelCommand(channelParams));
            const channel = channelResult.channel;

            return res.json({
                message: 'Stream đã tồn tại',
                stream: {
                    channelArn: streamData.channelArn,
                    streamKey: streamData.streamKey,
                    playbackUrl: channel.playbackUrl,
                    ingestEndpoint: channel.ingestEndpoint,
                    title: streamData.title,
                    isLive: false
                }
            });
        }

        // Create new IVS channel
        const createChannelParams = {
            name: `${req.user.username || req.user.email}-channel-${Date.now()}`,
            type: 'STANDARD',
            latencyMode: 'LOW',
            recordingConfigurationArn: undefined // Có thể config recording sau
        };

        const channelResult = await ivsClient.send(new CreateChannelCommand(createChannelParams));
        const { channel, streamKey } = channelResult;

        // Save stream data to DynamoDB
        const streamData = {
            userId: userId,
            channelArn: channel.arn,
            streamKey: streamKey.value,
            playbackUrl: channel.playbackUrl,
            ingestEndpoint: channel.ingestEndpoint,
            title: title,
            isLive: false,
            createdAt: new Date().toISOString(),
            lastUpdated: new Date().toISOString(),
            viewerCount: 0,
            userName: req.user.username || req.user.email
        };

        const putParams = {
            TableName: STREAMS_TABLE,
            Item: streamData
        };

        await docClient.send(new PutCommand(putParams));

        res.json({
            message: 'Stream đã được tạo thành công',
            stream: {
                channelArn: channel.arn,
                streamKey: streamKey.value,
                playbackUrl: channel.playbackUrl,
                ingestEndpoint: channel.ingestEndpoint,
                title: title,
                isLive: false
            }
        });

    } catch (error) {
        console.error('Start stream error:', error);
        
        let message = 'Không thể tạo stream';
        if (error.name === 'LimitExceededException') {
            message = 'Đã đạt giới hạn số lượng channel';
        } else if (error.name === 'ValidationException') {
            message = 'Thông tin không hợp lệ';
        }

        res.status(500).json({ message });
    }
});

// Stop stream
router.post('/stop', authenticateToken, async (req, res) => {
    try {
        const userId = req.user.sub;

        // Get user's stream from DynamoDB
        const getParams = {
            TableName: STREAMS_TABLE,
            Key: {
                userId: userId
            }
        };

        const result = await docClient.send(new GetCommand(getParams));
        
        if (!result.Item) {
            return res.status(404).json({
                message: 'Không tìm thấy stream'
            });
        }

        const streamData = result.Item;

        // Stop stream on IVS
        const stopParams = {
            channelArn: streamData.channelArn
        };

        try {
            await ivsClient.send(new StopStreamCommand(stopParams));
        } catch (ivsError) {
            // Stream might already be stopped
            console.log('Stream already stopped or not active:', ivsError.message);
        }

        // Update status in DynamoDB
        const updateParams = {
            TableName: STREAMS_TABLE,
            Key: {
                userId: userId
            },
            UpdateExpression: 'SET isLive = :isLive, lastUpdated = :lastUpdated, viewerCount = :viewerCount',
            ExpressionAttributeValues: {
                ':isLive': false,
                ':lastUpdated': new Date().toISOString(),
                ':viewerCount': 0
            }
        };

        await docClient.send(new UpdateCommand(updateParams));

        res.json({
            message: 'Stream đã được dừng'
        });

    } catch (error) {
        console.error('Stop stream error:', error);
        res.status(500).json({
            message: 'Không thể dừng stream'
        });
    }
});

// Get viewer count (public endpoint)
router.get('/viewers', async (req, res) => {
    try {
        const { channelArn } = req.query;

        if (!channelArn) {
            return res.status(400).json({
                message: 'Thiếu channel ARN'
            });
        }

        // Get stream info from IVS
        const streamParams = {
            channelArn: channelArn
        };

        try {
            const streamResult = await ivsClient.send(new GetStreamCommand(streamParams));
            const stream = streamResult.stream;

            res.json({
                viewerCount: stream.viewerCount || 0,
                isLive: stream.state === 'LIVE'
            });

        } catch (ivsError) {
            // No active stream
            res.json({
                viewerCount: 0,
                isLive: false
            });
        }

    } catch (error) {
        console.error('Get viewers error:', error);
        res.status(500).json({
            message: 'Không thể lấy thông tin viewer'
        });
    }
});

// List all active streams (public endpoint)
router.get('/list', async (req, res) => {
    try {
        const { limit = 20, nextToken } = req.query;

        // Get active streams from IVS
        const listParams = {
            maxResults: parseInt(limit),
            nextToken: nextToken || undefined,
            filterBy: {
                health: 'HEALTHY'
            }
        };

        const streamsResult = await ivsClient.send(new ListStreamsCommand(listParams));
        const streams = streamsResult.streams || [];

        // Get additional info from DynamoDB for each stream
        const streamsWithInfo = await Promise.all(
            streams.map(async (stream) => {
                try {
                    // Query DynamoDB to find user info for this channel
                    const queryParams = {
                        TableName: STREAMS_TABLE,
                        IndexName: 'channelArn-index', // Cần tạo GSI này
                        KeyConditionExpression: 'channelArn = :channelArn',
                        ExpressionAttributeValues: {
                            ':channelArn': stream.channelArn
                        }
                    };

                    const dbResult = await docClient.send(new QueryCommand(queryParams));
                    const streamInfo = dbResult.Items?.[0] || {};

                    return {
                        channelArn: stream.channelArn,
                        health: stream.health,
                        state: stream.state,
                        viewerCount: stream.viewerCount || 0,
                        startTime: stream.startTime,
                        title: streamInfo.title || 'Live Stream',
                        userName: streamInfo.userName || 'Anonymous',
                        playbackUrl: streamInfo.playbackUrl
                    };
                } catch (err) {
                    console.error('Error fetching stream info:', err);
                    return {
                        channelArn: stream.channelArn,
                        health: stream.health,
                        state: stream.state,
                        viewerCount: stream.viewerCount || 0,
                        startTime: stream.startTime,
                        title: 'Live Stream',
                        userName: 'Anonymous'
                    };
                }
            })
        );

        res.json({
            streams: streamsWithInfo,
            nextToken: streamsResult.nextToken
        });

    } catch (error) {
        console.error('List streams error:', error);
        res.status(500).json({
            message: 'Không thể lấy danh sách stream'
        });
    }
});

module.exports = router;