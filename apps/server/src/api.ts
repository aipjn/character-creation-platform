/**
 * Shared API Configuration for Stream Coordination
 * Central configuration management for all API integrations
 */

import { ApiIntegrationConfig, StorageConfig, WebhookConfig } from '../types/generation';

// Environment variable validation
const validateApiEnvironment = (): void => {
  const required = ['NODE_ENV'];
  const missing = required.filter(envVar => !process.env[envVar]);
  
  if (missing.length > 0) {
    console.warn(`Missing API environment variables: ${missing.join(', ')}`);
  }
};

// Base API Configuration
export const API_CONFIG = {
  // Global settings
  environment: process.env.NODE_ENV || 'development',
  debug: process.env.NODE_ENV === 'development',
  
  // Request defaults
  defaultTimeout: 30000, // 30 seconds
  maxRetries: 3,
  retryBaseDelay: 1000, // 1 second
  retryMaxDelay: 30000, // 30 seconds
  
  // Rate limiting defaults
  rateLimitBuffer: 0.8, // Use 80% of available rate limit
  burstAllowance: 5, // Allow short bursts above normal limits
  
  // Connection pooling
  maxConcurrentConnections: 10,
  connectionTimeout: 5000, // 5 seconds
  keepAlive: true,
  
  // Response handling
  maxResponseSize: 50 * 1024 * 1024, // 50MB
  compression: true,
  
  // Security
  validateCertificates: process.env.NODE_ENV === 'production',
  allowInsecure: process.env.NODE_ENV === 'development'
} as const;

// nanoBanana API Integration Configuration
export const NANOBANANA_INTEGRATION: ApiIntegrationConfig = {
  provider: (process.env.NANOBANANA_PROVIDER as any) || 'NANOBANANA_API',
  baseUrl: process.env.NANOBANANA_API_URL || 'https://api.nanobanana.ai/v1',
  model: process.env.NANOBANANA_MODEL || 'nano-banana',
  apiKey: process.env.NANOBANANA_API_KEY || '',
  rateLimits: {
    requestsPerMinute: parseInt(process.env.NANOBANANA_RPM || '30', 10),
    requestsPerHour: parseInt(process.env.NANOBANANA_RPH || '500', 10),
    concurrentRequests: parseInt(process.env.NANOBANANA_CONCURRENT || '4', 10)
  },
  pricing: {
    pricePerImage: parseFloat(process.env.NANOBANANA_PRICE_PER_IMAGE || '0.020'),
    currency: 'USD'
  },
  features: {
    batchProcessing: true,
    imageToImage: true,
    multiImage: true,
    webhooks: !!process.env.NANOBANANA_WEBHOOK_URL
  }
};

// Storage Integration Configuration
export const STORAGE_INTEGRATION: StorageConfig = {
  provider: (process.env.STORAGE_PROVIDER as any) || 'AWS_S3',
  bucketName: process.env.AWS_S3_BUCKET_NAME || '',
  region: process.env.AWS_REGION || 'us-east-1',
  paths: {
    characters: process.env.STORAGE_PATH_CHARACTERS || 'characters/',
    thumbnails: process.env.STORAGE_PATH_THUMBNAILS || 'thumbnails/',
    temp: process.env.STORAGE_PATH_TEMP || 'temp/',
    exports: process.env.STORAGE_PATH_EXPORTS || 'exports/'
  },
  cdn: {
    enabled: !!process.env.AWS_CLOUDFRONT_DOMAIN_NAME,
    baseUrl: process.env.AWS_CLOUDFRONT_DOMAIN_NAME || '',
    cacheTtl: parseInt(process.env.CDN_CACHE_TTL || '86400', 10) // 24 hours default
  }
};

// Webhook Configuration
export const WEBHOOK_CONFIG: WebhookConfig = {
  url: process.env.WEBHOOK_URL || '',
  secret: process.env.WEBHOOK_SECRET || '',
  events: [
    'job_completed',
    'job_failed',
    'batch_completed',
    'batch_failed'
  ],
  retryAttempts: parseInt(process.env.WEBHOOK_RETRY_ATTEMPTS || '3', 10),
  retryDelayMs: parseInt(process.env.WEBHOOK_RETRY_DELAY || '5000', 10),
  timeoutMs: parseInt(process.env.WEBHOOK_TIMEOUT || '10000', 10),
  enabled: !!process.env.WEBHOOK_URL
};

// Database Configuration for API integration
export const DATABASE_CONFIG = {
  // Connection settings
  maxConnections: parseInt(process.env.DATABASE_MAX_CONNECTIONS || '20', 10),
  connectionTimeoutMs: parseInt(process.env.DATABASE_CONNECTION_TIMEOUT || '5000', 10),
  queryTimeoutMs: parseInt(process.env.DATABASE_QUERY_TIMEOUT || '30000', 10),
  
  // Pool settings
  idleTimeoutMs: parseInt(process.env.DATABASE_IDLE_TIMEOUT || '30000', 10),
  maxRetries: parseInt(process.env.DATABASE_MAX_RETRIES || '3', 10),
  
  // Performance settings
  enableQueryLogging: process.env.NODE_ENV === 'development',
  enableSlowQueryLogging: true,
  slowQueryThresholdMs: parseInt(process.env.DATABASE_SLOW_QUERY_THRESHOLD || '1000', 10)
};

