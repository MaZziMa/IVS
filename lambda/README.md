# AWS Lambda Functions cho IVS Chat

## 📁 Profanity Filter Lambda

Lambda function để lọc các từ tục tĩu trong AWS IVS Chat messages.

### 🎯 Tính năng

- ✅ Tích hợp với AWS IVS Chat Message Review
- ✅ Tự động lọc 10 từ tục tĩu phổ biến
- ✅ Thay thế từ tục tĩu bằng dấu sao (*)
- ✅ Gửi cảnh báo đến người dùng vi phạm
- ✅ Không làm gián đoạn luồng chat
- ✅ Hỗ trợ API Gateway để test

### 📦 Dependencies

```json
{
  "@aws-sdk/client-ivschat": "^3.x.x"
}
```

### 🔧 Cài đặt

1. **Cài đặt dependencies:**
```bash
npm install @aws-sdk/client-ivschat
```

2. **Tạo deployment package:**
```bash
# Tạo thư mục build
mkdir lambda-package
cd lambda-package

# Copy file Lambda
cp ../profanity-filter.js index.js

# Cài đặt dependencies
npm init -y
npm install @aws-sdk/client-ivschat

# Tạo ZIP file
# Windows PowerShell:
Compress-Archive -Path * -DestinationPath ../profanity-filter.zip -Force
```

3. **Deploy lên AWS Lambda:**

**Option 1: Sử dụng AWS Console**
- Vào AWS Lambda Console
- Tạo function mới: `ivs-chat-profanity-filter`
- Runtime: Node.js 18.x hoặc mới hơn
- Upload file `profanity-filter.zip`
- Handler: `index.handler`

**Option 2: Sử dụng AWS CLI**
```bash
# Tạo IAM role cho Lambda
aws iam create-role --role-name ivs-chat-lambda-role \
  --assume-role-policy-document file://trust-policy.json

# Attach policies
aws iam attach-role-policy --role-name ivs-chat-lambda-role \
  --policy-arn arn:aws:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole

aws iam attach-role-policy --role-name ivs-chat-lambda-role \
  --policy-arn arn:aws:iam::aws:policy/AmazonIVSChatFullAccess

# Tạo Lambda function
aws lambda create-function \
  --function-name ivs-chat-profanity-filter \
  --runtime nodejs18.x \
  --handler index.handler \
  --role arn:aws:iam::YOUR-ACCOUNT-ID:role/ivs-chat-lambda-role \
  --zip-file fileb://profanity-filter.zip \
  --timeout 10 \
  --memory-size 256
```

### 🔐 IAM Permissions

Lambda function cần các permissions sau:

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": [
        "ivschat:SendEvent"
      ],
      "Resource": "arn:aws:ivschat:*:*:room/*"
    },
    {
      "Effect": "Allow",
      "Action": [
        "logs:CreateLogGroup",
        "logs:CreateLogStream",
        "logs:PutLogEvents"
      ],
      "Resource": "arn:aws:logs:*:*:*"
    }
  ]
}
```

### ⚙️ Tích hợp với IVS Chat

1. **Tạo hoặc cập nhật IVS Chat Room với Message Review Handler:**

```bash
# Tạo chat room với message review
aws ivschat create-room \
  --name "MyStreamChatRoom" \
  --message-review-handler lambdaArn=arn:aws:lambda:REGION:ACCOUNT-ID:function:ivs-chat-profanity-filter,fallbackResult=ALLOW

# Hoặc update room hiện có
aws ivschat update-room \
  --identifier ROOM-ARN \
  --message-review-handler lambdaArn=arn:aws:lambda:REGION:ACCOUNT-ID:function:ivs-chat-profanity-filter,fallbackResult=ALLOW
```

2. **Grant permission cho IVS Chat gọi Lambda:**

```bash
aws lambda add-permission \
  --function-name ivs-chat-profanity-filter \
  --statement-id ivschat-invoke \
  --action lambda:InvokeFunction \
  --principal ivschat.amazonaws.com \
  --source-arn ROOM-ARN
```

### 🧪 Testing

Sử dụng file `test-profanity-filter.js` để test:

```bash
node test-profanity-filter.js
```

Hoặc test trực tiếp với AWS Lambda:

```bash
# Test với IVS Chat event
aws lambda invoke \
  --function-name ivs-chat-profanity-filter \
  --payload file://test-event.json \
  response.json

cat response.json
```

**test-event.json:**
```json
{
  "eventName": "aws:ivschat:Message",
  "content": {
    "message": "You are such an idiot"
  },
  "sender": {
    "userId": "user123",
    "attributes": {
      "username": "testuser"
    }
  },
  "roomArn": "arn:aws:ivschat:us-east-1:123456789012:room/AbCdEfGhIjKl"
}
```

### 📝 Cấu hình

**Environment Variables:**
- `AWS_REGION`: AWS region (mặc định: us-east-1)

**Timeout:** 10 giây (khuyến nghị)

**Memory:** 256 MB (khuyến nghị)

### 🎨 Tùy chỉnh danh sách từ tục tĩu

Chỉnh sửa `PROFANITY_LIST` trong `profanity-filter.js`:

```javascript
const PROFANITY_LIST = [
    'damn',
    'hell',
    'crap',
    'stupid',
    'idiot',
    'jerk',
    'fool',
    'dumb',
    'loser',
    'moron',
    // Thêm từ của bạn ở đây
];
```

### 📊 Response Format

**IVS Chat Event Response:**
```json
{
  "reviewResult": "ALLOW",
  "content": {
    "message": "You are such an *****",
    "filtered": true,
    "originalMessage": "You are such an idiot"
  }
}
```

**API Gateway Response:**
```json
{
  "originalMessage": "You are such an idiot",
  "filteredMessage": "You are such an *****",
  "containsProfanity": true,
  "profanityDetected": true
}
```

### 🚨 Troubleshooting

**Lỗi thường gặp:**

1. **Lambda không được trigger:**
   - Kiểm tra permissions
   - Verify room configuration
   - Check CloudWatch logs

2. **Module không tìm thấy:**
   - Đảm bảo đã package đúng dependencies
   - Check deployment package structure

3. **Timeout:**
   - Tăng timeout setting
   - Optimize code
   - Check network connectivity

### 📚 Tài liệu tham khảo

- [AWS IVS Chat Documentation](https://docs.aws.amazon.com/ivs/latest/ChatAPIReference/)
- [AWS Lambda Node.js Documentation](https://docs.aws.amazon.com/lambda/latest/dg/lambda-nodejs.html)
- [AWS SDK for JavaScript v3](https://docs.aws.amazon.com/AWSJavaScriptSDK/v3/latest/)

### 🔄 Updates

**Version 1.0.0** (October 15, 2025)
- Initial release
- Basic profanity filtering
- IVS Chat integration
- Warning message support
