/**
 * Generation Metrics Middleware
 * Express middleware for tracking HTTP requests, responses, and generation-specific metrics
 * Integrates with the metrics collector for comprehensive monitoring
 */

import { Request, Response, NextFunction } from 'express';
import { MetricsCollector, getDefaultMetricsCollector } from '../utils/metricsCollector';
import { StatusTracker, getDefaultStatusTracker } from '../services/statusTracker';
import {
  GenerationJob,
  GenerationEvent,
  isCharacterGenerationJob,
  isBatchGenerationJob,
  isSingleGenerationJob
} from '../types/generation';

export interface GenerationMetricsConfig {
  enableRequestTracking: boolean;
  enableResponseTracking: boolean;
  enableUserTracking: boolean;
  enableErrorTracking: boolean;
  enablePerformanceTracking: boolean;
  trackRequestBody: boolean;
  trackResponseBody: boolean;
  maxBodySize: number;
  enableRouteGrouping: boolean;
  routePatterns: Record<string, string>;
  excludeRoutes: string[];
  enableDetailedMetrics: boolean;
  trackGenerationLifecycle: boolean;
}

export interface RequestMetrics {
  requestId: string;
  method: string;
  url: string;
  route?: string;
  userAgent?: string;
  userId?: string;
  requestSize: number;
  startTime: Date;
  headers: Record<string, string>;
  body?: any;
  ip: string;
}

export interface ResponseMetrics {
  requestId: string;
  statusCode: number;
  responseSize: number;
  responseTime: number;
  endTime: Date;
  headers: Record<string, string>;
  body?: any;
  error?: Error;
}

export interface GenerationRequestData {
  jobId?: string;
  jobType?: 'character' | 'batch' | 'single';
  userId?: string;
  priority?: string;
  variations?: number;
  batchSize?: number;
  generationParams?: any;
}

declare global {
  namespace Express {
    interface Request {
      metrics?: {
        requestId: string;
        startTime: Date;
        generationData?: GenerationRequestData;
      };
    }
  }
}

export class GenerationMetricsMiddleware {
  private config: GenerationMetricsConfig;
  private metricsCollector: MetricsCollector;
  private statusTracker: StatusTracker;
  private activeRequests = new Map<string, RequestMetrics>();

  constructor(
    metricsCollector?: MetricsCollector,
    statusTracker?: StatusTracker,
    config?: Partial<GenerationMetricsConfig>
  ) {
    this.metricsCollector = metricsCollector || getDefaultMetricsCollector();
    this.statusTracker = statusTracker || getDefaultStatusTracker();
    
    this.config = {
      enableRequestTracking: true,
      enableResponseTracking: true,
      enableUserTracking: true,
      enableErrorTracking: true,
      enablePerformanceTracking: true,
      trackRequestBody: false,
      trackResponseBody: false,
      maxBodySize: 10240, // 10KB
      enableRouteGrouping: true,
      routePatterns: {
        '/api/characters/:id': '/api/characters/*',
        '/api/generations/:id': '/api/generations/*',
        '/api/users/:id': '/api/users/*'
      },
      excludeRoutes: ['/health', '/metrics', '/ping'],
      enableDetailedMetrics: true,
      trackGenerationLifecycle: true,
      ...config
    };

    if (this.config.trackGenerationLifecycle) {
      this.setupGenerationTracking();
    }
  }

