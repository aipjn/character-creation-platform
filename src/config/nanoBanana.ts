/**
 * nanoBanana API Configuration for Character Creation Platform
 * Handles Google Gemini 2.5 Flash Image (nanoBanana) API configuration
 */

// Environment variables validation
const requiredEnvVars = [
  'NANOBANANA_API_KEY'
] as const;

const optionalEnvVars = [
  'NANOBANANA_API_URL',
  'NANOBANANA_PROVIDER',
  'NANOBANANA_MAX_CONCURRENT_REQUESTS',
  'NANOBANANA_REQUEST_TIMEOUT_MS',
  'NANOBANANA_MAX_RETRIES'
] as const;

const validateEnvironment = (strict: boolean = true): void => {
  const missing = requiredEnvVars.filter(envVar => !process.env[envVar]);
  
  if (missing.length > 0 && strict) {
    throw new Error(
      `Missing required nanoBanana environment variables: ${missing.join(', ')}`
    );
  }
  
  if (missing.length > 0) {
    console.warn(
      `Optional nanoBanana environment variables missing: ${missing.join(', ')}`
    );
  }
};

// API Provider Configuration
export const API_PROVIDERS = {
  GOOGLE_OFFICIAL: {
    baseUrl: 'https://ai.googleapis.com/v1/models/gemini-2.5-flash-image',
    pricePerImage: 0.039, // $0.039 per image
    model: 'gemini-2.5-flash-image-preview',
    maxConcurrentRequests: 10,
    rateLimit: {
      requestsPerMinute: 60,
      requestsPerHour: 1000
    }
  },
  NANOBANANA_API: {
    baseUrl: 'https://api.nanobanana.ai/v1',
    pricePerImage: 0.020, // $0.020 per image
    model: 'nano-banana',
    maxConcurrentRequests: 4,
    rateLimit: {
      requestsPerMinute: 30,
      requestsPerHour: 500
    }
  },
  FAL_AI: {
    baseUrl: 'https://fal.run/fal-ai/nano-banana',
    pricePerImage: 0.025,
    model: 'fal-ai/nano-banana',
    maxConcurrentRequests: 6,
    rateLimit: {
      requestsPerMinute: 40,
      requestsPerHour: 750
    }
  }
} as const;

export type ApiProvider = keyof typeof API_PROVIDERS;

// nanoBanana API Configuration
export const nanoBananaConfig = {
  // Provider selection (can be overridden by environment variable)
  provider: (process.env.NANOBANANA_PROVIDER as ApiProvider) || 'NANOBANANA_API',
  
  // API Authentication
  apiKey: process.env.NANOBANANA_API_KEY || '',
  
  // Base URL (defaults based on provider)
  baseUrl: process.env.NANOBANANA_API_URL || API_PROVIDERS.NANOBANANA_API.baseUrl,
  
  // Request Configuration
  timeout: parseInt(process.env.NANOBANANA_REQUEST_TIMEOUT_MS || '30000', 10), // 30 seconds
  maxRetries: parseInt(process.env.NANOBANANA_MAX_RETRIES || '3', 10),
  
  // Concurrent Request Limits
  maxConcurrentRequests: parseInt(
    process.env.NANOBANANA_MAX_CONCURRENT_REQUESTS || '4', 
    10
  ),
  
  // Batch Processing
  batchConfig: {
    maxBatchSize: 4, // Maximum characters per batch
    batchTimeoutMs: 300000, // 5 minutes for batch completion
    priorityLevels: ['low', 'normal', 'high', 'urgent'] as const
  },
  
  // Rate Limiting
  rateLimiting: {
    requestsPerMinute: 30,
    requestsPerHour: 500,
    burstAllowance: 5, // Allow short bursts above limit
    cooldownMs: 60000 // 1 minute cooldown after rate limit hit
  },
  
  // Circuit Breaker Configuration
  circuitBreaker: {
    failureThreshold: 5, // Open circuit after 5 consecutive failures
    timeoutMs: 60000, // 1 minute timeout
    monitoringPeriodMs: 300000, // 5 minutes monitoring period
    minimumRequestCount: 10 // Minimum requests before circuit breaker activates
  },
  
  // Retry Configuration
  retryConfig: {
    initialDelayMs: 1000, // Start with 1 second delay
    maxDelayMs: 30000, // Maximum 30 second delay
    backoffMultiplier: 2, // Exponential backoff
    retryableStatusCodes: [408, 429, 500, 502, 503, 504],
    retryableErrors: [
      'ENOTFOUND', 
      'ECONNRESET', 
      'ETIMEDOUT', 
      'ECONNREFUSED'
    ]
  },
  
  // Image Generation Defaults
  defaults: {
    quality: 'high' as const,
    aspectRatio: '1:1' as const,
    outputFormat: 'png' as const,
    style: 'realistic' as const,
    seed: null, // Random seed by default
    steps: 30, // Generation steps
    guidanceScale: 7.5 // Prompt adherence
  },
  
  // Image Processing
  imageConfig: {
    maxInputSize: 2048, // Maximum input image dimension
    maxOutputSize: 2048, // Maximum output image dimension
    supportedFormats: ['png', 'jpeg', 'jpg', 'webp'],
    compressionQuality: 0.9, // JPEG compression quality
    thumbnailSize: 256 // Thumbnail dimension
  },
  
  // Webhook Configuration
  webhooks: {
    enabled: !!process.env.NANOBANANA_WEBHOOK_URL,
    url: process.env.NANOBANANA_WEBHOOK_URL || '',
    secret: process.env.NANOBANANA_WEBHOOK_SECRET || '',
    retryAttempts: 3,
    timeoutMs: 10000 // 10 seconds
  },
  
  // Monitoring and Logging
  monitoring: {
    enableMetrics: process.env.NODE_ENV === 'production',
    enableDetailedLogging: process.env.NODE_ENV === 'development',
    metricsIntervalMs: 60000, // 1 minute metrics collection
    logSensitiveData: false // Never log API keys or user data
  }
} as const;

