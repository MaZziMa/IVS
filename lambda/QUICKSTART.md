# 🚀 Quick Start - IVS Chat Profanity Filter

Hướng dẫn nhanh để deploy Lambda lọc từ tục tĩu cho AWS IVS Chat.

## ⚡ 5 phút setup

### Bước 1: Cài đặt dependencies (30 giây)

```powershell
cd d:\IVS\lambda
npm install
```

### Bước 2: Test local (30 giây)

```powershell
npm test
```

Kết quả mong đợi: ✅ All tests passed

### Bước 3: Deploy lên AWS (3 phút)

```powershell
.\deploy.ps1
```

Script sẽ tự động:
1. ✅ Kiểm tra AWS CLI & Node.js
2. ✅ Cài đặt dependencies
3. ✅ Chạy tests
4. ✅ Đóng gói Lambda
5. ✅ Deploy lên AWS
6. ✅ Cấu hình IVS Chat (tùy chọn)

### Bước 4: Cấu hình IVS Chat Room (1 phút)

**Tự động (trong script deploy):**
- Nhập `y` khi được hỏi
- Nhập Room ARN

**Thủ công qua AWS Console:**
1. Mở IVS Console → Chat Rooms
2. Chọn room cần cấu hình
3. Trong "Message review handler", chọn Lambda `ivs-chat-profanity-filter`
4. Save

### Bước 5: Test trên IVS Chat (1 phút)

Gửi tin nhắn test:
```
"You are an idiot"
```

Kết quả mong đợi:
```
"You are an *****"
```

## 📋 Checklist

- [ ] AWS CLI đã cài đặt
- [ ] Node.js >= 18.x đã cài đặt
- [ ] AWS credentials đã cấu hình
- [ ] IAM role có quyền Lambda + IVS Chat
- [ ] IVS Chat Room đã tạo
- [ ] Lambda function đã deploy
- [ ] Lambda đã được thêm vào Chat Room
- [ ] Test thành công

## 🔑 Prerequisites

### 1. AWS CLI

```powershell
# Kiểm tra
aws --version

# Cấu hình
aws configure
```

### 2. Node.js

```powershell
# Kiểm tra
node --version  # >= 18.x
npm --version
```

### 3. IAM Role

Cần IAM role với permissions:
- `AWSLambdaBasicExecutionRole`
- `ivschat:SendEvent`

**Tạo IAM role:**

```bash
aws iam create-role \
  --role-name lambda-ivschat-role \
  --assume-role-policy-document file://trust-policy.json

aws iam attach-role-policy \
  --role-name lambda-ivschat-role \
  --policy-arn arn:aws:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole
```

## 🎯 Tùy chỉnh nhanh

### Thay đổi danh sách từ tục tĩu

Sửa `profanity-filter.js` dòng 25:

```javascript
const PROFANITY_LIST = [
    'word1',
    'word2', 
    'word3'
    // Thêm từ của bạn
];
```

Deploy lại:
```powershell
.\deploy.ps1
```

## 🧪 Ví dụ Test

### Test 1: Lọc từ đơn
```
Input:  "You are an idiot"
Output: "You are an *****"
```

### Test 2: Lọc nhiều từ
```
Input:  "This is damn stupid"
Output: "This is **** ******"
```

### Test 3: Không lọc tin nhắn sạch
```
Input:  "Hello, how are you?"
Output: "Hello, how are you?"
```

## 🔍 Monitoring

### Xem logs real-time

```bash
aws logs tail /aws/lambda/ivs-chat-profanity-filter --follow
```

### Kiểm tra metrics

AWS Console → Lambda → ivs-chat-profanity-filter → Monitoring

## ❓ Troubleshooting

### Lỗi 1: "AWS CLI not found"

**Giải pháp:**
```powershell
# Download và cài đặt AWS CLI
# https://aws.amazon.com/cli/
```

### Lỗi 2: "Module not found"

**Giải pháp:**
```powershell
cd d:\IVS\lambda
npm install
```

### Lỗi 3: "Access Denied"

**Giải pháp:**
```powershell
# Kiểm tra AWS credentials
aws sts get-caller-identity

# Cấu hình lại nếu cần
aws configure
```

### Lỗi 4: Lambda timeout

**Giải pháp:**
```bash
aws lambda update-function-configuration \
  --function-name ivs-chat-profanity-filter \
  --timeout 30
```

## 📞 Support

- 📖 [DEPLOY.md](DEPLOY.md) - Hướng dẫn chi tiết
- 📖 [README.md](README.md) - Tài liệu đầy đủ
- 🐛 GitHub Issues

## ✅ Next Steps

Sau khi setup thành công:

1. **Tùy chỉnh từ tục tĩu** - Thêm/xóa từ theo nhu cầu
2. **Monitoring** - Theo dõi logs và metrics
3. **Scaling** - Điều chỉnh memory/timeout nếu cần
4. **Alert** - Setup CloudWatch alarms
5. **Multi-language** - Thêm từ tiếng Việt

## 🎉 Hoàn thành!

Lambda của bạn đã sẵn sàng lọc từ tục tĩu cho IVS Chat!

Test ngay: Gửi tin nhắn có từ "idiot" vào chat room. 🚀
