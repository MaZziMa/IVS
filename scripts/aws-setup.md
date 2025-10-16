# AWS Setup Scripts

## DynamoDB Table Creation

### Create Users Table
```bash
aws dynamodb create-table \
    --table-name ivs_users \
    --attribute-definitions \
        AttributeName=userId,AttributeType=S \
    --key-schema \
        AttributeName=userId,KeyType=HASH \
    --provisioned-throughput \
        ReadCapacityUnits=5,WriteCapacityUnits=5 \
    --region us-east-1
```

### Create Streams Table
```bash
aws dynamodb create-table \
    --table-name ivs_streams \
    --attribute-definitions \
        AttributeName=userId,AttributeType=S \
        AttributeName=createdAt,AttributeType=S \
        AttributeName=channelArn,AttributeType=S \
    --key-schema \
        AttributeName=userId,KeyType=HASH \
        AttributeName=createdAt,KeyType=RANGE \
    --global-secondary-indexes \
        'IndexName=channelArn-index,KeySchema=[{AttributeName=channelArn,KeyType=HASH}],Projection={ProjectionType=ALL},ProvisionedThroughput={ReadCapacityUnits=5,WriteCapacityUnits=5}' \
    --provisioned-throughput \
        ReadCapacityUnits=5,WriteCapacityUnits=5 \
    --region us-east-1
```

## Cognito Setup

### Create User Pool
```bash
aws cognito-idp create-user-pool \
    --pool-name "IVS-Streaming-Users" \
    --policies "PasswordPolicy={MinimumLength=8,RequireUppercase=true,RequireLowercase=true,RequireNumbers=true,RequireSymbols=false}" \
    --auto-verified-attributes email \
    --username-attributes email \
    --region us-east-1
```

### Create User Pool Client
```bash
aws cognito-idp create-user-pool-client \
    --user-pool-id "us-east-1_xxxxxxxxx" \
    --client-name "IVS-Streaming-Client" \
    --explicit-auth-flows "USER_PASSWORD_AUTH" \
    --region us-east-1
```

## PowerShell Scripts

### Windows PowerShell setup script
```powershell
# Set AWS region
$env:AWS_DEFAULT_REGION = "us-east-1"

# Create DynamoDB tables
Write-Host "Creating DynamoDB tables..."

# Users table
aws dynamodb create-table `
    --table-name ivs_users `
    --attribute-definitions AttributeName=userId,AttributeType=S `
    --key-schema AttributeName=userId,KeyType=HASH `
    --provisioned-throughput ReadCapacityUnits=5,WriteCapacityUnits=5 `
    --region us-east-1

# Streams table
aws dynamodb create-table `
    --table-name ivs_streams `
    --attribute-definitions AttributeName=userId,AttributeType=S AttributeName=createdAt,AttributeType=S AttributeName=channelArn,AttributeType=S `
    --key-schema AttributeName=userId,KeyType=HASH AttributeName=createdAt,KeyType=RANGE `
    --global-secondary-indexes "IndexName=channelArn-index,KeySchema=[{AttributeName=channelArn,KeyType=HASH}],Projection={ProjectionType=ALL},ProvisionedThroughput={ReadCapacityUnits=5,WriteCapacityUnits=5}" `
    --provisioned-throughput ReadCapacityUnits=5,WriteCapacityUnits=5 `
    --region us-east-1

Write-Host "DynamoDB tables creation initiated. Please check AWS Console for status."
```