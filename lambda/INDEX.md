# 🎉 AWS IVS Chat Profanity Filter - Hoàn Thành!

## ✅ Tổng quan

Đã tạo thành công hàm Lambda để lọc từ tục tĩu cho AWS IVS Chat với đầy đủ:

- ✅ Hàm Lambda hoàn chỉnh (`profanity-filter.js`)
- ✅ Script test tự động (`test-profanity-filter.js`)
- ✅ Script deploy tự động (`deploy.ps1`)
- ✅ Script setup IAM role (`setup-iam-role.ps1`)
- ✅ File cấu hình (`config.js`)
- ✅ Tài liệu đầy đủ (README, DEPLOY, QUICKSTART)
- ✅ IAM policies mẫu

## 📁 Cấu trúc Files

```
lambda/
├── profanity-filter.js          # ⭐ Hàm Lambda chính
├── test-profanity-filter.js     # 🧪 Script test
├── config.js                    # ⚙️ File cấu hình
├── package.json                 # 📦 Dependencies
│
├── deploy.ps1                   # 🚀 Deploy tự động
├── setup-iam-role.ps1           # 🔐 Setup IAM role
│
├── iam-trust-policy.json        # 📄 Trust policy
├── iam-policy.json              # 📄 IAM permissions
│
├── README.md                    # 📖 Tài liệu chính
├── DEPLOY.md                    # 📖 Hướng dẫn deploy chi tiết
├── QUICKSTART.md                # 🚀 Quick start guide
└── INDEX.md                     # 📄 File này
```

## 🎯 Tính năng chính

### 1. Lọc từ tục tĩu
- Thay thế 10 từ tục tĩu bằng dấu sao (*)
- Không phân biệt chữ hoa/thường
- Chỉ lọc từ đầy đủ (word boundaries)
- Giữ nguyên độ dài từ gốc

### 2. Tích hợp IVS Chat
- Message Review Handler
- Tự động xử lý tin nhắn
- Không làm gián đoạn chat flow
- Gửi cảnh báo cho user

### 3. Hỗ trợ API Gateway
- Endpoint `/filter` để lọc message
- Endpoint `/check` để kiểm tra profanity
- CORS enabled

## 🚀 3 Bước Deploy Nhanh

### Bước 1: Setup IAM Role (2 phút)

```powershell
cd d:\IVS\lambda
.\setup-iam-role.ps1
```

Kết quả: Role ARN được lưu vào `role-arn.txt`

### Bước 2: Deploy Lambda (3 phút)

```powershell
.\deploy.ps1
```

Script tự động:
- Cài đặt dependencies
- Chạy tests
- Đóng gói Lambda
- Deploy lên AWS

### Bước 3: Test (1 phút)

Gửi message vào IVS Chat:
```
"You are an idiot"
```

Kết quả:
```
"You are an *****"
```

## 📊 Kết quả Test

```
🧪 Testing Profanity Filter Lambda

📋 Profanity List: [
  'damn', 'hell', 'crap', 'stupid', 'idiot',
  'jerk', 'fool', 'dumb', 'loser', 'moron'
]

✅ Test 1: filterProfanity() Function - PASS
✅ Test 2: IVS Chat Event Handler - PASS
✅ Test 3: API Gateway Event - PASS
✅ Test 4: Check Action - PASS
✅ Test 5: Edge Cases - PASS

════════════════════════════════════════════
✅ All tests completed!
════════════════════════════════════════════
```

## 🔧 Tùy chỉnh

### Thay đổi danh sách từ

Sửa `profanity-filter.js` dòng 25:

```javascript
const PROFANITY_LIST = [
    'your', 'custom', 'words', 'here'
];
```

### Thay đổi ký tự thay thế

Sửa `config.js`:

```javascript
config: {
    replacementChar: '#',  // Thay vì '*'
}
```

### Thay đổi hành động

```javascript
config: {
    action: 'DENY',  // Chặn message thay vì lọc
}
```

## 📖 Tài liệu

| File | Mô tả |
|------|-------|
| [QUICKSTART.md](QUICKSTART.md) | 🚀 Hướng dẫn nhanh 5 phút |
| [DEPLOY.md](DEPLOY.md) | 📖 Hướng dẫn deploy chi tiết |
| [README.md](README.md) | 📚 Tài liệu đầy đủ API & Config |

## 🧪 Examples

### Ví dụ 1: Lọc từ đơn
```javascript
Input:  "You are an idiot"
Output: "You are an *****"
```

