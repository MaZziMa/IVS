const express = require('express');
const { CognitoIdentityProviderClient, SignUpCommand, ConfirmSignUpCommand, InitiateAuthCommand, GlobalSignOutCommand, AdminGetUserCommand } = require('@aws-sdk/client-cognito-identity-provider');
const { CognitoJwtVerifier } = require('aws-jwt-verify');
const crypto = require('crypto');
const { IvsClient, CreateChannelCommand } = require('@aws-sdk/client-ivs');
const { IvschatClient, CreateRoomCommand } = require('@aws-sdk/client-ivschat');
const { DynamoDBClient } = require('@aws-sdk/client-dynamodb');
const { DynamoDBDocumentClient, PutCommand, QueryCommand } = require('@aws-sdk/lib-dynamodb');

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

// Initialize Cognito client
const cognitoClient = new CognitoIdentityProviderClient({
    region: process.env.AWS_REGION || 'us-east-1'
});

// Initialize JWT verifier for Access Token
const verifier = CognitoJwtVerifier.create({
    userPoolId: process.env.COGNITO_USER_POOL_ID,
    tokenUse: 'access',
    clientId: process.env.COGNITO_CLIENT_ID
});

// Initialize JWT verifier for ID Token (contains user attributes)
const idTokenVerifier = CognitoJwtVerifier.create({
    userPoolId: process.env.COGNITO_USER_POOL_ID,
    tokenUse: 'id',
    clientId: process.env.COGNITO_CLIENT_ID
});

// Helper function to create secret hash
function createSecretHash(username) {
    const message = username + process.env.COGNITO_CLIENT_ID;
    return crypto
        .createHmac('SHA256', process.env.COGNITO_CLIENT_SECRET)
        .update(message)
        .digest('base64');
}

// Helper function to automatically create IVS channel for new user
async function createChannelForNewUser(userId, username) {
    try {
        console.log(`Creating channel for new user: ${username} (${userId})`);

        // Create IVS channel
        const createChannelParams = {
            name: `${username}-channel`,
            type: 'STANDARD',
            latencyMode: 'LOW'
        };

        const channelResult = await ivsClient.send(new CreateChannelCommand(createChannelParams));
        const { channel, streamKey } = channelResult;
        console.log('✓ IVS Channel created:', channel.arn);

        // Create IVS Chat room
        let chatRoomArn = null;
        try {
            const createRoomParams = {
                name: `${username}-chat`,
                maximumMessageLength: 500,
                maximumMessageRatePerSecond: 10
            };
            const roomResult = await ivsChatClient.send(new CreateRoomCommand(createRoomParams));
            chatRoomArn = roomResult.arn;
            console.log('✓ Chat room created:', chatRoomArn);
        } catch (chatError) {
            console.error('Failed to create chat room:', chatError);
            // Continue without chat room
        }

        // Save to DynamoDB
        const streamData = {
            userId: userId,
            channelArn: channel.arn,
            streamKey: streamKey.value,
            playbackUrl: channel.playbackUrl,
            ingestEndpoint: channel.ingestEndpoint,
            chatRoomArn: chatRoomArn,
            title: 'Live Stream',
            category: 'Just Chatting',
            tags: [],
            language: 'vi',
            isLive: false,
            createdAt: new Date().toISOString(),
            lastUpdated: new Date().toISOString(),
            viewerCount: 0,
            userName: username
        };

        const putParams = {
            TableName: STREAMS_TABLE,
            Item: streamData
        };

        await docClient.send(new PutCommand(putParams));
        console.log('✓ Stream data saved to DynamoDB');

        return {
            success: true,
            channelArn: channel.arn,
            streamKey: streamKey.value
        };

    } catch (error) {
        console.error('Error creating channel for new user:', error);
        return {
            success: false,
            error: error.message
        };
    }
}

// Get auth configuration
router.get('/config', (req, res) => {
    res.json({
        region: process.env.COGNITO_REGION || process.env.AWS_REGION,
        userPoolId: process.env.COGNITO_USER_POOL_ID,
        clientId: process.env.COGNITO_CLIENT_ID
    });
});

