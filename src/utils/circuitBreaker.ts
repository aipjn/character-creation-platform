/**
 * Circuit Breaker Implementation
 * 
 * Prevents cascade failures by temporarily blocking requests to failing services.
 * Implements the Circuit Breaker pattern with three states: CLOSED, OPEN, HALF_OPEN.
 */

import { CircuitBreakerConfig, isCircuitBreakerError } from '../config/resilience';

export enum CircuitBreakerState {
  CLOSED = 'CLOSED',     // Normal operation, requests flow through
  OPEN = 'OPEN',         // Circuit is open, requests are blocked
  HALF_OPEN = 'HALF_OPEN' // Testing if service has recovered
}

export class CircuitBreakerError extends Error {
  constructor(
    message: string,
    public readonly state: CircuitBreakerState,
    public readonly nextAttemptTime?: Date
  ) {
    super(message);
    this.name = 'CircuitBreakerError';
  }
}

interface CallMetrics {
  totalCalls: number;
  failedCalls: number;
  successfulCalls: number;
  lastCallTime: Date;
  lastFailureTime?: Date;
  lastSuccessTime?: Date;
}

export class CircuitBreaker {
  private state: CircuitBreakerState = CircuitBreakerState.CLOSED;
  private metrics: CallMetrics = {
    totalCalls: 0,
    failedCalls: 0,
    successfulCalls: 0,
    lastCallTime: new Date(),
  };
  private nextAttemptTime?: Date | undefined;
  private stateChangeTime: Date = new Date();

  constructor(
    private readonly name: string,
    private readonly config: CircuitBreakerConfig
  ) {}

  /**
   * Execute a function with circuit breaker protection
   */
  async execute<T>(fn: () => Promise<T>): Promise<T> {
    // Check if circuit breaker should allow the call
    this.updateState();
    
    if (this.state === CircuitBreakerState.OPEN) {
      throw new CircuitBreakerError(
        `Circuit breaker '${this.name}' is OPEN. Service is currently unavailable.`,
        this.state,
        this.nextAttemptTime
      );
    }

    const startTime = new Date();
    let result: T;

    try {
      result = await fn();
      this.onSuccess(startTime);
      return result;
    } catch (err) {
      this.onFailure(startTime, err);
      throw err;
    }
  }

  /**
   * Get current circuit breaker status
   */
  getStatus() {
    return {
      name: this.name,
      state: this.state,
      metrics: { ...this.metrics },
      nextAttemptTime: this.nextAttemptTime,
      stateChangeTime: this.stateChangeTime,
      config: this.config,
      failureRate: this.getFailureRate(),
      isHealthy: this.state === CircuitBreakerState.CLOSED,
    };
  }

  /**
   * Get current failure rate as percentage
   */
  getFailureRate(): number {
    if (this.metrics.totalCalls === 0) return 0;
    return (this.metrics.failedCalls / this.metrics.totalCalls) * 100;
  }

  /**
   * Manually reset the circuit breaker to CLOSED state
   */
  reset(): void {
    this.state = CircuitBreakerState.CLOSED;
    this.metrics = {
      totalCalls: 0,
      failedCalls: 0,
      successfulCalls: 0,
      lastCallTime: new Date(),
    };
    this.nextAttemptTime = undefined;
    this.stateChangeTime = new Date();
  }

  /**
   * Force circuit breaker to OPEN state
   */
  forceOpen(): void {
    this.changeState(CircuitBreakerState.OPEN);
    this.nextAttemptTime = new Date(Date.now() + this.config.resetTimeoutMs);
  }

  /**
   * Update circuit breaker state based on current conditions
   */
  private updateState(): void {
    const now = new Date();

    switch (this.state) {
      case CircuitBreakerState.CLOSED:
        // Check if we should open the circuit
        if (this.shouldOpen()) {
          this.changeState(CircuitBreakerState.OPEN);
          this.nextAttemptTime = new Date(now.getTime() + this.config.resetTimeoutMs);
        }
        break;

      case CircuitBreakerState.OPEN:
        // Check if we should try half-open
        if (this.nextAttemptTime && now >= this.nextAttemptTime) {
          this.changeState(CircuitBreakerState.HALF_OPEN);
          this.nextAttemptTime = undefined;
        }
        break;

      case CircuitBreakerState.HALF_OPEN:
        // Half-open state is handled by success/failure callbacks
        break;
    }

    // Clean up old metrics outside monitoring window
    this.cleanupOldMetrics();
  }

  /**
   * Determine if circuit should open based on failure threshold
   */
  private shouldOpen(): boolean {
    // Need minimum throughput to make decisions
    if (this.metrics.totalCalls < this.config.minimumThroughput) {
      return false;
    }

    // Check if failure rate exceeds threshold
    const failureRate = this.getFailureRate();
    return failureRate >= this.config.failureThreshold;
  }

