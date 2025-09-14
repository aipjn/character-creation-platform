/**
 * nanoBanana API Client Service
 * Handles communication with Google Gemini 2.5 Flash Image (nanoBanana) API
 */

import { EventEmitter } from 'events';
import {
  GenerationRequest,
  GenerationResponse,
  BatchGenerationRequest,
  BatchGenerationResponse,
  CharacterGenerationRequest,
  ApiError,
  ApiResponse,
  RateLimitState,
  CircuitBreakerStatus,
  NanoBananaEvent,
  ApiMetrics,
  QueuedRequest,
  Priority,
  GenerationStatus
} from '../types/nanoBanana';
import { getNanoBananaConfig } from '../config/nanoBanana';
import { AuthTokenManager, getDefaultAuthTokenManager, AuthError } from '../utils/authTokenManager';

export class NanoBananaClient extends EventEmitter {
  private config: ReturnType<typeof getNanoBananaConfig>;
  private authManager: AuthTokenManager;
  private rateLimitState: RateLimitState;
  private circuitBreakerStatus: CircuitBreakerStatus;
  private activeRequests: Map<string, AbortController> = new Map();
  private requestQueue: QueuedRequest[] = [];
  private metrics: ApiMetrics;
  private lastRequestTime: number = 0;

  constructor(authManager?: AuthTokenManager) {
    super();
    
    this.config = getNanoBananaConfig();
    this.authManager = authManager || getDefaultAuthTokenManager();
    
    // Initialize rate limiting state
    this.rateLimitState = {
      requestsPerMinute: {
        limit: this.config.rateLimiting.requestsPerMinute,
        remaining: this.config.rateLimiting.requestsPerMinute,
        resetAt: new Date(Date.now() + 60000)
      },
      requestsPerHour: {
        limit: this.config.rateLimiting.requestsPerHour,
        remaining: this.config.rateLimiting.requestsPerHour,
        resetAt: new Date(Date.now() + 3600000)
      },
      concurrentRequests: {
        current: 0,
        maximum: this.config.maxConcurrentRequests
      }
    };

    // Initialize circuit breaker
    this.circuitBreakerStatus = {
      state: 'closed',
      failureCount: 0,
      requestCount: 0,
      successCount: 0
    };

    // Initialize metrics
    this.metrics = {
      requests: {
        total: 0,
        successful: 0,
        failed: 0,
        averageResponseTimeMs: 0
      },
      rateLimiting: {
        rateLimitHits: 0,
        throttledRequests: 0
      },
      circuitBreaker: {
        state: 'closed',
        openCount: 0,
        halfOpenCount: 0
      },
      errors: {
        byCode: {},
        byType: {}
      },
      performance: {
        averageGenerationTimeMs: 0,
        p95GenerationTimeMs: 0,
        p99GenerationTimeMs: 0
      }
    };

    // Set up periodic rate limit reset
    this.setupRateLimitReset();
  }

  /**
   * Generate a single image
   */
  public async generateImage(request: GenerationRequest): Promise<GenerationResponse> {
    const requestId = this.generateRequestId();
    
    try {
      this.emit('request_started', { type: 'request_started', timestamp: new Date(), data: { requestId, request } });
      
      // Check circuit breaker
      if (this.circuitBreakerStatus.state === 'open') {
        throw this.createApiError('CIRCUIT_BREAKER_OPEN', 'Circuit breaker is open', 503, true);
      }

      // Check rate limits
      await this.checkRateLimit();

      // Wait for available slot
      await this.waitForAvailableSlot();

      // Make the API request
      const response = await this.makeRequest(request, requestId);
      
      this.updateCircuitBreakerSuccess();
      this.updateMetrics(true, Date.now() - this.lastRequestTime);
      
      this.emit('request_completed', { 
        type: 'request_completed', 
        timestamp: new Date(), 
        data: { requestId, response } 
      });

      return response;
    } catch (error) {
      this.updateCircuitBreakerFailure();
      this.updateMetrics(false, Date.now() - this.lastRequestTime);
      
      const apiError = this.normalizeError(error);
      
      this.emit('request_failed', { 
        type: 'request_failed', 
        timestamp: new Date(), 
        data: { requestId, error: apiError } 
      });

      throw apiError;
    } finally {
      this.rateLimitState.concurrentRequests.current--;
      this.activeRequests.delete(requestId);
    }
  }

