require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });

const { DynamoDBClient } = require('@aws-sdk/client-dynamodb');
const { DynamoDBDocumentClient, ScanCommand, UpdateCommand } = require('@aws-sdk/lib-dynamodb');
const { CognitoIdentityProviderClient, GetUserCommand } = require('@aws-sdk/client-cognito-identity-provider');

const dynamoClient = new DynamoDBClient({
    region: process.env.AWS_REGION || 'ap-southeast-1'
});
const docClient = DynamoDBDocumentClient.from(dynamoClient);

const cognitoClient = new CognitoIdentityProviderClient({
    region: process.env.AWS_REGION || 'ap-southeast-1'
});

const STREAMS_TABLE = process.env.DYNAMODB_STREAMS_TABLE || 'ivs_streams';

console.log('Using AWS Region:', process.env.AWS_REGION);
console.log('Using DynamoDB Table:', STREAMS_TABLE);

async function addUsernameToStreams() {
    console.log('Đang quét tất cả streams trong DynamoDB...');
    
    // Scan all streams
    const scanParams = {
        TableName: STREAMS_TABLE
    };
    
    const result = await docClient.send(new ScanCommand(scanParams));
    const streams = result.Items || [];
    
    console.log(`Tìm thấy ${streams.length} stream(s)`);
    
    for (const stream of streams) {
        console.log(`\nXử lý stream: userId=${stream.userId}`);
        console.log(`  Title: ${stream.title || 'N/A'}`);
        console.log(`  Channel ARN: ${stream.channelArn || 'N/A'}`);
        console.log(`  Created At: ${stream.createdAt}`);
        
        // Check if userName already exists
        if (stream.userName) {
            console.log(`  ✓ Stream đã có userName: ${stream.userName}`);
            continue;
        }
        
        // Try to get username from Cognito
        let userName = null;
        
        try {
            // First, we need to get the user's access token or use AdminGetUser
            // Since we don't have the access token here, we'll use a default approach
            // You might need to manually set this or use AWS CLI to get user info
            
            console.log('  ℹ Không thể tự động lấy username từ Cognito (cần access token)');
            console.log('  ℹ Vui lòng chạy script với tham số username:');
            console.log(`  node add-username-to-streams.js ${stream.userId} <username>`);
            
        } catch (error) {
            console.error('  ✗ Lỗi khi lấy thông tin user:', error.message);
        }
    }
}

// If run with arguments: node script.js <userId> <userName>
async function updateSpecificStream(userId, userName) {
    console.log(`Đang cập nhật stream cho userId=${userId} với userName=${userName}...`);
    
    // First, get the stream to find its createdAt (sort key)
    const scanParams = {
        TableName: STREAMS_TABLE,
        FilterExpression: 'userId = :userId',
        ExpressionAttributeValues: {
            ':userId': userId
        }
    };
    
    const result = await docClient.send(new ScanCommand(scanParams));
    const streams = result.Items || [];
    
    if (streams.length === 0) {
        console.log('✗ Không tìm thấy stream nào với userId này');
        return;
    }
    
    console.log(`Tìm thấy ${streams.length} stream(s) cho user này`);
    
    // Update each stream
    for (const stream of streams) {
        console.log(`\nCập nhật stream: createdAt=${stream.createdAt}`);
        console.log(`  Old userName: ${stream.userName}`);
        console.log(`  New userName: ${userName}`);
        
        const updateParams = {
            TableName: STREAMS_TABLE,
            Key: {
                userId: userId,
                createdAt: stream.createdAt
            },
            UpdateExpression: 'SET userName = :userName',
            ExpressionAttributeValues: {
                ':userName': userName
            }
        };
        
        try {
            await docClient.send(new UpdateCommand(updateParams));
            console.log('  ✓ Đã cập nhật userName thành công!');
        } catch (error) {
            console.error('  ✗ Lỗi khi cập nhật:', error.message);
        }
    }
}

// Main execution
(async () => {
    try {
        const args = process.argv.slice(2);
        
        if (args.length >= 2) {
            // Update specific stream
            await updateSpecificStream(args[0], args[1]);
        } else {
            // Scan all streams
            await addUsernameToStreams();
            console.log('\n===========================================');
            console.log('Để cập nhật stream, chạy lệnh:');
            console.log('node add-username-to-streams.js <userId> <username>');
            console.log('\nVí dụ:');
            console.log('node add-username-to-streams.js <your-sub-id> sang59498');
            console.log('===========================================\n');
        }
    } catch (error) {
        console.error('Lỗi:', error);
    }
})();
