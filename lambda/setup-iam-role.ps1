# Setup IAM Role for Lambda - IVS Chat Profanity Filter
# Script tu dong tao IAM role voi cac permissions can thiet

Write-Host "IAM Role Setup for Lambda" -ForegroundColor Cyan
Write-Host "================================================" -ForegroundColor Cyan
Write-Host ""

$roleName = "lambda-ivschat-profanity-filter-role"
$policyName = "lambda-ivschat-profanity-filter-policy"

# Kiem tra AWS CLI
Write-Host "Checking AWS CLI..." -ForegroundColor Yellow
try {
    $awsVersion = aws --version
    Write-Host "AWS CLI installed: $awsVersion" -ForegroundColor Green
} catch {
    Write-Host "AWS CLI not found. Please install AWS CLI first." -ForegroundColor Red
    exit 1
}

# Kiem tra credentials
Write-Host "Checking AWS credentials..." -ForegroundColor Yellow
try {
    $identity = aws sts get-caller-identity | ConvertFrom-Json
    Write-Host "Authenticated as: $($identity.Arn)" -ForegroundColor Green
    $accountId = $identity.Account
} catch {
    Write-Host "AWS credentials not configured. Run 'aws configure' first." -ForegroundColor Red
    exit 1
}

# Kiem tra xem role da ton tai chua
Write-Host ""
Write-Host "Checking if IAM role exists..." -ForegroundColor Yellow
$roleExists = $false

try {
    aws iam get-role --role-name $roleName 2>$null
    if ($LASTEXITCODE -eq 0) {
        $roleExists = $true
        Write-Host "Role '$roleName' already exists" -ForegroundColor Yellow
        $overwrite = Read-Host "Do you want to update it? (y/n)"
        if ($overwrite -ne 'y') {
            Write-Host "Cancelled by user" -ForegroundColor Red
            exit 0
        }
    }
} catch {
    Write-Host "Role does not exist. Will create new role." -ForegroundColor Yellow
}

# Tao hoac update role
Write-Host ""
if (-not $roleExists) {
    Write-Host "Creating IAM role..." -ForegroundColor Yellow
    
    aws iam create-role --role-name $roleName --assume-role-policy-document file://iam-trust-policy.json --description "Role for IVS Chat Profanity Filter Lambda function"
    
    if ($LASTEXITCODE -eq 0) {
        Write-Host "IAM role created successfully" -ForegroundColor Green
    } else {
        Write-Host "Failed to create IAM role" -ForegroundColor Red
        exit 1
    }
} else {
    Write-Host "Updating IAM role trust policy..." -ForegroundColor Yellow
    
    aws iam update-assume-role-policy --role-name $roleName --policy-document file://iam-trust-policy.json
    
    if ($LASTEXITCODE -eq 0) {
        Write-Host "IAM role trust policy updated" -ForegroundColor Green
    } else {
        Write-Host "Failed to update IAM role" -ForegroundColor Red
    }
}

# Attach AWS managed policy cho CloudWatch Logs
Write-Host ""
Write-Host "Attaching AWS managed policies..." -ForegroundColor Yellow

aws iam attach-role-policy --role-name $roleName --policy-arn "arn:aws:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole"

if ($LASTEXITCODE -eq 0) {
    Write-Host "Attached AWSLambdaBasicExecutionRole" -ForegroundColor Green
} else {
    Write-Host "Failed to attach AWSLambdaBasicExecutionRole (may already be attached)" -ForegroundColor Yellow
}

# Tao custom policy cho IVS Chat
Write-Host ""
Write-Host "Creating custom policy for IVS Chat..." -ForegroundColor Yellow

# Kiem tra xem policy da ton tai chua
$policyArn = "arn:aws:iam::${accountId}:policy/${policyName}"
$policyExists = $false

try {
    aws iam get-policy --policy-arn $policyArn 2>$null
    if ($LASTEXITCODE -eq 0) {
        $policyExists = $true
        Write-Host "Policy already exists: $policyArn" -ForegroundColor Yellow
    }
} catch {
    Write-Host "Policy does not exist. Will create new policy." -ForegroundColor Yellow
}

if (-not $policyExists) {
    aws iam create-policy --policy-name $policyName --policy-document file://iam-policy.json --description "Policy for IVS Chat Profanity Filter Lambda"
    
    if ($LASTEXITCODE -eq 0) {
        Write-Host "Custom policy created" -ForegroundColor Green
    } else {
        Write-Host "Failed to create custom policy" -ForegroundColor Red
        exit 1
    }
}

# Attach custom policy
Write-Host ""
Write-Host "Attaching custom policy to role..." -ForegroundColor Yellow

aws iam attach-role-policy --role-name $roleName --policy-arn $policyArn

if ($LASTEXITCODE -eq 0) {
    Write-Host "Custom policy attached" -ForegroundColor Green
} else {
    Write-Host "Failed to attach custom policy (may already be attached)" -ForegroundColor Yellow
}

# Lay thong tin role
Write-Host ""
Write-Host "Role Information:" -ForegroundColor Cyan
Write-Host "================================================" -ForegroundColor Cyan

$roleInfo = aws iam get-role --role-name $roleName | ConvertFrom-Json

Write-Host "Role Name: $($roleInfo.Role.RoleName)" -ForegroundColor White
Write-Host "Role ARN: $($roleInfo.Role.Arn)" -ForegroundColor White
Write-Host "Created: $($roleInfo.Role.CreateDate)" -ForegroundColor White
Write-Host ""

# List attached policies
Write-Host "Attached Policies:" -ForegroundColor Cyan
$policies = aws iam list-attached-role-policies --role-name $roleName | ConvertFrom-Json
foreach ($policy in $policies.AttachedPolicies) {
    Write-Host "  - $($policy.PolicyName)" -ForegroundColor Green
}

# Hoan thanh
Write-Host ""
Write-Host "IAM Role setup completed!" -ForegroundColor Green
Write-Host "================================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "Role ARN (copy this):" -ForegroundColor Yellow
Write-Host "$($roleInfo.Role.Arn)" -ForegroundColor Cyan
Write-Host ""
Write-Host "Next steps:" -ForegroundColor Yellow
Write-Host "1. Copy the Role ARN above" -ForegroundColor White
Write-Host "2. Run .\deploy.ps1 to deploy Lambda" -ForegroundColor White
Write-Host "3. Use this Role ARN when prompted" -ForegroundColor White
Write-Host ""

# Luu ARN vao file
$roleInfo.Role.Arn | Out-File -FilePath "role-arn.txt" -Encoding UTF8
Write-Host "Role ARN saved to: role-arn.txt" -ForegroundColor Green
Write-Host ""
