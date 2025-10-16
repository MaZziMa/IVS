const express = require('express');
const { IvsClient, CreateChannelCommand, GetChannelCommand, StopStreamCommand, GetStreamCommand, ListStreamsCommand, DeleteChannelCommand } = require('@aws-sdk/client-ivs');
const { IvschatClient, CreateRoomCommand, CreateChatTokenCommand, GetRoomCommand, DeleteRoomCommand } = require('@aws-sdk/client-ivschat');
const { DynamoDBClient } = require('@aws-sdk/client-dynamodb');
const { DynamoDBDocumentClient, PutCommand, GetCommand, UpdateCommand, QueryCommand, DeleteCommand, ScanCommand } = require('@aws-sdk/lib-dynamodb');
const { authenticateToken } = require('./auth');

const router = express.Router();

// Initialize AWS clients
const ivsClient = new IvsClient({
    region: process.env.AWS_REGION || 'us-east-1'
});

const ivsChatClient = new IvschatClient({
    region: process.env.AWS_REGION || 'us-east-1'
});

const ddbClient = new DynamoDBClient({
    region: process.env.AWS_REGION || 'us-east-1'
});
const docClient = DynamoDBDocumentClient.from(ddbClient);

const STREAMS_TABLE = process.env.DYNAMODB_STREAMS_TABLE || 'ivs_streams';

// Debug endpoint to list all usernames
router.get('/debug/users', async (req, res) => {
    try {
        const scanParams = {
            TableName: STREAMS_TABLE,
            ProjectionExpression: 'userName, userId, createdAt'
        };
        
        const result = await docClient.send(new ScanCommand(scanParams));
        
        res.json({
            count: result.Items?.length || 0,
            users: result.Items || []
        });
    } catch (error) {
        console.error('Debug users error:', error);
        res.status(500).json({ message: 'Failed to fetch users', error: error.message });
    }
});

// Get my stream data (for dashboard and channel page)
router.get('/my-stream', authenticateToken, async (req, res) => {
    try {
        const userId = req.user.sub;
        
        // Query user's stream from DynamoDB
        const queryParams = {
            TableName: STREAMS_TABLE,
            KeyConditionExpression: 'userId = :userId',
            ExpressionAttributeValues: {
                ':userId': userId
            },
            ScanIndexForward: false, // Get latest first
            Limit: 1
        };
        
        const result = await docClient.send(new QueryCommand(queryParams));
        
        if (!result.Items || result.Items.length === 0) {
            return res.status(404).json({ message: 'Stream not found' });
        }
        
        const streamData = result.Items[0];
        
        // Check if channel exists (channelArn is proof of creation)
        if (!streamData.channelArn) {
            return res.status(404).json({ message: 'Channel not created yet' });
        }
        
        // Check live status from IVS (real-time)
        let isLive = false;
        let viewerCount = 0;
        
        try {
            const streamParams = { channelArn: streamData.channelArn };
            const streamResult = await ivsClient.send(new GetStreamCommand(streamParams));
            isLive = streamResult.stream && streamResult.stream.state === 'LIVE';
            viewerCount = streamResult.stream ? streamResult.stream.viewerCount || 0 : 0;
            
            // Update database with latest status
            const updateParams = {
                TableName: STREAMS_TABLE,
                Key: {
                    userId: userId,
                    createdAt: streamData.createdAt
                },
                UpdateExpression: 'SET isLive = :isLive, viewerCount = :viewerCount, lastChecked = :lastChecked',
                ExpressionAttributeValues: {
                    ':isLive': isLive,
                    ':viewerCount': viewerCount,
                    ':lastChecked': new Date().toISOString()
                }
            };
            await docClient.send(new UpdateCommand(updateParams));
        } catch (err) {
            // Stream not live or error checking
            console.log('Stream not live or error:', err.name);
            isLive = false;
        }
        
        // Return data with real-time status
        res.json({
            userName: streamData.userName,
            title: streamData.title || 'Live Stream',
            category: streamData.category || 'Just Chatting',
            tags: streamData.tags || [],
            language: streamData.language || 'vi',
            playbackUrl: streamData.playbackUrl,
            channelArn: streamData.channelArn,
            chatRoomArn: streamData.chatRoomArn,
            streamKey: streamData.streamKey,
            ingestEndpoint: streamData.ingestEndpoint,
            isLive: isLive,
            viewerCount: viewerCount,
            createdAt: streamData.createdAt
        });
        
    } catch (error) {
        console.error('Error fetching my stream:', error);
        res.status(500).json({ message: 'Failed to load stream data' });
    }
});

