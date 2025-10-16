// Script to check stream data in DynamoDB

const { DynamoDBClient } = require('@aws-sdk/client-dynamodb');
const { DynamoDBDocumentClient, ScanCommand, GetCommand } = require('@aws-sdk/lib-dynamodb');

require('dotenv').config();

const ddbClient = new DynamoDBClient({
    region: process.env.AWS_REGION || 'us-east-1'
});
const docClient = DynamoDBDocumentClient.from(ddbClient);

const STREAMS_TABLE = process.env.DYNAMODB_STREAMS_TABLE || 'ivs_streams';

async function checkStreams() {
    try {
        console.log('=== Checking all streams in DynamoDB ===');
        console.log('Table:', STREAMS_TABLE);
        console.log('');
        
        // Scan all items
        const scanParams = {
            TableName: STREAMS_TABLE
        };
        
        const result = await docClient.send(new ScanCommand(scanParams));
        
        console.log(`Found ${result.Items?.length || 0} stream(s)`);
        console.log('');
        
        if (result.Items && result.Items.length > 0) {
            result.Items.forEach((item, index) => {
                console.log(`--- Stream ${index + 1} ---`);
                console.log('userId:', item.userId);
                console.log('userName:', JSON.stringify(item.userName));
                console.log('userName type:', typeof item.userName);
                console.log('userName length:', item.userName?.length);
                console.log('title:', item.title);
                console.log('channelArn:', item.channelArn);
                console.log('createdAt:', item.createdAt);
                console.log('');
            });
        }
        
        // Test specific scan
        console.log('=== Testing userName scan ===');
        const testScanParams = {
            TableName: STREAMS_TABLE,
            FilterExpression: 'userName = :username',
            ExpressionAttributeValues: {
                ':username': 'sang594988'
            }
        };
        
        const testResult = await docClient.send(new ScanCommand(testScanParams));
        console.log('Scan with userName = sang594988:', testResult.Items?.length || 0, 'results');
        
    } catch (error) {
        console.error('Error:', error);
    }
}

checkStreams();
