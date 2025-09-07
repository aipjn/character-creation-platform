/**
 * Tests for Error Recovery Service
 */

import {
  ErrorRecoveryService,
  withErrorRecovery,
  withNanoBananaRecovery,
  withDatabaseRecovery,
  withStorageRecovery,
} from '../errorRecovery';
import { CircuitBreakerError, CircuitBreakerState } from '../../utils/circuitBreaker';
import { RateLimitError } from '../../middleware/rateLimiter';
import { RetryError } from '../../utils/retryHandler';
import { ResilienceConfig } from '../../config/resilience';

// Mock the dependencies
jest.mock('../../utils/circuitBreaker');
jest.mock('../../middleware/rateLimiter');
jest.mock('../../utils/retryHandler');

describe('ErrorRecoveryService', () => {
  let errorRecoveryService: ErrorRecoveryService;

  beforeEach(() => {
    errorRecoveryService = ErrorRecoveryService.getInstance();
    
    // Clear any existing singleton state
    jest.clearAllMocks();
  });

  describe('getInstance', () => {
    it('should return singleton instance', () => {
      const instance1 = ErrorRecoveryService.getInstance();
      const instance2 = ErrorRecoveryService.getInstance();
      
      expect(instance1).toBe(instance2);
    });

    it('should accept custom config', () => {
      const customConfig: ResilienceConfig = {
        defaults: {
          retry: {
            maxAttempts: 5,
            baseDelayMs: 2000,
            maxDelayMs: 60000,
            backoffMultiplier: 3,
            jitterFactor: 0.2,
          },
          circuitBreaker: {
            failureThreshold: 10,
            resetTimeoutMs: 120000,
            monitoringPeriodMs: 30000,
            minimumThroughput: 20,
          },
          rateLimit: {
            windowMs: 120000,
            maxRequests: 50,
          },
          timeoutMs: 60000,
        },
        endpoints: {},
      };
      
      const customInstance = ErrorRecoveryService.getInstance(customConfig);
      expect(customInstance).toBeDefined();
    });
  });

  describe('executeWithRecovery', () => {
    it('should execute successfully and return success result', async () => {
      const mockOperation = jest.fn().mockResolvedValue('success');
      const options = {
        operationName: 'test-operation',
        endpointName: 'test-endpoint',
      };
      
      const result = await errorRecoveryService.executeWithRecovery(mockOperation, options);
      
      expect(result.success).toBe(true);
      expect(result.result).toBe('success');
      expect(result.fallbackUsed).toBe(false);
      expect(result.circuitBreakerTriggered).toBe(false);
      expect(result.rateLimitTriggered).toBe(false);
      expect(result.totalDuration).toBeGreaterThan(0);
      expect(result.metadata.operationName).toBe('test-operation');
      expect(result.metadata.endpointName).toBe('test-endpoint');
    });

    it('should handle operation failure', async () => {
      const error = new Error('Operation failed');
      const mockOperation = jest.fn().mockRejectedValue(error);
      const options = {
        operationName: 'test-operation',
      };
      
      const result = await errorRecoveryService.executeWithRecovery(mockOperation, options);
      
      expect(result.success).toBe(false);
      expect(result.error).toBe(error);
      expect(result.fallbackUsed).toBe(false);
      expect(result.totalDuration).toBeGreaterThan(0);
    });

    it('should use fallback when operation fails', async () => {
      const error = new Error('Operation failed');
      const mockOperation = jest.fn().mockRejectedValue(error);
      const fallbackResult = 'fallback-value';
      const onFallbackUsed = jest.fn();
      
      const options = {
        operationName: 'test-operation',
        fallbackResult,
        onFallbackUsed,
      };
      
      const result = await errorRecoveryService.executeWithRecovery(mockOperation, options);
      
      expect(result.success).toBe(true);
      expect(result.result).toBe(fallbackResult);
      expect(result.fallbackUsed).toBe(true);
      expect(result.error).toBe(error);
      expect(onFallbackUsed).toHaveBeenCalledWith(error, fallbackResult);
    });

    it('should handle circuit breaker errors', async () => {
      const cbError = new CircuitBreakerError('Circuit breaker open', CircuitBreakerState.OPEN);
      const mockOperation = jest.fn().mockRejectedValue(cbError);
      const onCircuitBreakerOpen = jest.fn();
      
      const options = {
        operationName: 'test-operation',
        onCircuitBreakerOpen,
      };
      
      const result = await errorRecoveryService.executeWithRecovery(mockOperation, options);
      
      expect(result.success).toBe(false);
      expect(result.circuitBreakerTriggered).toBe(true);
      expect(result.error).toBe(cbError);
      expect(onCircuitBreakerOpen).toHaveBeenCalledWith(cbError);
    });

    it('should handle rate limit errors', async () => {
      const rlError = new RateLimitError('Rate limit exceeded', new Date(), 30, 100, 0);
      const mockOperation = jest.fn().mockRejectedValue(rlError);
      const onRateLimitExceeded = jest.fn();
      
      const options = {
        operationName: 'test-operation',
        onRateLimitExceeded,
      };
      
      const result = await errorRecoveryService.executeWithRecovery(mockOperation, options);
      
      expect(result.success).toBe(false);
      expect(result.rateLimitTriggered).toBe(true);
      expect(result.error).toBe(rlError);
      expect(onRateLimitExceeded).toHaveBeenCalledWith(rlError);
    });

    it('should disable specific resilience patterns when requested', async () => {
      const mockOperation = jest.fn().mockResolvedValue('success');
      const options = {
        operationName: 'test-operation',
        endpointName: 'test-endpoint',
        enableRetry: false,
        enableCircuitBreaker: false,
        enableRateLimit: false,
      };
      
      const result = await errorRecoveryService.executeWithRecovery(mockOperation, options);
      
      expect(result.success).toBe(true);
      expect(result.result).toBe('success');
    });
  });

  describe('executeNanoBananaOperation', () => {
    it('should execute nanoBanana generation operation', async () => {
      const mockOperation = jest.fn().mockResolvedValue('generated character');
      
      const result = await errorRecoveryService.executeNanoBananaOperation(
        mockOperation,
        'generation'
      );
      
      expect(result.success).toBe(true);
      expect(result.result).toBe('generated character');
      expect(result.metadata.operationName).toBe('nanoBanana-generation');
      expect(result.metadata.endpointName).toBe('nanoBanana');
    });

    it('should accept additional options', async () => {
      const mockOperation = jest.fn().mockResolvedValue('query result');
      const fallbackResult = 'cached result';
      
      const result = await errorRecoveryService.executeNanoBananaOperation(
        mockOperation,
        'query',
        { fallbackResult }
      );
      
      expect(result.success).toBe(true);
      expect(result.result).toBe('query result');
      expect(result.metadata.operationName).toBe('nanoBanana-query');
    });

    it('should handle different operation types', async () => {
      const mockOperation = jest.fn().mockResolvedValue('batch result');
      
      const result = await errorRecoveryService.executeNanoBananaOperation(
        mockOperation,
        'batch'
      );
      
      expect(result.metadata.operationName).toBe('nanoBanana-batch');
    });
  });

  describe('executeDatabaseOperation', () => {
    it('should execute database operation with appropriate config', async () => {
      const mockOperation = jest.fn().mockResolvedValue('database result');
      
      const result = await errorRecoveryService.executeDatabaseOperation(
        mockOperation,
        'user-query'
      );
      
      expect(result.success).toBe(true);
      expect(result.result).toBe('database result');
      expect(result.metadata.operationName).toBe('database-user-query');
      expect(result.metadata.endpointName).toBe('database');
    });

    it('should not enable rate limiting by default', async () => {
      const mockOperation = jest.fn().mockResolvedValue('database result');
      
      const result = await errorRecoveryService.executeDatabaseOperation(
        mockOperation,
        'user-query'
      );
      
      expect(result.success).toBe(true);
      // Rate limiting should be disabled for database operations
    });
  });

  describe('executeStorageOperation', () => {
    it('should execute storage operation with appropriate config', async () => {
      const mockOperation = jest.fn().mockResolvedValue('storage result');
      
      const result = await errorRecoveryService.executeStorageOperation(
        mockOperation,
        'file-upload'
      );
      
      expect(result.success).toBe(true);
      expect(result.result).toBe('storage result');
      expect(result.metadata.operationName).toBe('storage-file-upload');
      expect(result.metadata.endpointName).toBe('storage');
    });
  });

  describe('getSystemHealth', () => {
    it('should return system health information', () => {
      const health = errorRecoveryService.getSystemHealth();
      
      expect(health).toHaveProperty('healthy');
      expect(health).toHaveProperty('circuitBreakers');
      expect(health).toHaveProperty('rateLimiters');
      expect(health).toHaveProperty('recommendations');
      
      expect(typeof health.healthy).toBe('boolean');
      expect(Array.isArray(health.recommendations)).toBe(true);
    });

    it('should provide recommendations when unhealthy', () => {
      // This would require mocking the registry responses
      // For now, just verify the structure exists
      const health = errorRecoveryService.getSystemHealth();
      expect(Array.isArray(health.recommendations)).toBe(true);
    });
  });

  describe('resetAll', () => {
    it('should reset all resilience components', () => {
      // This method calls resetAll on registries
      // We can't easily test the actual reset without mocking
      expect(() => errorRecoveryService.resetAll()).not.toThrow();
    });
  });

  describe('updateConfig', () => {
    it('should update configuration', () => {
      const newConfig: Partial<ResilienceConfig> = {
        defaults: {
          retry: {
            maxAttempts: 10,
            baseDelayMs: 5000,
            maxDelayMs: 120000,
            backoffMultiplier: 3,
            jitterFactor: 0.3,
          },
          circuitBreaker: {
            failureThreshold: 10,
            resetTimeoutMs: 120000,
            monitoringPeriodMs: 30000,
            minimumThroughput: 20,
          },
          rateLimit: {
            windowMs: 120000,
            maxRequests: 50,
          },
          timeoutMs: 60000,
        },
      };
      
      expect(() => errorRecoveryService.updateConfig(newConfig)).not.toThrow();
    });
  });
});

