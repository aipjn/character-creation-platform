/**
 * Gemini Text Service for Prompt Optimization
 * Uses unified Gemini API client for text generation
 */

import { getDefaultGeminiClient } from '../api/geminiClient';

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

class GeminiTextService {
  private geminiClient: any;

  constructor() {
    this.geminiClient = getDefaultGeminiClient();
  }

  /**
   * Optimize user description into a detailed character generation prompt
   */
  async optimizePrompt(request: PromptOptimizationRequest): Promise<PromptOptimizationResponse> {
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
      
    } catch (error: any) {
      console.error(`[GeminiTextService] Prompt optimization failed:`, error.message);
      throw new Error(`Prompt optimization error: ${error.message || 'Unknown error'}`);
    }
  }



  private buildSystemPrompt(): string {
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


  private buildUserPrompt(request: PromptOptimizationRequest): string {
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


  private parseGeminiResponse(
    text: string, 
    originalInput: string, 
    conversationId?: string
  ): PromptOptimizationResponse {
    try {
      // Try to extract JSON from the response
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
    } catch (error) {
      console.error('Error parsing Gemini response:', error);
      console.error('Raw response:', text);
      
      // Fallback response
      return {
        originalInput,
        optimizedPrompt: originalInput, // Fallback to original
        reasoning: 'Error processing response, using original description',
        suggestions: ['Try rephrasing your description', 'Add more specific details', 'Specify the art style'],
        conversationId: conversationId || this.generateConversationId()
      };
    }
  }

  private generateConversationId(): string {
    return `conv_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
  }


  /**
   * Health check for the service
   */
  async healthCheck(): Promise<boolean> {
    return await this.geminiClient.healthCheck();
  }
}

export default GeminiTextService;
export type { PromptOptimizationRequest, PromptOptimizationResponse };