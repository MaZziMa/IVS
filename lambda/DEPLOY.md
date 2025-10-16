# AWS Lambda - IVS Chat Profanity Filter

Hàm Lambda để lọc các từ tục tĩu trong tin nhắn AWS IVS Chat.

## 🎯 Tính năng

- ✅ Lọc 10 từ tục tĩu (có thể tùy chỉnh)
- ✅ Thay thế từ tục tĩu bằng dấu sao (*)
- ✅ Tích hợp với AWS IVS Chat Message Review
- ✅ Hỗ trợ API Gateway
- ✅ Gửi cảnh báo cho người dùng vi phạm
- ✅ Không phân biệt chữ hoa/thường
- ✅ Chỉ lọc từ đầy đủ (không lọc từ con)

## 📋 Danh sách từ tục tĩu mặc định

```javascript
const PROFANITY_LIST = [
    'damn', 'hell', 'crap', 'stupid', 'idiot',
    'jerk', 'fool', 'dumb', 'loser', 'moron'
];
```

## 🚀 Cài đặt

### 1. Cài đặt dependencies

```bash
cd lambda
npm install
```

### 2. Test local

```bash
npm test
# hoặc
node test-profanity-filter.js
```

### 3. Đóng gói Lambda

**Windows PowerShell:**
```powershell
Compress-Archive -Path profanity-filter.js,package.json,node_modules -DestinationPath profanity-filter.zip -Force
```

**Linux/Mac:**
```bash
zip -r profanity-filter.zip profanity-filter.js package.json node_modules/
```

## 📦 Deploy lên AWS Lambda

### Bước 1: Tạo IAM Role

Tạo IAM Role với policy:

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": [
        "logs:CreateLogGroup",
        "logs:CreateLogStream",
        "logs:PutLogEvents"
      ],
      "Resource": "arn:aws:logs:*:*:*"
    },
    {
      "Effect": "Allow",
      "Action": [
        "ivschat:SendEvent"
      ],
      "Resource": "*"
    }
  ]
}
```

### Bước 2: Tạo Lambda Function

**AWS CLI:**
```bash
aws lambda create-function \
  --function-name ivs-chat-profanity-filter \
  --runtime nodejs18.x \
  --handler profanity-filter.handler \
  --role arn:aws:iam::YOUR_ACCOUNT_ID:role/lambda-ivschat-role \
  --zip-file fileb://profanity-filter.zip \
  --timeout 10 \
  --memory-size 256 \
  --environment Variables={AWS_REGION=us-east-1}
```

**AWS Console:**
1. Mở AWS Lambda Console
2. Nhấn "Create function"
3. Chọn "Author from scratch"
4. Nhập tên: `ivs-chat-profanity-filter`
5. Runtime: Node.js 18.x
6. Architecture: x86_64
7. Chọn IAM role đã tạo
8. Upload file `profanity-filter.zip`
9. Handler: `profanity-filter.handler`
10. Timeout: 10 giây
11. Memory: 256 MB

### Bước 3: Cấu hình IVS Chat Room

```bash
aws ivschat update-room \
  --identifier YOUR_ROOM_ARN \
  --message-review-handler \
    uri=arn:aws:lambda:us-east-1:YOUR_ACCOUNT_ID:function:ivs-chat-profanity-filter
```

**Hoặc qua AWS Console:**
1. Mở IVS Console
2. Vào Chat Rooms
3. Chọn room cần cấu hình
4. Trong "Message review handler", chọn Lambda function vừa tạo
5. Lưu thay đổi

## 🔧 Cấu hình

### Biến môi trường

| Tên | Mô tả | Mặc định |
|-----|-------|----------|
| `AWS_REGION` | AWS Region | `us-east-1` |
| `SEND_WARNING` | Gửi cảnh báo cho user | `true` |
| `ACTION_MODE` | `ALLOW` hoặc `DENY` | `ALLOW` |

### Tùy chỉnh danh sách từ tục tĩu

Sửa file `profanity-filter.js`:

```javascript
const PROFANITY_LIST = [
    'từ1', 'từ2', 'từ3', // Thêm từ của bạn
    // ... thêm nhiều từ khác
];
```

## 📖 API

### 1. IVS Chat Message Review Handler

**Input Event:**
```json
{
  "eventName": "aws:ivschat:Message",
  "content": {
    "message": "Your message here"
  },
  "sender": {
    "userId": "user123",
    "attributes": {
      "username": "testuser"
    }
  },
  "roomArn": "arn:aws:ivschat:...",
  "sendTime": "2025-10-15T00:00:00Z"
}
```

**Output:**
```json
{
  "reviewResult": "ALLOW",
  "content": {
    "message": "Your filtered message",
    "filtered": true,
    "originalMessage": "Your message here"
  }
}
```

### 2. API Gateway (Optional)

**Request:**
```json
POST /filter
{
  "message": "Your message here",
  "action": "filter"  // hoặc "check"
}
```

**Response (action: "filter"):**
```json
{
  "originalMessage": "Your message here",
  "filteredMessage": "Your filtered message",
  "containsProfanity": true,
  "profanityDetected": true
}
```

**Response (action: "check"):**
```json
{
  "originalMessage": "Your message here",
  "containsProfanity": true
}
```

## 🧪 Test

Kết quả test:

```
✅ Test 1: filterProfanity() - PASS
✅ Test 2: IVS Chat Event - PASS
✅ Test 3: API Gateway Event - PASS
✅ Test 4: Check Action - PASS
✅ Test 5: Edge Cases - PASS
```

## 🔍 Monitoring

### CloudWatch Logs

```bash
aws logs tail /aws/lambda/ivs-chat-profanity-filter --follow
```

### Metrics

- Invocations
- Duration
- Errors
- Filtered messages count

## 🛠️ Troubleshooting

### Lỗi: Module not found

```bash
cd lambda
npm install @aws-sdk/client-ivschat
```

### Test không chạy được

Đảm bảo đã cài Node.js >= 18.x:
```bash
node --version
```

### Lambda timeout

Tăng timeout trong AWS Lambda Console hoặc CLI:
```bash
aws lambda update-function-configuration \
  --function-name ivs-chat-profanity-filter \
  --timeout 30
```

## 📝 License

MIT

## 👨‍💻 Author

AWS IVS Streaming Application

## 🔗 Resources

- [AWS IVS Chat Documentation](https://docs.aws.amazon.com/ivs/latest/chatdocs/)
- [AWS Lambda Documentation](https://docs.aws.amazon.com/lambda/)
- [AWS SDK for JavaScript v3](https://docs.aws.amazon.com/AWSJavaScriptSDK/v3/latest/)