  /**
   * Generate multiple images in a batch
   */
  public async generateBatch(request: BatchGenerationRequest): Promise<BatchGenerationResponse> {
    const batchId = request.batchId || this.generateBatchId();
    
    try {
      this.emit('batch_started', { type: 'batch_started', timestamp: new Date(), data: { batchId, request } });

      // Validate batch size
      if (request.requests.length > this.config.batchConfig.maxBatchSize) {
        throw this.createApiError(
          'BATCH_TOO_LARGE', 
          `Batch size ${request.requests.length} exceeds maximum ${this.config.batchConfig.maxBatchSize}`,
          400
        );
      }

      // Process batch requests
      const results: GenerationResponse[] = [];
      const promises = request.requests.map(async (req, index) => {
        try {
          const response = await this.generateImage(req);
          results[index] = response;
          return response;
        } catch (error) {
          const failedResponse: GenerationResponse = {
            id: this.generateRequestId(),
            status: 'failed',
            error: this.normalizeError(error),
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
          };
          results[index] = failedResponse;
          return failedResponse;
        }
      });

      // Wait for all requests to complete or timeout
      const timeoutPromise = new Promise<never>((_, reject) => {
        setTimeout(() => {
          reject(this.createApiError('BATCH_TIMEOUT', 'Batch processing timeout', 408, true));
        }, this.config.batchConfig.batchTimeoutMs);
      });

      await Promise.race([Promise.allSettled(promises), timeoutPromise]);

      const batchResponse: BatchGenerationResponse = {
        batchId,
        status: results.every(r => r.status === 'completed') ? 'completed' : 
               results.some(r => r.status === 'completed') ? 'completed' : 'failed',
        totalRequests: request.requests.length,
        completedRequests: results.filter(r => r.status === 'completed').length,
        failedRequests: results.filter(r => r.status === 'failed').length,
        results,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };

      this.emit('batch_completed', { 
        type: 'batch_completed', 
        timestamp: new Date(), 
        data: { batchId, response: batchResponse } 
      });

      return batchResponse;
    } catch (error) {
      const apiError = this.normalizeError(error);
      
      this.emit('batch_failed', { 
        type: 'batch_failed', 
        timestamp: new Date(), 
        data: { batchId, error: apiError } 
      });

      throw apiError;
    }
  }

  /**
   * Generate character images with specifications
   */
  public async generateCharacter(request: CharacterGenerationRequest): Promise<BatchGenerationResponse> {
    const variations = request.variations || 1;
    const requests: GenerationRequest[] = [];

    // Build prompts from character specifications
    const basePrompt = this.buildCharacterPrompt(request.characterSpecs);
    
    // Create variations
    for (let i = 0; i < variations; i++) {
      const generationRequest: GenerationRequest = {
        type: 'text-to-image',
        prompt: basePrompt,
        ...request.generationParams
      };
      
      // Add slight variations for multiple generations
      if (variations > 1) {
        generationRequest.seed = undefined; // Use random seed for variations
        generationRequest.prompt += ` (variation ${i + 1})`;
      }
      
      requests.push(generationRequest);
    }

    const batchRequest: BatchGenerationRequest = {
      requests,
      batchId: `character-${request.characterId}-${Date.now()}`,
      metadata: {
        characterId: request.characterId,
        characterSpecs: request.characterSpecs,
        type: 'character_generation'
      }
    };

    return await this.generateBatch(batchRequest);
  }

  /**
   * Cancel a request
   */
  public cancelRequest(requestId: string): boolean {
    const controller = this.activeRequests.get(requestId);
    if (controller) {
      controller.abort();
      this.activeRequests.delete(requestId);
      return true;
    }
    return false;
  }

  /**
   * Get current API status
   */
  public getStatus(): {
    rateLimits: RateLimitState;
    circuitBreaker: CircuitBreakerStatus;
    activeRequests: number;
    queueSize: number;
    metrics: ApiMetrics;
  } {
    return {
      rateLimits: { ...this.rateLimitState },
      circuitBreaker: { ...this.circuitBreakerStatus },
      activeRequests: this.activeRequests.size,
      queueSize: this.requestQueue.length,
      metrics: { ...this.metrics }
    };
  }

  /**
   * Test API connection
   */
  public async testConnection(): Promise<boolean> {
    try {
      const testRequest: GenerationRequest = {
        type: 'text-to-image',
        prompt: 'test connection',
        quality: 'low',
        width: 64,
        height: 64
      };

      // Don't actually generate, just validate the request would work
      const headers = await this.authManager.getAuthHeader();
      const response = await this.fetchWithRetry('/health', {
        method: 'GET',
        headers
      });

      return response.ok;
    } catch (error) {
      console.error('Connection test failed:', error);
      return false;
    }
  }

