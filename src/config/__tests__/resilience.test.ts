/**
 * Tests for resilience configuration
 */

import {
  DEFAULT_RESILIENCE_CONFIG,
  getEndpointConfig,
  isRetryableError,
  isCircuitBreakerError,
  RETRYABLE_ERRORS,
  RETRYABLE_HTTP_CODES,
  ResilienceConfig,
} from '../resilience';

describe('Resilience Configuration', () => {
  describe('DEFAULT_RESILIENCE_CONFIG', () => {
    it('should have valid default configuration', () => {
      expect(DEFAULT_RESILIENCE_CONFIG).toBeDefined();
      expect(DEFAULT_RESILIENCE_CONFIG.defaults).toBeDefined();
      expect(DEFAULT_RESILIENCE_CONFIG.endpoints).toBeDefined();
    });

    it('should have valid default retry configuration', () => {
      const { retry } = DEFAULT_RESILIENCE_CONFIG.defaults;
      expect(retry.maxAttempts).toBeGreaterThan(0);
      expect(retry.baseDelayMs).toBeGreaterThan(0);
      expect(retry.maxDelayMs).toBeGreaterThanOrEqual(retry.baseDelayMs);
      expect(retry.backoffMultiplier).toBeGreaterThan(1);
      expect(retry.jitterFactor).toBeGreaterThanOrEqual(0);
      expect(retry.jitterFactor).toBeLessThanOrEqual(1);
    });

    it('should have valid default circuit breaker configuration', () => {
      const { circuitBreaker } = DEFAULT_RESILIENCE_CONFIG.defaults;
      expect(circuitBreaker.failureThreshold).toBeGreaterThan(0);
      expect(circuitBreaker.resetTimeoutMs).toBeGreaterThan(0);
      expect(circuitBreaker.monitoringPeriodMs).toBeGreaterThan(0);
      expect(circuitBreaker.minimumThroughput).toBeGreaterThanOrEqual(0);
    });

    it('should have valid default rate limit configuration', () => {
      const { rateLimit } = DEFAULT_RESILIENCE_CONFIG.defaults;
      expect(rateLimit.windowMs).toBeGreaterThan(0);
      expect(rateLimit.maxRequests).toBeGreaterThan(0);
      expect(typeof rateLimit.skipSuccessfulRequests).toBe('boolean');
      expect(typeof rateLimit.skipFailedRequests).toBe('boolean');
    });

    it('should have nanoBanana endpoint configuration', () => {
      expect(DEFAULT_RESILIENCE_CONFIG.endpoints['nanoBanana']).toBeDefined();
      const nanoBanana = DEFAULT_RESILIENCE_CONFIG.endpoints['nanoBanana'];
      expect(nanoBanana?.retry?.maxAttempts).toBeGreaterThan(3); // More aggressive for AI API
      expect(nanoBanana?.timeoutMs).toBeGreaterThan(60000); // Longer timeout for AI generation
    });
  });

  describe('getEndpointConfig', () => {
    it('should return default config for unknown endpoint', () => {
      const config = getEndpointConfig('unknown');
      expect(config.name).toBe('unknown');
      expect(config.retry).toEqual(DEFAULT_RESILIENCE_CONFIG.defaults.retry);
      expect(config.circuitBreaker).toEqual(DEFAULT_RESILIENCE_CONFIG.defaults.circuitBreaker);
      expect(config.rateLimit).toEqual(DEFAULT_RESILIENCE_CONFIG.defaults.rateLimit);
      expect(config.timeoutMs).toBe(DEFAULT_RESILIENCE_CONFIG.defaults.timeoutMs);
    });

    it('should merge endpoint-specific config with defaults', () => {
      const config = getEndpointConfig('nanoBanana');
      expect(config.name).toBe('nanoBanana');
      
      // Should have nanoBanana-specific retry config
      expect(config.retry.maxAttempts).toBe(5);
      expect(config.retry.baseDelayMs).toBe(2000);
      
      // Should have nanoBanana-specific timeout
      expect(config.timeoutMs).toBe(120000);
      
      // Should merge circuit breaker config
      expect(config.circuitBreaker.failureThreshold).toBe(3); // nanoBanana specific
      expect(config.circuitBreaker.resetTimeoutMs).toBe(120000); // nanoBanana specific
    });

    it('should work with custom resilience config', () => {
      const customConfig: ResilienceConfig = {
        defaults: {
          retry: {
            maxAttempts: 2,
            baseDelayMs: 500,
            maxDelayMs: 10000,
            backoffMultiplier: 1.5,
            jitterFactor: 0.05,
          },
          circuitBreaker: {
            failureThreshold: 3,
            resetTimeoutMs: 30000,
            monitoringPeriodMs: 5000,
            minimumThroughput: 5,
          },
          rateLimit: {
            windowMs: 30000,
            maxRequests: 50,
          },
          timeoutMs: 15000,
        },
        endpoints: {
          custom: {
            retry: {
              maxAttempts: 1,
              baseDelayMs: 1000,
              maxDelayMs: 10000,
              backoffMultiplier: 2,
              jitterFactor: 0.1,
            },
            timeoutMs: 5000,
          },
        },
      };

      const config = getEndpointConfig('custom', customConfig);
      expect(config.retry.maxAttempts).toBe(1); // endpoint specific
      expect(config.retry.baseDelayMs).toBe(1000); // from custom config
      expect(config.timeoutMs).toBe(5000); // endpoint specific
    });
  });

  describe('isRetryableError', () => {
    it('should return false for falsy values', () => {
      expect(isRetryableError(null)).toBe(false);
      expect(isRetryableError(undefined)).toBe(false);
      expect(isRetryableError('')).toBe(false);
      expect(isRetryableError(0)).toBe(false);
    });

    it('should identify retryable error codes', () => {
      const retryableErrors = [
        { code: 'ECONNRESET' },
        { code: 'ENOTFOUND' },
        { code: 'ECONNREFUSED' },
        { code: 'ETIMEDOUT' },
        { code: 'NETWORK_ERROR' },
        { code: 'SERVICE_UNAVAILABLE' },
        { code: 'RATE_LIMITED' },
        { code: 'TEMPORARY_FAILURE' },
      ];

      retryableErrors.forEach(error => {
        expect(isRetryableError(error)).toBe(true);
      });
    });

    it('should identify retryable HTTP status codes', () => {
      const retryableStatuses = [408, 429, 502, 503, 504, 520, 521, 522, 523, 524];

      retryableStatuses.forEach(status => {
        expect(isRetryableError({ status })).toBe(true);
        expect(isRetryableError({ response: { status } })).toBe(true);
      });
    });

    it('should identify retryable error messages', () => {
      const retryableMessages = [
        'timeout error',
        'connection failed',
        'network issue',
        'temporary failure',
        'rate limit',
        'service unavailable',
      ];

      retryableMessages.forEach(message => {
        expect(isRetryableError({ message })).toBe(true);
      });
    });

    it('should not identify non-retryable errors', () => {
      const nonRetryableErrors = [
        { code: 'VALIDATION_ERROR' },
        { status: 400 },
        { status: 401 },
        { status: 403 },
        { status: 404 },
        { message: 'Invalid input' },
        { message: 'Not found' },
      ];

      nonRetryableErrors.forEach(error => {
        expect(isRetryableError(error)).toBe(false);
      });
    });
  });

  describe('isCircuitBreakerError', () => {
    it('should return false for falsy values', () => {
      expect(isCircuitBreakerError(null)).toBe(false);
      expect(isCircuitBreakerError(undefined)).toBe(false);
    });

    it('should identify circuit breaker errors that are also retryable', () => {
      const retryableErrors = [
        { code: 'ECONNRESET' },
        { code: 'NETWORK_ERROR' },
        { status: 502 },
        { status: 503 },
      ];

      retryableErrors.forEach(error => {
        expect(isCircuitBreakerError(error)).toBe(true);
      });
    });

    it('should identify authentication errors', () => {
      expect(isCircuitBreakerError({ status: 401 })).toBe(true);
      expect(isCircuitBreakerError({ status: 403 })).toBe(true);
    });

    it('should identify quota and rate limit errors', () => {
      expect(isCircuitBreakerError({ status: 429 })).toBe(true);
      expect(isCircuitBreakerError({ code: 'QUOTA_EXCEEDED' })).toBe(true);
    });

    it('should identify server errors (5xx)', () => {
      const serverErrors = [500, 501, 502, 503, 504, 505, 520, 521, 522, 523, 524];

      serverErrors.forEach(status => {
        expect(isCircuitBreakerError({ status })).toBe(true);
      });
    });

    it('should not identify client errors that are not auth/rate limit', () => {
      const nonCircuitBreakerErrors = [
        { status: 400 },
        { status: 404 },
        { status: 422 },
        { message: 'Invalid input' },
      ];

      nonCircuitBreakerErrors.forEach(error => {
        expect(isCircuitBreakerError(error)).toBe(false);
      });
    });
  });

  describe('constants', () => {
    it('should have valid RETRYABLE_ERRORS array', () => {
      expect(Array.isArray(RETRYABLE_ERRORS)).toBe(true);
      expect(RETRYABLE_ERRORS.length).toBeGreaterThan(0);
      expect(RETRYABLE_ERRORS).toContain('ECONNRESET');
      expect(RETRYABLE_ERRORS).toContain('ETIMEDOUT');
      expect(RETRYABLE_ERRORS).toContain('RATE_LIMITED');
    });

    it('should have valid RETRYABLE_HTTP_CODES array', () => {
      expect(Array.isArray(RETRYABLE_HTTP_CODES)).toBe(true);
      expect(RETRYABLE_HTTP_CODES.length).toBeGreaterThan(0);
      expect(RETRYABLE_HTTP_CODES).toContain(429);
      expect(RETRYABLE_HTTP_CODES).toContain(502);
      expect(RETRYABLE_HTTP_CODES).toContain(503);
      expect(RETRYABLE_HTTP_CODES).toContain(504);
    });
  });
});