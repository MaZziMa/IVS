/**
 * AWS Lambda Function - IVS Chat Profanity Filter
 * Filters profane words from AWS IVS Chat messages
 * Integrates with IVS Chat as a message review handler
 * Supports Vietnamese and English profanity detection
 */

// Lazy load AWS SDK only when needed
let IvschatClient, SendEventCommand, ivschatClient;

try {
    const awsSdk = require('@aws-sdk/client-ivschat');
    IvschatClient = awsSdk.IvschatClient;
    SendEventCommand = awsSdk.SendEventCommand;
    
    // Initialize IVS Chat client
    ivschatClient = new IvschatClient({ 
        region: process.env.AWS_REGION || 'us-east-1' 
    });
} catch (error) {
    console.log('AWS SDK not available (running in test mode)');
}

// Danh sách từ tục tĩu tiếng Việt
const VIETNAMESE_PROFANITY = [
    // Từ tục phổ biến (đã làm nhẹ)
    'đ.m', 'đ.m.m', 'd.m', 'vcl', 'vl', 'cc', 'cl', 'dcm', 'dmm',
    'đ.t', 'd.t', 'dit', 'đit', 'lol', 'loz', 'lồn', 'buồi',
    'cặc', 'cak', 'cak', 'đ.đ', 'd.d', 'đ.b', 'd.b',
    'ngu', 'ngốc', 'khùng', 'điên', 'óc chó', 'óc lợn',
    'đồ ngu', 'đồ khùng', 'đồ điên', 'con chó', 'con lợn',
    'thằng ngu', 'thằng khùng', 'thằng điên',
    'đ.c', 'd.c', 'đụ', 'đéo', 'deo', 'đ.e.o', 'd.e.o',
    'địt', 'đ.ị.t', 'd.i.t', 'bố láo', 'mẹ mày', 'cha mày',
    'đồ chó', 'đồ lợn', 'súc vật', 'súc sinh'
];

// Danh sách từ tục tiếng Anh
const ENGLISH_PROFANITY = [
    'fuck', 'shit', 'damn', 'hell', 'ass', 'bitch', 'bastard',
    'crap', 'dick', 'pussy', 'cock', 'piss', 'asshole',
    'motherfucker', 'fck', 'fuk', 'sht', 'btch', 'b1tch',
    'stupid', 'idiot', 'retard', 'moron', 'dumb', 'dumbass',
    'wtf', 'stfu', 'gtfo', 'kys'
];

// Kết hợp cả hai danh sách
const PROFANITY_LIST = [...VIETNAMESE_PROFANITY, ...ENGLISH_PROFANITY];

// Patterns đặc biệt (leetspeak, variations)
const PROFANITY_PATTERNS = [
    { pattern: /đ+[\s\.]*[mM]+/gi, replacement: '***' },           // đ.m, đ m, đmm
    { pattern: /v+[\s\.]*c+[\s\.]*l+/gi, replacement: '***' },     // vcl, v.c.l
    { pattern: /c+[\s\.]*[cC]+/gi, replacement: '**' },            // cc, c.c
    { pattern: /đ+[\s\.]*[cC]+/gi, replacement: '**' },            // đc, đ.c
    { pattern: /f+[\s\.]*u+[\s\.]*c+[\s\.]*k+/gi, replacement: '****' }, // fuck, f.u.c.k
    { pattern: /s+[\s\.]*h+[\s\.]*[i1]+[\s\.]*t+/gi, replacement: '****' }, // shit, sh1t
    { pattern: /b+[\s\.]*[i1]+[\s\.]*t+[\s\.]*c+[\s\.]*h+/gi, replacement: '*****' }, // bitch
];

/**
 * Thay thế từ tục tĩu bằng dấu sao (*)
 * @param {string} text - Văn bản cần lọc
 * @returns {string} - Văn bản đã được lọc
 */
function filterProfanity(text) {
    if (!text || typeof text !== 'string') {
        return text;
    }

    let filteredText = text;
    
    // Bước 1: Lọc theo patterns đặc biệt
    PROFANITY_PATTERNS.forEach(({ pattern, replacement }) => {
        filteredText = filteredText.replace(pattern, replacement);
    });
    
    // Bước 2: Lọc từng từ trong danh sách
    PROFANITY_LIST.forEach(word => {
        // Escape special characters trong từ
        const escapedWord = word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        
        // Tạo regex để tìm từ (case-insensitive, có thể có dấu cách/chấm ở giữa)
        const regex = new RegExp(`\\b${escapedWord.split('').join('[\\s\\.]*')}\\b`, 'gi');
        
        // Thay thế bằng dấu sao có độ dài bằng từ gốc
        filteredText = filteredText.replace(regex, (match) => {
            return '*'.repeat(match.length);
        });
    });

    return filteredText;
}

