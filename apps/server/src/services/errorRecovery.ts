/**
 * Error Recovery Service
 * 
 * Comprehensive error handling and recovery service that orchestrates
 * retry logic, circuit breakers, and graceful degradation patterns.
 * Provides centralized error handling for the entire application.
 */

import { 
  RetryHandler, 
  NanoBananaRetryHandler
} from '../utils/retryHandler';
import { 
  CircuitBreakerRegistry, 
  CircuitBreakerError,
  executeWithCircuitBreaker 
} from '../utils/circuitBreaker';
import { 
  RateLimiterRegistry,
  RateLimitError 
} from '../middleware/rateLimiter';
import { 
  getEndpointConfig, 
  DEFAULT_RESILIENCE_CONFIG,
  ResilienceConfig 
} from '../config/resilience';

export interface ErrorRecoveryOptions {
  operationName: string;
  endpointName?: string;
  enableRetry?: boolean;
  enableCircuitBreaker?: boolean;
  enableRateLimit?: boolean;
  fallbackResult?: any;
  onRetry?: (attempt: number, error: unknown, delay: number) => void;
  onCircuitBreakerOpen?: (error: CircuitBreakerError) => void;
  onRateLimitExceeded?: (error: RateLimitError) => void;
  onFallbackUsed?: (originalError: unknown, fallbackResult: any) => void;
}

export interface RecoveryResult<T> {
  success: boolean;
  result?: T;
  error?: unknown;
  fallbackUsed: boolean;
  retryAttempts?: number | undefined;
  circuitBreakerTriggered: boolean;
  rateLimitTriggered: boolean;
  totalDuration: number;
  metadata: {
    operationName: string;
    endpointName?: string | undefined;
    timestamp: Date;
  };
}

export class ErrorRecoveryService {
  private static instance: ErrorRecoveryService;
  private config: ResilienceConfig;
  private circuitBreakerRegistry: CircuitBreakerRegistry;
  private rateLimiterRegistry: RateLimiterRegistry;

  private constructor(config: ResilienceConfig = DEFAULT_RESILIENCE_CONFIG) {
    this.config = config;
    this.circuitBreakerRegistry = CircuitBreakerRegistry.getInstance();
    this.rateLimiterRegistry = RateLimiterRegistry.getInstance();
  }

  static getInstance(config?: ResilienceConfig): ErrorRecoveryService {
    if (!ErrorRecoveryService.instance) {
      ErrorRecoveryService.instance = new ErrorRecoveryService(config);
    }
    return ErrorRecoveryService.instance;
  }

  /**
   * Execute an operation with full error recovery
   */
  async executeWithRecovery<T>(
    operation: () => Promise<T>,
    options: ErrorRecoveryOptions
  ): Promise<RecoveryResult<T>> {
    const startTime = new Date();
    const metadata = {
      operationName: options.operationName,
      endpointName: options.endpointName,
      timestamp: startTime,
    };

    let result: RecoveryResult<T> = {
      success: false,
      fallbackUsed: false,
      circuitBreakerTriggered: false,
      rateLimitTriggered: false,
      totalDuration: 0,
      metadata,
    };

    try {
      // Get endpoint configuration
      const endpointConfig = options.endpointName 
        ? getEndpointConfig(options.endpointName, this.config)
        : null;

      // Execute with all resilience patterns
      const executionResult = await this.executeWithResilience(
        operation,
        options,
        endpointConfig
      );

      result = {
        ...result,
        success: true,
        result: executionResult.result,
        retryAttempts: executionResult.retryAttempts,
        totalDuration: new Date().getTime() - startTime.getTime(),
      };

    } catch (error) {
      result.error = error;
      result.totalDuration = new Date().getTime() - startTime.getTime();

      // Check error types
      if (error instanceof CircuitBreakerError) {
        result.circuitBreakerTriggered = true;
        options.onCircuitBreakerOpen?.(error);
      } else if (error instanceof RateLimitError) {
        result.rateLimitTriggered = true;
        options.onRateLimitExceeded?.(error);
      }

      // Attempt fallback if available
      if (options.fallbackResult !== undefined) {
        result.result = options.fallbackResult;
        result.fallbackUsed = true;
        result.success = true;
        options.onFallbackUsed?.(error, options.fallbackResult);
      }
    }

    // Log operation result
    this.logOperationResult(result);

    return result;
  }