// Get channel by username
router.get('/channel/:username', async (req, res) => {
    try {
        const username = req.params.username;
        
        console.log('=== GET CHANNEL BY USERNAME ===');
        console.log('Requested username:', username);
        
        // Scan ALL items and filter in code (more reliable than FilterExpression)
        const scanParams = {
            TableName: STREAMS_TABLE
        };
        
        let result;
        let retries = 0;
        const MAX_RETRIES = 3;
        let foundItem = null;
        
        // Retry logic for eventual consistency
        while (retries < MAX_RETRIES && !foundItem) {
            console.log(`Scan attempt ${retries + 1}/${MAX_RETRIES}`);
            result = await docClient.send(new ScanCommand(scanParams));
            
            console.log(`Scan returned ${result.Items?.length || 0} total items`);
            
            // Filter in code (more reliable than DynamoDB FilterExpression)
            if (result.Items && result.Items.length > 0) {
                foundItem = result.Items.find(item => item.userName === username);
                
                if (foundItem) {
                    console.log('✓ Found stream for userName:', foundItem.userName);
                    break;
                } else {
                    console.log('✗ Username not found in items:', result.Items.map(i => i.userName));
                }
            }
            
            retries++;
            if (retries < MAX_RETRIES && !foundItem) {
                console.log('Not found, waiting 500ms before retry...');
                await new Promise(resolve => setTimeout(resolve, 500));
            }
        }
        
        if (!foundItem) {
            console.log('Channel not found after', MAX_RETRIES, 'attempts');
            console.log('Available usernames:', result.Items?.map(i => i.userName));
            
            return res.status(404).json({ 
                message: 'Channel not found',
                requestedUsername: username,
                availableUsernames: result.Items?.map(i => i.userName)
            });
        }
        
        const streamData = foundItem;
        
        // Check current stream status from IVS
        let isLive = false;
        let viewerCount = 0;
        
        try {
            const streamParams = { channelArn: streamData.channelArn };
            const streamResult = await ivsClient.send(new GetStreamCommand(streamParams));
            isLive = streamResult.stream && streamResult.stream.state === 'LIVE';
            viewerCount = streamResult.stream ? streamResult.stream.viewerCount || 0 : 0;
        } catch (err) {
            // Stream not live
            isLive = false;
        }
        
        res.json({
            userName: streamData.userName,
            title: streamData.title || 'Live Stream',
            category: streamData.category || 'Just Chatting',
            tags: streamData.tags || [],
            language: streamData.language || 'vi',
            playbackUrl: streamData.playbackUrl,
            channelArn: streamData.channelArn,
            chatRoomArn: streamData.chatRoomArn,
            isLive: isLive,
            viewerCount: viewerCount,
            streamKey: streamData.streamKey,
            ingestEndpoint: streamData.ingestEndpoint
        });
        
    } catch (error) {
        console.error('Error fetching channel:', error);
        res.status(500).json({ message: 'Failed to load channel' });
    }
});

// Update stream title
router.post('/update-title', authenticateToken, async (req, res) => {
    try {
        const userId = req.user.sub;
        const { title } = req.body;
        
        if (!title || title.trim() === '') {
            return res.status(400).json({ message: 'Title is required' });
        }
        
        // Query user's stream
        const queryParams = {
            TableName: STREAMS_TABLE,
            KeyConditionExpression: 'userId = :userId',
            ExpressionAttributeValues: {
                ':userId': userId
            },
            ScanIndexForward: false,
            Limit: 1
        };
        
        const result = await docClient.send(new QueryCommand(queryParams));
        
        if (!result.Items || result.Items.length === 0) {
            return res.status(404).json({ message: 'Stream not found' });
        }
        
        const streamData = result.Items[0];
        
        // Update title
        const updateParams = {
            TableName: STREAMS_TABLE,
            Key: {
                userId: userId,
                createdAt: streamData.createdAt
            },
            UpdateExpression: 'SET title = :title',
            ExpressionAttributeValues: {
                ':title': title.trim()
            }
        };
        
        await docClient.send(new UpdateCommand(updateParams));
        
        res.json({ message: 'Title updated successfully', title: title.trim() });
        
    } catch (error) {
        console.error('Error updating title:', error);
        res.status(500).json({ message: 'Failed to update title' });
    }
});

