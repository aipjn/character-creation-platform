/**
 * Data Format Conversion Utilities
 * Handles conversion between different data formats across the character generation system
 */

import {
  CharacterGenerationJob,
  GenerationResult as InternalGenerationResult,
  GenerationError as InternalGenerationError
} from '../types/generation';
import {
  CharacterGenerationRequest,
  BatchGenerationResponse,
  GenerationResult as NanoBananaResult,
  GenerationResponse as NanoBananaResponse
} from '../types/nanoBanana';
import { Character } from '../types/character';

/**
 * Convert character specifications from external format to internal format
 */
export function convertToCharacterSpecs(
  externalSpecs: CharacterGenerationRequest['characterSpecs']
): CharacterGenerationJob['characterSpecs'] {
  return {
    name: externalSpecs.name,
    description: externalSpecs.description,
    traits: externalSpecs.traits || [],
    appearance: externalSpecs.appearance ? {
      age: externalSpecs.appearance.age,
      gender: externalSpecs.appearance.gender,
      height: externalSpecs.appearance.height,
      build: externalSpecs.appearance.build,
      hair: externalSpecs.appearance.hair,
      eyes: externalSpecs.appearance.eyes,
      skin: externalSpecs.appearance.skin,
      clothing: externalSpecs.appearance.clothing,
      accessories: externalSpecs.appearance.accessories || []
    } : undefined,
    personality: externalSpecs.personality || [],
    background: externalSpecs.background
  };
}

/**
 * Convert internal character specifications to external format
 */
export function convertFromCharacterSpecs(
  internalSpecs: CharacterGenerationJob['characterSpecs']
): CharacterGenerationRequest['characterSpecs'] {
  return {
    name: internalSpecs.name,
    description: internalSpecs.description,
    traits: internalSpecs.traits,
    appearance: internalSpecs.appearance ? {
      age: internalSpecs.appearance.age,
      gender: internalSpecs.appearance.gender,
      height: internalSpecs.appearance.height,
      build: internalSpecs.appearance.build,
      hair: internalSpecs.appearance.hair,
      eyes: internalSpecs.appearance.eyes,
      skin: internalSpecs.appearance.skin,
      clothing: internalSpecs.appearance.clothing,
      accessories: internalSpecs.appearance.accessories
    } : undefined,
    personality: internalSpecs.personality,
    background: internalSpecs.background
  };
}

/**
 * Convert nanoBanana batch response to internal generation results
 */
export async function convertFromNanoBananaResponse(
  nanoBananaResponse: BatchGenerationResponse
): Promise<InternalGenerationResult[]> {
  const results: InternalGenerationResult[] = [];
  
  for (const nanoBananaResult of nanoBananaResponse.results) {
    if (nanoBananaResult.status === 'completed' && nanoBananaResult.result) {
      const internalResult = await convertNanoBananaResult(nanoBananaResult.result);
      results.push({
        id: nanoBananaResult.id,
        imageUrl: internalResult.imageUrl,
        imageData: internalResult.imageData,
        thumbnailUrl: internalResult.thumbnailUrl,
        metadata: internalResult.metadata,
        createdAt: new Date(nanoBananaResult.createdAt),
        storageInfo: internalResult.storageInfo
      });
    } else if (nanoBananaResult.error) {
      // For failed results, we still want to include them in the response
      // but without image data
      results.push({
        id: nanoBananaResult.id,
        metadata: {
          dimensions: { width: 0, height: 0 },
          format: 'png' as const,
          fileSize: 0,
          generationTimeMs: 0,
          seed: 0,
          model: 'unknown',
          provider: 'nanoBanana'
        },
        createdAt: new Date(nanoBananaResult.createdAt)
      });
    }
  }
  
  return results;
}

/**
 * Convert nanoBanana result to internal format
 */
export async function convertNanoBananaResult(
  nanoBananaResult: NanoBananaResult
): Promise<InternalGenerationResult> {
  // Generate thumbnail URL if not provided
  let thumbnailUrl = nanoBananaResult.thumbnailUrl;
  if (!thumbnailUrl && nanoBananaResult.imageUrl) {
    thumbnailUrl = await generateThumbnailUrl(nanoBananaResult.imageUrl);
  }
  
  return {
    id: crypto.randomUUID(),
    imageUrl: nanoBananaResult.imageUrl,
    imageData: nanoBananaResult.imageData,
    thumbnailUrl,
    metadata: {
      dimensions: nanoBananaResult.metadata.dimensions,
      format: nanoBananaResult.metadata.format,
      fileSize: nanoBananaResult.metadata.fileSize,
      generationTimeMs: nanoBananaResult.metadata.generationTimeMs,
      seed: nanoBananaResult.metadata.seed,
      model: nanoBananaResult.metadata.model,
      provider: nanoBananaResult.metadata.provider,
      cost: calculateImageCost(nanoBananaResult.metadata)
    },
    createdAt: new Date(),
    storageInfo: await processImageStorage(nanoBananaResult)
  };
}

