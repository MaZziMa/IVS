# Deploy AWS Lambda - IVS Chat Profanity Filter
# Script tu dong deploy Lambda function

Write-Host "Deploy AWS Lambda - IVS Chat Profanity Filter" -ForegroundColor Cyan
Write-Host "================================================" -ForegroundColor Cyan
Write-Host ""

# Kiem tra AWS CLI
Write-Host "Checking AWS CLI..." -ForegroundColor Yellow
try {
    $awsVersion = aws --version
    Write-Host "AWS CLI installed: $awsVersion" -ForegroundColor Green
} catch {
    Write-Host "AWS CLI not found. Please install AWS CLI first." -ForegroundColor Red
    exit 1
}

# Kiem tra Node.js
Write-Host "Checking Node.js..." -ForegroundColor Yellow
try {
    $nodeVersion = node --version
    Write-Host "Node.js installed: $nodeVersion" -ForegroundColor Green
} catch {
    Write-Host "Node.js not found. Please install Node.js first." -ForegroundColor Red
    exit 1
}

# Cai dat dependencies
Write-Host ""
Write-Host "Installing dependencies..." -ForegroundColor Yellow
npm install

if ($LASTEXITCODE -ne 0) {
    Write-Host "Failed to install dependencies" -ForegroundColor Red
    exit 1
}
Write-Host "Dependencies installed" -ForegroundColor Green

# Chay test
Write-Host ""
Write-Host "Running tests..." -ForegroundColor Yellow
npm test

if ($LASTEXITCODE -ne 0) {
    Write-Host "Tests failed, but continuing with deployment" -ForegroundColor Yellow
}

# Dong goi Lambda
Write-Host ""
Write-Host "Packaging Lambda function..." -ForegroundColor Yellow

# Xoa file zip cu neu co
if (Test-Path "profanity-filter.zip") {
    Remove-Item "profanity-filter.zip"
}

# Tao file zip
Compress-Archive -Path profanity-filter.js,package.json,node_modules -DestinationPath profanity-filter.zip -Force

if (Test-Path "profanity-filter.zip") {
    $fileSize = (Get-Item "profanity-filter.zip").Length / 1MB
    Write-Host "Package created: profanity-filter.zip ($([math]::Round($fileSize, 2)) MB)" -ForegroundColor Green
} else {
    Write-Host "Failed to create package" -ForegroundColor Red
    exit 1
}

# Lay thong tin cau hinh
Write-Host ""
Write-Host "Lambda Configuration" -ForegroundColor Cyan
Write-Host "================================================" -ForegroundColor Cyan

$functionName = Read-Host "Enter Lambda function name (default: ivs-chat-profanity-filter)"
if ([string]::IsNullOrWhiteSpace($functionName)) {
    $functionName = "ivs-chat-profanity-filter"
}

$region = Read-Host "Enter AWS region (default: us-east-1)"
if ([string]::IsNullOrWhiteSpace($region)) {
    $region = "us-east-1"
}

Write-Host ""
Write-Host "Function Name: $functionName" -ForegroundColor Cyan
Write-Host "Region: $region" -ForegroundColor Cyan
Write-Host ""

# Kiem tra xem function da ton tai chua
Write-Host "Checking if function exists..." -ForegroundColor Yellow
$functionExists = $false

try {
    aws lambda get-function --function-name $functionName --region $region 2>$null
    if ($LASTEXITCODE -eq 0) {
        $functionExists = $true
        Write-Host "Function exists. Will update the code." -ForegroundColor Green
    }
} catch {
    Write-Host "Function does not exist. Will create new function." -ForegroundColor Yellow
}

