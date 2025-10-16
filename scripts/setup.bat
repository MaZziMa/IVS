@echo off
REM AWS Setup for IVS Streaming App - Simple Batch Version

echo 🚀 AWS IVS Streaming App Setup
echo.

REM Check AWS CLI
aws --version >nul 2>&1
if errorlevel 1 (
    echo ❌ AWS CLI not found. Please install AWS CLI first.
    pause
    exit /b 1
)
echo ✅ AWS CLI found

REM Check AWS credentials
aws sts get-caller-identity >nul 2>&1
if errorlevel 1 (
    echo ❌ AWS credentials not configured. Please run 'aws configure' first.
    pause
    exit /b 1
)
echo ✅ AWS credentials configured
echo.

echo 📊 Creating DynamoDB tables...

REM Create Users table
echo    Creating ivs_users table...
aws dynamodb create-table --table-name ivs_users --attribute-definitions AttributeName=userId,AttributeType=S --key-schema AttributeName=userId,KeyType=HASH --provisioned-throughput ReadCapacityUnits=5,WriteCapacityUnits=5 --region us-east-1 >nul 2>&1

REM Create Streams table
echo    Creating ivs_streams table...
aws dynamodb create-table --table-name ivs_streams --attribute-definitions AttributeName=userId,AttributeType=S AttributeName=createdAt,AttributeType=S --key-schema AttributeName=userId,KeyType=HASH AttributeName=createdAt,KeyType=RANGE --provisioned-throughput ReadCapacityUnits=5,WriteCapacityUnits=5 --region us-east-1 >nul 2>&1

echo.
echo 🔐 Creating Cognito User Pool...

REM Create User Pool - save to temp file
aws cognito-idp create-user-pool --pool-name "IVS-Streaming-Users" --auto-verified-attributes email --username-attributes email --region us-east-1 > temp-pool.json 2>&1

if errorlevel 1 (
    echo    ❌ Failed to create User Pool
    echo    Please create manually in AWS Console
    goto :end
)

echo    ✅ User Pool created successfully
echo.
echo 📝 Next Steps:
echo 1. Check the AWS Console for your User Pool ID
echo 2. Create a User Pool Client in the Console
echo 3. Update your .env file with the IDs
echo 4. Run: npm install
echo 5. Run: npm start

:end
if exist temp-pool.json del temp-pool.json
echo.
echo ✨ Setup complete! Check AWS Console for resource IDs.
pause