  /**
   * Make HTTP request to nanoBanana API
   */
  private async makeRequest(request: GenerationRequest, requestId: string): Promise<GenerationResponse> {
    const controller = new AbortController();
    this.activeRequests.set(requestId, controller);

    try {
      const headers = await this.authManager.getAuthHeader();
      const apiResponse = await this.fetchWithRetry('/generate', {
        method: 'POST',
        headers: {
          ...headers,
          'Content-Type': 'application/json',
          'X-Request-ID': requestId
        },
        data: {
          ...request,
          model: this.config.model
        },
        signal: controller.signal
      });

      const response: GenerationResponse = {
        id: requestId,
        status: 'completed',
        result: apiResponse.data.result,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        completedAt: new Date().toISOString()
      };

      return response;
    } catch (error) {
      if (controller.signal.aborted) {
        throw this.createApiError('REQUEST_CANCELLED', 'Request was cancelled', 499);
      }
      throw error;
    }
  }

  /**
   * HTTP client with retry logic
   */
  private async fetchWithRetry(
    endpoint: string, 
    options: any,
    retryCount: number = 0
  ): Promise<ApiResponse> {
    const url = `${this.config.baseUrl}${endpoint}`;
    const startTime = Date.now();
    
    try {
      const fetchOptions: RequestInit = {
        method: options.method,
        headers: options.headers,
        signal: options.signal,
        timeout: this.config.timeout
      };

      if (options.data) {
        fetchOptions.body = JSON.stringify(options.data);
      }

      const response = await fetch(url, fetchOptions);
      const responseTime = Date.now() - startTime;

      // Update rate limit info from headers
      this.updateRateLimitFromHeaders(response.headers);

      if (!response.ok) {
        const error = await this.parseErrorResponse(response);
        
        // Check if error is retryable
        if (this.shouldRetry(error, retryCount)) {
          const delay = this.calculateRetryDelay(retryCount);
          await this.wait(delay);
          return this.fetchWithRetry(endpoint, options, retryCount + 1);
        }
        
        throw error;
      }

      const data = await response.json();
      
      return {
        data,
        status: response.status,
        statusText: response.statusText,
        headers: this.headersToObject(response.headers),
        requestId: response.headers.get('x-request-id') || undefined
      };
    } catch (error) {
      if (error instanceof ApiError) {
        throw error;
      }

      const apiError = this.normalizeError(error);
      
      if (this.shouldRetry(apiError, retryCount)) {
        const delay = this.calculateRetryDelay(retryCount);
        await this.wait(delay);
        return this.fetchWithRetry(endpoint, options, retryCount + 1);
      }
      
      throw apiError;
    }
  }

  /**
   * Build character prompt from specifications
   */
  private buildCharacterPrompt(specs: CharacterGenerationRequest['characterSpecs']): string {
    const parts: string[] = [];

    // Base description
    if (specs.description) {
      parts.push(specs.description);
    }

    // Character name
    if (specs.name) {
      parts.push(`character named ${specs.name}`);
    }

    // Physical appearance
    if (specs.appearance) {
      const appearance = specs.appearance;
      const appearanceParts: string[] = [];

      if (appearance.age) appearanceParts.push(`${appearance.age} years old`);
      if (appearance.gender) appearanceParts.push(appearance.gender);
      if (appearance.build) appearanceParts.push(`${appearance.build} build`);
      if (appearance.hair) appearanceParts.push(`${appearance.hair} hair`);
      if (appearance.eyes) appearanceParts.push(`${appearance.eyes} eyes`);
      if (appearance.skin) appearanceParts.push(`${appearance.skin} skin`);
      if (appearance.clothing) appearanceParts.push(`wearing ${appearance.clothing}`);
      
      if (appearance.accessories && appearance.accessories.length > 0) {
        appearanceParts.push(`with ${appearance.accessories.join(', ')}`);
      }

      if (appearanceParts.length > 0) {
        parts.push(appearanceParts.join(', '));
      }
    }

    // Personality traits
    if (specs.personality && specs.personality.length > 0) {
      parts.push(`personality: ${specs.personality.join(', ')}`);
    }

    // Character traits
    if (specs.traits && specs.traits.length > 0) {
      parts.push(`traits: ${specs.traits.join(', ')}`);
    }

    // Background
    if (specs.background) {
      parts.push(`background: ${specs.background}`);
    }

    return parts.join(', ');
  }

