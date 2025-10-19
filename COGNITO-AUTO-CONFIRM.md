# Cấu hình Cognito - Tắt Email Verification

## ⚠️ Lưu ý quan trọng

Code hiện tại đã sử dụng `AdminConfirmSignUpCommand` để tự động confirm user sau khi đăng ký. Tuy nhiên, để hoạt động tốt nhất, bạn nên tắt email verification trong Cognito User Pool.

## 🔧 Cách tắt Email Verification trong AWS Console

### Bước 1: Mở AWS Console
1. Đăng nhập vào [AWS Console](https://console.aws.amazon.com/)
2. Tìm và mở **Cognito**

### Bước 2: Chọn User Pool
1. Click vào User Pool của bạn (tên trong `.env`: `COGNITO_USER_POOL_ID`)

### Bước 3: Sửa Sign-up Experience
1. Ở menu bên trái, click **Sign-up experience**
2. Scroll xuống phần **Attribute verification and user account confirmation**
3. Click **Edit**

### Bước 4: Tắt Email Verification
1. Tìm **Email verification**
2. Chọn **No verification** hoặc bỏ check **Email**
3. Click **Save changes**

## 🎯 Kết quả

Sau khi tắt:
- ✅ User đăng ký xong → Có thể login ngay
- ✅ Không cần nhập mã verification
- ✅ Không gửi email verification
- ⚠️ **Lưu ý**: Không verify email thật → có thể có spam/fake accounts

## 🛡️ Alternative: Keep Email Verification (khuyến nghị cho production)

Nếu bạn muốn GIỮ email verification cho production:

### Option 1: Chỉ tắt cho development
```javascript
// server/routes/auth.js
const AUTO_CONFIRM = process.env.NODE_ENV === 'development';

if (!result.UserConfirmed && AUTO_CONFIRM) {
    // Only auto-confirm in dev
    await cognitoClient.send(new AdminConfirmSignUpCommand(...));
}
```

### Option 2: Sử dụng test email domains
Trong Cognito Console:
1. **Sign-up experience** → **Email**
2. Add test email addresses (không gửi email thật)
3. Format: `testuser+123@example.com`

### Option 3: Cấu hình SES cho production
1. Verify domain trong **Amazon SES**
2. Move out of SES Sandbox
3. Configure Cognito to use SES
4. Gửi email verification thật cho users

## 📋 IAM Permissions Required

Để `AdminConfirmSignUpCommand` hoạt động, IAM user/role cần permission:

```json
{
    "Version": "2012-10-17",
    "Statement": [
        {
            "Effect": "Allow",
            "Action": [
                "cognito-idp:AdminConfirmSignUp"
            ],
            "Resource": "arn:aws:cognito-idp:REGION:ACCOUNT:userpool/POOL_ID"
        }
    ]
}
```

## 🧪 Test Auto-Confirm

1. Đăng ký user mới
2. Kiểm tra console logs:
   ```
   ✓ Auto-confirmed user: test@example.com
   ✓ Channel created for new user: testuser
   ```
3. Login ngay mà không cần verify email

## 🔍 Troubleshooting

### Error: "User is not confirmed"
- Kiểm tra IAM permissions
- Kiểm tra `AdminConfirmSignUpCommand` có được gọi không
- Check CloudWatch logs

### Error: "User cannot be confirmed"
- User Pool settings có require email verification
- Thử tắt email verification trong Console

### Auto-login không hoạt động
- Check browser console for errors
- Verify token được lưu vào localStorage
- Check PM2 logs: `npx pm2 logs ivs-server`

## 📚 Resources

- [AWS Cognito User Pool Settings](https://docs.aws.amazon.com/cognito/latest/developerguide/user-pool-settings.html)
- [AdminConfirmSignUp API](https://docs.aws.amazon.com/cognito-user-identity-pools/latest/APIReference/API_AdminConfirmSignUp.html)
- [Cognito Email Configuration](https://docs.aws.amazon.com/cognito/latest/developerguide/user-pool-email.html)