  /**
   * Execute operation with specific resilience patterns
   */
  private async executeWithResilience<T>(
    operation: () => Promise<T>,
    options: ErrorRecoveryOptions,
    endpointConfig: any
  ): Promise<{ result: T; retryAttempts?: number }> {
    
    // Create the execution function with layered resilience
    let enhancedOperation = operation;

    // Layer 3: Circuit Breaker (outermost)
    if (options.enableCircuitBreaker !== false && endpointConfig?.circuitBreaker) {
      const circuitBreakerName = `${options.operationName}_${options.endpointName || 'default'}`;
      enhancedOperation = () => executeWithCircuitBreaker(
        circuitBreakerName,
        endpointConfig.circuitBreaker,
        enhancedOperation
      );
    }

    // Layer 2: Rate Limiting
    if (options.enableRateLimit !== false && endpointConfig?.rateLimit) {
      const rateLimiter = this.rateLimiterRegistry.getRateLimiter(
        options.endpointName || 'default',
        endpointConfig.rateLimit
      );
      
      const originalOperation = enhancedOperation;
      enhancedOperation = async () => {
        const identifier = this.generateRateLimitIdentifier(options);
        const limitResult = await rateLimiter.checkLimit(identifier);
        
        if (!limitResult.allowed) {
          throw new RateLimitError(
            `Rate limit exceeded for ${options.operationName}`,
            limitResult.resetTime,
            limitResult.retryAfter || 0,
            limitResult.limit,
            limitResult.remaining
          );
        }
        
        return originalOperation();
      };
    }

    // Layer 1: Retry Logic (innermost)
    if (options.enableRetry !== false && endpointConfig?.retry) {
      const retryHandler = options.endpointName === 'nanoBanana'
        ? new NanoBananaRetryHandler(endpointConfig.retry)
        : new RetryHandler(endpointConfig.retry);

      const executeOptions: any = {
        name: options.operationName,
      };
      if (options.onRetry) {
        executeOptions.onRetry = options.onRetry;
      }
      
      const retryResult = await retryHandler.executeWithDetails(enhancedOperation, executeOptions);

      if (!retryResult.succeeded) {
        throw retryResult.error;
      }

      return {
        result: retryResult.result!,
        retryAttempts: retryResult.attempts.length,
      };
    }

    // No retry - execute directly
    const result = await enhancedOperation();
    return { result };
  }

  /**
   * Execute nanoBanana specific operations with specialized error handling
   */
  async executeNanoBananaOperation<T>(
    operation: () => Promise<T>,
    operationType: 'generation' | 'query' | 'batch',
    additionalOptions: Partial<ErrorRecoveryOptions> = {}
  ): Promise<RecoveryResult<T>> {
    const options: ErrorRecoveryOptions = {
      operationName: `nanoBanana-${operationType}`,
      endpointName: 'nanoBanana',
      enableRetry: true,
      enableCircuitBreaker: true,
      enableRateLimit: true,
      ...additionalOptions,
    };

    return this.executeWithRecovery(operation, options);
  }

  /**
   * Execute database operations with appropriate resilience
   */
  async executeDatabaseOperation<T>(
    operation: () => Promise<T>,
    operationName: string,
    additionalOptions: Partial<ErrorRecoveryOptions> = {}
  ): Promise<RecoveryResult<T>> {
    const options: ErrorRecoveryOptions = {
      operationName: `database-${operationName}`,
      endpointName: 'database',
      enableRetry: true,
      enableCircuitBreaker: true,
      enableRateLimit: false, // Usually not needed for database
      ...additionalOptions,
    };

    return this.executeWithRecovery(operation, options);
  }

  /**
   * Execute storage operations with appropriate resilience
   */
  async executeStorageOperation<T>(
    operation: () => Promise<T>,
    operationName: string,
    additionalOptions: Partial<ErrorRecoveryOptions> = {}
  ): Promise<RecoveryResult<T>> {
    const options: ErrorRecoveryOptions = {
      operationName: `storage-${operationName}`,
      endpointName: 'storage',
      enableRetry: true,
      enableCircuitBreaker: true,
      enableRateLimit: false,
      ...additionalOptions,
    };

    return this.executeWithRecovery(operation, options);
  }