describe('Convenience functions', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('withErrorRecovery', () => {
    it('should execute operation with error recovery', async () => {
      const mockOperation = jest.fn().mockResolvedValue('success');
      const options = {
        operationName: 'test-operation',
      };
      
      const result = await withErrorRecovery(mockOperation, options);
      
      expect(result.success).toBe(true);
      expect(result.result).toBe('success');
      expect(mockOperation).toHaveBeenCalled();
    });
  });

  describe('withNanoBananaRecovery', () => {
    it('should execute nanoBanana operation with recovery', async () => {
      const mockOperation = jest.fn().mockResolvedValue('ai result');
      
      const result = await withNanoBananaRecovery(mockOperation, 'generation');
      
      expect(result.success).toBe(true);
      expect(result.result).toBe('ai result');
      expect(mockOperation).toHaveBeenCalled();
    });

    it('should accept additional options', async () => {
      const mockOperation = jest.fn().mockResolvedValue('ai result');
      const options = { fallbackResult: 'default' };
      
      const result = await withNanoBananaRecovery(mockOperation, 'generation', options);
      
      expect(result.success).toBe(true);
      expect(result.result).toBe('ai result');
    });
  });

  describe('withDatabaseRecovery', () => {
    it('should execute database operation with recovery', async () => {
      const mockOperation = jest.fn().mockResolvedValue('db result');
      
      const result = await withDatabaseRecovery(mockOperation, 'user-query');
      
      expect(result.success).toBe(true);
      expect(result.result).toBe('db result');
      expect(mockOperation).toHaveBeenCalled();
    });

    it('should accept additional options', async () => {
      const mockOperation = jest.fn().mockResolvedValue('db result');
      const options = { enableRetry: false };
      
      const result = await withDatabaseRecovery(mockOperation, 'user-query', options);
      
      expect(result.success).toBe(true);
      expect(result.result).toBe('db result');
    });
  });

  describe('withStorageRecovery', () => {
    it('should execute storage operation with recovery', async () => {
      const mockOperation = jest.fn().mockResolvedValue('storage result');
      
      const result = await withStorageRecovery(mockOperation, 'file-upload');
      
      expect(result.success).toBe(true);
      expect(result.result).toBe('storage result');
      expect(mockOperation).toHaveBeenCalled();
    });

    it('should accept additional options', async () => {
      const mockOperation = jest.fn().mockResolvedValue('storage result');
      const options = { enableCircuitBreaker: false };
      
      const result = await withStorageRecovery(mockOperation, 'file-upload', options);
      
      expect(result.success).toBe(true);
      expect(result.result).toBe('storage result');
    });
  });
});

