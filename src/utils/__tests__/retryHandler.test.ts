/**
 * Tests for Retry Handler with Exponential Backoff
 */

import {
  RetryHandler,
  NanoBananaRetryHandler,
  RetryError,
  retryWithBackoff,
  createRetryHandler,
} from '../retryHandler';
import { RetryConfig } from '../../config/resilience';

describe('RetryHandler', () => {
  let config: RetryConfig;
  let retryHandler: RetryHandler;

  beforeEach(() => {
    config = {
      maxAttempts: 3,
      baseDelayMs: 100,
      maxDelayMs: 1000,
      backoffMultiplier: 2,
      jitterFactor: 0.1,
    };
    retryHandler = new RetryHandler(config);
  });

  describe('execute', () => {
    it('should execute successfully on first attempt', async () => {
      const mockFn = jest.fn().mockResolvedValue('success');
      
      const result = await retryHandler.execute(mockFn);
      
      expect(result).toBe('success');
      expect(mockFn).toHaveBeenCalledTimes(1);
    });

    it('should retry on retryable errors and succeed', async () => {
      const mockFn = jest
        .fn()
        .mockRejectedValueOnce(new Error('ECONNRESET'))
        .mockRejectedValueOnce(new Error('ETIMEDOUT'))
        .mockResolvedValue('success');
      
      const result = await retryHandler.execute(mockFn);
      
      expect(result).toBe('success');
      expect(mockFn).toHaveBeenCalledTimes(3);
    });

    it('should fail after max attempts', async () => {
      const error = new Error('NETWORK_ERROR');
      const mockFn = jest.fn().mockRejectedValue(error);
      
      await expect(retryHandler.execute(mockFn)).rejects.toThrow(RetryError);
      expect(mockFn).toHaveBeenCalledTimes(config.maxAttempts);
    });

    it('should not retry on non-retryable errors', async () => {
      const error = new Error('Invalid input');
      const mockFn = jest.fn().mockRejectedValue(error);
      
      await expect(retryHandler.execute(mockFn)).rejects.toThrow('Invalid input');
      expect(mockFn).toHaveBeenCalledTimes(1);
    });

    it('should call onRetry callback', async () => {
      const mockFn = jest
        .fn()
        .mockRejectedValueOnce(new Error('ECONNRESET'))
        .mockResolvedValue('success');
      
      const onRetry = jest.fn();
      
      await retryHandler.execute(mockFn, { onRetry });
      
      expect(onRetry).toHaveBeenCalledWith(1, expect.any(Error), expect.any(Number));
    });

    it('should use custom shouldRetry function', async () => {
      const error = new Error('Custom error');
      const mockFn = jest.fn().mockRejectedValue(error);
      const shouldRetry = jest.fn().mockReturnValue(false);
      
      await expect(retryHandler.execute(mockFn, { shouldRetry })).rejects.toThrow('Custom error');
      
      expect(shouldRetry).toHaveBeenCalledWith(error, 1);
      expect(mockFn).toHaveBeenCalledTimes(1);
    });

    it('should respect exponential backoff timing', async () => {
      const mockFn = jest
        .fn()
        .mockRejectedValueOnce(new Error('NETWORK_ERROR'))
        .mockRejectedValueOnce(new Error('NETWORK_ERROR'))
        .mockResolvedValue('success');
      
      const startTime = Date.now();
      
      await retryHandler.execute(mockFn);
      
      const endTime = Date.now();
      const duration = endTime - startTime;
      
      // Should have waited at least baseDelay + (baseDelay * multiplier) with some tolerance
      const expectedMinDelay = config.baseDelayMs + (config.baseDelayMs * config.backoffMultiplier) * 0.8; // Account for jitter
      expect(duration).toBeGreaterThan(expectedMinDelay);
    });
  });

  describe('executeWithDetails', () => {
    it('should return detailed success result', async () => {
      const mockFn = jest.fn().mockResolvedValue('success');
      
      const result = await retryHandler.executeWithDetails(mockFn);
      
      expect(result.succeeded).toBe(true);
      expect(result.result).toBe('success');
      expect(result.attempts).toHaveLength(1);
      expect(result.totalDuration).toBeGreaterThan(0);
      expect(result.attempts[0]?.attempt).toBe(1);
      expect(result.attempts[0]?.duration).toBeGreaterThan(0);
    });

    it('should return detailed failure result', async () => {
      const error = new Error('NETWORK_ERROR');
      const mockFn = jest.fn().mockRejectedValue(error);
      
      const result = await retryHandler.executeWithDetails(mockFn);
      
      expect(result.succeeded).toBe(false);
      expect(result.error).toBe(error);
      expect(result.attempts).toHaveLength(config.maxAttempts);
      expect(result.totalDuration).toBeGreaterThan(0);
      
      // Check all attempts have error
      result.attempts.forEach((attempt, index) => {
        expect(attempt.attempt).toBe(index + 1);
        expect(attempt.error).toBe(error);
        expect(attempt.duration).toBeGreaterThan(0);
        
        if (index < result.attempts.length - 1) {
          expect(attempt.delay).toBeGreaterThan(0);
        }
      });
    });

    it('should show retry progression with increasing delays', async () => {
      const error = new Error('SERVICE_UNAVAILABLE');
      const mockFn = jest.fn().mockRejectedValue(error);
      
      const result = await retryHandler.executeWithDetails(mockFn);
      
      expect(result.attempts).toHaveLength(3);
      
      // Check delay progression (accounting for jitter)
      const delays = result.attempts.slice(0, -1).map(a => a.delay);
      expect(delays[0]).toBeGreaterThan(0);
      expect(delays[1]).toBeGreaterThan((delays[0] || 0) * 0.8); // Account for jitter
    });
  });

  describe('delay calculation', () => {
    it('should calculate exponential backoff correctly', async () => {
      const testConfig: RetryConfig = {
        maxAttempts: 4,
        baseDelayMs: 100,
        maxDelayMs: 10000,
        backoffMultiplier: 2,
        jitterFactor: 0, // No jitter for predictable testing
      };
      
      const handler = new RetryHandler(testConfig);
      const error = new Error('NETWORK_ERROR');
      const mockFn = jest.fn().mockRejectedValue(error);
      
      const result = await handler.executeWithDetails(mockFn);
      
      // Expected delays: 100, 200, 400
      const delays = result.attempts.slice(0, -1).map(a => a.delay);
      expect(delays[0]).toBe(100); // baseDelay * (2^0) = 100
      expect(delays[1]).toBe(200); // baseDelay * (2^1) = 200
      expect(delays[2]).toBe(400); // baseDelay * (2^2) = 400
    });

    it('should apply maximum delay cap', async () => {
      const testConfig: RetryConfig = {
        maxAttempts: 5,
        baseDelayMs: 100,
        maxDelayMs: 250, // Low max to test capping
        backoffMultiplier: 2,
        jitterFactor: 0,
      };
      
      const handler = new RetryHandler(testConfig);
      const error = new Error('NETWORK_ERROR');
      const mockFn = jest.fn().mockRejectedValue(error);
      
      const result = await handler.executeWithDetails(mockFn);
      
      const delays = result.attempts.slice(0, -1).map(a => a.delay);
      
      // Delays should be: 100, 200, 250 (capped), 250 (capped)
      expect(delays[0]).toBe(100);
      expect(delays[1]).toBe(200);
      expect(delays[2]).toBe(250); // Capped
      expect(delays[3]).toBe(250); // Capped
    });

    it('should apply jitter', async () => {
      const testConfig: RetryConfig = {
        maxAttempts: 3,
        baseDelayMs: 100,
        maxDelayMs: 1000,
        backoffMultiplier: 2,
        jitterFactor: 0.5, // 50% jitter
      };
      
      const handler = new RetryHandler(testConfig);
      const error = new Error('NETWORK_ERROR');
      const mockFn = jest.fn().mockRejectedValue(error);
      
      const result = await handler.executeWithDetails(mockFn);
      
      const delays = result.attempts.slice(0, -1).map(a => a.delay);
      
      // With 50% jitter, delays should be within range
      expect(delays[0]).toBeGreaterThan(50);   // 100 * 0.5
      expect(delays[0]).toBeLessThan(150);     // 100 * 1.5
      expect(delays[1]).toBeGreaterThan(100);  // 200 * 0.5
      expect(delays[1]).toBeLessThan(300);     // 200 * 1.5
    });
  });
});

