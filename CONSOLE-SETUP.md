# Setup AWS Resources via Console - Step by Step Guide

## 🌐 Tạo Resources qua AWS Console (Không cần script)

### 1. 📊 DynamoDB Tables

#### Tạo bảng `ivs_users`:
1. Vào [DynamoDB Console](https://console.aws.amazon.com/dynamodb/)
2. Click "Create table"
3. **Table name**: `ivs_users`
4. **Partition key**: `userId` (String)
5. Để mặc định các setting khác
6. Click "Create table"

#### Tạo bảng `ivs_streams`:
1. Click "Create table" 
2. **Table name**: `ivs_streams`
3. **Partition key**: `userId` (String)
4. **Sort key**: `createdAt` (String)
5. Click "Create table"

### 2. 🔐 Cognito User Pool

#### Tạo User Pool:
1. Vào [Cognito Console](https://console.aws.amazon.com/cognito/)
2. Click "Create user pool"
3. **Cognito user pool sign-in options**: Email
4. **Password policy**: Mặc định
5. **Multi-factor authentication**: No MFA
6. **User account recovery**: Email only
7. **Required attributes**: Email
8. **Email provider**: Send email with Cognito
9. **User pool name**: `IVS-Streaming-Users`
10. **App client name**: `IVS-Streaming-Client`
11. **Authentication flows**: Allow USER_PASSWORD_AUTH
12. Click "Create user pool"

#### Lưu thông tin:
- Copy **User pool ID** (dạng: us-east-1_xxxxxxxxx)
- Copy **Client ID** (dạng: xxxxxxxxxxxxxxxxxxxxxxxxxx)

### 3. 📝 Cập nhật .env

Mở file `.env` và cập nhật:
```env
AWS_REGION=us-east-1
AWS_ACCESS_KEY_ID=your_access_key
AWS_SECRET_ACCESS_KEY=your_secret_key

COGNITO_USER_POOL_ID=us-east-1_xxxxxxxxx
COGNITO_CLIENT_ID=xxxxxxxxxxxxxxxxxxxxxxxxxx
COGNITO_REGION=us-east-1

DYNAMODB_STREAMS_TABLE=ivs_streams
DYNAMODB_USERS_TABLE=ivs_users

PORT=3000
```

### 4. 🚀 Chạy ứng dụng

```bash
# Cài Node.js từ https://nodejs.org (nếu chưa có)
node --version

# Cài dependencies
npm install

# Chạy app
npm start
```

## ✅ Ưu điểm của cách này:
- ✅ Không cần script phức tạp
- ✅ Trực quan với giao diện web
- ✅ Dễ debug nếu có lỗi
- ✅ Có thể xem và quản lý resources dễ dàng
- ✅ Không lo syntax error

## 🎯 Sau khi setup:
1. Resources sẽ xuất hiện trong AWS Console
2. App sẽ chạy tại: http://localhost:3000
3. Đăng ký tài khoản để test streaming