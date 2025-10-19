/**
 * Test Profanity Filter
 * Run: node server/utils/test-profanity-filter.js
 */

const { filterProfanity, containsProfanity, getProfanitySeverity } = require('./profanity-filter');

console.log('🧪 Testing Profanity Filter\n');

const testCases = [
    // Vietnamese
    'Chào bạn!',
    'vcl quá',
    'Đồ ngu',
    'thằng khùng',
    'cc gì đây',
    'Xin chào mọi người',
    'Mày ngu lắm',
    'Bố láo à',
    
    // English
    'Hello world',
    'What the fuck',
    'This is shit',
    'You are stupid',
    'Nice game!',
    'F*ck this',
    'wtf is this',
    
    // Leetspeak
    'f.u.c.k',
    'v.c.l',
    'sh1t',
    
    // Mixed
    'Chơi game vcl',
    'Hello các bạn ngu',
    'Nice cc gì',
];

console.log('📝 Test Results:\n');
console.log('═'.repeat(80));

testCases.forEach((text, index) => {
    const result = filterProfanity(text);
    const hasProfanity = containsProfanity(text);
    const severity = getProfanitySeverity(text);
    
    console.log(`\nTest ${index + 1}:`);
    console.log(`  Original:  "${text}"`);
    console.log(`  Filtered:  "${result.filtered}"`);
    console.log(`  Contains:  ${hasProfanity ? '❌ YES' : '✅ NO'}`);
    console.log(`  Severity:  ${severity}`);
    console.log(`  Changed:   ${result.wasFiltered ? '⚠️  YES' : '✓ NO'}`);
    
    if (result.wasFiltered) {
        console.log(`  \x1b[33m→ Profanity detected and filtered!\x1b[0m`);
    }
});

console.log('\n' + '═'.repeat(80));
console.log('\n✅ All tests completed!\n');

// Performance test
console.log('⚡ Performance Test:');
const iterations = 10000;
const testText = 'Hello vcl this is a test shit message wtf';
const startTime = Date.now();

for (let i = 0; i < iterations; i++) {
    filterProfanity(testText);
}

const endTime = Date.now();
const avgTime = (endTime - startTime) / iterations;

console.log(`  Iterations: ${iterations}`);
console.log(`  Total time: ${endTime - startTime}ms`);
console.log(`  Average:    ${avgTime.toFixed(4)}ms per filter`);
console.log(`  Throughput: ${Math.round(iterations / ((endTime - startTime) / 1000))} messages/second`);
console.log();