// Get all live streams (for homepage)
router.get('/live', async (req, res) => {
    try {
        // Scan all channels (don't trust isLive flag in DB)
        const scanParams = {
            TableName: STREAMS_TABLE
        };
        const result = await docClient.send(new ScanCommand(scanParams));

        const allStreams = result.Items || [];
        
        // Verify each stream's actual status from IVS
        const verifiedStreams = await Promise.all(
            allStreams.map(async (item) => {
                if (!item.channelArn) return null; // Skip if no channel
                
                try {
                    // Check actual live status from IVS
                    const streamParams = { channelArn: item.channelArn };
                    const streamResult = await ivsClient.send(new GetStreamCommand(streamParams));
                    const stream = streamResult.stream;
                    
                    // Only return if actually LIVE
                    if (stream && stream.state === 'LIVE') {
                        return {
                            userId: item.userId,
                            userName: item.userName,
                            title: item.title || 'Live Stream',
                            playbackUrl: item.playbackUrl,
                            channelArn: item.channelArn,
                            createdAt: item.createdAt,
                            viewerCount: stream.viewerCount || 0,
                            avatar: item.avatar || null
                        };
                    }
                    return null; // Stream not live
                } catch (err) {
                    // GetStream throws error if not broadcasting
                    console.log(`Stream check for ${item.userName}: Not live (${err.name})`);
                    return null;
                }
            })
        );
        
        // Filter out null values (offline streams)
        const liveStreams = verifiedStreams.filter(s => s !== null);
        
        res.json({ streams: liveStreams });
    } catch (error) {
        console.error('Error fetching live streams:', error);
        res.status(500).json({ message: 'Không thể lấy danh sách stream đang live' });
    }
});