// Cache Configuration
export const CACHE_CONFIG = {
  // Redis settings (if using Redis)
  redisUrl: process.env.REDIS_URL || '',
  redisPassword: process.env.REDIS_PASSWORD || '',
  redisDb: parseInt(process.env.REDIS_DB || '0', 10),
  
  // Cache TTLs (Time To Live)
  ttl: {
    default: 3600, // 1 hour
    short: 300, // 5 minutes
    medium: 1800, // 30 minutes
    long: 86400, // 24 hours
    userLimits: 900, // 15 minutes
    apiStatus: 60, // 1 minute
    generationResults: 86400 * 7 // 7 days
  },
  
  // Memory limits
  maxMemoryMB: parseInt(process.env.CACHE_MAX_MEMORY_MB || '512', 10),
  evictionPolicy: process.env.CACHE_EVICTION_POLICY || 'allkeys-lru',
  
  // Performance
  keyPrefix: process.env.CACHE_KEY_PREFIX || 'cc:',
  compression: true
};

// Monitoring Configuration
export const MONITORING_CONFIG = {
  // Metrics collection
  enabled: process.env.NODE_ENV === 'production',
  metricsIntervalMs: parseInt(process.env.METRICS_INTERVAL_MS || '60000', 10), // 1 minute
  
  // Health checks
  healthCheckIntervalMs: parseInt(process.env.HEALTH_CHECK_INTERVAL_MS || '30000', 10), // 30 seconds
  healthCheckTimeoutMs: parseInt(process.env.HEALTH_CHECK_TIMEOUT_MS || '5000', 10), // 5 seconds
  
  // Logging
  logLevel: process.env.LOG_LEVEL || 'info',
  enableStructuredLogging: process.env.NODE_ENV === 'production',
  logSensitiveData: false, // Never log sensitive data
  
  // Alerting
  alertWebhookUrl: process.env.ALERT_WEBHOOK_URL || '',
  errorThreshold: parseInt(process.env.ERROR_THRESHOLD || '10', 10), // 10 errors per minute
  responseTimeThreshold: parseInt(process.env.RESPONSE_TIME_THRESHOLD || '5000', 10) // 5 seconds
};

// Queue Configuration (for Stream B coordination)
export const QUEUE_CONFIG = {
  // Queue limits
  maxQueueSize: parseInt(process.env.QUEUE_MAX_SIZE || '100', 10),
  maxConcurrentJobs: parseInt(process.env.QUEUE_MAX_CONCURRENT || '4', 10),
  
  // Job settings
  jobTimeoutMs: parseInt(process.env.JOB_TIMEOUT_MS || '300000', 10), // 5 minutes
  maxRetryAttempts: parseInt(process.env.JOB_MAX_RETRIES || '3', 10),
  retryDelayMs: parseInt(process.env.JOB_RETRY_DELAY_MS || '5000', 10),
  
  // Priority settings
  priorityLevels: ['low', 'normal', 'high', 'urgent'] as const,
  defaultPriority: 'normal' as const,
  
  // Cleanup settings
  cleanupIntervalMs: parseInt(process.env.QUEUE_CLEANUP_INTERVAL_MS || '300000', 10), // 5 minutes
  maxCompletedJobAge: parseInt(process.env.QUEUE_MAX_COMPLETED_AGE_MS || '86400000', 10), // 24 hours
  maxFailedJobAge: parseInt(process.env.QUEUE_MAX_FAILED_AGE_MS || '259200000', 10) // 3 days
};

// Security Configuration
export const SECURITY_CONFIG = {
  // API Keys
  apiKeyLength: 32,
  apiKeyPrefix: 'cc_',
  
  // Rate limiting
  rateLimitWindowMs: 60000, // 1 minute
  rateLimitMaxRequests: 100, // 100 requests per minute per IP
  
  // Request validation
  maxRequestSize: 10 * 1024 * 1024, // 10MB
  allowedOrigins: process.env.ALLOWED_ORIGINS?.split(',') || ['*'],
  
  // Headers
  corsEnabled: true,
  securityHeaders: {
    'X-Content-Type-Options': 'nosniff',
    'X-Frame-Options': 'DENY',
    'X-XSS-Protection': '1; mode=block',
    'Strict-Transport-Security': 'max-age=31536000; includeSubDomains',
    'Content-Security-Policy': "default-src 'self'"
  }
};

