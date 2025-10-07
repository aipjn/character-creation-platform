"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getDefaultGeminiClient = exports.GeminiClient = void 0;
const https_proxy_agent_1 = require("https-proxy-agent");
const node_fetch_1 = __importDefault(require("node-fetch"));
class GeminiClient {
    constructor(options = {}) {
        const proxyEnabledEnv = process.env['GEMINI_PROXY_ENABLED'];
        const enableProxy = typeof options.enableProxy === 'boolean'
            ? options.enableProxy
            : proxyEnabledEnv === '1' || proxyEnabledEnv === 'true';
        this.apiKey = process.env['GOOGLE_API_KEY'] || '';
        this.baseUrl = 'https://generativelanguage.googleapis.com/v1beta/models';
        if (!this.apiKey) {
            throw new Error('GOOGLE_API_KEY environment variable is required');
        }
        if (enableProxy) {
            const proxyUrl = options.proxyUrl ||
                process.env['GEMINI_PROXY_URL'] ||
                process.env['HTTPS_PROXY'] ||
                process.env['https_proxy'] ||
                process.env['HTTP_PROXY'] ||
                process.env['http_proxy'] ||
                '';
            if (proxyUrl) {
                console.log(`[GeminiClient] Proxy enabled via configuration: ${proxyUrl}`);
                this.proxyAgent = new https_proxy_agent_1.HttpsProxyAgent(proxyUrl);
            }
            else {
                console.warn('[GeminiClient] Proxy requested but no proxy URL provided');
                this.proxyAgent = null;
            }
        }
        else {
            this.proxyAgent = null;
            if (process.env['HTTPS_PROXY'] ||
                process.env['https_proxy'] ||
                process.env['HTTP_PROXY'] ||
                process.env['http_proxy']) {
                console.log('[GeminiClient] Proxy variables ignored (GEMINI_PROXY_ENABLED is not set)');
            }
        }
    }
    async generateContent(request) {
        const { model, prompt, systemPrompt } = request;
        try {
            console.log(`[GeminiClient] Calling ${model} with prompt length: ${prompt.length}`);
            const url = `${this.baseUrl}/${model}:generateContent`;
            let fullPrompt = prompt;
            if (model === 'gemini-2.5-flash-image-preview') {
                fullPrompt = `Generate an image of: ${prompt}`;
            }
            if (model === 'gemini-2.5-flash' && systemPrompt) {
                fullPrompt = `${systemPrompt}\n\n${prompt}`;
            }
            const requestBody = {
                contents: [{
                        parts: [{ text: fullPrompt }]
                    }]
            };
            const fetchOptions = {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'x-goog-api-key': this.apiKey,
                    'User-Agent': 'character-creator/1.0.0'
                },
                body: JSON.stringify(requestBody)
            };
            if (this.proxyAgent) {
                fetchOptions.agent = this.proxyAgent;
                console.log(`[GeminiClient] Using proxy agent for ${model} request`);
            }
            const response = await (0, node_fetch_1.default)(url, fetchOptions);
            console.log(`[GeminiClient] ${model} response status:`, response.status);
            if (!response.ok) {
                const errorText = await response.text();
                console.error(`[GeminiClient] ${model} API error:`, errorText);
                return {
                    success: false,
                    error: `${model} API error: ${response.status} ${response.statusText} - ${errorText}`
                };
            }
            const responseData = await response.json();
            console.log(`[GeminiClient] ${model} API call successful!`);
            const candidates = responseData.candidates || [];
            if (candidates.length === 0) {
                return {
                    success: false,
                    error: 'No candidates found in API response'
                };
            }
            const candidate = candidates[0];
            const content = candidate.content;
            const parts = content?.parts || [];
            if (model === 'gemini-2.5-flash-image-preview') {
                console.log(`[GeminiClient] Processing ${parts.length} parts for image data`);
                for (let i = 0; i < parts.length; i++) {
                    const part = parts[i];
                    console.log(`[GeminiClient] Part ${i} keys:`, Object.keys(part));
                    if (part.inlineData) {
                        const imageData = part.inlineData;
                        const mimeType = imageData.mime_type || imageData.mimeType || 'image/png';
                        const base64Data = imageData.data;
                        const imageUrl = `data:${mimeType};base64,${base64Data}`;
                        console.log(`[GeminiClient] Generated image: ${mimeType}, data length: ${base64Data.length}`);
                        return {
                            success: true,
                            data: {
                                id: `gen_${Date.now()}`,
                                status: 'completed',
                                result: {
                                    imageUrl: imageUrl,
                                    thumbnailUrl: imageUrl
                                }
                            }
                        };
                    }
                    if (part.text) {
                        console.log(`[GeminiClient] Part ${i} contains text:`, part.text.substring(0, 100));
                    }
                }
                console.log(`[GeminiClient] No inlineData found in any of the ${parts.length} parts`);
                console.log(`[GeminiClient] Full response structure:`, JSON.stringify(responseData, null, 2));
                return {
                    success: false,
                    error: 'No image data found in response'
                };
            }
            if (model === 'gemini-2.5-flash') {
                const text = parts[0]?.text || 'No response generated';
                return {
                    success: true,
                    data: {
                        text: text,
                        candidates: candidates
                    }
                };
            }
            return {
                success: false,
                error: 'Unknown model type'
            };
        }
        catch (error) {
            console.error(`[GeminiClient] ${model} API call failed:`, error.message);
            return {
                success: false,
                error: `${model} API call failed: ${error.message || 'Unknown error'}`
            };
        }
    }
    async generateText(prompt, systemPrompt) {
        return this.generateContent({
            model: 'gemini-2.5-flash',
            prompt,
            systemPrompt
        });
    }
    async generateImage(prompt) {
        return this.generateContent({
            model: 'gemini-2.5-flash-image-preview',
            prompt
        });
    }
    async generateWithImage(prompt, imageBase64, mimeType = 'image/jpeg', model = 'gemini-2.5-flash-image-preview') {
        try {
            console.log(`[GeminiClient] Calling ${model} with image input, prompt length: ${prompt.length}`);
            const url = `${this.baseUrl}/${model}:generateContent`;
            const requestBody = {
                contents: [{
                        parts: [
                            { text: prompt },
                            {
                                inline_data: {
                                    mime_type: mimeType,
                                    data: imageBase64
                                }
                            }
                        ]
                    }]
            };
            const fetchOptions = {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'x-goog-api-key': this.apiKey,
                    'User-Agent': 'character-creator/1.0.0'
                },
                body: JSON.stringify(requestBody)
            };
            if (this.proxyAgent) {
                fetchOptions.agent = this.proxyAgent;
                console.log(`[GeminiClient] Using proxy agent for image-to-image request`);
            }
            const response = await (0, node_fetch_1.default)(url, fetchOptions);
            console.log(`[GeminiClient] ${model} image-to-image response status:`, response.status);
            if (!response.ok) {
                const errorText = await response.text();
                console.error(`[GeminiClient] ${model} API error:`, errorText);
                return {
                    success: false,
                    error: `${model} API error: ${response.status} ${response.statusText} - ${errorText}`
                };
            }
            const responseData = await response.json();
            console.log(`[GeminiClient] ${model} image-to-image API call successful!`);
            const candidates = responseData.candidates || [];
            if (candidates.length === 0) {
                return {
                    success: false,
                    error: 'No candidates found in API response'
                };
            }
            const candidate = candidates[0];
            const content = candidate.content;
            const parts = content?.parts || [];
            console.log(`[GeminiClient] Processing ${parts.length} parts for image data`);
            for (let i = 0; i < parts.length; i++) {
                const part = parts[i];
                console.log(`[GeminiClient] Part ${i} keys:`, Object.keys(part));
                if (part.inlineData || part.inline_data) {
                    const imageData = part.inlineData || part.inline_data;
                    const imageMimeType = imageData.mime_type || imageData.mimeType || 'image/png';
                    const base64Data = imageData.data;
                    const imageUrl = `data:${imageMimeType};base64,${base64Data}`;
                    console.log(`[GeminiClient] Generated edited image: ${imageMimeType}, data length: ${base64Data.length}`);
                    return {
                        success: true,
                        data: {
                            imageUrl: imageUrl,
                            thumbnailUrl: imageUrl,
                            mimeType: imageMimeType
                        }
                    };
                }
                if (part.text) {
                    console.log(`[GeminiClient] Part ${i} contains text:`, part.text.substring(0, 100));
                }
            }
            console.log(`[GeminiClient] No image data found in response`);
            return {
                success: false,
                error: 'No image data found in response - model may not support image-to-image'
            };
        }
        catch (error) {
            console.error(`[GeminiClient] Image-to-image API call failed:`, error.message);
            return {
                success: false,
                error: `Image-to-image API call failed: ${error.message || 'Unknown error'}`
            };
        }
    }
    async healthCheck() {
        return !!this.apiKey;
    }
}
exports.GeminiClient = GeminiClient;
let defaultClient = null;
let defaultClientOptions;
const getDefaultGeminiClient = (options = {}) => {
    const normalize = (config = {}) => ({
        enableProxy: config.enableProxy ?? undefined,
        proxyUrl: config.proxyUrl ?? undefined,
    });
    const normalizedOptions = normalize(options);
    if (!defaultClient ||
        JSON.stringify(normalize(defaultClientOptions)) !== JSON.stringify(normalizedOptions)) {
        defaultClient = new GeminiClient(options);
        defaultClientOptions = { ...options };
    }
    return defaultClient;
};
exports.getDefaultGeminiClient = getDefaultGeminiClient;
exports.default = GeminiClient;
//# sourceMappingURL=geminiClient.js.map