  /**
   * Rate limiting and queue management
   */
  private async checkRateLimit(): Promise<void> {
    const now = new Date();
    
    // Reset rate limits if expired
    if (now >= this.rateLimitState.requestsPerMinute.resetAt) {
      this.rateLimitState.requestsPerMinute.remaining = this.rateLimitState.requestsPerMinute.limit;
      this.rateLimitState.requestsPerMinute.resetAt = new Date(now.getTime() + 60000);
    }
    
    if (now >= this.rateLimitState.requestsPerHour.resetAt) {
      this.rateLimitState.requestsPerHour.remaining = this.rateLimitState.requestsPerHour.limit;
      this.rateLimitState.requestsPerHour.resetAt = new Date(now.getTime() + 3600000);
    }

    // Check if we can make a request
    if (this.rateLimitState.requestsPerMinute.remaining <= 0 || 
        this.rateLimitState.requestsPerHour.remaining <= 0) {
      
      this.metrics.rateLimiting.rateLimitHits++;
      this.emit('rate_limit_hit', { 
        type: 'rate_limit_hit', 
        timestamp: new Date(), 
        data: this.rateLimitState 
      });

      const waitTime = Math.min(
        this.rateLimitState.requestsPerMinute.resetAt.getTime() - now.getTime(),
        this.rateLimitState.requestsPerHour.resetAt.getTime() - now.getTime()
      );

      throw this.createApiError('RATE_LIMIT_EXCEEDED', `Rate limit exceeded, wait ${waitTime}ms`, 429, true);
    }

    // Decrement rate limit counters
    this.rateLimitState.requestsPerMinute.remaining--;
    this.rateLimitState.requestsPerHour.remaining--;
  }

  private async waitForAvailableSlot(): Promise<void> {
    while (this.rateLimitState.concurrentRequests.current >= this.rateLimitState.concurrentRequests.maximum) {
      await this.wait(100); // Wait 100ms and check again
    }
    this.rateLimitState.concurrentRequests.current++;
  }

  /**
   * Circuit breaker management
   */
  private updateCircuitBreakerSuccess(): void {
    this.circuitBreakerStatus.requestCount++;
    this.circuitBreakerStatus.successCount++;
    
    if (this.circuitBreakerStatus.state === 'half-open' && 
        this.circuitBreakerStatus.successCount >= 3) {
      this.circuitBreakerStatus.state = 'closed';
      this.circuitBreakerStatus.failureCount = 0;
      this.emit('circuit_breaker_closed', { 
        type: 'circuit_breaker_closed', 
        timestamp: new Date(), 
        data: this.circuitBreakerStatus 
      });
    }
  }

  private updateCircuitBreakerFailure(): void {
    this.circuitBreakerStatus.requestCount++;
    this.circuitBreakerStatus.failureCount++;

    if (this.circuitBreakerStatus.failureCount >= this.config.circuitBreaker.failureThreshold &&
        this.circuitBreakerStatus.requestCount >= this.config.circuitBreaker.minimumRequestCount) {
      
      this.circuitBreakerStatus.state = 'open';
      this.circuitBreakerStatus.lastFailureAt = new Date();
      this.circuitBreakerStatus.nextAttemptAt = new Date(Date.now() + this.config.circuitBreaker.timeoutMs);
      
      this.metrics.circuitBreaker.openCount++;
      
      this.emit('circuit_breaker_opened', { 
        type: 'circuit_breaker_opened', 
        timestamp: new Date(), 
        data: this.circuitBreakerStatus 
      });

      // Schedule half-open attempt
      setTimeout(() => {
        if (this.circuitBreakerStatus.state === 'open') {
          this.circuitBreakerStatus.state = 'half-open';
          this.metrics.circuitBreaker.halfOpenCount++;
        }
      }, this.config.circuitBreaker.timeoutMs);
    }
  }

