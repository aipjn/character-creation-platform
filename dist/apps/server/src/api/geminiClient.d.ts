export interface GeminiClientOptions {
    enableProxy?: boolean;
    proxyUrl?: string;
}
interface GeminiRequest {
    model: 'gemini-2.5-flash' | 'gemini-2.5-flash-image-preview';
    prompt: string;
    systemPrompt?: string | undefined;
}
interface GeminiResponse {
    success: boolean;
    data?: any;
    error?: string;
}
export declare class GeminiClient {
    private apiKey;
    private baseUrl;
    private proxyAgent;
    constructor(options?: GeminiClientOptions);
    generateContent(request: GeminiRequest): Promise<GeminiResponse>;
    generateText(prompt: string, systemPrompt?: string): Promise<GeminiResponse>;
    generateImage(prompt: string): Promise<GeminiResponse>;
    generateWithImage(prompt: string, imageBase64: string, mimeType?: string, model?: 'gemini-2.5-flash-image-preview'): Promise<GeminiResponse>;
    healthCheck(): Promise<boolean>;
}
export declare const getDefaultGeminiClient: (options?: GeminiClientOptions) => GeminiClient;
export default GeminiClient;
//# sourceMappingURL=geminiClient.d.ts.map