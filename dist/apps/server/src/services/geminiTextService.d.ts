interface PromptOptimizationRequest {
    userDescription: string;
    style?: string | undefined;
    gender?: string | undefined;
    conversationHistory?: Array<{
        userInput: string;
        generatedPrompt: string;
        feedback?: string;
    }> | undefined;
}
interface PromptOptimizationResponse {
    originalInput: string;
    optimizedPrompt: string;
    reasoning: string;
    suggestions: string[];
    conversationId: string;
}
declare class GeminiTextService {
    private geminiClient;
    constructor();
    optimizePrompt(request: PromptOptimizationRequest): Promise<PromptOptimizationResponse>;
    private buildSystemPrompt;
    private buildUserPrompt;
    private parseGeminiResponse;
    private generateConversationId;
    editImageWithGemini(request: {
        imageUrl: string;
        prompt: string;
        characterId?: string;
    }): Promise<any>;
    healthCheck(): Promise<boolean>;
}
export default GeminiTextService;
export type { PromptOptimizationRequest, PromptOptimizationResponse };
//# sourceMappingURL=geminiTextService.d.ts.map