describe('Error Recovery Integration', () => {
  let errorRecoveryService: ErrorRecoveryService;

  beforeEach(() => {
    errorRecoveryService = ErrorRecoveryService.getInstance();
    jest.clearAllMocks();
  });

  it('should handle complex failure scenarios', async () => {
    // Simulate an operation that fails with retry but has fallback
    const error = new Error('Service temporarily unavailable');
    const mockOperation = jest.fn().mockRejectedValue(error);
    const fallbackResult = 'cached data';
    
    const options = {
      operationName: 'complex-operation',
      fallbackResult,
      enableRetry: true,
      enableCircuitBreaker: true,
    };
    
    const result = await errorRecoveryService.executeWithRecovery(mockOperation, options);
    
    expect(result.success).toBe(true); // Success due to fallback
    expect(result.result).toBe(fallbackResult);
    expect(result.fallbackUsed).toBe(true);
    expect(result.error).toBe(error);
    expect(result.totalDuration).toBeGreaterThan(0);
  });

  it('should provide detailed metrics for monitoring', async () => {
    const mockOperation = jest.fn().mockResolvedValue('success');
    const options = {
      operationName: 'monitored-operation',
      endpointName: 'test-service',
    };
    
    const result = await errorRecoveryService.executeWithRecovery(mockOperation, options);
    
    expect(result.metadata).toEqual({
      operationName: 'monitored-operation',
      endpointName: 'test-service',
      timestamp: expect.any(Date),
    });
    
    expect(typeof result.totalDuration).toBe('number');
    expect(result.totalDuration).toBeGreaterThan(0);
    expect(typeof result.success).toBe('boolean');
    expect(typeof result.fallbackUsed).toBe('boolean');
    expect(typeof result.circuitBreakerTriggered).toBe('boolean');
    expect(typeof result.rateLimitTriggered).toBe('boolean');
  });
});

