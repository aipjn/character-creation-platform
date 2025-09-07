/**
 * Logging Middleware
 * Enhanced request/response logging with structured output and metrics
 */

import { Request, Response, NextFunction } from 'express';
import { ApiRequest, LogContext, LogLevel } from '../types/api';

/**
 * Configuration for logging middleware
 */
export interface LoggingConfig {
  enableRequestLogging: boolean;
  enableResponseLogging: boolean;
  enableStructuredLogging: boolean;
  enableSlowRequestLogging: boolean;
  slowRequestThreshold: number; // milliseconds
  logLevel: LogLevel;
  excludePaths: string[];
  includeRequestBody: boolean;
  includeResponseBody: boolean;
  maxBodySize: number; // bytes
}

/**
 * Default logging configuration
 */
export const DEFAULT_LOGGING_CONFIG: LoggingConfig = {
  enableRequestLogging: true,
  enableResponseLogging: true,
  enableStructuredLogging: process.env.NODE_ENV === 'production',
  enableSlowRequestLogging: true,
  slowRequestThreshold: 5000, // 5 seconds
  logLevel: (process.env.LOG_LEVEL as LogLevel) || 'info',
  excludePaths: ['/health', '/favicon.ico', '/robots.txt'],
  includeRequestBody: false, // Be careful with sensitive data
  includeResponseBody: false, // Be careful with large responses
  maxBodySize: 10240 // 10KB
};

/**
 * Enhanced request information interface
 */
export interface RequestInfo {
  requestId: string;
  method: string;
  url: string;
  path: string;
  query: any;
  headers: Record<string, string | string[] | undefined>;
  userAgent?: string;
  referer?: string;
  ip: string;
  body?: any;
  timestamp: string;
  userId?: string;
}

/**
 * Enhanced response information interface
 */
export interface ResponseInfo {
  statusCode: number;
  statusMessage: string;
  headers: Record<string, string | string[] | number | undefined>;
  body?: any;
  responseTime: number;
  timestamp: string;
}

/**
 * Log entry structure for structured logging
 */
export interface LogEntry {
  level: LogLevel;
  timestamp: string;
  requestId: string;
  message: string;
  context: LogContext;
  request?: RequestInfo;
  response?: ResponseInfo;
  error?: {
    name: string;
    message: string;
    stack?: string;
  };
}

/**
 * Logger class for structured logging
 */
export class ApiLogger {
  private config: LoggingConfig;

  constructor(config: Partial<LoggingConfig> = {}) {
    this.config = { ...DEFAULT_LOGGING_CONFIG, ...config };
  }

  /**
   * Should log based on path exclusions
   */
  private shouldLog(path: string): boolean {
    return !this.config.excludePaths.some(excludePath => 
      path.startsWith(excludePath)
    );
  }

  /**
   * Should include body based on size and config
   */
  private shouldIncludeBody(body: any, include: boolean): any {
    if (!include || !body) {
      return undefined;
    }

    try {
      const bodyString = typeof body === 'string' ? body : JSON.stringify(body);
      if (bodyString.length > this.config.maxBodySize) {
        return `[Body too large: ${bodyString.length} bytes]`;
      }
      return body;
    } catch {
      return '[Body not serializable]';
    }
  }

  /**
   * Sanitize headers to remove sensitive information
   */
  private sanitizeHeaders(headers: Record<string, any>): Record<string, any> {
    const sensitiveHeaders = ['authorization', 'cookie', 'x-api-key', 'x-auth-token'];
    const sanitized = { ...headers };
    
    sensitiveHeaders.forEach(header => {
      if (sanitized[header]) {
        sanitized[header] = '[REDACTED]';
      }
    });

    return sanitized;
  }

  /**
   * Create log context from request and response
   */
  private createLogContext(req: ApiRequest, res?: Response, responseTime?: number): LogContext {
    return {
      requestId: req.requestId,
      userId: req.user?.id,
      path: req.path,
      method: req.method,
      statusCode: res?.statusCode,
      responseTime,
      userAgent: req.get('User-Agent'),
      ip: req.ip
    };
  }

  /**
   * Create request info object
   */
  private createRequestInfo(req: ApiRequest): RequestInfo {
    return {
      requestId: req.requestId,
      method: req.method,
      url: req.url,
      path: req.path,
      query: req.query,
      headers: this.sanitizeHeaders(req.headers),
      userAgent: req.get('User-Agent'),
      referer: req.get('Referer'),
      ip: req.ip,
      body: this.shouldIncludeBody(req.body, this.config.includeRequestBody),
      timestamp: new Date().toISOString(),
      userId: req.user?.id
    };
  }

  /**
   * Create response info object
   */
  private createResponseInfo(res: Response, responseTime: number, body?: any): ResponseInfo {
    return {
      statusCode: res.statusCode,
      statusMessage: res.statusMessage,
      headers: this.sanitizeHeaders(res.getHeaders()),
      body: this.shouldIncludeBody(body, this.config.includeResponseBody),
      responseTime,
      timestamp: new Date().toISOString()
    };
  }

  /**
   * Log structured entry
   */
  private logStructured(entry: LogEntry): void {
    const logMethod = entry.level === 'error' ? console.error : 
                     entry.level === 'warn' ? console.warn : 
                     entry.level === 'debug' ? console.debug : console.log;
    
    logMethod(JSON.stringify(entry, null, this.config.logLevel === 'debug' ? 2 : 0));
  }