// Register new user
router.post('/register', async (req, res) => {
    try {
        const { username, email, password } = req.body;

        if (!username || !email || !password) {
            return res.status(400).json({
                message: 'Thiếu thông tin bắt buộc'
            });
        }

        const params = {
            ClientId: process.env.COGNITO_CLIENT_ID,
            Username: email,
            Password: password,
            UserAttributes: [
                {
                    Name: 'email',
                    Value: email
                },
                {
                    Name: 'preferred_username',
                    Value: username
                }
            ]
        };

        // Add secret hash if client secret is configured
        if (process.env.COGNITO_CLIENT_SECRET) {
            params.SecretHash = createSecretHash(email);
        }

        const command = new SignUpCommand(params);
        const result = await cognitoClient.send(command);

        res.json({
            message: 'Đăng ký thành công! Vui lòng kiểm tra email để xác nhận.',
            userSub: result.UserSub,
            needConfirmation: !result.UserConfirmed
        });

    } catch (error) {
        console.error('Registration error:', error);
        
        let message = 'Đăng ký thất bại';
        if (error.name === 'UsernameExistsException') {
            message = 'Email này đã được sử dụng';
        } else if (error.name === 'InvalidPasswordException') {
            message = 'Mật khẩu không đủ mạnh';
        } else if (error.name === 'InvalidParameterException') {
            message = 'Thông tin không hợp lệ';
        }

        res.status(400).json({ message });
    }
});

// Confirm registration
router.post('/confirm', async (req, res) => {
    try {
        const { username, confirmationCode } = req.body;

        if (!username || !confirmationCode) {
            return res.status(400).json({
                message: 'Thiếu thông tin xác nhận'
            });
        }

        const params = {
            ClientId: process.env.COGNITO_CLIENT_ID,
            Username: username,
            ConfirmationCode: confirmationCode
        };

        // Add secret hash if client secret is configured
        if (process.env.COGNITO_CLIENT_SECRET) {
            params.SecretHash = createSecretHash(username);
        }

        const command = new ConfirmSignUpCommand(params);
        await cognitoClient.send(command);

        // Get user details to get the userId (sub)
        let userId = null;
        try {
            const getUserParams = {
                UserPoolId: process.env.COGNITO_USER_POOL_ID,
                Username: username
            };
            const getUserCommand = new AdminGetUserCommand(getUserParams);
            const userResult = await cognitoClient.send(getUserCommand);
            
            // Find the 'sub' attribute
            const subAttribute = userResult.UserAttributes.find(attr => attr.Name === 'sub');
            if (subAttribute) {
                userId = subAttribute.Value;
                console.log('User confirmed, userId:', userId);
            }
        } catch (getUserError) {
            console.error('Failed to get user details:', getUserError);
        }

        // Automatically create IVS channel for new user
        if (userId) {
            const channelResult = await createChannelForNewUser(userId, username);
            if (channelResult.success) {
                console.log('✓ Channel automatically created for new user');
                return res.json({
                    message: 'Xác nhận thành công! Kênh stream của bạn đã được tạo. Bạn có thể đăng nhập ngay.',
                    channelCreated: true
                });
            } else {
                console.warn('⚠ User confirmed but channel creation failed:', channelResult.error);
                return res.json({
                    message: 'Xác nhận thành công! Bạn có thể đăng nhập ngay.',
                    channelCreated: false,
                    note: 'Kênh stream sẽ được tạo khi bạn đăng nhập lần đầu.'
                });
            }
        }

        res.json({
            message: 'Xác nhận thành công! Bạn có thể đăng nhập ngay.'
        });

    } catch (error) {
        console.error('Confirmation error:', error);
        
        let message = 'Xác nhận thất bại';
        if (error.name === 'CodeMismatchException') {
            message = 'Mã xác nhận không đúng';
        } else if (error.name === 'ExpiredCodeException') {
            message = 'Mã xác nhận đã hết hạn';
        } else if (error.name === 'NotAuthorizedException') {
            message = 'Người dùng đã được xác nhận';
        }

        res.status(400).json({ message });
    }
});