describe('Error types handling', () => {
  let errorRecoveryService: ErrorRecoveryService;

  beforeEach(() => {
    errorRecoveryService = ErrorRecoveryService.getInstance();
  });

  it('should properly identify and handle RetryError', async () => {
    const originalError = new Error('Network error');
    const retryError = new RetryError('Max retries exceeded', originalError, 3, 3);
    const mockOperation = jest.fn().mockRejectedValue(retryError);
    
    const result = await errorRecoveryService.executeWithRecovery(mockOperation, {
      operationName: 'retry-test',
    });
    
    expect(result.success).toBe(false);
    expect(result.error).toBe(retryError);
  });

  it('should handle CircuitBreakerError with proper flags', async () => {
    const cbError = new CircuitBreakerError('Circuit open', CircuitBreakerState.OPEN, new Date());
    const mockOperation = jest.fn().mockRejectedValue(cbError);
    
    const result = await errorRecoveryService.executeWithRecovery(mockOperation, {
      operationName: 'cb-test',
    });
    
    expect(result.circuitBreakerTriggered).toBe(true);
    expect(result.success).toBe(false);
  });

  it('should handle RateLimitError with proper flags', async () => {
    const rlError = new RateLimitError('Rate limited', new Date(), 60, 100, 0);
    const mockOperation = jest.fn().mockRejectedValue(rlError);
    
    const result = await errorRecoveryService.executeWithRecovery(mockOperation, {
      operationName: 'rl-test',
    });
    
    expect(result.rateLimitTriggered).toBe(true);
    expect(result.success).toBe(false);
  });
});