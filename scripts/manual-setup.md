# Setup AWS Resources - Manual Commands
# Chạy từng lệnh một trong PowerShell/Command Prompt

## 1. Kiểm tra AWS CLI
```bash
aws --version
aws sts get-caller-identity
```

## 2. Tạo DynamoDB Tables

### Users Table
```bash
aws dynamodb create-table ^
    --table-name ivs_users ^
    --attribute-definitions AttributeName=userId,AttributeType=S ^
    --key-schema AttributeName=userId,KeyType=HASH ^
    --provisioned-throughput ReadCapacityUnits=5,WriteCapacityUnits=5 ^
    --region us-east-1
```

### Streams Table  
```bash
aws dynamodb create-table ^
    --table-name ivs_streams ^
    --attribute-definitions AttributeName=userId,AttributeType=S AttributeName=createdAt,AttributeType=S ^
    --key-schema AttributeName=userId,KeyType=HASH AttributeName=createdAt,KeyType=RANGE ^
    --provisioned-throughput ReadCapacityUnits=5,WriteCapacityUnits=5 ^
    --region us-east-1
```

## 3. Tạo Cognito User Pool

### Create User Pool
```bash
aws cognito-idp create-user-pool ^
    --pool-name IVS-Streaming-Users ^
    --auto-verified-attributes email ^
    --username-attributes email ^
    --region us-east-1
```

Sau lệnh này, copy USER_POOL_ID từ output.

### Create User Pool Client
```bash
aws cognito-idp create-user-pool-client ^
    --user-pool-id YOUR_USER_POOL_ID_HERE ^
    --client-name IVS-Streaming-Client ^
    --explicit-auth-flows USER_PASSWORD_AUTH ^
    --region us-east-1
```

Copy CLIENT_ID từ output.

## 4. Cập nhật .env file
```
AWS_REGION=us-east-1
COGNITO_USER_POOL_ID=YOUR_USER_POOL_ID
COGNITO_CLIENT_ID=YOUR_CLIENT_ID
COGNITO_REGION=us-east-1
DYNAMODB_STREAMS_TABLE=ivs_streams
DYNAMODB_USERS_TABLE=ivs_users
```