/**
 * Kiểm tra xem văn bản có chứa từ tục tĩu không
 * @param {string} text - Văn bản cần kiểm tra
 * @returns {boolean} - true nếu chứa từ tục tĩu
 */
function containsProfanity(text) {
    if (!text || typeof text !== 'string') {
        return false;
    }

    // Kiểm tra patterns đặc biệt
    const hasPatternMatch = PROFANITY_PATTERNS.some(({ pattern }) => {
        return pattern.test(text);
    });

    if (hasPatternMatch) return true;

    // Kiểm tra danh sách từ
    return PROFANITY_LIST.some(word => {
        const escapedWord = word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        const regex = new RegExp(`\\b${escapedWord}\\b`, 'gi');
        return regex.test(text);
    });
}

/**
 * Gửi thông báo cảnh báo về từ tục tĩu đến chat room
 * @param {string} roomArn - ARN của chat room
 * @param {string} userId - ID của người dùng vi phạm
 * @param {string} originalMessage - Tin nhắn gốc
 */
async function sendWarningMessage(roomArn, userId, originalMessage) {
    try {
        const warningEvent = {
            eventName: 'profanity-warning',
            attributes: {
                userId: userId,
                message: 'Your message contained inappropriate language and was filtered.',
                originalMessage: originalMessage,
                timestamp: new Date().toISOString()
            }
        };

        const command = new SendEventCommand({
            roomIdentifier: roomArn,
            eventName: warningEvent.eventName,
            attributes: warningEvent.attributes
        });

        await ivschatClient.send(command);
        console.log('Warning message sent successfully');
    } catch (error) {
        console.error('Error sending warning message:', error);
    }
}

/**
 * AWS Lambda Handler - IVS Chat Message Review
 * @param {Object} event - Lambda event from IVS Chat
 * @param {Object} context - Lambda context object
 * @returns {Object} - Review decision
 */
exports.handler = async (event, context) => {
    console.log('IVS Chat Profanity Filter Lambda triggered');
    console.log('Event:', JSON.stringify(event, null, 2));

    try {
        // Xử lý IVS Chat Event
        if (event.eventName === 'aws:ivschat:Message') {
            const { content, sender, roomArn } = event;
            const messageContent = content?.message || content;

            if (!messageContent) {
                console.log('No message content found');
                return {
                    reviewResult: 'ALLOW'
                };
            }

            const hasProfanity = containsProfanity(messageContent);
            
            if (hasProfanity) {
                console.log('Profanity detected in message:', messageContent);
                
                // Lọc tin nhắn
                const filteredMessage = filterProfanity(messageContent);
                
                // Gửi cảnh báo (optional)
                if (roomArn && sender?.userId) {
                    await sendWarningMessage(roomArn, sender.userId, messageContent);
                }
                
                // Trả về tin nhắn đã được lọc
                return {
                    reviewResult: 'ALLOW',
                    content: {
                        message: filteredMessage,
                        filtered: true,
                        originalMessage: messageContent
                    }
                };
            }

            // Cho phép tin nhắn không có từ tục tĩu
            return {
                reviewResult: 'ALLOW'
            };
        }

        // Xử lý API Gateway request (để test)
        if (event.body || event.message) {
            let body = event.body;
            if (typeof body === 'string') {
                body = JSON.parse(body);
            }

            const { message, action = 'filter' } = body || event;

            if (!message) {
                return {
                    statusCode: 400,
                    headers: {
                        'Content-Type': 'application/json',
                        'Access-Control-Allow-Origin': '*'
                    },
                    body: JSON.stringify({
                        error: 'Message is required'
                    })
                };
            }

            let result;
            
            if (action === 'check') {
                result = {
                    originalMessage: message,
                    containsProfanity: containsProfanity(message)
                };
            } else {
                const filteredMessage = filterProfanity(message);
                result = {
                    originalMessage: message,
                    filteredMessage: filteredMessage,
                    containsProfanity: message !== filteredMessage,
                    profanityDetected: containsProfanity(message)
                };
            }

            return {
                statusCode: 200,
                headers: {
                    'Content-Type': 'application/json',
                    'Access-Control-Allow-Origin': '*'
                },
                body: JSON.stringify(result)
            };
        }

        // Default response
        return {
            reviewResult: 'ALLOW'
        };

    } catch (error) {
        console.error('Error processing message:', error);
        
        // Trong trường hợp lỗi, vẫn cho phép tin nhắn để không làm gián đoạn chat
        return {
            reviewResult: 'ALLOW',
            error: error.message
        };
    }
};

// Export các hàm để test
exports.filterProfanity = filterProfanity;
exports.containsProfanity = containsProfanity;
exports.PROFANITY_LIST = PROFANITY_LIST;
