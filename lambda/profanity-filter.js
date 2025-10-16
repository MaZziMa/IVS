/**
 * AWS Lambda Function - IVS Chat Profanity Filter
 * Filters profane words from AWS IVS Chat messages
 * Integrates with IVS Chat as a message review handler
 */

const { IvschatClient, SendEventCommand } = require('@aws-sdk/client-ivschat');

// Initialize IVS Chat client
const ivschatClient = new IvschatClient({ 
    region: process.env.AWS_REGION || 'us-east-1' 
});

// Danh sách các từ tục tĩu cần lọc (10 từ ví dụ - có thể thay đổi)
const PROFANITY_LIST = [
    'damn',
    'hell',
    'crap',
    'stupid',
    'idiot',
    'jerk',
    'fool',
    'dumb',
    'loser',
    'moron'
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
    
    // Lọc từng từ trong danh sách
    PROFANITY_LIST.forEach(word => {
        // Tạo regex để tìm từ (case-insensitive, word boundaries)
        const regex = new RegExp(`\\b${word}\\b`, 'gi');
        
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

    return PROFANITY_LIST.some(word => {
        const regex = new RegExp(`\\b${word}\\b`, 'gi');
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
