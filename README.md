# 🎥 AWS IVS Streaming Application

Ứng dụng web streaming đơn giản sử dụng AWS Interactive Video Service (IVS), DynamoDB, và Cognito cho xác thực người dùng.

## ✨ Tính Năng

- 🔐 **Xác thực người dùng** với AWS Cognito
- 📺 **Live streaming** với AWS IVS
- 💬 **Real-time chat** với WebSocket
- 📊 **Quản lý stream** và thống kê
- 📱 **Responsive design** tương thích mobile
- ⚡ **Real-time viewer count**

## 🏗️ Kiến Trúc

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   Frontend      │    │   Backend       │    │   AWS Services  │
│                 │    │                 │    │                 │
│ • HTML/CSS/JS   │◄──►│ • Node.js       │◄──►│ • AWS IVS       │
│ • IVS Player    │    │ • Express.js    │    │ • DynamoDB      │
│ • WebSocket     │    │ • WebSocket     │    │ • Cognito       │
│ • Auth UI       │    │ • AWS SDK v3    │    │                 │
└─────────────────┘    └─────────────────┘    └─────────────────┘
```

## 📋 Yêu Cầu Hệ Thống

- **Node.js** 18.x hoặc cao hơn
- **npm** hoặc **yarn**
- **AWS CLI** đã cấu hình
- **AWS Account** với quyền truy cập:
  - AWS IVS
  - DynamoDB
  - Cognito
  - IAM

## 🚀 Cài Đặt Nhanh

### 1. Cài đặt Node.js

**Windows:**
- Tải về từ [nodejs.org](https://nodejs.org/)
- Chạy file installer và làm theo hướng dẫn
- Khởi động lại PowerShell sau khi cài đặt

**Kiểm tra cài đặt:**
```powershell
node --version
npm --version
```

### 2. Clone Repository

```powershell
# Nếu bạn có git
git clone <repository-url>
cd aws-ivs-streaming-app

# Hoặc tải về và giải nén source code
```

### 3. Cài Đặt Dependencies

```powershell
npm install
```

### 4. Cấu Hình AWS

#### Cài đặt AWS CLI:
```powershell
# Sử dụng Chocolatey (nếu đã cài)
choco install awscli

# Hoặc tải từ: https://aws.amazon.com/cli/
```

#### Cấu hình AWS credentials:
```powershell
aws configure
```

#### Chạy script tự động tạo resources:
```powershell
# Cấp quyền execution cho PowerShell script
Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope CurrentUser

# Chạy setup script
.\scripts\setup-aws.ps1
```

### 5. Cấu Hình Environment Variables

Sao chép file `.env.example` thành `.env`:
```powershell
copy .env.example .env
```

Cập nhật file `.env` với thông tin AWS của bạn:
```env
# AWS Configuration
AWS_REGION=us-east-1
AWS_ACCESS_KEY_ID=your_access_key_here
AWS_SECRET_ACCESS_KEY=your_secret_key_here

# Cognito (từ output của setup script)
COGNITO_USER_POOL_ID=us-east-1_xxxxxxxxx
COGNITO_CLIENT_ID=xxxxxxxxxxxxxxxxxxxxxxxxxx
COGNITO_REGION=us-east-1

# DynamoDB
DYNAMODB_STREAMS_TABLE=ivs_streams
DYNAMODB_USERS_TABLE=ivs_users

# Server
PORT=3000
```

### 6. Khởi Chạy Ứng Dụng

```powershell
# Development mode
npm run dev

# Production mode
npm start
```

Truy cập ứng dụng tại: `http://localhost:3000`

## 📚 Hướng Dẫn Sử Dụng

### Cho Người Xem

1. **Truy cập trang web** `http://localhost:3000`
2. **Xem stream** mà không cần đăng ký
3. **Đăng ký/Đăng nhập** để sử dụng chat
4. **Chat real-time** với người xem khác

### Cho Streamer

1. **Đăng ký tài khoản** và xác nhận email
2. **Đăng nhập** vào ứng dụng
3. **Bấm "Bắt đầu Stream"** để tạo channel
4. **Sao chép Stream Key** và sử dụng với OBS/streaming software
5. **Cấu hình OBS:**
   - Server: `rtmps://ingest.live-video.net/live/`
   - Stream Key: (từ ứng dụng)

### Streaming với OBS Studio

1. **Tải OBS Studio**: https://obsproject.com/
2. **Cài đặt và mở OBS**
3. **Settings → Stream:**
   - Service: Custom
   - Server: `rtmps://ingest.live-video.net/live/`
   - Stream Key: (sao chép từ ứng dụng)
4. **Bấm "Start Streaming"**

## 🛠️ Development

### Project Structure