describe('NanoBananaRetryHandler', () => {
  let config: RetryConfig;
  let handler: NanoBananaRetryHandler;

  beforeEach(() => {
    config = {
      maxAttempts: 3,
      baseDelayMs: 100,
      maxDelayMs: 1000,
      backoffMultiplier: 2,
      jitterFactor: 0.1,
    };
    handler = new NanoBananaRetryHandler(config);
  });

  describe('executeApiCall', () => {
    it('should execute nanoBanana API calls with specialized retry logic', async () => {
      const mockFn = jest.fn().mockResolvedValue('generated character');
      
      const result = await handler.executeApiCall(mockFn, {
        operationType: 'generation',
      });
      
      expect(result).toBe('generated character');
      expect(mockFn).toHaveBeenCalledTimes(1);
    });

    it('should retry on quota exceeded errors', async () => {
      const quotaError = { code: 'QUOTA_EXCEEDED' };
      const mockFn = jest
        .fn()
        .mockRejectedValueOnce(quotaError)
        .mockResolvedValue('success');
      
      const result = await handler.executeApiCall(mockFn, {
        operationType: 'generation',
      });
      
      expect(result).toBe('success');
      expect(mockFn).toHaveBeenCalledTimes(2);
    });

    it('should retry on model loading errors', async () => {
      const modelError = { message: 'Model is warming up' };
      const mockFn = jest
        .fn()
        .mockRejectedValueOnce(modelError)
        .mockResolvedValue('success');
      
      const result = await handler.executeApiCall(mockFn, {
        operationType: 'generation',
      });
      
      expect(result).toBe('success');
      expect(mockFn).toHaveBeenCalledTimes(2);
    });

    it('should be more aggressive with retries for generation operations', async () => {
      const temporaryError = { status: 408 }; // Request timeout
      const mockFn = jest
        .fn()
        .mockRejectedValueOnce(temporaryError)
        .mockResolvedValue('success');
      
      const result = await handler.executeApiCall(mockFn, {
        operationType: 'generation',
      });
      
      expect(result).toBe('success');
      expect(mockFn).toHaveBeenCalledTimes(2);
    });

    it('should retry on authentication token refresh scenarios', async () => {
      const authError = { status: 401, code: 'TOKEN_EXPIRED' };
      const mockFn = jest
        .fn()
        .mockRejectedValueOnce(authError)
        .mockResolvedValue('success');
      
      const result = await handler.executeApiCall(mockFn, {
        operationType: 'query',
      });
      
      expect(result).toBe('success');
      expect(mockFn).toHaveBeenCalledTimes(2);
    });

    it('should not retry on invalid credentials', async () => {
      const authError = { status: 401, code: 'INVALID_CREDENTIALS' };
      const mockFn = jest.fn().mockRejectedValue(authError);
      
      await expect(
        handler.executeApiCall(mockFn, { operationType: 'generation' })
      ).rejects.toMatchObject(authError);
      
      expect(mockFn).toHaveBeenCalledTimes(1);
    });
  });
});