  /**
   * Handle successful call
   */
  private onSuccess(_startTime: Date): void {
    this.metrics.totalCalls++;
    this.metrics.successfulCalls++;
    this.metrics.lastCallTime = new Date();
    this.metrics.lastSuccessTime = new Date();

    // In half-open state, success moves to closed
    if (this.state === CircuitBreakerState.HALF_OPEN) {
      this.changeState(CircuitBreakerState.CLOSED);
      // Reset failure metrics on successful recovery
      this.resetFailureMetrics();
    }
  }

  /**
   * Handle failed call
   */
  private onFailure(_startTime: Date, error: unknown): void {
    this.metrics.totalCalls++;
    this.metrics.lastCallTime = new Date();
    
    // Only count as failure if it's a circuit breaker error
    if (isCircuitBreakerError(error)) {
      this.metrics.failedCalls++;
      this.metrics.lastFailureTime = new Date();

      // In half-open state, failure moves back to open
      if (this.state === CircuitBreakerState.HALF_OPEN) {
        this.changeState(CircuitBreakerState.OPEN);
        this.nextAttemptTime = new Date(Date.now() + this.config.resetTimeoutMs);
      }
    }
  }

  /**
   * Change circuit breaker state
   */
  private changeState(newState: CircuitBreakerState): void {
    const previousState = this.state;
    this.state = newState;
    this.stateChangeTime = new Date();

    console.log(
      `Circuit breaker '${this.name}' state changed: ${previousState} -> ${newState}`,
      {
        failureRate: this.getFailureRate(),
        totalCalls: this.metrics.totalCalls,
        failedCalls: this.metrics.failedCalls,
      }
    );
  }

  /**
   * Clean up metrics outside monitoring window
   */
  private cleanupOldMetrics(): void {
    const cutoffTime = new Date(Date.now() - this.config.monitoringPeriodMs);
    
    // If last call was outside monitoring window, reset metrics
    if (this.metrics.lastCallTime < cutoffTime) {
      this.resetFailureMetrics();
    }
  }

  /**
   * Reset failure-related metrics
   */
  private resetFailureMetrics(): void {
    this.metrics.totalCalls = 0;
    this.metrics.failedCalls = 0;
    this.metrics.successfulCalls = 0;
  }
}

/**
 * Circuit breaker registry for managing multiple circuit breakers
 */
export class CircuitBreakerRegistry {
  private static instance: CircuitBreakerRegistry;
  private circuitBreakers = new Map<string, CircuitBreaker>();

  private constructor() {}

  static getInstance(): CircuitBreakerRegistry {
    if (!CircuitBreakerRegistry.instance) {
      CircuitBreakerRegistry.instance = new CircuitBreakerRegistry();
    }
    return CircuitBreakerRegistry.instance;
  }

  /**
   * Get or create a circuit breaker
   */
  getCircuitBreaker(name: string, config: CircuitBreakerConfig): CircuitBreaker {
    if (!this.circuitBreakers.has(name)) {
      this.circuitBreakers.set(name, new CircuitBreaker(name, config));
    }
    return this.circuitBreakers.get(name)!;
  }

  /**
   * Get all circuit breakers status
   */
  getAllStatus() {
    const statuses: Record<string, ReturnType<CircuitBreaker['getStatus']>> = {};
    
    for (const [name, breaker] of this.circuitBreakers.entries()) {
      statuses[name] = breaker.getStatus();
    }
    
    return statuses;
  }

  /**
   * Reset all circuit breakers
   */
  resetAll(): void {
    for (const breaker of this.circuitBreakers.values()) {
      breaker.reset();
    }
  }

  /**
   * Get circuit breaker health summary
   */
  getHealthSummary() {
    const statuses = this.getAllStatus();
    const total = Object.keys(statuses).length;
    const healthy = Object.values(statuses).filter(status => status.isHealthy).length;
    const unhealthy = total - healthy;

    return {
      total,
      healthy,
      unhealthy,
      healthPercentage: total > 0 ? (healthy / total) * 100 : 100,
      circuitBreakers: statuses,
    };
  }
}

/**
 * Convenience function to execute with circuit breaker protection
 */
export async function executeWithCircuitBreaker<T>(
  name: string,
  config: CircuitBreakerConfig,
  fn: () => Promise<T>
): Promise<T> {
  const registry = CircuitBreakerRegistry.getInstance();
  const circuitBreaker = registry.getCircuitBreaker(name, config);
  return circuitBreaker.execute(fn);
}