// Login
router.post('/login', async (req, res) => {
    try {
        const { email, password } = req.body;

        if (!email || !password) {
            return res.status(400).json({
                message: 'Thiếu email hoặc mật khẩu'
            });
        }

        const params = {
            AuthFlow: 'USER_PASSWORD_AUTH',
            ClientId: process.env.COGNITO_CLIENT_ID,
            AuthParameters: {
                USERNAME: email,
                PASSWORD: password
            }
        };

        // Add secret hash if client secret is configured
        if (process.env.COGNITO_CLIENT_SECRET) {
            params.AuthParameters.SECRET_HASH = createSecretHash(email);
        }

        const command = new InitiateAuthCommand(params);
        const result = await cognitoClient.send(command);

        // Verify and decode the ID token (contains user attributes like preferred_username)
        const idPayload = await idTokenVerifier.verify(result.AuthenticationResult.IdToken);
        
        // Log payload to debug
        console.log('ID Token payload:', JSON.stringify(idPayload, null, 2));

        const user = {
            sub: idPayload.sub,
            username: idPayload.preferred_username || idPayload['cognito:username'] || idPayload.email,
            email: idPayload.email,
            emailVerified: idPayload.email_verified
        };

        // Check if user has a channel, if not create one (fallback for old users)
        try {
            const queryParams = {
                TableName: STREAMS_TABLE,
                KeyConditionExpression: 'userId = :userId',
                ExpressionAttributeValues: {
                    ':userId': user.sub
                },
                Limit: 1
            };
            const queryResult = await docClient.send(new QueryCommand(queryParams));
            
            if (!queryResult.Items || queryResult.Items.length === 0) {
                console.log('User has no channel, creating one...');
                const channelResult = await createChannelForNewUser(user.sub, user.username);
                if (channelResult.success) {
                    console.log('✓ Channel created on first login');
                }
            }
        } catch (checkError) {
            console.error('Error checking/creating channel on login:', checkError);
            // Don't fail login if channel creation fails
        }

        res.json({
            message: 'Đăng nhập thành công',
            user: user,
            tokens: result.AuthenticationResult
        });

    } catch (error) {
        console.error('Login error:', error);
        
        let message = 'Đăng nhập thất bại';
        if (error.name === 'NotAuthorizedException') {
            message = 'Email hoặc mật khẩu không đúng';
        } else if (error.name === 'UserNotFoundException') {
            message = 'Người dùng không tồn tại';
        } else if (error.name === 'UserNotConfirmedException') {
            message = 'Tài khoản chưa được xác nhận';
        }

        res.status(401).json({ message });
    }
});

// Logout
router.post('/logout', async (req, res) => {
    try {
        const token = req.headers.authorization?.replace('Bearer ', '');
        
        if (token) {
            // Verify token trước khi logout
            const payload = await verifier.verify(token);
            
            // Global sign out từ Cognito
            const params = {
                AccessToken: token
            };

            const command = new GlobalSignOutCommand(params);
            await cognitoClient.send(command);
        }

        res.json({
            message: 'Đăng xuất thành công'
        });

    } catch (error) {
        console.error('Logout error:', error);
        // Vẫn return success vì logout nên luôn thành công ở client
        res.json({
            message: 'Đăng xuất thành công'
        });
    }
});

// Middleware để verify JWT token
async function authenticateToken(req, res, next) {
    try {
        const token = req.headers.authorization?.replace('Bearer ', '');
        
        if (!token) {
            return res.status(401).json({
                message: 'Thiếu token xác thực'
            });
        }

        // Use ID token verifier to get user attributes including preferred_username
        const payload = await idTokenVerifier.verify(token);
        req.user = {
            sub: payload.sub,
            username: payload.preferred_username || payload['cognito:username'] || payload.email,
            email: payload.email,
            emailVerified: payload.email_verified
        };

        next();
    } catch (error) {
        console.error('Token verification error:', error);
        res.status(401).json({
            message: 'Token không hợp lệ'
        });
    }
}

// Refresh token endpoint
router.post('/refresh', async (req, res) => {
    try {
        const { refreshToken } = req.body;

        if (!refreshToken) {
            return res.status(400).json({
                message: 'Thiếu refresh token'
            });
        }

        const params = {
            AuthFlow: 'REFRESH_TOKEN_AUTH',
            ClientId: process.env.COGNITO_CLIENT_ID,
            AuthParameters: {
                REFRESH_TOKEN: refreshToken
            }
        };

        // Add secret hash if client secret is configured
        if (process.env.COGNITO_CLIENT_SECRET) {
            // For refresh token, use a static identifier
            params.AuthParameters.SECRET_HASH = createSecretHash('refresh');
        }

        const command = new InitiateAuthCommand(params);
        const result = await cognitoClient.send(command);

        res.json({
            message: 'Token đã được làm mới',
            tokens: {
                IdToken: result.AuthenticationResult.IdToken,
                AccessToken: result.AuthenticationResult.AccessToken
                // RefreshToken is NOT returned (same one is reused)
            }
        });

    } catch (error) {
        console.error('Refresh token error:', error);
        
        let message = 'Không thể làm mới token';
        if (error.name === 'NotAuthorizedException') {
            message = 'Refresh token không hợp lệ hoặc đã hết hạn';
        }

        res.status(401).json({ message });
    }
});

// Protected route example
router.get('/me', authenticateToken, (req, res) => {
    res.json({
        user: req.user
    });
});

module.exports = {
    router,
    authenticateToken
};