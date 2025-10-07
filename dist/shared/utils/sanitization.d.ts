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
export declare class SanitizationUtils {
    static escapeHtml(input: string): string;
    static stripDangerousHtml(input: string): string;
    static detectSqlInjection(input: string): boolean;
    static sanitizeSqlInput(input: string): string;
    static sanitizePath(input: string): string;
    static removeControlCharacters(input: string): string;
    static normalizeUnicode(input: string): string;
    static sanitizeText(input: string, options?: SanitizationOptions): string;
    static sanitizeFilename(filename: string, options?: FileSanitizationOptions): string;
    static sanitizeUrl(url: string): string;
    static sanitizeEmail(email: string): string;
    static sanitizeSearchQuery(query: string): string;
    static sanitizeJsonObject(obj: any, maxDepth?: number, currentDepth?: number): any;
    static sanitizeHeaders(headers: Record<string, any>): Record<string, string>;
    static securitySanitize(input: any, type?: 'text' | 'email' | 'url' | 'filename' | 'search' | 'json'): any;
}
//# sourceMappingURL=sanitization.d.ts.map