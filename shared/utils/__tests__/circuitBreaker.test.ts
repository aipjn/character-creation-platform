/**
 * Tests for Circuit Breaker implementation
 */

import {
  CircuitBreaker,
  CircuitBreakerState,
  CircuitBreakerError,
  CircuitBreakerRegistry,
  executeWithCircuitBreaker,
} from '../circuitBreaker';
import { CircuitBreakerConfig } from '../../config/resilience';

describe('CircuitBreaker', () => {
  let config: CircuitBreakerConfig;
  let circuitBreaker: CircuitBreaker;

  beforeEach(() => {
    config = {
      failureThreshold: 3,
      resetTimeoutMs: 1000,
      monitoringPeriodMs: 5000,
      minimumThroughput: 5,
    };
    circuitBreaker = new CircuitBreaker('test', config);
  });

  describe('constructor', () => {
    it('should initialize with CLOSED state', () => {
      const status = circuitBreaker.getStatus();
      expect(status.state).toBe(CircuitBreakerState.CLOSED);
      expect(status.name).toBe('test');
      expect(status.isHealthy).toBe(true);
    });
  });

  describe('execute - CLOSED state', () => {
    it('should execute successfully and remain closed', async () => {
      const mockFn = jest.fn().mockResolvedValue('success');
      
      const result = await circuitBreaker.execute(mockFn);
      
      expect(result).toBe('success');
      expect(mockFn).toHaveBeenCalledTimes(1);
      
      const status = circuitBreaker.getStatus();
      expect(status.state).toBe(CircuitBreakerState.CLOSED);
      expect(status.metrics.totalCalls).toBe(1);
      expect(status.metrics.successfulCalls).toBe(1);
      expect(status.metrics.failedCalls).toBe(0);
    });

    it('should track failures but remain closed below threshold', async () => {
      const mockFn = jest.fn().mockRejectedValue(new Error('Service error'));
      
      // Execute below failure threshold
      for (let i = 0; i < config.failureThreshold - 1; i++) {
        try {
          await circuitBreaker.execute(mockFn);
        } catch (error) {
          // Expected to fail
        }
      }
      
      const status = circuitBreaker.getStatus();
      expect(status.state).toBe(CircuitBreakerState.CLOSED);
      expect(status.metrics.failedCalls).toBe(config.failureThreshold - 1);
    });

    it('should open when failure threshold is exceeded', async () => {
      const mockFn = jest.fn().mockRejectedValue(new Error('Service error'));
      
      // First, add minimum throughput with mixed results
      for (let i = 0; i < config.minimumThroughput - config.failureThreshold; i++) {
        await circuitBreaker.execute(jest.fn().mockResolvedValue('success'));
      }
      
      // Now add failures to exceed threshold
      for (let i = 0; i < config.failureThreshold; i++) {
        try {
          await circuitBreaker.execute(mockFn);
        } catch (error) {
          // Expected to fail
        }
      }
      
      const status = circuitBreaker.getStatus();
      expect(status.state).toBe(CircuitBreakerState.OPEN);
      expect(status.failureRate).toBeGreaterThanOrEqual(config.failureThreshold);
    });
  });

  describe('execute - OPEN state', () => {
    beforeEach(async () => {
      // Force circuit breaker to OPEN state
      circuitBreaker.forceOpen();
    });

    it('should throw CircuitBreakerError immediately', async () => {
      const mockFn = jest.fn();
      
      await expect(circuitBreaker.execute(mockFn)).rejects.toThrow(CircuitBreakerError);
      expect(mockFn).not.toHaveBeenCalled();
    });

    it('should include next attempt time in error', async () => {
      const mockFn = jest.fn();
      
      try {
        await circuitBreaker.execute(mockFn);
        fail('Should have thrown CircuitBreakerError');
      } catch (error) {
        expect(error).toBeInstanceOf(CircuitBreakerError);
        const cbError = error as CircuitBreakerError;
        expect(cbError.state).toBe(CircuitBreakerState.OPEN);
        expect(cbError.nextAttemptTime).toBeInstanceOf(Date);
      }
    });

    it('should transition to HALF_OPEN after reset timeout', async () => {
      // Wait for reset timeout
      await new Promise(resolve => setTimeout(resolve, config.resetTimeoutMs + 100));
      
      const mockFn = jest.fn().mockResolvedValue('success');
      const result = await circuitBreaker.execute(mockFn);
      
      expect(result).toBe('success');
      
      const status = circuitBreaker.getStatus();
      expect(status.state).toBe(CircuitBreakerState.CLOSED); // Should close after successful execution
    });
  });

  describe('execute - HALF_OPEN state', () => {
    beforeEach(async () => {
      // Force to OPEN state then wait for transition to HALF_OPEN
      circuitBreaker.forceOpen();
      await new Promise(resolve => setTimeout(resolve, config.resetTimeoutMs + 100));
    });

    it('should close on successful execution', async () => {
      const mockFn = jest.fn().mockResolvedValue('success');
      
      // This should trigger the HALF_OPEN check and succeed
      const result = await circuitBreaker.execute(mockFn);
      
      expect(result).toBe('success');
      
      const status = circuitBreaker.getStatus();
      expect(status.state).toBe(CircuitBreakerState.CLOSED);
    });

    it('should return to OPEN on failure', async () => {
      const mockFn = jest.fn().mockRejectedValue(new Error('Still failing'));
      
      try {
        await circuitBreaker.execute(mockFn);
        fail('Should have thrown error');
      } catch (error) {
        // Expected to fail
      }
      
      const status = circuitBreaker.getStatus();
      expect(status.state).toBe(CircuitBreakerState.OPEN);
    });
  });

  describe('getStatus', () => {
    it('should return comprehensive status information', () => {
      const status = circuitBreaker.getStatus();
      
      expect(status).toHaveProperty('name');
      expect(status).toHaveProperty('state');
      expect(status).toHaveProperty('metrics');
      expect(status).toHaveProperty('config');
      expect(status).toHaveProperty('failureRate');
      expect(status).toHaveProperty('isHealthy');
      expect(status).toHaveProperty('stateChangeTime');
      
      expect(status.metrics).toHaveProperty('totalCalls');
      expect(status.metrics).toHaveProperty('failedCalls');
      expect(status.metrics).toHaveProperty('successfulCalls');
      expect(status.metrics).toHaveProperty('lastCallTime');
    });
  });

  describe('getFailureRate', () => {
    it('should return 0 for no calls', () => {
      expect(circuitBreaker.getFailureRate()).toBe(0);
    });

    it('should calculate correct failure rate', async () => {
      // Add some successful calls
      await circuitBreaker.execute(jest.fn().mockResolvedValue('success'));
      await circuitBreaker.execute(jest.fn().mockResolvedValue('success'));
      
      // Add a failed call
      try {
        await circuitBreaker.execute(jest.fn().mockRejectedValue(new Error('fail')));
      } catch (error) {
        // Expected
      }
      
      const failureRate = circuitBreaker.getFailureRate();
      expect(failureRate).toBeCloseTo(33.33, 1); // 1 failure out of 3 calls = 33.33%
    });
  });

  describe('reset', () => {
    it('should reset circuit breaker to initial state', async () => {
      // Make some calls to change state
      try {
        await circuitBreaker.execute(jest.fn().mockRejectedValue(new Error('fail')));
      } catch (error) {
        // Expected
      }
      
      circuitBreaker.reset();
      
      const status = circuitBreaker.getStatus();
      expect(status.state).toBe(CircuitBreakerState.CLOSED);
      expect(status.metrics.totalCalls).toBe(0);
      expect(status.metrics.failedCalls).toBe(0);
      expect(status.metrics.successfulCalls).toBe(0);
      expect(status.isHealthy).toBe(true);
    });
  });

  describe('forceOpen', () => {
    it('should force circuit breaker to OPEN state', () => {
      circuitBreaker.forceOpen();
      
      const status = circuitBreaker.getStatus();
      expect(status.state).toBe(CircuitBreakerState.OPEN);
      expect(status.nextAttemptTime).toBeInstanceOf(Date);
    });
  });
});

