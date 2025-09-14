/**
 * Resilience Configuration
 * 
 * Centralized configuration for error handling, circuit breaker,
 * rate limiting, and retry patterns across the application.
 */

export interface RetryConfig {
  maxAttempts: number;
  baseDelayMs: number;
  maxDelayMs: number;
  backoffMultiplier: number;
  jitterFactor: number;
}

export interface CircuitBreakerConfig {
  failureThreshold: number;
  resetTimeoutMs: number;
  monitoringPeriodMs: number;
  minimumThroughput: number;
}

export interface RateLimiterConfig {
  windowMs: number;
  maxRequests: number;
  skipSuccessfulRequests?: boolean;
  skipFailedRequests?: boolean;
}

export interface ApiEndpointConfig {
  name: string;
  retry: RetryConfig;
  circuitBreaker: CircuitBreakerConfig;
  rateLimit: RateLimiterConfig;
  timeoutMs: number;
}

export interface ResilienceConfig {
  defaults: {
    retry: RetryConfig;
    circuitBreaker: CircuitBreakerConfig;
    rateLimit: RateLimiterConfig;
    timeoutMs: number;
  };
  endpoints: Record<string, Partial<ApiEndpointConfig>>;
}

/**
 * Default resilience configuration
 */
export const DEFAULT_RESILIENCE_CONFIG: ResilienceConfig = {
  defaults: {
    retry: {
      maxAttempts: 3,
      baseDelayMs: 1000,
      maxDelayMs: 30000,
      backoffMultiplier: 2,
      jitterFactor: 0.1,
    },
    circuitBreaker: {
      failureThreshold: 5,
      resetTimeoutMs: 60000,
      monitoringPeriodMs: 10000,
      minimumThroughput: 10,
    },
    rateLimit: {
      windowMs: 60000, // 1 minute
      maxRequests: 100,
      skipSuccessfulRequests: false,
      skipFailedRequests: false,
    },
    timeoutMs: 30000,
  },
  endpoints: {
    // nanoBanana API specific configuration
    nanoBanana: {
      retry: {
        maxAttempts: 5,
        baseDelayMs: 2000,
        maxDelayMs: 60000,
        backoffMultiplier: 2.5,
        jitterFactor: 0.2,
      },
      circuitBreaker: {
        failureThreshold: 3,
        resetTimeoutMs: 120000, // 2 minutes
        monitoringPeriodMs: 30000, // 30 seconds
        minimumThroughput: 5,
      },
      rateLimit: {
        windowMs: 60000,
        maxRequests: 10, // Conservative for AI API
        skipSuccessfulRequests: false,
        skipFailedRequests: true,
      },
      timeoutMs: 120000, // 2 minutes for AI generation
    },
    // Database operations
    database: {
      retry: {
        maxAttempts: 3,
        baseDelayMs: 500,
        maxDelayMs: 5000,
        backoffMultiplier: 1.5,
        jitterFactor: 0.05,
      },
      circuitBreaker: {
        failureThreshold: 10,
        resetTimeoutMs: 30000,
        monitoringPeriodMs: 5000,
        minimumThroughput: 20,
      },
      timeoutMs: 10000,
    },
    // File upload/storage operations
    storage: {
      retry: {
        maxAttempts: 4,
        baseDelayMs: 1500,
        maxDelayMs: 20000,
        backoffMultiplier: 2,
        jitterFactor: 0.15,
      },
      circuitBreaker: {
        failureThreshold: 7,
        resetTimeoutMs: 45000,
        monitoringPeriodMs: 15000,
        minimumThroughput: 15,
      },
      timeoutMs: 60000,
    },
  },
};

/**
 * Error types that should trigger retries
 */
export const RETRYABLE_ERRORS = [
  'ECONNRESET',
  'ENOTFOUND',
  'ECONNREFUSED',
  'ETIMEDOUT',
  'NETWORK_ERROR',
  'SERVICE_UNAVAILABLE',
  'RATE_LIMITED',
  'TEMPORARY_FAILURE',
] as const;

/**
 * HTTP status codes that should trigger retries
 */
export const RETRYABLE_HTTP_CODES = [
  408, // Request Timeout
  429, // Too Many Requests
  502, // Bad Gateway
  503, // Service Unavailable
  504, // Gateway Timeout
  520, // Unknown Error (Cloudflare)
  521, // Web Server Is Down (Cloudflare)
  522, // Connection Timed Out (Cloudflare)
  523, // Origin Is Unreachable (Cloudflare)
  524, // A Timeout Occurred (Cloudflare)
] as const;

/**
 * Error types that should trigger circuit breaker
 */
export const CIRCUIT_BREAKER_ERRORS = [
  ...RETRYABLE_ERRORS,
  'API_ERROR',
  'QUOTA_EXCEEDED',
  'AUTHENTICATION_FAILED',
  'VALIDATION_ERROR',
] as const;

/**
 * Get configuration for a specific endpoint
 */
export function getEndpointConfig(
  endpointName: string,
  config: ResilienceConfig = DEFAULT_RESILIENCE_CONFIG
): ApiEndpointConfig {
  const endpointConfig = config.endpoints[endpointName] || {};
  
  return {
    name: endpointName,
    retry: { ...config.defaults.retry, ...endpointConfig.retry },
    circuitBreaker: { ...config.defaults.circuitBreaker, ...endpointConfig.circuitBreaker },
    rateLimit: { ...config.defaults.rateLimit, ...endpointConfig.rateLimit },
    timeoutMs: endpointConfig.timeoutMs || config.defaults.timeoutMs,
  };
}

/**
 * Check if an error should trigger a retry
 */
export function isRetryableError(error: unknown): boolean {
  if (!error) return false;
  
  if (typeof error === 'object' && error !== null) {
    const errorObj = error as any;
    
    // Check error code
    if (errorObj.code && RETRYABLE_ERRORS.includes(errorObj.code)) {
      return true;
    }
    
    // Check HTTP status code
    if (errorObj.status && RETRYABLE_HTTP_CODES.includes(errorObj.status)) {
      return true;
    }
    
    // Check response status
    if (errorObj.response?.status && RETRYABLE_HTTP_CODES.includes(errorObj.response.status)) {
      return true;
    }
    
    // Check message for specific patterns
    if (typeof errorObj.message === 'string') {
      const message = errorObj.message.toLowerCase();
      const retryablePatterns = [
        'timeout',
        'connection',
        'network',
        'temporary',
        'rate limit',
        'service unavailable',
      ];
      
      return retryablePatterns.some(pattern => message.includes(pattern));
    }
  }
  
  return false;
}

/**
 * Check if an error should trigger circuit breaker
 */
export function isCircuitBreakerError(error: unknown): boolean {
  if (!error) return false;
  
  // Circuit breaker triggers on retryable errors plus additional conditions
  if (isRetryableError(error)) {
    return true;
  }
  
  if (typeof error === 'object' && error !== null) {
    const errorObj = error as any;
    
    // Check for authentication/authorization errors
    if (errorObj.status === 401 || errorObj.status === 403) {
      return true;
    }
    
    // Check for quota/rate limit errors
    if (errorObj.status === 429 || errorObj.code === 'QUOTA_EXCEEDED') {
      return true;
    }
    
    // Check for server errors (5xx)
    if (errorObj.status >= 500) {
      return true;
    }
  }
  
  return false;
}

export type RetryableErrorType = typeof RETRYABLE_ERRORS[number];
export type CircuitBreakerErrorType = typeof CIRCUIT_BREAKER_ERRORS[number];
export type RetryableHttpCode = typeof RETRYABLE_HTTP_CODES[number];