  /**
   * Log simple format
   */
  private logSimple(level: LogLevel, message: string): void {
    const timestamp = new Date().toISOString();
    const logMethod = level === 'error' ? console.error : 
                     level === 'warn' ? console.warn : 
                     level === 'debug' ? console.debug : console.log;
    
    logMethod(`${timestamp} [${level.toUpperCase()}] ${message}`);
  }

  /**
   * Log request
   */
  logRequest(req: ApiRequest): void {
    if (!this.config.enableRequestLogging || !this.shouldLog(req.path)) {
      return;
    }

    const context = this.createLogContext(req);
    const message = `${req.method} ${req.path} - ${req.ip}`;

    if (this.config.enableStructuredLogging) {
      const entry: LogEntry = {
        level: 'info',
        timestamp: new Date().toISOString(),
        requestId: req.requestId,
        message: `Request: ${message}`,
        context,
        request: this.createRequestInfo(req)
      };
      
      this.logStructured(entry);
    } else {
      this.logSimple('info', `Request: ${message}`);
    }
  }

  /**
   * Log response
   */
  logResponse(req: ApiRequest, res: Response, responseTime: number, body?: any): void {
    if (!this.config.enableResponseLogging || !this.shouldLog(req.path)) {
      return;
    }

    const context = this.createLogContext(req, res, responseTime);
    const level: LogLevel = res.statusCode >= 500 ? 'error' : 
                           res.statusCode >= 400 ? 'warn' : 'info';
    const message = `${req.method} ${req.path} - ${res.statusCode} - ${responseTime}ms - ${req.ip}`;

    // Log slow requests
    if (this.config.enableSlowRequestLogging && responseTime > this.config.slowRequestThreshold) {
      const slowMessage = `Slow request: ${message}`;
      if (this.config.enableStructuredLogging) {
        const entry: LogEntry = {
          level: 'warn',
          timestamp: new Date().toISOString(),
          requestId: req.requestId,
          message: slowMessage,
          context,
          request: this.createRequestInfo(req),
          response: this.createResponseInfo(res, responseTime, body)
        };
        
        this.logStructured(entry);
      } else {
        this.logSimple('warn', slowMessage);
      }
    }

    // Log regular response
    if (this.config.enableStructuredLogging) {
      const entry: LogEntry = {
        level,
        timestamp: new Date().toISOString(),
        requestId: req.requestId,
        message: `Response: ${message}`,
        context,
        request: this.createRequestInfo(req),
        response: this.createResponseInfo(res, responseTime, body)
      };
      
      this.logStructured(entry);
    } else {
      this.logSimple(level, `Response: ${message}`);
    }
  }

  /**
   * Log error
   */
  logError(req: ApiRequest, error: Error, res?: Response): void {
    const context = this.createLogContext(req, res);
    const message = `Error in ${req.method} ${req.path}: ${error.message}`;

    if (this.config.enableStructuredLogging) {
      const entry: LogEntry = {
        level: 'error',
        timestamp: new Date().toISOString(),
        requestId: req.requestId,
        message,
        context,
        request: this.createRequestInfo(req),
        error: {
          name: error.name,
          message: error.message,
          stack: error.stack
        }
      };
      
      this.logStructured(entry);
    } else {
      this.logSimple('error', `${message}\n${error.stack}`);
    }
  }
}

/**
 * Default logger instance
 */
export const defaultLogger = new ApiLogger();

/**
 * Request logging middleware
 */
export const requestLogger = (config?: Partial<LoggingConfig>) => {
  const logger = config ? new ApiLogger(config) : defaultLogger;
  
  return (req: ApiRequest, res: Response, next: NextFunction): void => {
    const startTime = Date.now();
    
    // Ensure request has requestId
    if (!req.requestId) {
      req.requestId = `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    }

    // Log request
    logger.logRequest(req);

    // Capture original response methods to log response
    const originalSend = res.send;
    const originalJson = res.json;
    let responseBody: any;

    // Override send method to capture response body
    res.send = function(data: any) {
      responseBody = data;
      return originalSend.call(this, data);
    };

    // Override json method to capture response body
    res.json = function(data: any) {
      responseBody = data;
      return originalJson.call(this, data);
    };

    // Log response when finished
    const cleanup = () => {
      const responseTime = Date.now() - startTime;
      logger.logResponse(req, res, responseTime, responseBody);
    };

    res.on('finish', cleanup);
    res.on('close', cleanup);

    // Handle errors
    const originalNext = next;
    next = (error?: any) => {
      if (error) {
        logger.logError(req, error, res);
      }
      originalNext(error);
    };

    next();
  };
};

/**
 * Error logging middleware
 */
export const errorLogger = (config?: Partial<LoggingConfig>) => {
  const logger = config ? new ApiLogger(config) : defaultLogger;
  
  return (error: Error, req: ApiRequest, res: Response, next: NextFunction): void => {
    logger.logError(req, error, res);
    next(error);
  };
};

/**
 * Export logging utilities
 */
export {
  ApiLogger,
  LoggingConfig,
  DEFAULT_LOGGING_CONFIG,
  LogEntry,
  RequestInfo,
  ResponseInfo
};