  /**
   * Get overall system health based on circuit breakers and other metrics
   */
  getSystemHealth(): {
    healthy: boolean;
    circuitBreakers: ReturnType<CircuitBreakerRegistry['getHealthSummary']>;
    rateLimiters: ReturnType<RateLimiterRegistry['getAllStatus']>;
    recommendations: string[];
  } {
    const circuitBreakers = this.circuitBreakerRegistry.getHealthSummary();
    const rateLimiters = this.rateLimiterRegistry.getAllStatus();
    
    const recommendations: string[] = [];
    
    // Analyze circuit breaker health
    if (circuitBreakers.unhealthy > 0) {
      recommendations.push(`${circuitBreakers.unhealthy} circuit breakers are unhealthy`);
    }
    
    if (circuitBreakers.healthPercentage < 80) {
      recommendations.push('Consider implementing fallback mechanisms');
    }

    // Check for patterns in circuit breaker failures
    const openBreakers = Object.values(circuitBreakers.circuitBreakers)
      .filter(cb => cb.state === 'OPEN');
    
    if (openBreakers.length > 0) {
      recommendations.push('Some services are experiencing issues - check logs');
    }

    return {
      healthy: circuitBreakers.healthPercentage >= 80,
      circuitBreakers,
      rateLimiters,
      recommendations,
    };
  }

  /**
   * Reset all resilience components
   */
  resetAll(): void {
    this.circuitBreakerRegistry.resetAll();
    this.rateLimiterRegistry.destroyAll();
  }

  /**
   * Update configuration
   */
  updateConfig(newConfig: Partial<ResilienceConfig>): void {
    this.config = { ...this.config, ...newConfig };
  }

  /**
   * Generate rate limit identifier for operation
   */
  private generateRateLimitIdentifier(options: ErrorRecoveryOptions): string {
    // This would typically include user ID, API key, or other identifier
    // For now, using operation name as basic identifier
    return `${options.operationName}_${options.endpointName || 'default'}`;
  }

  /**
   * Log operation result for monitoring and debugging
   */
  private logOperationResult<T>(result: RecoveryResult<T>): void {
    const logData = {
      operation: result.metadata.operationName,
      endpoint: result.metadata.endpointName,
      success: result.success,
      fallbackUsed: result.fallbackUsed,
      retryAttempts: result.retryAttempts,
      circuitBreakerTriggered: result.circuitBreakerTriggered,
      rateLimitTriggered: result.rateLimitTriggered,
      duration: result.totalDuration,
      timestamp: result.metadata.timestamp,
    };

    if (result.success) {
      console.log('Operation completed successfully:', logData);
    } else {
      console.error('Operation failed:', {
        ...logData,
        error: result.error instanceof Error ? result.error.message : String(result.error),
      });
    }
  }
}

/**
 * Convenience functions for common operations
 */
export const errorRecovery = ErrorRecoveryService.getInstance();

export async function withErrorRecovery<T>(
  operation: () => Promise<T>,
  options: ErrorRecoveryOptions
): Promise<RecoveryResult<T>> {
  return errorRecovery.executeWithRecovery(operation, options);
}

export async function withNanoBananaRecovery<T>(
  operation: () => Promise<T>,
  operationType: 'generation' | 'query' | 'batch',
  options: Partial<ErrorRecoveryOptions> = {}
): Promise<RecoveryResult<T>> {
  return errorRecovery.executeNanoBananaOperation(operation, operationType, options);
}

export async function withDatabaseRecovery<T>(
  operation: () => Promise<T>,
  operationName: string,
  options: Partial<ErrorRecoveryOptions> = {}
): Promise<RecoveryResult<T>> {
  return errorRecovery.executeDatabaseOperation(operation, operationName, options);
}

export async function withStorageRecovery<T>(
  operation: () => Promise<T>,
  operationName: string,
  options: Partial<ErrorRecoveryOptions> = {}
): Promise<RecoveryResult<T>> {
  return errorRecovery.executeStorageOperation(operation, operationName, options);
}