/**
 * Convert internal generation job to Character format for frontend
 */
export function convertJobToCharacter(
  job: CharacterGenerationJob,
  includeResults = true
): Character {
  const character: Character = {
    id: job.characterId,
    name: job.characterSpecs.name || 'Unnamed Character',
    description: job.characterSpecs.description,
    traits: job.characterSpecs.traits || [],
    appearance: job.characterSpecs.appearance ? {
      age: job.characterSpecs.appearance.age,
      gender: job.characterSpecs.appearance.gender,
      height: job.characterSpecs.appearance.height,
      build: job.characterSpecs.appearance.build,
      hair: job.characterSpecs.appearance.hair,
      eyes: job.characterSpecs.appearance.eyes,
      skin: job.characterSpecs.appearance.skin,
      clothing: job.characterSpecs.appearance.clothing,
      accessories: job.characterSpecs.appearance.accessories || []
    } : {
      age: undefined,
      gender: undefined,
      height: undefined,
      build: undefined,
      hair: undefined,
      eyes: undefined,
      skin: undefined,
      clothing: undefined,
      accessories: []
    },
    personality: job.characterSpecs.personality || [],
    background: job.characterSpecs.background,
    images: includeResults ? (job.results || []).map(result => ({
      id: result.id,
      url: result.imageUrl || '',
      thumbnailUrl: result.thumbnailUrl,
      isMain: false, // Could be enhanced to detect main image
      tags: [],
      createdAt: result.createdAt.toISOString()
    })) : [],
    tags: extractTagsFromCharacter(job.characterSpecs),
    isPublic: false, // Default to private
    createdAt: job.createdAt.toISOString(),
    updatedAt: job.updatedAt.toISOString(),
    userId: job.userId || '',
    stats: {
      views: 0,
      likes: 0,
      downloads: 0,
      shares: 0
    }
  };
  
  return character;
}

/**
 * Convert Character format to internal generation job format
 */
export function convertCharacterToJobSpecs(character: Character): CharacterGenerationJob['characterSpecs'] {
  return {
    name: character.name,
    description: character.description,
    traits: character.traits,
    appearance: {
      age: character.appearance.age,
      gender: character.appearance.gender,
      height: character.appearance.height,
      build: character.appearance.build,
      hair: character.appearance.hair,
      eyes: character.appearance.eyes,
      skin: character.appearance.skin,
      clothing: character.appearance.clothing,
      accessories: character.appearance.accessories
    },
    personality: character.personality,
    background: character.background
  };
}

/**
 * Convert generation error from nanoBanana format to internal format
 */
export function convertNanoBananaError(
  nanoBananaError: NanoBananaResponse['error']
): InternalGenerationError | undefined {
  if (!nanoBananaError) {
    return undefined;
  }
  
  return {
    code: nanoBananaError.code,
    message: nanoBananaError.message,
    details: nanoBananaError.details,
    retryable: isRetryableErrorCode(nanoBananaError.code),
    retryCount: 0,
    originalError: nanoBananaError
  };
}

/**
 * Format generation job data for API response
 */
export interface ApiJobResponse {
  id: string;
  type: string;
  status: string;
  progress?: {
    percentage: number;
    stage: string;
    message?: string;
    estimatedTimeRemainingMs?: number;
  };
  character: {
    id: string;
    name: string;
    description: string;
    specs: CharacterGenerationJob['characterSpecs'];
  };
  results: Array<{
    id: string;
    imageUrl?: string;
    thumbnailUrl?: string;
    metadata: InternalGenerationResult['metadata'];
    createdAt: string;
  }>;
  error?: {
    code: string;
    message: string;
    retryable: boolean;
  };
  createdAt: string;
  updatedAt: string;
  completedAt?: string;
}

export function convertJobToApiResponse(
  job: CharacterGenerationJob,
  progress?: any
): ApiJobResponse {
  return {
    id: job.id,
    type: job.type,
    status: job.status,
    progress,
    character: {
      id: job.characterId,
      name: job.characterSpecs.name || 'Unnamed Character',
      description: job.characterSpecs.description,
      specs: job.characterSpecs
    },
    results: (job.results || []).map(result => ({
      id: result.id,
      imageUrl: result.imageUrl,
      thumbnailUrl: result.thumbnailUrl,
      metadata: result.metadata,
      createdAt: result.createdAt.toISOString()
    })),
    error: job.error ? {
      code: job.error.code,
      message: job.error.message,
      retryable: job.error.retryable
    } : undefined,
    createdAt: job.createdAt.toISOString(),
    updatedAt: job.updatedAt.toISOString(),
    completedAt: job.completedAt?.toISOString()
  };
}

/**
 * Validate character generation request data
 */
export interface ValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
}