  /**
   * Utility methods
   */
  private generateRequestId(): string {
    return `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private generateBatchId(): string {
    return `batch_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private calculateRetryDelay(retryCount: number): number {
    const baseDelay = this.config.retryConfig.initialDelayMs;
    const multiplier = this.config.retryConfig.backoffMultiplier;
    const maxDelay = this.config.retryConfig.maxDelayMs;
    
    const delay = Math.min(baseDelay * Math.pow(multiplier, retryCount), maxDelay);
    
    // Add jitter to prevent thundering herd
    return delay + Math.random() * 1000;
  }

  private shouldRetry(error: ApiError, retryCount: number): boolean {
    if (retryCount >= this.config.maxRetries) {
      return false;
    }

    if (error.retryable === false) {
      return false;
    }

    // Check retryable status codes
    if (error.statusCode && this.config.retryConfig.retryableStatusCodes.includes(error.statusCode)) {
      return true;
    }

    // Check retryable error codes
    return this.config.retryConfig.retryableErrors.includes(error.code);
  }

  private async parseErrorResponse(response: Response): Promise<ApiError> {
    try {
      const errorData = await response.json();
      return this.createApiError(
        errorData.code || 'API_ERROR',
        errorData.message || response.statusText,
        response.status,
        [408, 429, 500, 502, 503, 504].includes(response.status)
      );
    } catch {
      return this.createApiError(
        'API_ERROR',
        response.statusText || 'Unknown API error',
        response.status,
        [408, 429, 500, 502, 503, 504].includes(response.status)
      );
    }
  }

  private createApiError(code: string, message: string, statusCode?: number, retryable?: boolean): ApiError {
    return {
      code,
      message,
      statusCode,
      retryable: retryable || false
    };
  }

  private normalizeError(error: any): ApiError {
    if (error && typeof error === 'object' && 'code' in error) {
      return error as ApiError;
    }

    if (error instanceof AuthError) {
      return {
        code: error.code,
        message: error.message,
        statusCode: error.statusCode,
        retryable: error.retryable
      };
    }

    return {
      code: 'UNKNOWN_ERROR',
      message: error instanceof Error ? error.message : String(error),
      retryable: false
    };
  }

  private updateMetrics(success: boolean, responseTime: number): void {
    this.metrics.requests.total++;
    
    if (success) {
      this.metrics.requests.successful++;
    } else {
      this.metrics.requests.failed++;
    }

    // Update average response time
    const total = this.metrics.requests.total;
    this.metrics.requests.averageResponseTimeMs = 
      (this.metrics.requests.averageResponseTimeMs * (total - 1) + responseTime) / total;

    // Update circuit breaker state in metrics
    this.metrics.circuitBreaker.state = this.circuitBreakerStatus.state;
  }

  private updateRateLimitFromHeaders(headers: Headers): void {
    const remaining = headers.get('x-ratelimit-remaining-minute');
    const resetAt = headers.get('x-ratelimit-reset-minute');
    
    if (remaining) {
      this.rateLimitState.requestsPerMinute.remaining = parseInt(remaining, 10);
    }
    
    if (resetAt) {
      this.rateLimitState.requestsPerMinute.resetAt = new Date(parseInt(resetAt, 10) * 1000);
    }
  }

  private headersToObject(headers: Headers): Record<string, string> {
    const obj: Record<string, string> = {};
    headers.forEach((value, key) => {
      obj[key] = value;
    });
    return obj;
  }

  private setupRateLimitReset(): void {
    setInterval(() => {
      const now = new Date();
      
      if (now >= this.rateLimitState.requestsPerMinute.resetAt) {
        this.rateLimitState.requestsPerMinute.remaining = this.rateLimitState.requestsPerMinute.limit;
        this.rateLimitState.requestsPerMinute.resetAt = new Date(now.getTime() + 60000);
      }
      
      if (now >= this.rateLimitState.requestsPerHour.resetAt) {
        this.rateLimitState.requestsPerHour.remaining = this.rateLimitState.requestsPerHour.limit;
        this.rateLimitState.requestsPerHour.resetAt = new Date(now.getTime() + 3600000);
      }
    }, 60000); // Check every minute
  }

  private wait(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  public destroy(): void {
    // Cancel all active requests
    this.activeRequests.forEach(controller => controller.abort());
    this.activeRequests.clear();
    
    // Clear request queue
    this.requestQueue = [];
    
    // Remove all listeners
    this.removeAllListeners();
    
    // Destroy auth manager
    this.authManager.destroy();
  }
}

// Factory function
export const createNanoBananaClient = (authManager?: AuthTokenManager): NanoBananaClient => {
  return new NanoBananaClient(authManager);
};

// Singleton instance
let defaultClient: NanoBananaClient | null = null;

export const getDefaultNanoBananaClient = (): NanoBananaClient => {
  if (!defaultClient) {
    defaultClient = new NanoBananaClient();
  }
  return defaultClient;
};

export default NanoBananaClient;