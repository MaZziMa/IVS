/**
 * Profanity Filter Utility
 * Filters inappropriate language from chat messages
 * Supports Vietnamese and English
 */

// Danh sách từ tục tĩu tiếng Việt
const VIETNAMESE_PROFANITY = [
    // Từ tục phổ biến (đã làm nhẹ để tránh vi phạm)
    'vcl', 'vl', 'cc', 'cl', 'dcm', 'dmm', 'dit', 'lol', 'loz',
    'ngu', 'ngốc', 'khùng', 'điên', 'óc chó', 'óc lợn',
    'đồ ngu', 'đồ khùng', 'đồ điên', 'con chó', 'con lợn',
    'thằng ngu', 'thằng khùng', 'thằng điên',
    'bố láo', 'mẹ mày', 'cha mày',
    'đồ chó', 'đồ lợn', 'súc vật', 'súc sinh',
    'chó má', 'lợn', 'ngu si', 'ngu dốt', 'đần độn'
];

// Danh sách từ tục tiếng Anh
const ENGLISH_PROFANITY = [
    'fuck', 'shit', 'damn', 'hell', 'ass', 'bitch', 'bastard',
    'crap', 'dick', 'pussy', 'cock', 'piss', 'asshole',
    'motherfucker', 'fck', 'fuk', 'sht', 'btch', 'b1tch',
    'stupid', 'idiot', 'retard', 'moron', 'dumb', 'dumbass',
    'wtf', 'stfu', 'gtfo', 'kys', 'fag', 'faggot', 'slut', 'whore'
];

// Kết hợp cả hai danh sách
const PROFANITY_LIST = [...VIETNAMESE_PROFANITY, ...ENGLISH_PROFANITY];

// Patterns đặc biệt (leetspeak, variations)
const PROFANITY_PATTERNS = [
    { pattern: /v+[\s\.]*c+[\s\.]*l+/gi, replacement: '***' },     // vcl, v.c.l
    { pattern: /c+[\s\.]*[cC]+/gi, replacement: '**' },            // cc, c.c
    { pattern: /f+[\s\.]*u+[\s\.]*c+[\s\.]*k+/gi, replacement: '****' }, // fuck, f.u.c.k
    { pattern: /s+[\s\.]*h+[\s\.]*[i1]+[\s\.]*t+/gi, replacement: '****' }, // shit, sh1t
    { pattern: /b+[\s\.]*[i1]+[\s\.]*t+[\s\.]*c+[\s\.]*h+/gi, replacement: '*****' }, // bitch
    { pattern: /d+[\s\.]*m+/gi, replacement: '**' },               // dm, d.m
    { pattern: /đ+[\s\.]*m+/gi, replacement: '**' },               // đm, đ.m
];

/**
 * Thay thế từ tục tĩu bằng dấu sao (*)
 * @param {string} text - Văn bản cần lọc
 * @returns {Object} - { filtered: string, wasFiltered: boolean }
 */
function filterProfanity(text) {
    if (!text || typeof text !== 'string') {
        return { filtered: text, wasFiltered: false };
    }

    let filteredText = text;
    let wasFiltered = false;
    
    // Bước 1: Lọc theo patterns đặc biệt
    PROFANITY_PATTERNS.forEach(({ pattern, replacement }) => {
        const before = filteredText;
        filteredText = filteredText.replace(pattern, replacement);
        if (before !== filteredText) wasFiltered = true;
    });
    
    // Bước 2: Lọc từng từ trong danh sách
    PROFANITY_LIST.forEach(word => {
        // Escape special characters trong từ
        const escapedWord = word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        
        // Tạo regex để tìm từ (case-insensitive)
        const regex = new RegExp(`\\b${escapedWord}\\b`, 'gi');
        
        // Thay thế bằng dấu sao có độ dài bằng từ gốc
        const before = filteredText;
        filteredText = filteredText.replace(regex, (match) => {
            return '*'.repeat(match.length);
        });
        if (before !== filteredText) wasFiltered = true;
    });

    return {
        filtered: filteredText,
        wasFiltered: wasFiltered,
        original: text
    };
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
        // Reset lastIndex để tránh bug với global flag
        pattern.lastIndex = 0;
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
 * Lấy severity level của profanity
 * @param {string} text - Văn bản
 * @returns {string} - 'none', 'mild', 'moderate', 'severe'
 */
function getProfanitySeverity(text) {
    if (!containsProfanity(text)) return 'none';
    
    const severeProfanity = ['fuck', 'shit', 'bitch', 'asshole', 'motherfucker'];
    const hasSevere = severeProfanity.some(word => {
        const regex = new RegExp(`\\b${word}\\b`, 'gi');
        return regex.test(text);
    });
    
    if (hasSevere) return 'severe';
    
    const moderateProfanity = ['damn', 'hell', 'ass', 'crap', 'dick'];
    const hasModerate = moderateProfanity.some(word => {
        const regex = new RegExp(`\\b${word}\\b`, 'gi');
        return regex.test(text);
    });
    
    if (hasModerate) return 'moderate';
    
    return 'mild';
}

module.exports = {
    filterProfanity,
    containsProfanity,
    getProfanitySeverity,
    PROFANITY_LIST
};