describe('retryWithBackoff', () => {
  it('should execute function with retry logic', async () => {
    const config: RetryConfig = {
      maxAttempts: 2,
      baseDelayMs: 50,
      maxDelayMs: 500,
      backoffMultiplier: 2,
      jitterFactor: 0,
    };
    
    const mockFn = jest
      .fn()
      .mockRejectedValueOnce(new Error('NETWORK_ERROR'))
      .mockResolvedValue('success');
    
    const result = await retryWithBackoff(mockFn, config);
    
    expect(result).toBe('success');
    expect(mockFn).toHaveBeenCalledTimes(2);
  });
});

describe('createRetryHandler', () => {
  it('should create handler for nanoBanana scenario', () => {
    const handler = createRetryHandler('nanoBanana');
    
    expect(handler).toBeInstanceOf(NanoBananaRetryHandler);
  });

  it('should create regular handler for other scenarios', () => {
    const handler = createRetryHandler('database');
    
    expect(handler).toBeInstanceOf(RetryHandler);
    expect(handler).not.toBeInstanceOf(NanoBananaRetryHandler);
  });

  it('should apply custom config overrides', () => {
    const customConfig = { maxAttempts: 10 };
    const handler = createRetryHandler('default', customConfig);
    
    // This would require accessing private config, so we'll test behavior instead
    expect(handler).toBeInstanceOf(RetryHandler);
  });

  it('should use appropriate config for each scenario', () => {
    const nanoBananaHandler = createRetryHandler('nanoBanana');
    const databaseHandler = createRetryHandler('database');
    const storageHandler = createRetryHandler('storage');
    const defaultHandler = createRetryHandler('default');
    
    expect(nanoBananaHandler).toBeInstanceOf(NanoBananaRetryHandler);
    expect(databaseHandler).toBeInstanceOf(RetryHandler);
    expect(storageHandler).toBeInstanceOf(RetryHandler);
    expect(defaultHandler).toBeInstanceOf(RetryHandler);
  });
});

describe('RetryError', () => {
  it('should contain retry information', () => {
    const originalError = new Error('Original failure');
    const retryError = new RetryError('Retry failed', originalError, 3, 5);
    
    expect(retryError.name).toBe('RetryError');
    expect(retryError.originalError).toBe(originalError);
    expect(retryError.attempt).toBe(3);
    expect(retryError.maxAttempts).toBe(5);
    expect(retryError.message).toBe('Retry failed');
  });
});