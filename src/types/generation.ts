/**
 * Shared Generation Types for Stream Coordination
 * Common types used across API client, queue system, and other streams
 */

// Re-export core nanoBanana types for convenience
export {
  GenerationStatus,
  Priority,
  ImageFormat,
  AspectRatio,
  Quality,
  Style
} from './nanoBanana';

// Base Generation Types
export interface GenerationJobBase {
  id: string;
  userId?: string;
  type: 'character' | 'batch' | 'single';
  status: 'pending' | 'queued' | 'processing' | 'completed' | 'failed' | 'cancelled';
  priority: 'low' | 'normal' | 'high' | 'urgent';
  createdAt: Date;
  updatedAt: Date;
  completedAt?: Date;
  scheduledAt?: Date;
}

// Character Generation Job (for Stream coordination)
export interface CharacterGenerationJob extends GenerationJobBase {
  type: 'character';
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
  generationParams?: {
    quality?: 'low' | 'medium' | 'high' | 'ultra';
    aspectRatio?: '1:1' | '16:9' | '9:16' | '4:3' | '3:4' | '2:1' | '1:2';
    outputFormat?: 'png' | 'jpeg' | 'jpg' | 'webp';
    style?: 'realistic' | 'artistic' | 'anime' | 'cartoon' | 'concept-art';
    variations?: number; // Number of variations (1-4)
  };
  results?: GenerationResult[];
  error?: GenerationError;
  progress?: GenerationProgress;
}

// Batch Generation Job (for Stream coordination)
export interface BatchGenerationJob extends GenerationJobBase {
  type: 'batch';
  batchId: string;
  requests: SingleGenerationJob[];
  totalRequests: number;
  completedRequests: number;
  failedRequests: number;
  results?: GenerationResult[];
  error?: GenerationError;
}

// Single Generation Job (for Stream coordination)
export interface SingleGenerationJob extends GenerationJobBase {
  type: 'single';
  prompt: string;
  negativePrompt?: string;
  generationParams?: {
    quality?: 'low' | 'medium' | 'high' | 'ultra';
    aspectRatio?: '1:1' | '16:9' | '9:16' | '4:3' | '3:4' | '2:1' | '1:2';
    outputFormat?: 'png' | 'jpeg' | 'jpg' | 'webp';
    style?: 'realistic' | 'artistic' | 'anime' | 'cartoon' | 'concept-art';
    seed?: number;
    steps?: number;
    guidanceScale?: number;
  };
  inputImage?: string; // For image-to-image generations
  result?: GenerationResult;
  error?: GenerationError;
  progress?: GenerationProgress;
}

// Union type for all generation jobs
export type GenerationJob = CharacterGenerationJob | BatchGenerationJob | SingleGenerationJob;

// Generation Result (shared across all streams)
export interface GenerationResult {
  id: string;
  imageUrl?: string;
  imageData?: string; // Base64 encoded
  thumbnailUrl?: string;
  metadata: {
    dimensions: {
      width: number;
      height: number;
    };
    format: 'png' | 'jpeg' | 'jpg' | 'webp';
    fileSize: number;
    generationTimeMs: number;
    seed: number;
    model: string;
    provider: string;
    cost?: number; // Cost in USD
  };
  createdAt: Date;
  storageInfo?: {
    s3Key?: string;
    cloudfrontUrl?: string;
    expiresAt?: Date;
  };
}

// Generation Error (shared across all streams)
export interface GenerationError {
  code: string;
  message: string;
  details?: any;
  retryable: boolean;
  retryCount?: number;
  lastRetryAt?: Date;
  originalError?: any;
}

// Generation Progress (shared across all streams)
export interface GenerationProgress {
  percentage: number;
  stage: 'queued' | 'preprocessing' | 'generating' | 'postprocessing' | 'uploading';
  message?: string;
  estimatedTimeRemainingMs?: number;
  startedAt?: Date;
}

// Queue-related types for Stream B coordination
export interface QueueMetrics {
  pending: number;
  processing: number;
  completed: number;
  failed: number;
  averageWaitTimeMs: number;
  averageProcessingTimeMs: number;
  throughputPerHour: number;
}

export interface QueueConfiguration {
  maxConcurrentJobs: number;
  maxQueueSize: number;
  priorityLevels: readonly string[];
  retryAttempts: number;
  retryDelayMs: number;
  jobTimeoutMs: number;
}

// Event types for inter-stream communication
export type GenerationEventType = 
  | 'job_created'
  | 'job_queued'
  | 'job_started'
  | 'job_progress'
  | 'job_completed'
  | 'job_failed'
  | 'job_cancelled'
  | 'job_timeout'
  | 'queue_full'
  | 'queue_empty'
  | 'batch_started'
  | 'batch_completed'
  | 'batch_failed';

export interface GenerationEvent {
  type: GenerationEventType;
  jobId: string;
  batchId?: string;
  userId?: string;
  timestamp: Date;
  data: any;
}

// API Integration types (for coordination between streams)
export interface ApiIntegrationConfig {
  provider: 'GOOGLE_OFFICIAL' | 'NANOBANANA_API' | 'FAL_AI';
  baseUrl: string;
  model: string;
  apiKey: string;
  rateLimits: {
    requestsPerMinute: number;
    requestsPerHour: number;
    concurrentRequests: number;
  };
  pricing: {
    pricePerImage: number;
    currency: 'USD';
  };
  features: {
    batchProcessing: boolean;
    imageToImage: boolean;
    multiImage: boolean;
    webhooks: boolean;
  };
}

