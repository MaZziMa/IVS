/**
 * Test script for Profanity Filter Lambda
 * Run: node test-profanity-filter.js
 */

const { handler, filterProfanity, containsProfanity, PROFANITY_LIST } = require('./profanity-filter');

console.log('🧪 Testing Profanity Filter Lambda\n');
console.log('📋 Profanity List:', PROFANITY_LIST);
console.log('═'.repeat(60));

// Test 1: Filter Function
console.log('\n📝 Test 1: filterProfanity() Function');
console.log('─'.repeat(60));

const testMessages = [
    'Hello, how are you?',
    'You are such an idiot',
    'This is damn stupid',
    'What the hell is this crap',
    'You fool, you are a moron and a loser',
    'Nice work, great job!'
];

testMessages.forEach((message, index) => {
    const filtered = filterProfanity(message);
    const hasProf = containsProfanity(message);
    console.log(`\nTest ${index + 1}:`);
    console.log(`  Original:  "${message}"`);
    console.log(`  Filtered:  "${filtered}"`);
    console.log(`  Contains Profanity: ${hasProf ? '❌ YES' : '✅ NO'}`);
});

// Test 2: IVS Chat Event
console.log('\n\n📺 Test 2: IVS Chat Event Handler');
console.log('─'.repeat(60));

const ivsChatEvent = {
    eventName: 'aws:ivschat:Message',
    content: {
        message: 'You are such an idiot and stupid person'
    },
    sender: {
        userId: 'user123',
        attributes: {
            username: 'testuser',
            displayName: 'Test User'
        }
    },
    roomArn: 'arn:aws:ivschat:us-east-1:123456789012:room/AbCdEfGhIjKl',
    sendTime: new Date().toISOString()
};

handler(ivsChatEvent, {})
    .then(result => {
        console.log('\nIVS Chat Event Result:');
        console.log(JSON.stringify(result, null, 2));
    })
    .catch(error => {
        console.error('\n❌ Error:', error.message);
    });

// Test 3: API Gateway Event
console.log('\n\n🌐 Test 3: API Gateway Event Handler');
console.log('─'.repeat(60));

const apiGatewayEvent = {
    body: JSON.stringify({
        message: 'This is a damn test with stupid words',
        action: 'filter'
    }),
    headers: {
        'Content-Type': 'application/json'
    }
};

handler(apiGatewayEvent, {})
    .then(result => {
        console.log('\nAPI Gateway Event Result:');
        const body = JSON.parse(result.body);
        console.log(JSON.stringify(body, null, 2));
    })
    .catch(error => {
        console.error('\n❌ Error:', error.message);
    });

// Test 4: Check Action
console.log('\n\n🔍 Test 4: Check Action (No Filtering)');
console.log('─'.repeat(60));

const checkEvent = {
    body: JSON.stringify({
        message: 'You are an idiot',
        action: 'check'
    })
};

handler(checkEvent, {})
    .then(result => {
        console.log('\nCheck Action Result:');
        const body = JSON.parse(result.body);
        console.log(JSON.stringify(body, null, 2));
    })
    .catch(error => {
        console.error('\n❌ Error:', error.message);
    });

// Test 5: Edge Cases
console.log('\n\n🔬 Test 5: Edge Cases');
console.log('─'.repeat(60));

const edgeCases = [
    { input: '', desc: 'Empty string' },
    { input: null, desc: 'Null value' },
    { input: undefined, desc: 'Undefined' },
    { input: 'IDIOT', desc: 'Uppercase' },
    { input: 'IdIoT', desc: 'Mixed case' },
    { input: 'idiotic', desc: 'Partial word (should NOT filter)' },
    { input: 'id iot', desc: 'Spaced word (should NOT filter)' },
    { input: '  idiot  ', desc: 'With whitespace' }
];

edgeCases.forEach((test, index) => {
    const filtered = filterProfanity(test.input);
    const hasProf = containsProfanity(test.input);
    console.log(`\nEdge Case ${index + 1}: ${test.desc}`);
    console.log(`  Input:     "${test.input}"`);
    console.log(`  Filtered:  "${filtered}"`);
    console.log(`  Has Profanity: ${hasProf ? '❌ YES' : '✅ NO'}`);
});

// Summary
setTimeout(() => {
    console.log('\n\n' + '═'.repeat(60));
    console.log('✅ All tests completed!');
    console.log('═'.repeat(60));
}, 1000);