```
aws-ivs-streaming-app/
├── client/                 # Frontend files
│   ├── css/
│   │   └── styles.css     # Main stylesheet
│   ├── js/
│   │   ├── app.js         # Main application
│   │   ├── auth.js        # Authentication
│   │   ├── stream.js      # Stream management
│   │   └── chat.js        # Chat functionality
│   └── index.html         # Main HTML page
├── server/                 # Backend API
│   ├── routes/
│   │   ├── auth.js        # Auth endpoints
│   │   ├── stream.js      # Stream management
│   │   └── user.js        # User management
│   ├── websocket/
│   │   └── chat.js        # WebSocket chat server
│   └── server.js          # Main server file
├── scripts/                # Setup scripts
│   ├── setup-aws.ps1     # PowerShell setup
│   └── aws-setup.md      # Manual setup guide
└── package.json           # Dependencies
```

### Available Scripts

```powershell
# Start development server với nodemon
npm run dev

# Start production server
npm start

# Serve client files only (for testing)
npm run client
```

### API Endpoints

#### Authentication
- `POST /api/auth/register` - Đăng ký
- `POST /api/auth/confirm` - Xác nhận email
- `POST /api/auth/login` - Đăng nhập
- `POST /api/auth/logout` - Đăng xuất
- `GET /api/auth/config` - Cấu hình Cognito

#### Stream Management
- `GET /api/stream/status` - Trạng thái stream
- `POST /api/stream/start` - Tạo/bắt đầu stream
- `POST /api/stream/stop` - Dừng stream
- `GET /api/stream/viewers` - Số lượng viewer
- `GET /api/stream/list` - Danh sách stream active

#### User Management
- `GET /api/user/profile` - Thông tin profile
- `PUT /api/user/profile` - Cập nhật profile
- `GET /api/user/streams` - Stream của user
- `GET /api/user/stats` - Thống kê user

### WebSocket Events

#### Client → Server
```javascript
{
  "type": "auth",
  "token": "jwt_token"
}

{
  "type": "join",
  "room": "channel_arn"
}

{
  "type": "message",
  "message": "Tin nhắn chat"
}
```

#### Server → Client
```javascript
{
  "type": "message",
  "username": "tên_user",
  "message": "Tin nhắn",
  "timestamp": "2023-..."
}

{
  "type": "userJoined",
  "username": "tên_user"
}
```

## 🔧 Cấu Hình AWS

### DynamoDB Tables

#### `ivs_users`
```
Partition Key: userId (String)
Attributes:
- username
- email
- displayName
- createdAt
- lastLogin
- settings
```

#### `ivs_streams`
```
Partition Key: userId (String)
Sort Key: createdAt (String)
GSI: channelArn-index
Attributes:
- channelArn
- streamKey
- playbackUrl
- title
- isLive
- viewerCount
```

### IAM Permissions

User cần có quyền:
```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": [
        "ivs:*",
        "dynamodb:GetItem",
        "dynamodb:PutItem",
        "dynamodb:UpdateItem",
        "dynamodb:Query",
        "cognito-idp:*"
      ],
      "Resource": "*"
    }
  ]
}
```

## 🚨 Troubleshooting

### Lỗi thường gặp

#### 1. "npm not recognized"
```powershell
# Cài đặt Node.js từ nodejs.org
# Khởi động lại PowerShell
node --version
npm --version
```

#### 2. "AWS CLI not found"
```powershell
# Cài đặt AWS CLI
# Windows: https://aws.amazon.com/cli/
aws --version
```

#### 3. "Token không hợp lệ"
- Kiểm tra COGNITO_USER_POOL_ID và COGNITO_CLIENT_ID trong .env
- Đảm bảo user đã confirm email

#### 4. "Không tạo được stream"
- Kiểm tra AWS credentials có quyền IVS
- Kiểm tra region trong .env khớp với AWS resources

#### 5. "WebSocket connection failed"
- Kiểm tra server đang chạy
- Kiểm tra firewall/antivirus

### Debug Mode

Để bật debug logging:
```powershell
$env:NODE_ENV="development"
npm start
```

## 📖 Tài Liệu Tham Khảo

- [AWS IVS Documentation](https://docs.aws.amazon.com/ivs/)
- [AWS SDK for JavaScript](https://docs.aws.amazon.com/sdk-for-javascript/)
- [AWS Cognito](https://docs.aws.amazon.com/cognito/)
- [DynamoDB](https://docs.aws.amazon.com/dynamodb/)

## 🆘 Hỗ Trợ

Nếu gặp vấn đề:
1. Kiểm tra [Troubleshooting](#-troubleshooting)
2. Xem [AWS Documentation](https://docs.aws.amazon.com/)
3. Tạo Issue trên GitHub repository

---

**Lưu ý**: Đây là ứng dụng demo. Để sử dụng production, cần thêm:
- SSL/HTTPS
- Rate limiting
- Input validation
- Error monitoring
- Load balancing
- CDN cho static files
