/**
 * nanoBanana API Types and Interfaces
 * Type definitions for Google Gemini 2.5 Flash Image (nanoBanana) API integration
 */

// Base types
export type GenerationStatus = 
  | 'pending'
  | 'queued' 
  | 'processing'
  | 'completed'
  | 'failed'
  | 'cancelled'
  | 'timeout';

export type ImageFormat = 'png' | 'jpeg' | 'jpg' | 'webp';
export type AspectRatio = '1:1' | '16:9' | '9:16' | '4:3' | '3:4' | '2:1' | '1:2';
export type Quality = 'low' | 'medium' | 'high' | 'ultra';
export type Style = 'realistic' | 'artistic' | 'anime' | 'cartoon' | 'concept-art';
export type Priority = 'low' | 'normal' | 'high' | 'urgent';

// Request Types
export interface BaseGenerationRequest {
  prompt: string;
  negativePrompt?: string;
  quality?: Quality;
  aspectRatio?: AspectRatio;
  outputFormat?: ImageFormat;
  style?: Style;
  seed?: number;
  steps?: number;
  guidanceScale?: number;
  width?: number;
  height?: number;
}

export interface TextToImageRequest extends BaseGenerationRequest {
  type: 'text-to-image';
}

export interface ImageToImageRequest extends BaseGenerationRequest {
  type: 'image-to-image';
  inputImage: string; // Base64 encoded image or URL
  strength?: number; // 0.0 to 1.0, how much to change the image
  maskImage?: string; // Base64 encoded mask image
}

export interface MultiImageRequest extends BaseGenerationRequest {
  type: 'multi-image';
  inputImages: string[]; // Array of Base64 encoded images or URLs
  blendMode?: 'multiply' | 'overlay' | 'screen' | 'average';
  weights?: number[]; // Influence weight for each image (0.0 to 1.0)
}

export type GenerationRequest = TextToImageRequest | ImageToImageRequest | MultiImageRequest;

// Batch Request Types
export interface BatchGenerationRequest {
  requests: GenerationRequest[];
  batchId?: string;
  priority?: Priority;
  webhookUrl?: string;
  metadata?: Record<string, any>;
}

export interface CharacterGenerationRequest {
  characterId: string;
  characterSpecs: {
    name?: string;
    description: string;
    traits?: string[];
    appearance?: {
      age?: string;
      gender?: string;
      height?: string;
      build?: string;
      hair?: string;
      eyes?: string;
      skin?: string;
      clothing?: string;
      accessories?: string[];
    };
    personality?: string[];
    background?: string;
  };
  generationParams?: Partial<BaseGenerationRequest>;
  variations?: number; // Number of variations to generate (1-4)
}

// Response Types
export interface GenerationResult {
  imageUrl?: string;
  imageData?: string; // Base64 encoded image data
  thumbnailUrl?: string;
  metadata: {
    dimensions: {
      width: number;
      height: number;
    };
    format: ImageFormat;
    fileSize: number;
    generationTimeMs: number;
    seed: number;
    model: string;
    provider: string;
  };
}

export interface GenerationResponse {
  id: string;
  status: GenerationStatus;
  result?: GenerationResult;
  error?: {
    code: string;
    message: string;
    details?: any;
  };
  progress?: {
    percentage: number;
    stage: string;
    estimatedTimeRemainingMs?: number;
  };
  createdAt: string;
  updatedAt: string;
  completedAt?: string;
}

export interface BatchGenerationResponse {
  batchId: string;
  status: GenerationStatus;
  totalRequests: number;
  completedRequests: number;
  failedRequests: number;
  results: GenerationResponse[];
  createdAt: string;
  updatedAt: string;
  estimatedCompletionAt?: string;
}

// API Client Types
export interface ApiRequestConfig {
  method: 'GET' | 'POST' | 'PUT' | 'DELETE';
  url: string;
  headers?: Record<string, string>;
  data?: any;
  timeout?: number;
  retries?: number;
}

export interface ApiResponse<T = any> {
  data: T;
  status: number;
  statusText: string;
  headers: Record<string, string>;
  requestId?: string;
}

export interface ApiError {
  code: string;
  message: string;
  statusCode?: number;
  details?: any;
  retryable?: boolean;
  requestId?: string;
}

// Rate Limiting Types
export interface RateLimitInfo {
  limit: number;
  remaining: number;
  resetAt: Date;
  retryAfterMs?: number;
}

export interface RateLimitState {
  requestsPerMinute: RateLimitInfo;
  requestsPerHour: RateLimitInfo;
  requestsPerDay?: RateLimitInfo;
  concurrentRequests: {
    current: number;
    maximum: number;
  };
}

