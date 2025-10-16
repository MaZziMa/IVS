const express = require('express');
const { CognitoIdentityProviderClient, SignUpCommand, ConfirmSignUpCommand, InitiateAuthCommand, GlobalSignOutCommand } = require('@aws-sdk/client-cognito-identity-provider');
const { CognitoJwtVerifier } = require('aws-jwt-verify');
const crypto = require('crypto');

const router = express.Router();

// Initialize Cognito client
const cognitoClient = new CognitoIdentityProviderClient({
    region: process.env.AWS_REGION || 'us-east-1'
});

// Initialize JWT verifier
const verifier = CognitoJwtVerifier.create({
    userPoolId: process.env.COGNITO_USER_POOL_ID,
    tokenUse: 'access',
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

        // Verify and decode the access token
        const payload = await verifier.verify(result.AuthenticationResult.AccessToken);

        const user = {
            sub: payload.sub,
            username: payload.username,
            email: payload.email,
            emailVerified: payload.email_verified
        };

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

        const payload = await verifier.verify(token);
        req.user = {
            sub: payload.sub,
            username: payload.username,
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