  /**
   * Main middleware function for Express
   */
  public middleware = (req: Request, res: Response, next: NextFunction): void => {
    const startTime = new Date();
    const requestId = this.generateRequestId();

    // Skip excluded routes
    if (this.isExcludedRoute(req.path)) {
      return next();
    }

    // Initialize request metrics
    req.metrics = {
      requestId,
      startTime,
      generationData: this.extractGenerationData(req)
    };

    const requestMetrics: RequestMetrics = {
      requestId,
      method: req.method,
      url: req.url,
      route: this.normalizeRoute(req.route?.path || req.path),
      userAgent: req.headers['user-agent'],
      userId: this.extractUserId(req),
      requestSize: this.calculateRequestSize(req),
      startTime,
      headers: this.sanitizeHeaders(req.headers),
      body: this.config.trackRequestBody ? this.sanitizeBody(req.body) : undefined,
      ip: this.getClientIP(req)
    };

    this.activeRequests.set(requestId, requestMetrics);

    // Track request metrics
    if (this.config.enableRequestTracking) {
      this.trackRequestStart(requestMetrics);
    }

    // Override res.end to capture response metrics
    const originalEnd = res.end;
    const originalWrite = res.write;
    const chunks: Buffer[] = [];

    // Capture response data
    if (this.config.enableResponseTracking && this.config.trackResponseBody) {
      res.write = function(chunk: any, encoding?: string): boolean {
        if (chunk) {
          chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk, encoding as BufferEncoding));
        }
        return originalWrite.call(res, chunk, encoding);
      };
    }

    // Capture response end
    res.end = (chunk?: any, encoding?: string, cb?: (() => void)): Response => {
      if (chunk && this.config.trackResponseBody) {
        chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk, encoding as BufferEncoding));
      }

      const endTime = new Date();
      const responseTime = endTime.getTime() - startTime.getTime();

      const responseMetrics: ResponseMetrics = {
        requestId,
        statusCode: res.statusCode,
        responseSize: this.calculateResponseSize(res, chunks),
        responseTime,
        endTime,
        headers: this.sanitizeHeaders(res.getHeaders()),
        body: this.config.trackResponseBody ? this.parseResponseBody(chunks) : undefined,
        error: res.statusCode >= 400 ? new Error(`HTTP ${res.statusCode}`) : undefined
      };

      // Track response metrics
      if (this.config.enableResponseTracking) {
        this.trackRequestEnd(requestMetrics, responseMetrics);
      }

      // Clean up
      this.activeRequests.delete(requestId);

      return originalEnd.call(res, chunk, encoding, cb);
    };

    // Error handling
    res.on('error', (error: Error) => {
      this.trackRequestError(requestMetrics, error);
    });

    next();
  };

  /**
   * Middleware specifically for generation endpoints
   */
  public generationMiddleware = (req: Request, res: Response, next: NextFunction): void => {
    if (!req.metrics) {
      return next();
    }

    // Extract and enrich generation data
    const generationData = this.extractGenerationData(req);
    if (generationData) {
      req.metrics.generationData = generationData;
      
      // Track generation request initiation
      this.trackGenerationRequest(generationData, req.metrics.requestId);
    }

    next();
  };

  /**
   * Get current request metrics
   */
  public getActiveRequests(): RequestMetrics[] {
    return Array.from(this.activeRequests.values());
  }

  /**
   * Get metrics for a specific request
   */
  public getRequestMetrics(requestId: string): RequestMetrics | undefined {
    return this.activeRequests.get(requestId);
  }

  /**
   * Force cleanup of stale requests
   */
  public cleanup(maxAge: number = 300000): number { // 5 minutes default
    const cutoff = new Date(Date.now() - maxAge);
    let cleaned = 0;

    for (const [requestId, metrics] of this.activeRequests.entries()) {
      if (metrics.startTime < cutoff) {
        this.activeRequests.delete(requestId);
        cleaned++;
      }
    }

    return cleaned;
  }

  /**
   * Private helper methods
   */

  private setupGenerationTracking(): void {
    // Listen to generation events from status tracker
    this.statusTracker.on('job_event', (event: GenerationEvent) => {
      this.trackGenerationEvent(event);
    });
  }

  private trackRequestStart(metrics: RequestMetrics): void {
    const tags = {
      method: metrics.method,
      route: metrics.route || 'unknown',
      user_agent: this.categorizeUserAgent(metrics.userAgent),
      ...(metrics.userId && { user_id: metrics.userId })
    };

    // Basic request metrics
    this.metricsCollector.recordMetric('http.requests.started', 1, 'count', tags);
    this.metricsCollector.recordMetric('http.request.size', metrics.requestSize, 'bytes', tags);

    // User tracking
    if (this.config.enableUserTracking && metrics.userId) {
      this.metricsCollector.recordMetric('users.requests', 1, 'count', {
        user_id: metrics.userId,
        endpoint: metrics.route || 'unknown'
      });
    }

    // Performance tracking
    if (this.config.enablePerformanceTracking) {
      this.metricsCollector.recordMetric('http.concurrent_requests', this.activeRequests.size, 'gauge');
    }
  }

  private trackRequestEnd(requestMetrics: RequestMetrics, responseMetrics: ResponseMetrics): void {
    const tags = {
      method: requestMetrics.method,
      route: requestMetrics.route || 'unknown',
      status_code: responseMetrics.statusCode.toString(),
      status_class: Math.floor(responseMetrics.statusCode / 100) + 'xx'
    };

    // Record API metrics through the collector
    this.metricsCollector.recordApiMetrics(
      requestMetrics.route || requestMetrics.url,
      requestMetrics.method,
      responseMetrics.statusCode,
      responseMetrics.responseTime,
      requestMetrics.requestSize,
      responseMetrics.responseSize
    );

    // Additional HTTP metrics
    this.metricsCollector.recordMetric('http.requests.completed', 1, 'count', tags);
    this.metricsCollector.recordMetric('http.response.size', responseMetrics.responseSize, 'bytes', tags);

    // Success/error tracking
    if (responseMetrics.statusCode >= 200 && responseMetrics.statusCode < 300) {
      this.metricsCollector.recordMetric('http.requests.success', 1, 'count', tags);
    } else if (responseMetrics.statusCode >= 400) {
      this.metricsCollector.recordMetric('http.requests.error', 1, 'count', {
        ...tags,
        error_type: this.categorizeHttpError(responseMetrics.statusCode)
      });
    }

    // Performance metrics
    if (this.config.enablePerformanceTracking) {
      // Slow request detection
      if (responseMetrics.responseTime > 5000) { // 5 seconds
        this.metricsCollector.recordMetric('http.requests.slow', 1, 'count', tags);
      }

      // Response time percentiles
      this.metricsCollector.recordMetric('http.response_time.p50', responseMetrics.responseTime, 'ms', tags);
      this.metricsCollector.recordMetric('http.response_time.p95', responseMetrics.responseTime, 'ms', tags);
      this.metricsCollector.recordMetric('http.response_time.p99', responseMetrics.responseTime, 'ms', tags);
    }

    // Generation-specific metrics
    if (requestMetrics.userId && this.isGenerationEndpoint(requestMetrics.route)) {
      this.trackGenerationCompletion(requestMetrics, responseMetrics);
    }
  }

  private trackRequestError(requestMetrics: RequestMetrics, error: Error): void {
    const tags = {
      method: requestMetrics.method,
      route: requestMetrics.route || 'unknown',
      error_type: error.name || 'unknown'
    };

    this.metricsCollector.recordMetric('http.requests.error', 1, 'count', tags);
    
    if (this.config.enableErrorTracking) {
      this.metricsCollector.recordMetric('http.errors.by_type', 1, 'count', {
        ...tags,
        error_message: error.message.substring(0, 100) // Truncate error message
      });
    }
  }

  private trackGenerationRequest(data: GenerationRequestData, requestId: string): void {
    if (!data.jobType) return;

    const tags = {
      job_type: data.jobType,
      request_id: requestId,
      ...(data.userId && { user_id: data.userId }),
      ...(data.priority && { priority: data.priority })
    };

    this.metricsCollector.recordMetric('generation.requests.initiated', 1, 'count', tags);

    // Type-specific metrics
    if (data.jobType === 'character' && data.variations) {
      this.metricsCollector.recordMetric('generation.character.variations_requested', data.variations, 'count', tags);
    } else if (data.jobType === 'batch' && data.batchSize) {
      this.metricsCollector.recordMetric('generation.batch.size_requested', data.batchSize, 'count', tags);
    }

    // Parameter tracking
    if (data.generationParams) {
      this.trackGenerationParameters(data.generationParams, tags);
    }
  }

  private trackGenerationCompletion(requestMetrics: RequestMetrics, responseMetrics: ResponseMetrics): void {
    const generationData = requestMetrics.userId; // This would be more complex in real implementation

    const tags = {
      method: requestMetrics.method,
      route: requestMetrics.route || 'unknown',
      status_code: responseMetrics.statusCode.toString(),
      ...(generationData && { user_id: generationData })
    };

    if (responseMetrics.statusCode >= 200 && responseMetrics.statusCode < 300) {
      this.metricsCollector.recordMetric('generation.requests.successful', 1, 'count', tags);
    } else {
      this.metricsCollector.recordMetric('generation.requests.failed', 1, 'count', tags);
    }

    // Track generation API response times separately
    this.metricsCollector.recordMetric('generation.api.response_time', responseMetrics.responseTime, 'ms', tags);
  }

  private trackGenerationEvent(event: GenerationEvent): void {
    const job = this.statusTracker.getJobStatus(event.jobId);
    if (!job) return;

    const baseMetrics = {
      job_id: event.jobId,
      job_type: job.type,
      event_type: event.type,
      ...(job.userId && { user_id: job.userId })
    };

    // Record the generation event
    this.metricsCollector.recordJobMetrics(job, event);

    // Additional lifecycle tracking
    switch (event.type) {
      case 'job_started':
        this.trackGenerationStarted(job, event);
        break;
      case 'job_completed':
        this.trackGenerationCompleted(job, event);
        break;
      case 'job_failed':
        this.trackGenerationFailed(job, event);
        break;
      case 'job_progress':
        this.trackGenerationProgress(job, event);
        break;
    }
  }

  private trackGenerationStarted(job: GenerationJob, event: GenerationEvent): void {
    const waitTime = job.updatedAt.getTime() - job.createdAt.getTime();
    
    this.metricsCollector.recordMetric('generation.queue.wait_time', waitTime, 'ms', {
      job_type: job.type,
      priority: job.priority
    });
  }

  private trackGenerationCompleted(job: GenerationJob, event: GenerationEvent): void {
    if (!job.completedAt) return;

    const totalTime = job.completedAt.getTime() - job.createdAt.getTime();
    
    this.metricsCollector.recordMetric('generation.completion.total_time', totalTime, 'ms', {
      job_type: job.type,
      priority: job.priority
    });

    // Success rate tracking
    this.metricsCollector.recordMetric('generation.success_rate', 1, 'count', {
      job_type: job.type
    });
  }

  private trackGenerationFailed(job: GenerationJob, event: GenerationEvent): void {
    const error = job.error;
    if (!error) return;

    this.metricsCollector.recordMetric('generation.failures', 1, 'count', {
      job_type: job.type,
      error_code: error.code,
      retryable: error.retryable.toString()
    });
  }

  private trackGenerationProgress(job: GenerationJob, event: GenerationEvent): void {
    const progress = this.extractJobProgress(job);
    if (!progress) return;

    this.metricsCollector.recordMetric('generation.progress.percentage', progress.percentage, 'percent', {
      job_id: job.id,
      stage: progress.stage
    });

    if (progress.estimatedTimeRemainingMs) {
      this.metricsCollector.recordMetric('generation.progress.eta', progress.estimatedTimeRemainingMs, 'ms', {
        job_id: job.id,
        stage: progress.stage
      });
    }
  }

  private trackGenerationParameters(params: any, baseTags: Record<string, string>): void {
    if (params.quality) {
      this.metricsCollector.recordMetric('generation.params.quality', 1, 'count', {
        ...baseTags,
        quality: params.quality
      });
    }

    if (params.aspectRatio) {
      this.metricsCollector.recordMetric('generation.params.aspect_ratio', 1, 'count', {
        ...baseTags,
        aspect_ratio: params.aspectRatio
      });
    }

    if (params.style) {
      this.metricsCollector.recordMetric('generation.params.style', 1, 'count', {
        ...baseTags,
        style: params.style
      });
    }
  }

  private extractGenerationData(req: Request): GenerationRequestData | undefined {
    // Extract generation-specific data from request
    const body = req.body || {};
    const params = req.params || {};
    const query = req.query || {};

    // This would be more sophisticated in a real implementation
    if (this.isGenerationEndpoint(req.path)) {
      return {
        jobId: params.jobId || body.jobId,
        jobType: this.inferJobType(req.path, body),
        userId: this.extractUserId(req),
        priority: body.priority || 'normal',
        variations: body.variations || body.generationParams?.variations,
        batchSize: body.requests?.length || body.batchSize,
        generationParams: body.generationParams
      };
    }

    return undefined;
  }

  private extractUserId(req: Request): string | undefined {
    // Extract user ID from various sources
    return req.headers['x-user-id'] as string ||
           req.user?.id ||
           req.params.userId ||
           req.body.userId ||
           req.query.userId as string;
  }

  private extractJobProgress(job: GenerationJob): any {
    if ('progress' in job) {
      return job.progress;
    }
    return undefined;
  }

  private normalizeRoute(path: string): string {
    if (!this.config.enableRouteGrouping) {
      return path;
    }

    // Apply route patterns for grouping
    for (const [pattern, normalized] of Object.entries(this.config.routePatterns)) {
      const regex = new RegExp(pattern.replace(/:[^/]+/g, '[^/]+'));
      if (regex.test(path)) {
        return normalized;
      }
    }

    return path;
  }

  private isExcludedRoute(path: string): boolean {
    return this.config.excludeRoutes.some(route => path.includes(route));
  }

  private isGenerationEndpoint(path?: string): boolean {
    if (!path) return false;
    return path.includes('/generate') || 
           path.includes('/character') || 
           path.includes('/batch') ||
           path.includes('/api/generations');
  }

  private inferJobType(path: string, body: any): 'character' | 'batch' | 'single' | undefined {
    if (path.includes('/character') || body.characterSpecs) return 'character';
    if (path.includes('/batch') || body.requests) return 'batch';
    if (path.includes('/generate')) return 'single';
    return undefined;
  }

  private calculateRequestSize(req: Request): number {
    const bodySize = req.body ? JSON.stringify(req.body).length : 0;
    const headerSize = Object.keys(req.headers).reduce((size, key) => {
      return size + key.length + (req.headers[key]?.toString().length || 0);
    }, 0);
    
    return bodySize + headerSize;
  }

  private calculateResponseSize(res: Response, chunks: Buffer[]): number {
    const bodySize = chunks.reduce((total, chunk) => total + chunk.length, 0);
    const headerSize = Object.keys(res.getHeaders()).reduce((size, key) => {
      const value = res.getHeaders()[key];
      return size + key.length + (value?.toString().length || 0);
    }, 0);
    
    return bodySize + headerSize;
  }

  private sanitizeHeaders(headers: any): Record<string, string> {
    const sanitized: Record<string, string> = {};
    const sensitiveHeaders = ['authorization', 'cookie', 'x-api-key', 'x-auth-token'];
    
    for (const [key, value] of Object.entries(headers)) {
      if (sensitiveHeaders.includes(key.toLowerCase())) {
        sanitized[key] = '[REDACTED]';
      } else {
        sanitized[key] = String(value);
      }
    }
    
    return sanitized;
  }

  private sanitizeBody(body: any): any {
    if (!body || typeof body !== 'object') return body;
    
    const sanitized = { ...body };
    const sensitiveFields = ['password', 'secret', 'token', 'key', 'apiKey'];
    
    for (const field of sensitiveFields) {
      if (sanitized[field]) {
        sanitized[field] = '[REDACTED]';
      }
    }
    
    return sanitized;
  }

  private parseResponseBody(chunks: Buffer[]): any {
    if (chunks.length === 0) return undefined;
    
    try {
      const body = Buffer.concat(chunks).toString();
      if (body.length > this.config.maxBodySize) {
        return '[TRUNCATED - Body too large]';
      }
      
      return JSON.parse(body);
    } catch {
      return '[UNPARSEABLE]';
    }
  }

  private getClientIP(req: Request): string {
    const forwarded = req.headers['x-forwarded-for'] as string;
    if (forwarded) {
      return forwarded.split(',')[0].trim();
    }
    return req.connection.remoteAddress || req.socket.remoteAddress || 'unknown';
  }

  private categorizeUserAgent(userAgent?: string): string {
    if (!userAgent) return 'unknown';
    
    const lower = userAgent.toLowerCase();
    if (lower.includes('bot') || lower.includes('crawler')) return 'bot';
    if (lower.includes('mobile')) return 'mobile';
    if (lower.includes('tablet')) return 'tablet';
    if (lower.includes('curl') || lower.includes('wget')) return 'cli';
    return 'browser';
  }

  private categorizeHttpError(statusCode: number): string {
    if (statusCode >= 400 && statusCode < 500) return 'client_error';
    if (statusCode >= 500) return 'server_error';
    return 'unknown';
  }

  private generateRequestId(): string {
    return `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
}

// Factory function
export const createGenerationMetricsMiddleware = (
  metricsCollector?: MetricsCollector,
  statusTracker?: StatusTracker,
  config?: Partial<GenerationMetricsConfig>
): GenerationMetricsMiddleware => {
  return new GenerationMetricsMiddleware(metricsCollector, statusTracker, config);
};

// Default singleton instance
let defaultMiddleware: GenerationMetricsMiddleware | null = null;

export const getDefaultGenerationMetricsMiddleware = (): GenerationMetricsMiddleware => {
  if (!defaultMiddleware) {
    defaultMiddleware = new GenerationMetricsMiddleware();
  }
  return defaultMiddleware;
};

// Convenience function to get just the middleware function
export const generationMetricsMiddleware = (
  config?: Partial<GenerationMetricsConfig>
): ((req: Request, res: Response, next: NextFunction) => void) => {
  const middleware = createGenerationMetricsMiddleware(undefined, undefined, config);
  return middleware.middleware;
};

export default GenerationMetricsMiddleware;