### Ví dụ 2: Lọc nhiều từ
```javascript
Input:  "This is damn stupid"
Output: "This is **** ******"
```

### Ví dụ 3: Mixed case
```javascript
Input:  "You IDIOT"
Output: "You *****"
```

### Ví dụ 4: Không lọc partial words
```javascript
Input:  "idiotic behavior"
Output: "idiotic behavior"  // Không lọc vì "idiotic" != "idiot"
```

## 🔍 Monitoring

### View logs real-time

```bash
aws logs tail /aws/lambda/ivs-chat-profanity-filter --follow
```

### Check metrics

AWS Console → Lambda → ivs-chat-profanity-filter → Monitoring

### Key metrics to watch
- Invocations
- Duration
- Errors
- Filtered messages count

## ⚙️ Configuration

### Environment Variables

| Tên | Mô tả | Default |
|-----|-------|---------|
| `AWS_REGION` | AWS Region | `us-east-1` |
| `SEND_WARNING` | Gửi cảnh báo | `true` |
| `ACTION_MODE` | ALLOW/DENY | `ALLOW` |

### Lambda Settings

- **Runtime:** Node.js 18.x
- **Handler:** profanity-filter.handler
- **Memory:** 256 MB
- **Timeout:** 10 seconds
- **Architecture:** x86_64

## 🛠️ Troubleshooting

### Lỗi thường gặp

| Lỗi | Giải pháp |
|-----|-----------|
| Module not found | `npm install` |
| AWS CLI not found | Cài đặt AWS CLI |
| Access Denied | Kiểm tra IAM permissions |
| Lambda timeout | Tăng timeout lên 30s |
| Test failed | Kiểm tra Node.js >= 18.x |

### Debug

```bash
# Kiểm tra Lambda logs
aws logs tail /aws/lambda/ivs-chat-profanity-filter --follow

# Test local
npm test

# Kiểm tra IAM role
aws iam get-role --role-name lambda-ivschat-profanity-filter-role

# Kiểm tra Lambda
aws lambda get-function --function-name ivs-chat-profanity-filter
```

## 📚 API Reference

### IVS Chat Event

```javascript
{
  eventName: "aws:ivschat:Message",
  content: { message: "text" },
  sender: { userId: "id", attributes: {...} },
  roomArn: "arn:aws:ivschat:...",
  sendTime: "ISO8601"
}
```

### Response

```javascript
{
  reviewResult: "ALLOW|DENY",
  content: {
    message: "filtered text",
    filtered: true,
    originalMessage: "original text"
  }
}
```

## 🔗 Resources

- [AWS IVS Chat Docs](https://docs.aws.amazon.com/ivs/latest/chatdocs/)
- [AWS Lambda Docs](https://docs.aws.amazon.com/lambda/)
- [AWS SDK JS v3](https://docs.aws.amazon.com/AWSJavaScriptSDK/v3/latest/)
- [IVS Message Review](https://docs.aws.amazon.com/ivs/latest/chatdocs/message-review.html)

## ✅ Checklist Hoàn Thành

- [x] Tạo hàm Lambda
- [x] Viết tests
- [x] Tạo script deploy
- [x] Tạo IAM policies
- [x] Viết documentation
- [x] Test thành công
- [ ] Deploy lên AWS
- [ ] Cấu hình IVS Chat
- [ ] Test production

## 🎉 Next Steps

1. **Deploy ngay:**
   ```powershell
   .\setup-iam-role.ps1
   .\deploy.ps1
   ```

2. **Tùy chỉnh từ tục tĩu** theo nhu cầu

3. **Monitor logs** sau khi deploy

4. **Setup alerts** trên CloudWatch

5. **Scale** nếu cần (tăng memory/timeout)

## 💡 Tips

- Thêm từ tiếng Việt vào `PROFANITY_LIST`
- Sử dụng CloudWatch để track filtered messages
- Setup SNS alert khi có quá nhiều violations
- Implement rate limiting cho users vi phạm
- Backup danh sách từ tục tĩu ra DynamoDB

## 📞 Support

Nếu gặp vấn đề:
1. Xem [QUICKSTART.md](QUICKSTART.md)
2. Xem [DEPLOY.md](DEPLOY.md)
3. Check CloudWatch Logs
4. Tạo GitHub Issue

---

**🚀 Ready to deploy? Chạy `.\setup-iam-role.ps1` để bắt đầu!**
