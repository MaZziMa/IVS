/**
 * Profanity Filter Configuration
 * Tệp cấu hình để tùy chỉnh danh sách từ tục tĩu
 */

module.exports = {
    // Danh sách từ tục tĩu tiếng Anh
    englishProfanity: [
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
    ],

    // Danh sách từ tục tĩu tiếng Việt (ví dụ)
    vietnameseProfanity: [
        'ngu',
        'khon',
        'dien',
        'dao',
        'ngoc'
    ],

    // Cấu hình hành vi
    config: {
        // Ký tự thay thế
        replacementChar: '*',
        
        // Có gửi cảnh báo đến người dùng không
        sendWarning: true,
        
        // Hành động khi phát hiện từ tục tĩu
        // 'ALLOW' - Cho phép tin nhắn nhưng đã lọc
        // 'DENY' - Chặn tin nhắn hoàn toàn
        action: 'ALLOW',
        
        // Có phân biệt chữ hoa/thường không
        caseSensitive: false,
        
        // Thêm metadata vào message đã lọc
        includeMetadata: true,
        
        // Log level
        logLevel: 'info' // 'debug', 'info', 'warn', 'error'
    },

    // Tin nhắn cảnh báo tùy chỉnh
    warningMessages: {
        en: 'Your message contained inappropriate language and has been filtered.',
        vi: 'Tin nhắn của bạn chứa ngôn từ không phù hợp và đã bị lọc.'
    },

    // Danh sách các từ ngoại lệ (không lọc)
    whitelist: [
        // Thêm các từ không nên lọc ở đây
    ],

    // Regex patterns tùy chỉnh
    customPatterns: [
        // Ví dụ: /(\d{3}-\d{2}-\d{4})/ để lọc số SSN
    ]
};
