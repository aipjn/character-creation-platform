/**
 * Unified Gemini API Client
 * Handles both text generation (gemini-2.5-flash) and image generation (gemini-2.5-flash-image-preview)
 * Uses consistent calling pattern with proxy support
 * important: don't change this file !!!!!! don't change this file !!!!!! don't change this file !!!!!! 
 * 
 */

import { HttpsProxyAgent } from 'https-proxy-agent';
import fetch from 'node-fetch';

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

export class GeminiClient {
  private apiKey: string;
  private baseUrl: string;
  private proxyAgent: any;

  constructor(options: GeminiClientOptions = {}) {
    const proxyEnabledEnv = process.env['GEMINI_PROXY_ENABLED'];
    const enableProxy =
      typeof options.enableProxy === 'boolean'
        ? options.enableProxy
        : proxyEnabledEnv === '1' || proxyEnabledEnv === 'true';

    // Use Google API key
    this.apiKey = process.env['GOOGLE_API_KEY'] || '';
    this.baseUrl = 'https://generativelanguage.googleapis.com/v1beta/models';
    
    if (!this.apiKey) {
      throw new Error('GOOGLE_API_KEY environment variable is required');
    }
    
    // Configure proxy support (disabled by default)
    if (enableProxy) {
      const proxyUrl =
        options.proxyUrl ||
        process.env['GEMINI_PROXY_URL'] ||
        process.env['HTTPS_PROXY'] ||
        process.env['https_proxy'] ||
        process.env['HTTP_PROXY'] ||
        process.env['http_proxy'] ||
        '';

      if (proxyUrl) {
        console.log(`[GeminiClient] Proxy enabled via configuration: ${proxyUrl}`);
        this.proxyAgent = new HttpsProxyAgent(proxyUrl);
      } else {
        console.warn('[GeminiClient] Proxy requested but no proxy URL provided');
        this.proxyAgent = null;
      }
    } else {
      this.proxyAgent = null;
      if (
        process.env['HTTPS_PROXY'] ||
        process.env['https_proxy'] ||
        process.env['HTTP_PROXY'] ||
        process.env['http_proxy']
      ) {
        console.log('[GeminiClient] Proxy variables ignored (GEMINI_PROXY_ENABLED is not set)');
      }
    }
  }

  /**
   * Unified API call method for both text and image generation
   */
  async generateContent(request: GeminiRequest): Promise<GeminiResponse> {
    const { model, prompt, systemPrompt } = request;
    
    try {
      console.log(`[GeminiClient] Calling ${model} with prompt length: ${prompt.length}`);
      
      // Build the API URL
      const url = `${this.baseUrl}/${model}:generateContent`;
      
      // Build the request body
      let fullPrompt = prompt;
      
      // For image generation, prefix with "Generate an image of:"
      if (model === 'gemini-2.5-flash-image-preview') {
        fullPrompt = `Generate an image of: ${prompt}`;
      }
      
      // For text generation with system prompt, combine them
      if (model === 'gemini-2.5-flash' && systemPrompt) {
        fullPrompt = `${systemPrompt}\n\n${prompt}`;
      }
      
      const requestBody = {
        contents: [{
          parts: [{ text: fullPrompt }]
        }]
      };
      
      const fetchOptions: any = {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-goog-api-key': this.apiKey,
          'User-Agent': 'character-creator/1.0.0'
        },
        body: JSON.stringify(requestBody)
      };
      
      // Add proxy agent if configured
      if (this.proxyAgent) {
        fetchOptions.agent = this.proxyAgent;
        console.log(`[GeminiClient] Using proxy agent for ${model} request`);
      }
      
      const response = await fetch(url, fetchOptions);
      
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
      
      // Process response based on model type
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
      
      // For image generation - look for inlineData
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
      
      // For text generation - get text from first part
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
      
    } catch (error: any) {
      console.error(`[GeminiClient] ${model} API call failed:`, error.message);
      return {
        success: false,
        error: `${model} API call failed: ${error.message || 'Unknown error'}`
      };
    }
  }

  /**
   * Generate text using gemini-2.5-flash
   */
  async generateText(prompt: string, systemPrompt?: string): Promise<GeminiResponse> {
    return this.generateContent({
      model: 'gemini-2.5-flash',
      prompt,
      systemPrompt
    });
  }

  /**
   * Generate image using gemini-2.5-flash-image-preview
   */
  async generateImage(prompt: string): Promise<GeminiResponse> {
    return this.generateContent({
      model: 'gemini-2.5-flash-image-preview',
      prompt
    });
  }

  /**
   * Generate image with input image (image-to-image) using gemini-2.5-flash-image-preview
   * Used for image editing and variations
   */
  async generateWithImage(
    prompt: string,
    imageBase64: string,
    mimeType: string = 'image/jpeg',
    model: 'gemini-2.5-flash-image-preview' = 'gemini-2.5-flash-image-preview'
  ): Promise<GeminiResponse> {
    try {
      console.log(`[GeminiClient] Calling ${model} with image input, prompt length: ${prompt.length}`);

      const url = `${this.baseUrl}/${model}:generateContent`;

      // Build request with both text and image
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

      const fetchOptions: any = {
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

      const response = await fetch(url, fetchOptions);

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

      // Look for generated image in response
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

    } catch (error: any) {
      console.error(`[GeminiClient] Image-to-image API call failed:`, error.message);
      return {
        success: false,
        error: `Image-to-image API call failed: ${error.message || 'Unknown error'}`
      };
    }
  }

  /**
   * Health check for the service
   */
  async healthCheck(): Promise<boolean> {
    return !!this.apiKey;
  }
}

// Singleton instance
let defaultClient: GeminiClient | null = null;
let defaultClientOptions: GeminiClientOptions | undefined;

/**
 * Get the default Gemini client
 */
export const getDefaultGeminiClient = (options: GeminiClientOptions = {}): GeminiClient => {
  const normalize = (config: GeminiClientOptions = {}) => ({
    enableProxy: config.enableProxy ?? undefined,
    proxyUrl: config.proxyUrl ?? undefined,
  });

  const normalizedOptions = normalize(options);

  if (
    !defaultClient ||
    JSON.stringify(normalize(defaultClientOptions)) !== JSON.stringify(normalizedOptions)
  ) {
    defaultClient = new GeminiClient(options);
    defaultClientOptions = { ...options };
  }

  return defaultClient;
};

export default GeminiClient;
