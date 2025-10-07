"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const geminiClient_1 = require("../api/geminiClient");
class GeminiTextService {
    constructor() {
        this.geminiClient = (0, geminiClient_1.getDefaultGeminiClient)();
    }
    async optimizePrompt(request) {
        const systemPrompt = this.buildSystemPrompt();
        const userPrompt = this.buildUserPrompt(request);
        try {
            console.log(`[GeminiTextService] Optimizing prompt...`);
            const response = await this.geminiClient.generateText(userPrompt, systemPrompt);
            if (!response.success) {
                throw new Error(response.error || 'Failed to generate text');
            }
            const text = response.data.text || 'No response generated';
            console.log(`[GeminiTextService] Prompt optimization successful!`);
            return this.parseGeminiResponse(text, request.userDescription);
        }
        catch (error) {
            console.error(`[GeminiTextService] Prompt optimization failed:`, error.message);
            throw new Error(`Prompt optimization error: ${error.message || 'Unknown error'}`);
        }
    }
    buildSystemPrompt() {
        return `You are an expert AI art prompt engineer specializing in character generation. Your job is to transform user descriptions into detailed, effective prompts for AI image generation.

GUIDELINES:
1. Enhance vague descriptions with specific visual details
2. Add appropriate artistic style elements
3. Include lighting, composition, and quality modifiers
4. Maintain the user's original intent and character essence
5. Use terminology that works well with modern AI image generators
6. Be specific about pose, expression, clothing details, and environment

OUTPUT FORMAT:
Return your response in this exact JSON format:
{
  "optimizedPrompt": "Your enhanced prompt here",
  "reasoning": "Brief explanation of changes made",
  "suggestions": ["suggestion1", "suggestion2", "suggestion3"]
}

IMPORTANT: Only return valid JSON, no additional text.`;
    }
    buildUserPrompt(request) {
        let prompt = `Transform this character description into an optimized AI art prompt:

USER DESCRIPTION: "${request.userDescription}"`;
        if (request.style) {
            prompt += `\nPREFERRED STYLE: ${request.style}`;
        }
        if (request.gender) {
            prompt += `\nGENDER: ${request.gender}`;
        }
        if (request.conversationHistory && request.conversationHistory.length > 0) {
            prompt += `\n\nPREVIOUS CONVERSATION:`;
            request.conversationHistory.forEach((entry, index) => {
                prompt += `\n${index + 1}. User: "${entry.userInput}"`;
                prompt += `\n   Generated: "${entry.generatedPrompt}"`;
                if (entry.feedback) {
                    prompt += `\n   Feedback: "${entry.feedback}"`;
                }
            });
        }
        prompt += `\n\nPlease enhance this description into a detailed, effective prompt for AI character generation.`;
        return prompt;
    }
    parseGeminiResponse(text, originalInput, conversationId) {
        try {
            const jsonMatch = text.match(/\{[\s\S]*\}/);
            if (!jsonMatch) {
                throw new Error('No JSON found in response');
            }
            const parsed = JSON.parse(jsonMatch[0]);
            return {
                originalInput,
                optimizedPrompt: parsed.optimizedPrompt || '',
                reasoning: parsed.reasoning || 'No reasoning provided',
                suggestions: parsed.suggestions || [],
                conversationId: conversationId || this.generateConversationId()
            };
        }
        catch (error) {
            console.error('Error parsing Gemini response:', error);
            console.error('Raw response:', text);
            return {
                originalInput,
                optimizedPrompt: originalInput,
                reasoning: 'Error processing response, using original description',
                suggestions: ['Try rephrasing your description', 'Add more specific details', 'Specify the art style'],
                conversationId: conversationId || this.generateConversationId()
            };
        }
    }
    generateConversationId() {
        return `conv_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
    }
    async editImageWithGemini(request) {
        const { imageUrl, prompt, characterId } = request;
        try {
            console.log(`[GeminiTextService] Editing image with Gemini 2.5 Flash Image...`);
            console.log(`Image URL: ${imageUrl.substring(0, 100)}...`);
            console.log(`Edit prompt: ${prompt}`);
            let imageBase64;
            let mimeType = 'image/jpeg';
            if (imageUrl.startsWith('data:')) {
                const matches = imageUrl.match(/^data:([^;]+);base64,(.+)$/);
                if (!matches || !matches[1] || !matches[2]) {
                    throw new Error('Invalid data URL format');
                }
                mimeType = matches[1];
                imageBase64 = matches[2];
                console.log(`[GeminiTextService] Using base64 data URL directly`);
            }
            else {
                const imageResponse = await fetch(imageUrl);
                if (!imageResponse.ok) {
                    throw new Error(`Failed to fetch image from URL: ${imageResponse.statusText}`);
                }
                const imageBuffer = await imageResponse.arrayBuffer();
                imageBase64 = Buffer.from(imageBuffer).toString('base64');
                console.log(`[GeminiTextService] Image fetched and converted to base64`);
            }
            const result = await this.geminiClient.generateWithImage(prompt, imageBase64, mimeType, 'gemini-2.5-flash-image-preview');
            if (!result.success) {
                throw new Error(result.error || 'Failed to edit image with Gemini');
            }
            console.log(`[GeminiTextService] Image editing successful!`);
            return {
                editedImageUrl: result.data.imageUrl,
                thumbnailUrl: result.data.thumbnailUrl,
                prompt: prompt,
                originalImageUrl: imageUrl,
                characterId: characterId,
                model: 'gemini-2.5-flash-image-preview',
                mimeType: result.data.mimeType
            };
        }
        catch (error) {
            console.error(`[GeminiTextService] Image editing failed:`, error.message);
            throw new Error(`Image editing error: ${error.message || 'Unknown error'}`);
        }
    }
    async healthCheck() {
        return await this.geminiClient.healthCheck();
    }
}
exports.default = GeminiTextService;
//# sourceMappingURL=geminiTextService.js.map