export function validateCharacterGenerationRequest(
  request: CharacterGenerationRequest
): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];
  
  // Required fields
  if (!request.characterId) {
    errors.push('characterId is required');
  }
  
  if (!request.characterSpecs) {
    errors.push('characterSpecs is required');
  } else {
    // Validate character specs
    if (!request.characterSpecs.description || request.characterSpecs.description.trim().length === 0) {
      errors.push('character description is required');
    }
    
    if (request.characterSpecs.description && request.characterSpecs.description.length > 2000) {
      errors.push('character description is too long (max 2000 characters)');
    }
    
    if (request.characterSpecs.name && request.characterSpecs.name.length > 100) {
      errors.push('character name is too long (max 100 characters)');
    }
    
    if (request.characterSpecs.traits && request.characterSpecs.traits.length > 20) {
      warnings.push('many traits may result in inconsistent generation (max recommended: 20)');
    }
    
    if (request.characterSpecs.personality && request.characterSpecs.personality.length > 10) {
      warnings.push('many personality traits may result in inconsistent generation (max recommended: 10)');
    }
  }
  
  // Validate generation parameters
  if (request.generationParams) {
    const params = request.generationParams;
    
    if (params.variations && (params.variations < 1 || params.variations > 4)) {
      errors.push('variations must be between 1 and 4');
    }
    
    if (params.quality && !['low', 'medium', 'high', 'ultra'].includes(params.quality)) {
      errors.push('invalid quality parameter');
    }
    
    if (params.aspectRatio && !['1:1', '16:9', '9:16', '4:3', '3:4', '2:1', '1:2'].includes(params.aspectRatio)) {
      errors.push('invalid aspectRatio parameter');
    }
  }
  
  return {
    isValid: errors.length === 0,
    errors,
    warnings
  };
}

/**
 * Utility functions
 */
function extractTagsFromCharacter(specs: CharacterGenerationJob['characterSpecs']): string[] {
  const tags: string[] = [];
  
  // Add appearance-based tags
  if (specs.appearance) {
    const appearance = specs.appearance;
    if (appearance.gender) tags.push(appearance.gender);
    if (appearance.age) tags.push(appearance.age);
    if (appearance.build) tags.push(appearance.build);
    if (appearance.hair) tags.push(`${appearance.hair}-hair`);
    if (appearance.eyes) tags.push(`${appearance.eyes}-eyes`);
  }
  
  // Add trait-based tags
  if (specs.traits) {
    tags.push(...specs.traits.slice(0, 5)); // Limit to first 5 traits
  }
  
  // Add personality-based tags
  if (specs.personality) {
    tags.push(...specs.personality.slice(0, 3)); // Limit to first 3 personality traits
  }
  
  return [...new Set(tags)]; // Remove duplicates
}

async function generateThumbnailUrl(originalUrl: string): Promise<string> {
  // For now, return the original URL
  // In a real implementation, you would:
  // 1. Download the original image
  // 2. Create a resized thumbnail version
  // 3. Upload to storage
  // 4. Return the thumbnail URL
  return originalUrl + '?thumbnail=true';
}

function calculateImageCost(metadata: NanoBananaResult['metadata']): number {
  // Basic cost calculation based on resolution and quality
  const basePrice = 0.01; // $0.01 per image
  const pixelCount = metadata.dimensions.width * metadata.dimensions.height;
  const resolutionMultiplier = Math.max(1, pixelCount / (1024 * 1024)); // Scale with megapixels
  
  return Number((basePrice * resolutionMultiplier).toFixed(4));
}

async function processImageStorage(nanoBananaResult: NanoBananaResult): Promise<InternalGenerationResult['storageInfo']> {
  // For now, return basic storage info
  // In a real implementation, you would:
  // 1. Upload to S3 or other storage service
  // 2. Generate CloudFront URLs
  // 3. Set appropriate expiration dates
  
  if (nanoBananaResult.imageUrl) {
    return {
      s3Key: `characters/${Date.now()}_${crypto.randomUUID()}.png`,
      cloudfrontUrl: nanoBananaResult.imageUrl,
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) // 7 days
    };
  }
  
  return undefined;
}

function isRetryableErrorCode(errorCode: string): boolean {
  const retryableErrors = [
    'RATE_LIMIT_EXCEEDED',
    'TIMEOUT',
    'NETWORK_ERROR',
    'SERVICE_UNAVAILABLE',
    'INTERNAL_SERVER_ERROR',
    'CIRCUIT_BREAKER_OPEN'
  ];
  
  return retryableErrors.includes(errorCode);
}

// Export utility functions for external use
export const DataConverterUtils = {
  extractTagsFromCharacter,
  generateThumbnailUrl,
  calculateImageCost,
  processImageStorage,
  isRetryableErrorCode
};

export default {
  convertToCharacterSpecs,
  convertFromCharacterSpecs,
  convertFromNanoBananaResponse,
  convertNanoBananaResult,
  convertJobToCharacter,
  convertCharacterToJobSpecs,
  convertNanoBananaError,
  convertJobToApiResponse,
  validateCharacterGenerationRequest,
  DataConverterUtils
};