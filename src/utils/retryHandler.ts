/**
 * Retry Handler with Exponential Backoff
 * 
 * Implements retry logic with configurable exponential backoff, jitter,
 * and intelligent retry condition checking specifically designed for
 * nanoBanana API and other external service integrations.
 */

import { RetryConfig, isRetryableError } from '../config/resilience';

export class RetryError extends Error {
  constructor(
    message: string,
    public readonly originalError: unknown,
    public readonly attempt: number,
    public readonly maxAttempts: number
  ) {
    super(message);
    this.name = 'RetryError';
  }
}

export interface RetryAttempt {
  attempt: number;
  delay: number;
  error?: unknown;
  startTime: Date;
  endTime?: Date;
  duration?: number;
}

export interface RetryResult<T> {
  result?: T;
  error?: unknown;
  attempts: RetryAttempt[];
  totalDuration: number;
  succeeded: boolean;
}

export class RetryHandler {
  constructor(protected readonly config: RetryConfig) {}

  /**
   * Execute a function with retry logic and exponential backoff
   */
  async execute<T>(
    fn: () => Promise<T>,
    options?: {
      onRetry?: (attempt: number, error: unknown, delay: number) => void;
      shouldRetry?: (error: unknown, attempt: number) => boolean;
      name?: string;
    }
  ): Promise<T> {
    const startTime = new Date();
    const attempts: RetryAttempt[] = [];
    let lastError: unknown;

    for (let attempt = 1; attempt <= this.config.maxAttempts; attempt++) {
      const attemptStartTime = new Date();
      const attemptInfo: RetryAttempt = {
        attempt,
        delay: 0,
        startTime: attemptStartTime,
      };

      try {
        const result = await fn();
        attemptInfo.endTime = new Date();
        attemptInfo.duration = attemptInfo.endTime.getTime() - attemptStartTime.getTime();
        attempts.push(attemptInfo);

        // Success - log and return
        if (attempt > 1) {
          console.log(`Retry succeeded on attempt ${attempt}/${this.config.maxAttempts}`, {
            name: options?.name,
            totalAttempts: attempt,
            totalDuration: new Date().getTime() - startTime.getTime(),
          });
        }

        return result;
      } catch (error) {
        lastError = error;
        attemptInfo.error = error;
        attemptInfo.endTime = new Date();
        attemptInfo.duration = attemptInfo.endTime.getTime() - attemptStartTime.getTime();

        // Check if we should retry
        const shouldRetry = options?.shouldRetry
          ? options.shouldRetry(error, attempt)
          : this.shouldRetry(error, attempt);

        if (!shouldRetry || attempt >= this.config.maxAttempts) {
          attempts.push(attemptInfo);
          break;
        }

        // Calculate delay for next attempt
        const delay = this.calculateDelay(attempt);
        attemptInfo.delay = delay;
        attempts.push(attemptInfo);

        // Call retry callback if provided
        options?.onRetry?.(attempt, error, delay);

        console.warn(`Retry attempt ${attempt}/${this.config.maxAttempts} failed, retrying in ${delay}ms`, {
          name: options?.name,
          error: this.getErrorMessage(error),
          delay,
        });

        // Wait before next attempt
        await this.sleep(delay);
      }
    }

    // All attempts failed
    const totalDuration = new Date().getTime() - startTime.getTime();
    const errorMessage = `Failed after ${attempts.length} attempts over ${totalDuration}ms`;

    throw new RetryError(
      errorMessage,
      lastError,
      attempts.length,
      this.config.maxAttempts
    );
  }

  /**
   * Execute with detailed result information
   */
  async executeWithDetails<T>(
    fn: () => Promise<T>,
    options?: {
      onRetry?: (attempt: number, error: unknown, delay: number) => void;
      shouldRetry?: (error: unknown, attempt: number) => boolean;
      name?: string;
    }
  ): Promise<RetryResult<T>> {
    const startTime = new Date();
    const attempts: RetryAttempt[] = [];
    let result: T | undefined;
    let lastError: unknown;

    for (let attempt = 1; attempt <= this.config.maxAttempts; attempt++) {
      const attemptStartTime = new Date();
      const attemptInfo: RetryAttempt = {
        attempt,
        delay: 0,
        startTime: attemptStartTime,
      };

      try {
        result = await fn();
        attemptInfo.endTime = new Date();
        attemptInfo.duration = attemptInfo.endTime.getTime() - attemptStartTime.getTime();
        attempts.push(attemptInfo);

        return {
          result,
          attempts,
          totalDuration: new Date().getTime() - startTime.getTime(),
          succeeded: true,
        };
      } catch (error) {
        lastError = error;
        attemptInfo.error = error;
        attemptInfo.endTime = new Date();
        attemptInfo.duration = attemptInfo.endTime.getTime() - attemptStartTime.getTime();

        const shouldRetry = options?.shouldRetry
          ? options.shouldRetry(error, attempt)
          : this.shouldRetry(error, attempt);

        if (!shouldRetry || attempt >= this.config.maxAttempts) {
          attempts.push(attemptInfo);
          break;
        }

        const delay = this.calculateDelay(attempt);
        attemptInfo.delay = delay;
        attempts.push(attemptInfo);

        options?.onRetry?.(attempt, error, delay);
        await this.sleep(delay);
      }
    }

    return {
      error: lastError,
      attempts,
      totalDuration: new Date().getTime() - startTime.getTime(),
      succeeded: false,
    };
  }