// Feature Flags (for Stream coordination)
export const FEATURE_FLAGS = {
  // API features
  enableBatchProcessing: process.env.ENABLE_BATCH_PROCESSING !== 'false',
  enableWebhooks: process.env.ENABLE_WEBHOOKS !== 'false',
  enableCaching: process.env.ENABLE_CACHING !== 'false',
  
  // Queue features
  enablePriorityQueue: process.env.ENABLE_PRIORITY_QUEUE !== 'false',
  enableRetryLogic: process.env.ENABLE_RETRY_LOGIC !== 'false',
  
  // Monitoring features
  enableMetrics: process.env.ENABLE_METRICS !== 'false',
  enableTracing: process.env.ENABLE_TRACING !== 'false',
  enableProfiling: process.env.ENABLE_PROFILING === 'true',
  
  // Development features
  enableDebugLogs: process.env.NODE_ENV === 'development',
  enableApiMocking: process.env.ENABLE_API_MOCKING === 'true',
  enableTestMode: process.env.NODE_ENV === 'test'
};

// Provider Configurations (for multi-provider support)
export const PROVIDER_CONFIGS = {
  GOOGLE_OFFICIAL: {
    baseUrl: 'https://ai.googleapis.com/v1/models/gemini-2.5-flash-image',
    rateLimit: { rpm: 60, rph: 1000, concurrent: 10 },
    pricing: { pricePerImage: 0.039 }
  },
  NANOBANANA_API: {
    baseUrl: 'https://api.nanobanana.ai/v1',
    rateLimit: { rpm: 30, rph: 500, concurrent: 4 },
    pricing: { pricePerImage: 0.020 }
  },
  FAL_AI: {
    baseUrl: 'https://fal.run/fal-ai/nano-banana',
    rateLimit: { rpm: 40, rph: 750, concurrent: 6 },
    pricing: { pricePerImage: 0.025 }
  }
} as const;

// Validation Functions
export const validateApiConfiguration = (): {
  valid: boolean;
  errors: string[];
  warnings: string[];
} => {
  const errors: string[] = [];
  const warnings: string[] = [];

  // Validate nanoBanana configuration
  if (!NANOBANANA_INTEGRATION.apiKey) {
    errors.push('NANOBANANA_API_KEY is required');
  }

  if (!NANOBANANA_INTEGRATION.baseUrl) {
    errors.push('NANOBANANA_API_URL is required');
  }

  // Validate storage configuration
  if (STORAGE_INTEGRATION.provider === 'AWS_S3' && !STORAGE_INTEGRATION.bucketName) {
    errors.push('AWS_S3_BUCKET_NAME is required when using AWS_S3 storage');
  }

  // Validate webhook configuration
  if (WEBHOOK_CONFIG.enabled && !WEBHOOK_CONFIG.url) {
    warnings.push('Webhook URL is enabled but not configured');
  }

  // Validate monitoring configuration
  if (MONITORING_CONFIG.enabled && !MONITORING_CONFIG.alertWebhookUrl) {
    warnings.push('Monitoring is enabled but no alert webhook URL configured');
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings
  };
};

// Configuration Getters (for type-safe access)
export const getApiConfig = () => ({ ...API_CONFIG });
export const getNanoBananaIntegration = () => ({ ...NANOBANANA_INTEGRATION });
export const getStorageIntegration = () => ({ ...STORAGE_INTEGRATION });
export const getWebhookConfig = () => ({ ...WEBHOOK_CONFIG });
export const getDatabaseConfig = () => ({ ...DATABASE_CONFIG });
export const getCacheConfig = () => ({ ...CACHE_CONFIG });
export const getMonitoringConfig = () => ({ ...MONITORING_CONFIG });
export const getQueueConfig = () => ({ ...QUEUE_CONFIG });
export const getSecurityConfig = () => ({ ...SECURITY_CONFIG });
export const getFeatureFlags = () => ({ ...FEATURE_FLAGS });

// Environment-specific configuration loading
export const loadEnvironmentConfig = () => {
  validateApiEnvironment();
  
  const validation = validateApiConfiguration();
  
  if (validation.warnings.length > 0) {
    console.warn('API Configuration warnings:', validation.warnings);
  }
  
  if (!validation.valid) {
    throw new Error(`API Configuration errors: ${validation.errors.join(', ')}`);
  }

  return {
    api: getApiConfig(),
    nanoBanana: getNanoBananaIntegration(),
    storage: getStorageIntegration(),
    webhook: getWebhookConfig(),
    database: getDatabaseConfig(),
    cache: getCacheConfig(),
    monitoring: getMonitoringConfig(),
    queue: getQueueConfig(),
    security: getSecurityConfig(),
    features: getFeatureFlags()
  };
};

// Export all configurations as a single object for convenience
export const CONFIG = {
  API: API_CONFIG,
  NANOBANANA: NANOBANANA_INTEGRATION,
  STORAGE: STORAGE_INTEGRATION,
  WEBHOOK: WEBHOOK_CONFIG,
  DATABASE: DATABASE_CONFIG,
  CACHE: CACHE_CONFIG,
  MONITORING: MONITORING_CONFIG,
  QUEUE: QUEUE_CONFIG,
  SECURITY: SECURITY_CONFIG,
  FEATURES: FEATURE_FLAGS,
  PROVIDERS: PROVIDER_CONFIGS
} as const;

export default CONFIG;