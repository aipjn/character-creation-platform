/**
 * Google Gemini Official Image Generation Client
 * 
 * Uses unified Gemini API client for image generation
 */

import { getDefaultGeminiClient } from '../api/geminiClient';

export interface GenerationRequest {
  type: string;
  prompt: string;
  quality?: string;
  width?: number;
  height?: number;
  style?: string;
}

export interface GenerationResponse {
  id: string;
  status: string;
  result?: {
    imageUrl: string;
    thumbnailUrl: string;
  };
}

export class NanoBananaClient {
  private geminiClient: any;

  constructor() {
    this.geminiClient = getDefaultGeminiClient();
  }

  /**
   * Generate image using Google's official gemini-2.5-flash-image-preview model
   */
  async generateImage(request: GenerationRequest): Promise<GenerationResponse> {
    console.log('🎨 Google Official Image Generation API call:', request);
    
    try {
      console.log(`[GoogleImageClient] Generating image...`);
      
      const response = await this.geminiClient.generateImage(request.prompt);
      
      if (!response.success) {
        throw new Error(response.error || 'Failed to generate image');
      }
      
      console.log(`[GoogleImageClient] Image generation successful!`);
      return response.data;
      
    } catch (error) {
      console.error('Google Official Image API call failed:', error);
      throw new Error(`Google Official Image API call failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }
}

// Singleton instance for Google official client only
let defaultClient: NanoBananaClient | null = null;

/**
 * Get the default Google Official Image Generation client
 */
export const getDefaultNanoBananaClient = (): NanoBananaClient => {
  if (!defaultClient) {
    defaultClient = new NanoBananaClient();
  }
  return defaultClient;
};

export default NanoBananaClient;