// Generate configuration based on selected provider
export const getProviderConfig = (provider?: ApiProvider) => {
  const selectedProvider = provider || nanoBananaConfig.provider;
  const providerData = API_PROVIDERS[selectedProvider];
  
  return {
    ...nanoBananaConfig,
    provider: selectedProvider,
    baseUrl: nanoBananaConfig.baseUrl || providerData.baseUrl,
    maxConcurrentRequests: Math.min(
      nanoBananaConfig.maxConcurrentRequests,
      providerData.maxConcurrentRequests
    ),
    rateLimiting: {
      ...nanoBananaConfig.rateLimiting,
      requestsPerMinute: Math.min(
        nanoBananaConfig.rateLimiting.requestsPerMinute,
        providerData.rateLimit.requestsPerMinute
      )
    },
    model: providerData.model,
    pricePerImage: providerData.pricePerImage
  };
};

// Validation functions
export const validateApiKey = (apiKey: string): boolean => {
  return apiKey.length > 10 && apiKey.startsWith('sk-') || apiKey.length > 20;
};

export const validateConfiguration = (): {
  isValid: boolean;
  errors: string[];
  warnings: string[];
} => {
  const errors: string[] = [];
  const warnings: string[] = [];

  // Check required environment variables
  try {
    validateEnvironment(true);
  } catch (error) {
    errors.push(error instanceof Error ? error.message : 'Configuration validation failed');
  }

  // Validate API key format
  if (nanoBananaConfig.apiKey && !validateApiKey(nanoBananaConfig.apiKey)) {
    warnings.push('API key format may be invalid');
  }

  // Check provider configuration
  if (!(nanoBananaConfig.provider in API_PROVIDERS)) {
    errors.push(`Invalid provider: ${nanoBananaConfig.provider}`);
  }

  // Validate numeric configurations
  if (nanoBananaConfig.timeout < 1000) {
    warnings.push('Request timeout is very low, may cause premature timeouts');
  }

  if (nanoBananaConfig.maxConcurrentRequests > 10) {
    warnings.push('High concurrent request count may hit rate limits');
  }

  return {
    isValid: errors.length === 0,
    errors,
    warnings
  };
};

// Health check function for nanoBanana API
export const checkNanoBananaConnection = async (): Promise<{
  available: boolean;
  provider: string;
  responseTimeMs?: number;
  error?: string;
}> => {
  const startTime = Date.now();
  
  try {
    // Basic connection test - this would be implemented in the client
    // For now, just validate configuration
    const validation = validateConfiguration();
    
    if (!validation.isValid) {
      return {
        available: false,
        provider: nanoBananaConfig.provider,
        error: validation.errors.join('; ')
      };
    }

    const responseTime = Date.now() - startTime;
    
    return {
      available: true,
      provider: nanoBananaConfig.provider,
      responseTimeMs: responseTime
    };
  } catch (error) {
    return {
      available: false,
      provider: nanoBananaConfig.provider,
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
};

// Export configuration getter with validation
export const getNanoBananaConfig = () => {
  const validation = validateConfiguration();
  
  if (!validation.isValid) {
    throw new Error(`nanoBanana configuration invalid: ${validation.errors.join(', ')}`);
  }

  if (validation.warnings.length > 0) {
    console.warn('nanoBanana configuration warnings:', validation.warnings);
  }

  return getProviderConfig();
};

export default {
  config: nanoBananaConfig,
  providers: API_PROVIDERS,
  getProviderConfig,
  validateConfiguration,
  checkNanoBananaConnection,
  getNanoBananaConfig
};