describe('CircuitBreakerRegistry', () => {
  let registry: CircuitBreakerRegistry;

  beforeEach(() => {
    registry = CircuitBreakerRegistry.getInstance();
    // Clear any existing circuit breakers
    registry.resetAll();
  });

  describe('getCircuitBreaker', () => {
    it('should create new circuit breaker if not exists', () => {
      const config: CircuitBreakerConfig = {
        failureThreshold: 5,
        resetTimeoutMs: 1000,
        monitoringPeriodMs: 5000,
        minimumThroughput: 10,
      };
      
      const cb = registry.getCircuitBreaker('test', config);
      
      expect(cb).toBeInstanceOf(CircuitBreaker);
      expect(cb.getStatus().name).toBe('test');
    });

    it('should return existing circuit breaker', () => {
      const config: CircuitBreakerConfig = {
        failureThreshold: 5,
        resetTimeoutMs: 1000,
        monitoringPeriodMs: 5000,
        minimumThroughput: 10,
      };
      
      const cb1 = registry.getCircuitBreaker('test', config);
      const cb2 = registry.getCircuitBreaker('test', config);
      
      expect(cb1).toBe(cb2);
    });
  });

  describe('getAllStatus', () => {
    it('should return status of all circuit breakers', () => {
      const config: CircuitBreakerConfig = {
        failureThreshold: 5,
        resetTimeoutMs: 1000,
        monitoringPeriodMs: 5000,
        minimumThroughput: 10,
      };
      
      registry.getCircuitBreaker('test1', config);
      registry.getCircuitBreaker('test2', config);
      
      const statuses = registry.getAllStatus();
      
      expect(Object.keys(statuses)).toHaveLength(2);
      expect(statuses).toHaveProperty('test1');
      expect(statuses).toHaveProperty('test2');
    });
  });

  describe('getHealthSummary', () => {
    it('should return health summary', () => {
      const config: CircuitBreakerConfig = {
        failureThreshold: 5,
        resetTimeoutMs: 1000,
        monitoringPeriodMs: 5000,
        minimumThroughput: 10,
      };
      
      const cb1 = registry.getCircuitBreaker('test1', config);
      registry.getCircuitBreaker('test2', config);
      
      // Force one to be unhealthy
      cb1.forceOpen();
      
      const health = registry.getHealthSummary();
      
      expect(health.total).toBe(2);
      expect(health.healthy).toBe(1);
      expect(health.unhealthy).toBe(1);
      expect(health.healthPercentage).toBe(50);
      expect(health.circuitBreakers).toHaveProperty('test1');
      expect(health.circuitBreakers).toHaveProperty('test2');
    });
  });

  describe('resetAll', () => {
    it('should reset all circuit breakers', () => {
      const config: CircuitBreakerConfig = {
        failureThreshold: 5,
        resetTimeoutMs: 1000,
        monitoringPeriodMs: 5000,
        minimumThroughput: 10,
      };
      
      const cb1 = registry.getCircuitBreaker('test1', config);
      const cb2 = registry.getCircuitBreaker('test2', config);
      
      cb1.forceOpen();
      cb2.forceOpen();
      
      registry.resetAll();
      
      const health = registry.getHealthSummary();
      expect(health.healthy).toBe(2);
      expect(health.unhealthy).toBe(0);
    });
  });
});

describe('executeWithCircuitBreaker', () => {
  it('should execute function with circuit breaker protection', async () => {
    const config: CircuitBreakerConfig = {
      failureThreshold: 3,
      resetTimeoutMs: 1000,
      monitoringPeriodMs: 5000,
      minimumThroughput: 5,
    };
    
    const mockFn = jest.fn().mockResolvedValue('success');
    
    const result = await executeWithCircuitBreaker('test-function', config, mockFn);
    
    expect(result).toBe('success');
    expect(mockFn).toHaveBeenCalledTimes(1);
  });

  it('should throw CircuitBreakerError when circuit is open', async () => {
    const config: CircuitBreakerConfig = {
      failureThreshold: 1,
      resetTimeoutMs: 1000,
      monitoringPeriodMs: 5000,
      minimumThroughput: 1,
    };
    
    // First call to open the circuit
    try {
      await executeWithCircuitBreaker('test-function-2', config, () => {
        throw new Error('Service error');
      });
    } catch (error) {
      // Expected
    }
    
    // Second call should be blocked by circuit breaker
    await expect(
      executeWithCircuitBreaker('test-function-2', config, jest.fn())
    ).rejects.toThrow(CircuitBreakerError);
  });
});