# Update hoac Create function
Write-Host ""
if ($functionExists) {
    # Update existing function
    Write-Host "Updating Lambda function code..." -ForegroundColor Yellow
    
    aws lambda update-function-code --function-name $functionName --zip-file fileb://profanity-filter.zip --region $region
    
    if ($LASTEXITCODE -eq 0) {
        Write-Host "Function code updated successfully!" -ForegroundColor Green
    } else {
        Write-Host "Failed to update function code" -ForegroundColor Red
        exit 1
    }
    
} else {
    # Create new function
    Write-Host "Creating new Lambda function..." -ForegroundColor Yellow
    Write-Host "You need to provide an IAM role ARN" -ForegroundColor Yellow
    Write-Host ""
    
    $roleArn = Read-Host "Enter IAM Role ARN (format: arn:aws:iam::ACCOUNT_ID:role/ROLE_NAME)"
    
    if ([string]::IsNullOrWhiteSpace($roleArn)) {
        Write-Host "IAM Role ARN is required" -ForegroundColor Red
        Write-Host ""
        Write-Host "Please create an IAM role with the following permissions:" -ForegroundColor Yellow
        Write-Host "  - AWSLambdaBasicExecutionRole" -ForegroundColor Yellow
        Write-Host "  - ivschat:SendEvent" -ForegroundColor Yellow
        exit 1
    }
    
    aws lambda create-function --function-name $functionName --runtime nodejs18.x --handler profanity-filter.handler --role $roleArn --zip-file fileb://profanity-filter.zip --timeout 10 --memory-size 256 --region $region
    
    if ($LASTEXITCODE -eq 0) {
        Write-Host "Function created successfully!" -ForegroundColor Green
    } else {
        Write-Host "Failed to create function" -ForegroundColor Red
        exit 1
    }
}

# Lay thong tin function
Write-Host ""
Write-Host "Function Information:" -ForegroundColor Cyan
Write-Host "================================================" -ForegroundColor Cyan

$functionInfo = aws lambda get-function --function-name $functionName --region $region | ConvertFrom-Json

Write-Host "Function Name: $($functionInfo.Configuration.FunctionName)" -ForegroundColor White
Write-Host "ARN: $($functionInfo.Configuration.FunctionArn)" -ForegroundColor White
Write-Host "Runtime: $($functionInfo.Configuration.Runtime)" -ForegroundColor White
Write-Host "Handler: $($functionInfo.Configuration.Handler)" -ForegroundColor White
Write-Host "Memory: $($functionInfo.Configuration.MemorySize) MB" -ForegroundColor White
Write-Host "Timeout: $($functionInfo.Configuration.Timeout) seconds" -ForegroundColor White

# Cau hinh IVS Chat
Write-Host ""
Write-Host "IVS Chat Configuration (Optional)" -ForegroundColor Cyan
Write-Host "================================================" -ForegroundColor Cyan
$configureIVS = Read-Host "Do you want to configure IVS Chat Room now? (y/n)"

if ($configureIVS -eq 'y') {
    $roomArn = Read-Host "Enter IVS Chat Room ARN"
    
    if (-not [string]::IsNullOrWhiteSpace($roomArn)) {
        Write-Host "Configuring IVS Chat Room..." -ForegroundColor Yellow
        
        aws ivschat update-room --identifier $roomArn --message-review-handler uri=$($functionInfo.Configuration.FunctionArn) --region $region
        
        if ($LASTEXITCODE -eq 0) {
            Write-Host "IVS Chat Room configured successfully!" -ForegroundColor Green
        } else {
            Write-Host "Failed to configure IVS Chat Room" -ForegroundColor Red
        }
    }
}

# Hoan thanh
Write-Host ""
Write-Host "Deployment completed!" -ForegroundColor Green
Write-Host "================================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "Next steps:" -ForegroundColor Yellow
Write-Host "1. Test the function in AWS Lambda Console" -ForegroundColor White
Write-Host "2. Configure IVS Chat Room to use this Lambda" -ForegroundColor White
Write-Host "3. Monitor CloudWatch Logs for any issues" -ForegroundColor White
Write-Host ""
Write-Host "View logs with command:" -ForegroundColor Yellow
Write-Host "aws logs tail /aws/lambda/$functionName --follow --region $region" -ForegroundColor Cyan
Write-Host ""