// Get stream status
router.get('/status', authenticateToken, async (req, res) => {
    try {
        const userId = req.user.sub;

        // Query user's streams from DynamoDB (using Query instead of Get because of composite key)
        const queryParams = {
            TableName: STREAMS_TABLE,
            KeyConditionExpression: 'userId = :userId',
            ExpressionAttributeValues: {
                ':userId': userId
            },
            ScanIndexForward: false, // Get latest first
            Limit: 1
        };

        const result = await docClient.send(new QueryCommand(queryParams));
        
        if (!result.Items || result.Items.length === 0) {
            return res.json({
                hasStream: false,
                message: 'Chưa có stream nào được tạo'
            });
        }

        const streamData = result.Items[0]; // Get the latest stream

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
                chatRoomArn: streamData.chatRoomArn,
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
                    userId: userId,
                    createdAt: streamData.createdAt // Include sort key
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
        console.log('=== START STREAM REQUEST ===');
        console.log('User:', req.user);
        const userId = req.user.sub;
        const { title = 'Live Stream' } = req.body;
        console.log('Creating stream for userId:', userId, 'username:', req.user.username, 'title:', title);

        // Check if user already has a stream
        const queryParams = {
            TableName: STREAMS_TABLE,
            KeyConditionExpression: 'userId = :userId',
            ExpressionAttributeValues: {
                ':userId': userId
            },
            ScanIndexForward: false,
            Limit: 1
        };

        const existingResult = await docClient.send(new QueryCommand(queryParams));
        console.log('Existing streams found:', existingResult.Items?.length || 0);
        
        if (existingResult.Items && existingResult.Items.length > 0) {
            // User already has a stream, return existing data
            const streamData = existingResult.Items[0];
            console.log('Returning existing stream:', streamData.channelArn);
            
            // Get channel info from IVS
            const channelParams = {
                arn: streamData.channelArn
            };

            const channelResult = await ivsClient.send(new GetChannelCommand(channelParams));
            const channel = channelResult.channel;

            // Check if stream is currently live
            let isLive = false;
            let viewerCount = 0;
            try {
                const streamParams = {
                    channelArn: streamData.channelArn
                };
                const streamResult = await ivsClient.send(new GetStreamCommand(streamParams));
                isLive = streamResult.stream && streamResult.stream.state === 'LIVE';
                viewerCount = streamResult.stream ? streamResult.stream.viewerCount || 0 : 0;
            } catch (streamError) {
                // Stream not active
                console.log('Stream not live:', streamError.message);
            }

            return res.json({
                message: 'Stream đã tồn tại',
                stream: {
                    channelArn: streamData.channelArn,
                    streamKey: streamData.streamKey,
                    playbackUrl: channel.playbackUrl,
                    ingestEndpoint: channel.ingestEndpoint,
                    chatRoomArn: streamData.chatRoomArn,
                    title: streamData.title,
                    isLive: isLive,
                    viewerCount: viewerCount
                }
            });
        }

        // Create new IVS channel with userId (sub) for easy identification
        const createChannelParams = {
            name: `${userId}-channel`,
            type: 'STANDARD',
            latencyMode: 'LOW',
            recordingConfigurationArn: undefined // Có thể config recording sau
        };

        const channelResult = await ivsClient.send(new CreateChannelCommand(createChannelParams));
        const { channel, streamKey } = channelResult;

        // Create IVS Chat room with userId (sub) for easy identification
        let chatRoomArn = null;
        try {
            const createRoomParams = {
                name: `${userId}-chat`,
                maximumMessageLength: 500,
                maximumMessageRatePerSecond: 10
            };
            const roomResult = await ivsChatClient.send(new CreateRoomCommand(createRoomParams));
            chatRoomArn = roomResult.arn;
            console.log('Chat room created:', chatRoomArn);
        } catch (chatError) {
            console.error('Failed to create chat room:', chatError);
            // Continue without chat room
        }

        // Save stream data to DynamoDB
        const streamData = {
            userId: userId,
            channelArn: channel.arn,
            streamKey: streamKey.value,
            playbackUrl: channel.playbackUrl,
            ingestEndpoint: channel.ingestEndpoint,
            chatRoomArn: chatRoomArn,
            title: title,
            isLive: false,
            createdAt: new Date().toISOString(),
            lastUpdated: new Date().toISOString(),
            viewerCount: 0,
            userName: req.user.username || req.user.email
        };

        console.log('=== SAVING STREAM DATA ===');
        console.log('streamData:', JSON.stringify(streamData, null, 2));

        const putParams = {
            TableName: STREAMS_TABLE,
            Item: streamData
        };

        await docClient.send(new PutCommand(putParams));
        console.log('✓ Stream saved to DynamoDB');

        res.json({
            message: 'Stream đã được tạo thành công',
            stream: {
                channelArn: channel.arn,
                streamKey: streamKey.value,
                playbackUrl: channel.playbackUrl,
                ingestEndpoint: channel.ingestEndpoint,
                chatRoomArn: chatRoomArn,
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

        // Query user's stream from DynamoDB
        const queryParams = {
            TableName: STREAMS_TABLE,
            KeyConditionExpression: 'userId = :userId',
            ExpressionAttributeValues: {
                ':userId': userId
            },
            ScanIndexForward: false,
            Limit: 1
        };

        const result = await docClient.send(new QueryCommand(queryParams));
        
        if (!result.Items || result.Items.length === 0) {
            return res.status(404).json({
                message: 'Không tìm thấy stream'
            });
        }

        const streamData = result.Items[0];

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
                userId: userId,
                createdAt: streamData.createdAt // Include sort key
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

// Update stream info (title, category, tags, language)
router.post('/update-info', authenticateToken, async (req, res) => {
    try {
        const userId = req.user.sub;
        const { title, category, tags, language } = req.body;

        if (!title || title.trim().length === 0) {
            return res.status(400).json({ message: 'Title is required' });
        }

        if (title.length > 140) {
            return res.status(400).json({ message: 'Title must be 140 characters or less' });
        }

        if (tags && tags.length > 25) {
            return res.status(400).json({ message: 'Maximum 25 tags allowed' });
        }

        // Query user's stream from DynamoDB
        const queryParams = {
            TableName: STREAMS_TABLE,
            KeyConditionExpression: 'userId = :userId',
            ExpressionAttributeValues: {
                ':userId': userId
            },
            ScanIndexForward: false,
            Limit: 1
        };

        const result = await docClient.send(new QueryCommand(queryParams));

        if (!result.Items || result.Items.length === 0) {
            return res.status(404).json({ message: 'Stream not found' });
        }

        const streamData = result.Items[0];

        // Update stream info
        const updateParams = {
            TableName: STREAMS_TABLE,
            Key: {
                userId: userId,
                createdAt: streamData.createdAt
            },
            UpdateExpression: 'SET title = :title, category = :category, tags = :tags, #lang = :language',
            ExpressionAttributeNames: {
                '#lang': 'language' // 'language' is a reserved keyword
            },
            ExpressionAttributeValues: {
                ':title': title.trim(),
                ':category': category || 'Just Chatting',
                ':tags': tags || [],
                ':language': language || 'vi'
            }
        };

        await docClient.send(new UpdateCommand(updateParams));

        res.json({
            message: 'Stream info updated successfully',
            data: {
                title: title.trim(),
                category: category || 'Just Chatting',
                tags: tags || [],
                language: language || 'vi'
            }
        });

    } catch (error) {
        console.error('Error updating stream info:', error);
        res.status(500).json({ message: 'Failed to update stream info' });
    }
});

module.exports = router;