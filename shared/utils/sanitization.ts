/**
 * Security-focused sanitization utilities for user input
 */

// HTML entity encoding map
const HTML_ENTITIES: Record<string, string> = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#x27;',
  '/': '&#x2F;',
  '`': '&#96;',
  '=': '&#x3D;'
};

// SQL injection patterns to detect and prevent
const SQL_INJECTION_PATTERNS = [
  /(\b(ALTER|CREATE|DELETE|DROP|EXEC(UTE)?|INSERT|SCRIPT|SELECT|UNION|UPDATE)\b)/gi,
  /((\b(AND|OR)\b.{1,6}?\b(TRUE|FALSE)\b)|(\b(AND|OR)\b\s*\d+\s*[=<>]))/gi,
  /(\b(CHAR|NCHAR|VARCHAR|NVARCHAR)\s*\(\s*\d+\s*\))/gi,
  /((\bCONVERT\s*\()|(\bCAST\s*\())/gi,
  /(\b(CONCAT|GROUP_CONCAT)\s*\()/gi
];

// XSS patterns to detect and sanitize
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

// Path traversal patterns
const PATH_TRAVERSAL_PATTERNS = [
  /\.\.\//g,
  /\.\.\\/g,
  /%2e%2e%2f/gi,
  /%2e%2e%5c/gi,
  /\.\.%2f/gi,
  /\.\.%5c/gi
];

// Common dangerous characters for file names
const DANGEROUS_FILENAME_CHARS = /[<>:"|?*\x00-\x1f]/g;

export interface SanitizationOptions {
  allowHtml?: boolean;
  maxLength?: number;
  trimWhitespace?: boolean;
  removeNullBytes?: boolean;
  normalizeUnicode?: boolean;
}

export interface FileSanitizationOptions {
  maxLength?: number;
  allowedExtensions?: string[];
  preserveExtension?: boolean;
}

/**
 * Core sanitization utility class
 */
export class SanitizationUtils {
  
  /**
   * Escape HTML entities to prevent XSS
   */
  static escapeHtml(input: string): string {
    if (!input || typeof input !== 'string') {
      return '';
    }
    
    return input.replace(/[&<>"'\/`=]/g, (match) => HTML_ENTITIES[match] || match);
  }
  
  /**
   * Remove potentially dangerous HTML tags and attributes
   */
  static stripDangerousHtml(input: string): string {
    if (!input || typeof input !== 'string') {
      return '';
    }
    
    let sanitized = input;
    
    // Remove dangerous tags and their content
    XSS_PATTERNS.forEach(pattern => {
      sanitized = sanitized.replace(pattern, '');
    });
    
    // Remove any remaining script-related attributes
    sanitized = sanitized.replace(/\s*on\w+\s*=\s*["'][^"']*["']/gi, '');
    sanitized = sanitized.replace(/\s*on\w+\s*=\s*[^\s>]*/gi, '');
    
    return sanitized.trim();
  }
  
  /**
   * Detect potential SQL injection attempts
   */
  static detectSqlInjection(input: string): boolean {
    if (!input || typeof input !== 'string') {
      return false;
    }
    
    return SQL_INJECTION_PATTERNS.some(pattern => pattern.test(input));
  }
  
  /**
   * Sanitize input against SQL injection
   */
  static sanitizeSqlInput(input: string): string {
    if (!input || typeof input !== 'string') {
      return '';
    }
    
    // Remove null bytes
    let sanitized = input.replace(/\0/g, '');
    
    // Basic SQL injection character escaping
    sanitized = sanitized.replace(/'/g, "''");
    sanitized = sanitized.replace(/"/g, '""');
    sanitized = sanitized.replace(/\\/g, '\\\\');
    
    return sanitized;
  }
  
  /**
   * Remove path traversal attempts
   */
  static sanitizePath(input: string): string {
    if (!input || typeof input !== 'string') {
      return '';
    }
    
    let sanitized = input;
    
    PATH_TRAVERSAL_PATTERNS.forEach(pattern => {
      sanitized = sanitized.replace(pattern, '');
    });
    
    return sanitized;
  }
  
  /**
   * Remove null bytes and control characters
   */
  static removeControlCharacters(input: string): string {
    if (!input || typeof input !== 'string') {
      return '';
    }
    
    // Remove null bytes and most control characters (keep tab, newline, carriage return)
    return input.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '');
  }
  
  /**
   * Normalize Unicode to prevent homograph attacks
   */
  static normalizeUnicode(input: string): string {
    if (!input || typeof input !== 'string') {
      return '';
    }
    
    try {
      // Normalize to NFC (Canonical Decomposition, followed by Canonical Composition)
      return input.normalize('NFC');
    } catch (error) {
      console.warn('Unicode normalization failed:', error);
      return input;
    }
  }
  
  /**
   * Comprehensive text sanitization
   */
  static sanitizeText(input: string, options: SanitizationOptions = {}): string {
    if (!input || typeof input !== 'string') {
      return '';
    }
    
    const {
      allowHtml = false,
      maxLength = 10000,
      trimWhitespace = true,
      removeNullBytes = true,
      normalizeUnicode = true
    } = options;
    
    let sanitized = input;
    
    // Normalize Unicode
    if (normalizeUnicode) {
      sanitized = this.normalizeUnicode(sanitized);
    }
    
    // Remove control characters and null bytes
    if (removeNullBytes) {
      sanitized = this.removeControlCharacters(sanitized);
    }
    
    // Handle HTML content
    if (!allowHtml) {
      sanitized = this.stripDangerousHtml(sanitized);
      sanitized = this.escapeHtml(sanitized);
    } else {
      sanitized = this.stripDangerousHtml(sanitized);
    }
    
    // Remove path traversal attempts
    sanitized = this.sanitizePath(sanitized);
    
    // Trim whitespace
    if (trimWhitespace) {
      sanitized = sanitized.trim();
    }
    
    // Enforce length limit
    if (sanitized.length > maxLength) {
      sanitized = sanitized.substring(0, maxLength);
    }
    
    return sanitized;
  }
  
  /**
   * Sanitize filename to prevent directory traversal and dangerous characters
   */
  static sanitizeFilename(filename: string, options: FileSanitizationOptions = {}): string {
    if (!filename || typeof filename !== 'string') {
      return 'untitled';
    }
    
    const {
      maxLength = 255,
      allowedExtensions,
      preserveExtension = true
    } = options;
    
    let sanitized = filename;
    
    // Remove path traversal attempts
    sanitized = this.sanitizePath(sanitized);
    
    // Remove dangerous characters
    sanitized = sanitized.replace(DANGEROUS_FILENAME_CHARS, '');
    
    // Remove leading/trailing dots and spaces
    sanitized = sanitized.replace(/^[\.\s]+|[\.\s]+$/g, '');
    
    // Handle extension validation
    if (preserveExtension && allowedExtensions) {
      const lastDotIndex = sanitized.lastIndexOf('.');
      if (lastDotIndex > 0) {
        const extension = sanitized.substring(lastDotIndex).toLowerCase();
        if (!allowedExtensions.includes(extension)) {
          // Remove invalid extension
          sanitized = sanitized.substring(0, lastDotIndex);
        }
      }
    }
    
    // Ensure filename isn't empty
    if (!sanitized || sanitized.trim().length === 0) {
      sanitized = 'untitled';
    }
    
    // Enforce length limit
    if (sanitized.length > maxLength) {
      if (preserveExtension) {
        const lastDotIndex = sanitized.lastIndexOf('.');
        if (lastDotIndex > 0) {
          const extension = sanitized.substring(lastDotIndex);
          const nameWithoutExt = sanitized.substring(0, lastDotIndex);
          const maxNameLength = maxLength - extension.length;
          sanitized = nameWithoutExt.substring(0, maxNameLength) + extension;
        } else {
          sanitized = sanitized.substring(0, maxLength);
        }
      } else {
        sanitized = sanitized.substring(0, maxLength);
      }
    }
    
    return sanitized;
  }
  
  /**
   * Sanitize URL to prevent XSS and malicious redirects
   */
  static sanitizeUrl(url: string): string {
    if (!url || typeof url !== 'string') {
      return '';
    }
    
    let sanitized = url.trim();
    
    // Remove control characters
    sanitized = this.removeControlCharacters(sanitized);
    
    try {
      const urlObj = new URL(sanitized);
      
      // Only allow HTTP and HTTPS protocols
      if (!['http:', 'https:'].includes(urlObj.protocol)) {
        throw new Error('Invalid protocol');
      }
      
      // Remove javascript: and data: URIs
      if (/^(javascript|data|vbscript):/i.test(sanitized)) {
        throw new Error('Dangerous protocol');
      }
      
      return urlObj.href;
    } catch (error) {
      console.warn('URL sanitization failed:', error);
      return '';
    }
  }
  
  /**
   * Sanitize email address
   */
  static sanitizeEmail(email: string): string {
    if (!email || typeof email !== 'string') {
      return '';
    }
    
    let sanitized = email.trim().toLowerCase();
    
    // Remove control characters
    sanitized = this.removeControlCharacters(sanitized);
    
    // Basic email format check and character filtering
    sanitized = sanitized.replace(/[^\w@.\-+]/g, '');
    
    return sanitized;
  }
  
  /**
   * Sanitize search query to prevent injection attacks
   */
  static sanitizeSearchQuery(query: string): string {
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
    
    // Remove potential SQL injection patterns
    if (this.detectSqlInjection(sanitized)) {
      console.warn('Potential SQL injection attempt detected in search query');
      // Strip dangerous SQL keywords
      SQL_INJECTION_PATTERNS.forEach(pattern => {
        sanitized = sanitized.replace(pattern, '');
      });
    }
    
    return sanitized;
  }
  
  /**
   * Sanitize JSON object recursively
   */
  static sanitizeJsonObject(obj: any, maxDepth: number = 10, currentDepth: number = 0): any {
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
        .slice(0, 100) // Limit array size
        .map(item => this.sanitizeJsonObject(item, maxDepth, currentDepth + 1))
        .filter(item => item !== undefined);
    }
    
    if (typeof obj === 'object') {
      const sanitized: any = {};
      const keys = Object.keys(obj).slice(0, 50); // Limit object keys
      
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
  
  /**
   * Validate and sanitize request headers
   */
  static sanitizeHeaders(headers: Record<string, any>): Record<string, string> {
    const sanitized: Record<string, string> = {};
    
    // List of allowed headers (whitelist approach)
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
        // Remove control characters and limit length
        const sanitizedValue = this.removeControlCharacters(value);
        if (sanitizedValue.length <= 2048) {
          sanitized[lowerKey] = sanitizedValue;
        }
      }
    }
    
    return sanitized;
  }
  
  /**
   * Security-focused input validation and sanitization pipeline
   */
  static securitySanitize(input: any, type: 'text' | 'email' | 'url' | 'filename' | 'search' | 'json' = 'text'): any {
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
    } catch (error) {
      console.error('Sanitization error:', error);
      return typeof input === 'string' ? '' : null;
    }
  }
}