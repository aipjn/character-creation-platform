"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.SanitizationUtils = void 0;
const HTML_ENTITIES = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#x27;',
    '/': '&#x2F;',
    '`': '&#96;',
    '=': '&#x3D;'
};
const SQL_INJECTION_PATTERNS = [
    /(\b(ALTER|CREATE|DELETE|DROP|EXEC(UTE)?|INSERT|SCRIPT|SELECT|UNION|UPDATE)\b)/gi,
    /((\b(AND|OR)\b.{1,6}?\b(TRUE|FALSE)\b)|(\b(AND|OR)\b\s*\d+\s*[=<>]))/gi,
    /(\b(CHAR|NCHAR|VARCHAR|NVARCHAR)\s*\(\s*\d+\s*\))/gi,
    /((\bCONVERT\s*\()|(\bCAST\s*\())/gi,
    /(\b(CONCAT|GROUP_CONCAT)\s*\()/gi
];
const XSS_PATTERNS = [
    /<script[^>]*>.*?<\/script>/gi,
    /<iframe[^>]*>.*?<\/iframe>/gi,
    /<object[^>]*>.*?<\/object>/gi,
    /<embed[^>]*>.*?<\/embed>/gi,
    /<link[^>]*>/gi,
    /<meta[^>]*>/gi,
    /javascript:/gi,
    /vbscript:/gi,
    /data:/gi,
    /on\w+\s*=/gi
];
const PATH_TRAVERSAL_PATTERNS = [
    /\.\.\//g,
    /\.\.\\/g,
    /%2e%2e%2f/gi,
    /%2e%2e%5c/gi,
    /\.\.%2f/gi,
    /\.\.%5c/gi
];
const DANGEROUS_FILENAME_CHARS = /[<>:"|?*\x00-\x1f]/g;
class SanitizationUtils {
    static escapeHtml(input) {
        if (!input || typeof input !== 'string') {
            return '';
        }
        return input.replace(/[&<>"'\/`=]/g, (match) => HTML_ENTITIES[match] || match);
    }
    static stripDangerousHtml(input) {
        if (!input || typeof input !== 'string') {
            return '';
        }
        let sanitized = input;
        XSS_PATTERNS.forEach(pattern => {
            sanitized = sanitized.replace(pattern, '');
        });
        sanitized = sanitized.replace(/\s*on\w+\s*=\s*["'][^"']*["']/gi, '');
        sanitized = sanitized.replace(/\s*on\w+\s*=\s*[^\s>]*/gi, '');
        return sanitized.trim();
    }
    static detectSqlInjection(input) {
        if (!input || typeof input !== 'string') {
            return false;
        }
        return SQL_INJECTION_PATTERNS.some(pattern => pattern.test(input));
    }
    static sanitizeSqlInput(input) {
        if (!input || typeof input !== 'string') {
            return '';
        }
        let sanitized = input.replace(/\0/g, '');
        sanitized = sanitized.replace(/'/g, "''");
        sanitized = sanitized.replace(/"/g, '""');
        sanitized = sanitized.replace(/\\/g, '\\\\');
        return sanitized;
    }
    static sanitizePath(input) {
        if (!input || typeof input !== 'string') {
            return '';
        }
        let sanitized = input;
        PATH_TRAVERSAL_PATTERNS.forEach(pattern => {
            sanitized = sanitized.replace(pattern, '');
        });
        return sanitized;
    }
    static removeControlCharacters(input) {
        if (!input || typeof input !== 'string') {
            return '';
        }
        return input.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '');
    }
    static normalizeUnicode(input) {
        if (!input || typeof input !== 'string') {
            return '';
        }
        try {
            return input.normalize('NFC');
        }
        catch (error) {
            console.warn('Unicode normalization failed:', error);
            return input;
        }
    }
    static sanitizeText(input, options = {}) {
        if (!input || typeof input !== 'string') {
            return '';
        }
        const { allowHtml = false, maxLength = 10000, trimWhitespace = true, removeNullBytes = true, normalizeUnicode = true } = options;
        let sanitized = input;
        if (normalizeUnicode) {
            sanitized = this.normalizeUnicode(sanitized);
        }
        if (removeNullBytes) {
            sanitized = this.removeControlCharacters(sanitized);
        }
        if (!allowHtml) {
            sanitized = this.stripDangerousHtml(sanitized);
            sanitized = this.escapeHtml(sanitized);
        }
        else {
            sanitized = this.stripDangerousHtml(sanitized);
        }
        sanitized = this.sanitizePath(sanitized);
        if (trimWhitespace) {
            sanitized = sanitized.trim();
        }
        if (sanitized.length > maxLength) {
            sanitized = sanitized.substring(0, maxLength);
        }
        return sanitized;
    }
    static sanitizeFilename(filename, options = {}) {
        if (!filename || typeof filename !== 'string') {
            return 'untitled';
        }
        const { maxLength = 255, allowedExtensions, preserveExtension = true } = options;
        let sanitized = filename;
        sanitized = this.sanitizePath(sanitized);
        sanitized = sanitized.replace(DANGEROUS_FILENAME_CHARS, '');
        sanitized = sanitized.replace(/^[\.\s]+|[\.\s]+$/g, '');
        if (preserveExtension && allowedExtensions) {
            const lastDotIndex = sanitized.lastIndexOf('.');
            if (lastDotIndex > 0) {
                const extension = sanitized.substring(lastDotIndex).toLowerCase();
                if (!allowedExtensions.includes(extension)) {
                    sanitized = sanitized.substring(0, lastDotIndex);
                }
            }
        }
        if (!sanitized || sanitized.trim().length === 0) {
            sanitized = 'untitled';
        }
        if (sanitized.length > maxLength) {
            if (preserveExtension) {
                const lastDotIndex = sanitized.lastIndexOf('.');
                if (lastDotIndex > 0) {
                    const extension = sanitized.substring(lastDotIndex);
                    const nameWithoutExt = sanitized.substring(0, lastDotIndex);
                    const maxNameLength = maxLength - extension.length;
                    sanitized = nameWithoutExt.substring(0, maxNameLength) + extension;
                }
                else {
                    sanitized = sanitized.substring(0, maxLength);
                }
            }
            else {
                sanitized = sanitized.substring(0, maxLength);
            }
        }
        return sanitized;
    }
    static sanitizeUrl(url) {
        if (!url || typeof url !== 'string') {
            return '';
        }
        let sanitized = url.trim();
        sanitized = this.removeControlCharacters(sanitized);
        try {
            const urlObj = new URL(sanitized);
            if (!['http:', 'https:'].includes(urlObj.protocol)) {
                throw new Error('Invalid protocol');
            }
            if (/^(javascript|data|vbscript):/i.test(sanitized)) {
                throw new Error('Dangerous protocol');
            }
            return urlObj.href;
        }
        catch (error) {
            console.warn('URL sanitization failed:', error);
            return '';
        }
    }
    static sanitizeEmail(email) {
        if (!email || typeof email !== 'string') {
            return '';
        }
        let sanitized = email.trim().toLowerCase();
        sanitized = this.removeControlCharacters(sanitized);
        sanitized = sanitized.replace(/[^\w@.\-+]/g, '');
        return sanitized;
    }
    static sanitizeSearchQuery(query) {
        if (!query || typeof query !== 'string') {
            return '';
        }
        let sanitized = this.sanitizeText(query, {
            allowHtml: false,
            maxLength: 100,
            trimWhitespace: true,
            removeNullBytes: true,
            normalizeUnicode: true
        });
        if (this.detectSqlInjection(sanitized)) {
            console.warn('Potential SQL injection attempt detected in search query');
            SQL_INJECTION_PATTERNS.forEach(pattern => {
                sanitized = sanitized.replace(pattern, '');
            });
        }
        return sanitized;
    }
    static sanitizeJsonObject(obj, maxDepth = 10, currentDepth = 0) {
        if (currentDepth >= maxDepth) {
            return null;
        }
        if (obj === null || obj === undefined) {
            return obj;
        }
        if (typeof obj === 'string') {
            return this.sanitizeText(obj, { allowHtml: false, maxLength: 1000 });
        }
        if (typeof obj === 'number' || typeof obj === 'boolean') {
            return obj;
        }
        if (Array.isArray(obj)) {
            return obj
                .slice(0, 100)
                .map(item => this.sanitizeJsonObject(item, maxDepth, currentDepth + 1))
                .filter(item => item !== undefined);
        }
        if (typeof obj === 'object') {
            const sanitized = {};
            const keys = Object.keys(obj).slice(0, 50);
            for (const key of keys) {
                const sanitizedKey = this.sanitizeText(key, { allowHtml: false, maxLength: 100 });
                if (sanitizedKey) {
                    sanitized[sanitizedKey] = this.sanitizeJsonObject(obj[key], maxDepth, currentDepth + 1);
                }
            }
            return sanitized;
        }
        return null;
    }
    static sanitizeHeaders(headers) {
        const sanitized = {};
        const allowedHeaders = [
            'content-type',
            'authorization',
            'accept',
            'accept-encoding',
            'accept-language',
            'cache-control',
            'user-agent',
            'referer',
            'origin'
        ];
        for (const [key, value] of Object.entries(headers)) {
            const lowerKey = key.toLowerCase();
            if (allowedHeaders.includes(lowerKey) && typeof value === 'string') {
                const sanitizedValue = this.removeControlCharacters(value);
                if (sanitizedValue.length <= 2048) {
                    sanitized[lowerKey] = sanitizedValue;
                }
            }
        }
        return sanitized;
    }
    static securitySanitize(input, type = 'text') {
        try {
            switch (type) {
                case 'email':
                    return this.sanitizeEmail(input);
                case 'url':
                    return this.sanitizeUrl(input);
                case 'filename':
                    return this.sanitizeFilename(input);
                case 'search':
                    return this.sanitizeSearchQuery(input);
                case 'json':
                    return this.sanitizeJsonObject(input);
                case 'text':
                default:
                    return this.sanitizeText(input);
            }
        }
        catch (error) {
            console.error('Sanitization error:', error);
            return typeof input === 'string' ? '' : null;
        }
    }
}
exports.SanitizationUtils = SanitizationUtils;
//# sourceMappingURL=sanitization.js.map