// Storage Integration types (for coordination with other streams)
export interface StorageConfig {
  provider: 'AWS_S3' | 'GOOGLE_CLOUD' | 'LOCAL';
  bucketName?: string;
  region?: string;
  paths: {
    characters: string;
    thumbnails: string;
    temp: string;
    exports: string;
  };
  cdn?: {
    enabled: boolean;
    baseUrl: string;
    cacheTtl: number;
  };
}

// User Management types (for coordination with user system)
export interface UserGenerationLimits {
  userId: string;
  tier: 'free' | 'premium' | 'enterprise';
  limits: {
    dailyGenerations: number;
    monthlyGenerations: number;
    concurrentJobs: number;
    maxImageResolution: number;
    allowedFormats: string[];
  };
  usage: {
    dailyUsed: number;
    monthlyUsed: number;
    currentJobs: number;
  };
  resetDates: {
    dailyResetAt: Date;
    monthlyResetAt: Date;
  };
}

// Webhook types for external notifications
export interface WebhookConfig {
  url: string;
  secret?: string;
  events: GenerationEventType[];
  retryAttempts: number;
  retryDelayMs: number;
  timeoutMs: number;
  enabled: boolean;
}

export interface WebhookPayload {
  event: GenerationEventType;
  timestamp: string;
  data: {
    job: Partial<GenerationJob>;
    user?: {
      id: string;
      tier: string;
    };
    result?: GenerationResult;
    error?: GenerationError;
  };
  signature?: string;
}

// Analytics and Monitoring types
export interface GenerationAnalytics {
  timeRange: {
    start: Date;
    end: Date;
  };
  totals: {
    jobs: number;
    successful: number;
    failed: number;
    cancelled: number;
  };
  performance: {
    averageGenerationTime: number;
    p95GenerationTime: number;
    p99GenerationTime: number;
    throughputPerHour: number;
  };
  costs: {
    totalCost: number;
    costPerGeneration: number;
    costByProvider: Record<string, number>;
  };
  errors: {
    byCode: Record<string, number>;
    byProvider: Record<string, number>;
    retryRate: number;
  };
  usage: {
    byUser: Record<string, number>;
    byTier: Record<string, number>;
    popularStyles: Record<string, number>;
    popularAspectRatios: Record<string, number>;
  };
}

// Cache types for performance optimization
export interface CacheEntry {
  key: string;
  data: any;
  createdAt: Date;
  expiresAt: Date;
  accessCount: number;
  lastAccessedAt: Date;
}

export interface CacheMetrics {
  hitRate: number;
  missRate: number;
  evictionRate: number;
  averageResponseTime: number;
  totalEntries: number;
  usedMemory: number;
}

// Health Check types for monitoring
export interface HealthCheckResult {
  service: string;
  status: 'healthy' | 'degraded' | 'unhealthy';
  lastCheckedAt: Date;
  responseTimeMs: number;
  error?: string;
  details?: any;
}

export interface SystemHealthStatus {
  overall: 'healthy' | 'degraded' | 'unhealthy';
  services: {
    nanoBananaApi: HealthCheckResult;
    database: HealthCheckResult;
    storage: HealthCheckResult;
    cache: HealthCheckResult;
    queue: HealthCheckResult;
  };
  checkedAt: Date;
}

// Configuration validation types
export interface ConfigurationValidation {
  valid: boolean;
  errors: string[];
  warnings: string[];
  missingRequired: string[];
  deprecated: string[];
}

// Type guards for runtime type checking
export const isCharacterGenerationJob = (job: GenerationJob): job is CharacterGenerationJob => {
  return job.type === 'character';
};

export const isBatchGenerationJob = (job: GenerationJob): job is BatchGenerationJob => {
  return job.type === 'batch';
};

export const isSingleGenerationJob = (job: GenerationJob): job is SingleGenerationJob => {
  return job.type === 'single';
};

export const isCompletedJob = (job: GenerationJob): boolean => {
  return job.status === 'completed';
};

export const isFailedJob = (job: GenerationJob): boolean => {
  return job.status === 'failed';
};

export const isPendingJob = (job: GenerationJob): boolean => {
  return ['pending', 'queued', 'processing'].includes(job.status);
};

// Utility types for better type safety
export type JobStatus = GenerationJob['status'];
export type JobType = GenerationJob['type'];
export type JobPriority = GenerationJob['priority'];

// Default configurations for coordination
export const DEFAULT_GENERATION_CONFIG = {
  queue: {
    maxConcurrentJobs: 4,
    maxQueueSize: 100,
    priorityLevels: ['low', 'normal', 'high', 'urgent'] as const,
    retryAttempts: 3,
    retryDelayMs: 5000,
    jobTimeoutMs: 300000 // 5 minutes
  },
  api: {
    timeout: 30000,
    maxRetries: 3,
    rateLimitBuffer: 0.8, // Use 80% of rate limit
    batchSize: 4
  },
  storage: {
    tempTtl: 3600, // 1 hour for temp files
    resultTtl: 86400 * 7, // 7 days for results
    compressionQuality: 0.9
  }
} as const;