// Circuit Breaker Types
export type CircuitBreakerState = 'closed' | 'open' | 'half-open';

export interface CircuitBreakerStatus {
  state: CircuitBreakerState;
  failureCount: number;
  lastFailureAt?: Date;
  nextAttemptAt?: Date;
  requestCount: number;
  successCount: number;
}

// Authentication Types
export interface AuthToken {
  value: string;
  type: 'bearer' | 'api-key';
  expiresAt?: Date;
  scope?: string[];
}

export interface AuthConfig {
  apiKey: string;
  tokenRefreshUrl?: string;
  tokenValidationUrl?: string;
  autoRefresh?: boolean;
  refreshThresholdMs?: number;
}

// Event Types
export type NanoBananaEventType = 
  | 'request_started'
  | 'request_completed'
  | 'request_failed'
  | 'batch_started'
  | 'batch_completed'
  | 'batch_failed'
  | 'rate_limit_hit'
  | 'circuit_breaker_opened'
  | 'circuit_breaker_closed'
  | 'auth_token_refreshed'
  | 'auth_token_expired';

export interface NanoBananaEvent {
  type: NanoBananaEventType;
  timestamp: Date;
  data: any;
  requestId?: string;
  batchId?: string;
}

// Webhook Types
export interface WebhookPayload {
  event: NanoBananaEventType;
  data: {
    id: string;
    status: GenerationStatus;
    result?: GenerationResult;
    error?: ApiError;
    batchId?: string;
  };
  timestamp: string;
  signature: string;
}

// Monitoring Types
export interface ApiMetrics {
  requests: {
    total: number;
    successful: number;
    failed: number;
    averageResponseTimeMs: number;
  };
  rateLimiting: {
    rateLimitHits: number;
    throttledRequests: number;
  };
  circuitBreaker: {
    state: CircuitBreakerState;
    openCount: number;
    halfOpenCount: number;
  };
  errors: {
    byCode: Record<string, number>;
    byType: Record<string, number>;
  };
  performance: {
    averageGenerationTimeMs: number;
    p95GenerationTimeMs: number;
    p99GenerationTimeMs: number;
  };
}

// Configuration Types
export interface ProviderConfig {
  baseUrl: string;
  model: string;
  maxConcurrentRequests: number;
  rateLimit: {
    requestsPerMinute: number;
    requestsPerHour: number;
  };
  pricePerImage: number;
}

export interface ClientConfig {
  provider: string;
  apiKey: string;
  baseUrl: string;
  timeout: number;
  maxRetries: number;
  maxConcurrentRequests: number;
  batchConfig: {
    maxBatchSize: number;
    batchTimeoutMs: number;
    priorityLevels: readonly string[];
  };
  rateLimiting: {
    requestsPerMinute: number;
    requestsPerHour: number;
    burstAllowance: number;
    cooldownMs: number;
  };
  circuitBreaker: {
    failureThreshold: number;
    timeoutMs: number;
    monitoringPeriodMs: number;
    minimumRequestCount: number;
  };
  retryConfig: {
    initialDelayMs: number;
    maxDelayMs: number;
    backoffMultiplier: number;
    retryableStatusCodes: number[];
    retryableErrors: string[];
  };
}

// Queue Types (for coordination with Stream B)
export interface QueuedRequest {
  id: string;
  type: 'generation' | 'batch';
  request: GenerationRequest | BatchGenerationRequest;
  priority: Priority;
  userId?: string;
  createdAt: Date;
  scheduledAt?: Date;
  attempts: number;
  maxAttempts: number;
  lastError?: ApiError;
}

export interface QueueStatus {
  pending: number;
  processing: number;
  completed: number;
  failed: number;
  averageWaitTimeMs: number;
  averageProcessingTimeMs: number;
}

// Utility Types
export type DeepPartial<T> = {
  [P in keyof T]?: T[P] extends object ? DeepPartial<T[P]> : T[P];
};

export type RequiredKeys<T, K extends keyof T> = T & Required<Pick<T, K>>;

export type OptionalKeys<T, K extends keyof T> = Omit<T, K> & Partial<Pick<T, K>>;

// Export all types as a namespace for better organization
export namespace NanoBanana {
  export type Request = GenerationRequest;
  export type Response = GenerationResponse;
  export type BatchRequest = BatchGenerationRequest;
  export type BatchResponse = BatchGenerationResponse;
  export type Error = ApiError;
  export type Config = ClientConfig;
  export type Metrics = ApiMetrics;
  export type Event = NanoBananaEvent;
}