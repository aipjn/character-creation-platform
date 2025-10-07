"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getDefaultNanoBananaClient = exports.NanoBananaClient = void 0;
const geminiClient_1 = require("../api/geminiClient");
class NanoBananaClient {
    constructor() {
        this.geminiClient = (0, geminiClient_1.getDefaultGeminiClient)();
    }
    async generateImage(request) {
        console.log('🎨 Google Official Image Generation API call:', request);
        try {
            console.log(`[GoogleImageClient] Generating image...`);
            const response = await this.geminiClient.generateImage(request.prompt);
            if (!response.success) {
                throw new Error(response.error || 'Failed to generate image');
            }
            console.log(`[GoogleImageClient] Image generation successful!`);
            return response.data;
        }
        catch (error) {
            console.error('Google Official Image API call failed:', error);
            throw new Error(`Google Official Image API call failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
    }
}
exports.NanoBananaClient = NanoBananaClient;
let defaultClient = null;
const getDefaultNanoBananaClient = () => {
    if (!defaultClient) {
        defaultClient = new NanoBananaClient();
    }
    return defaultClient;
};
exports.getDefaultNanoBananaClient = getDefaultNanoBananaClient;
exports.default = NanoBananaClient;
//# sourceMappingURL=nanoBananaClient.js.map