  /**
   * Calculate delay with exponential backoff and jitter
   */
  private calculateDelay(attempt: number): number {
    // Exponential backoff: baseDelay * (multiplier ^ (attempt - 1))
    const exponentialDelay = this.config.baseDelayMs * Math.pow(this.config.backoffMultiplier, attempt - 1);
    
    // Apply maximum delay cap
    const cappedDelay = Math.min(exponentialDelay, this.config.maxDelayMs);
    
    // Add jitter to prevent thundering herd
    const jitterAmount = cappedDelay * this.config.jitterFactor;
    const jitter = (Math.random() * 2 - 1) * jitterAmount; // Random between -jitterAmount and +jitterAmount
    
    return Math.max(0, Math.round(cappedDelay + jitter));
  }

  /**
   * Determine if error should trigger a retry
   */
  private shouldRetry(error: unknown, attempt: number): boolean {
    if (attempt >= this.config.maxAttempts) {
      return false;
    }

    return isRetryableError(error);
  }

  /**
   * Sleep for specified milliseconds
   */
  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Extract error message for logging
   */
  private getErrorMessage(error: unknown): string {
    if (error instanceof Error) {
      return error.message;
    }
    if (typeof error === 'string') {
      return error;
    }
    if (typeof error === 'object' && error !== null) {
      const errorObj = error as any;
      return errorObj.message || errorObj.code || JSON.stringify(error);
    }
    return String(error);
  }
}

/**
 * Convenience function for simple retry with default configuration
 */
export async function retryWithBackoff<T>(
  fn: () => Promise<T>,
  config: RetryConfig,
  options?: {
    onRetry?: (attempt: number, error: unknown, delay: number) => void;
    shouldRetry?: (error: unknown, attempt: number) => boolean;
    name?: string;
  }
): Promise<T> {
  const retryHandler = new RetryHandler(config);
  return retryHandler.execute(fn, options);
}

/**
 * Specialized retry handler for nanoBanana API calls
 */
export class NanoBananaRetryHandler extends RetryHandler {
  constructor(config: RetryConfig) {
    super(config);
  }

  /**
   * Execute nanoBanana API call with specialized retry logic
   */
  async executeApiCall<T>(
    fn: () => Promise<T>,
    options?: {
      operationType?: 'generation' | 'query' | 'batch';
      onRetry?: (attempt: number, error: unknown, delay: number) => void;
    }
  ): Promise<T> {
    const executeOptions: any = {
      name: `nanoBanana-${options?.operationType || 'api'}`,
      shouldRetry: (error: unknown, attempt: number) => this.shouldRetryNanoBanana(error, attempt, options?.operationType),
    };
    
    if (options?.onRetry) {
      executeOptions.onRetry = options.onRetry;
    }
    
    return this.execute(fn, executeOptions);
  }

  /**
   * Specialized retry logic for nanoBanana API
   */
  protected shouldRetryNanoBanana(error: unknown, attempt: number, operationType?: string): boolean {
    if (attempt >= this.config.maxAttempts) {
      return false;
    }

    // Check standard retryable errors
    if (isRetryableError(error)) {
      return true;
    }

    // nanoBanana specific retry conditions
    if (typeof error === 'object' && error !== null) {
      const errorObj = error as any;

      // API quota/rate limit errors
      if (errorObj.code === 'QUOTA_EXCEEDED' || errorObj.status === 429) {
        return true;
      }

      // Model loading/initialization errors (common in AI APIs)
      if (errorObj.message && typeof errorObj.message === 'string') {
        const message = errorObj.message.toLowerCase();
        if (
          message.includes('model loading') ||
          message.includes('model not ready') ||
          message.includes('initialization') ||
          message.includes('warming up')
        ) {
          return true;
        }
      }

      // For generation operations, be more aggressive with retries
      if (operationType === 'generation') {
        // Retry on certain 4xx errors that might be temporary
        if (errorObj.status === 408 || errorObj.status === 409) {
          return true;
        }
      }

      // Authentication token refresh scenarios
      if (errorObj.status === 401 && errorObj.code !== 'INVALID_CREDENTIALS') {
        return true;
      }
    }

    return false;
  }
}

/**
 * Create retry handler with exponential backoff for common scenarios
 */
export function createRetryHandler(scenario: 'nanoBanana' | 'database' | 'storage' | 'default', customConfig?: Partial<RetryConfig>): RetryHandler {
  const configs = {
    nanoBanana: {
      maxAttempts: 5,
      baseDelayMs: 2000,
      maxDelayMs: 60000,
      backoffMultiplier: 2.5,
      jitterFactor: 0.2,
    },
    database: {
      maxAttempts: 3,
      baseDelayMs: 500,
      maxDelayMs: 5000,
      backoffMultiplier: 1.5,
      jitterFactor: 0.05,
    },
    storage: {
      maxAttempts: 4,
      baseDelayMs: 1500,
      maxDelayMs: 20000,
      backoffMultiplier: 2,
      jitterFactor: 0.15,
    },
    default: {
      maxAttempts: 3,
      baseDelayMs: 1000,
      maxDelayMs: 30000,
      backoffMultiplier: 2,
      jitterFactor: 0.1,
    },
  };

  const config = { ...configs[scenario], ...customConfig };
  
  if (scenario === 'nanoBanana') {
    return new NanoBananaRetryHandler(config);
  }
  
  return new RetryHandler(config);
}