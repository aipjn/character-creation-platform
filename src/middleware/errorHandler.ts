import { Request, Response, NextFunction } from 'express';
import { ValidationError } from './validation';

// Error response interface
export interface ErrorResponse {
  error: {
    message: string;
    code?: string;
    details?: string[];
    timestamp: string;
    path: string;
    requestId?: string;
  };
}

// Base error class for application errors
export class AppError extends Error {
  public statusCode: number;
  public code?: string;
  public isOperational: boolean;
  public details?: string[];

  constructor(
    message: string,
    statusCode: number = 500,
    code?: string,
    details?: string[],
    isOperational: boolean = true
  ) {
    super(message);
    this.name = this.constructor.name;
    this.statusCode = statusCode;
    this.code = code;
    this.details = details;
    this.isOperational = isOperational;

    Error.captureStackTrace(this, this.constructor);
  }
}

// Specific error classes
export class NotFoundError extends AppError {
  constructor(message: string = 'Resource not found', details?: string[]) {
    super(message, 404, 'NOT_FOUND', details);
  }
}

export class UnauthorizedError extends AppError {
  constructor(message: string = 'Unauthorized access', details?: string[]) {
    super(message, 401, 'UNAUTHORIZED', details);
  }
}

export class ForbiddenError extends AppError {
  constructor(message: string = 'Forbidden access', details?: string[]) {
    super(message, 403, 'FORBIDDEN', details);
  }
}

export class ConflictError extends AppError {
  constructor(message: string = 'Resource conflict', details?: string[]) {
    super(message, 409, 'CONFLICT', details);
  }
}

export class TooManyRequestsError extends AppError {
  constructor(message: string = 'Too many requests', details?: string[]) {
    super(message, 429, 'TOO_MANY_REQUESTS', details);
  }
}

export class BadRequestError extends AppError {
  constructor(message: string = 'Bad request', details?: string[]) {
    super(message, 400, 'BAD_REQUEST', details);
  }
}

export class InternalServerError extends AppError {
  constructor(message: string = 'Internal server error', details?: string[]) {
    super(message, 500, 'INTERNAL_SERVER_ERROR', details);
  }
}

export class ServiceUnavailableError extends AppError {
  constructor(message: string = 'Service temporarily unavailable', details?: string[]) {
    super(message, 503, 'SERVICE_UNAVAILABLE', details);
  }
}

// Database-specific errors
export class DatabaseError extends AppError {
  constructor(message: string = 'Database operation failed', details?: string[]) {
    super(message, 500, 'DATABASE_ERROR', details);
  }
}

export class DatabaseConnectionError extends DatabaseError {
  constructor(message: string = 'Database connection failed', details?: string[]) {
    super(message, 503, 'DATABASE_CONNECTION_ERROR', details);
  }
}

// File/Upload errors
export class FileUploadError extends AppError {
  constructor(message: string = 'File upload failed', details?: string[]) {
    super(message, 400, 'FILE_UPLOAD_ERROR', details);
  }
}

export class FileSizeError extends FileUploadError {
  constructor(message: string = 'File size exceeds limit', details?: string[]) {
    super(message, 400, 'FILE_SIZE_ERROR', details);
  }
}

export class FileTypeError extends FileUploadError {
  constructor(message: string = 'Invalid file type', details?: string[]) {
    super(message, 400, 'FILE_TYPE_ERROR', details);
  }
}

// External service errors
export class ExternalServiceError extends AppError {
  constructor(message: string = 'External service error', details?: string[]) {
    super(message, 502, 'EXTERNAL_SERVICE_ERROR', details);
  }
}

export class AIGenerationError extends ExternalServiceError {
  constructor(message: string = 'AI generation failed', details?: string[]) {
    super(message, 502, 'AI_GENERATION_ERROR', details);
  }
}

/**
 * Logger interface for error logging
 */
export interface Logger {
  error(message: string, meta?: any): void;
  warn(message: string, meta?: any): void;
  info(message: string, meta?: any): void;
}

// Simple console logger implementation
export const consoleLogger: Logger = {
  error: (message: string, meta?: any) => console.error(message, meta ? JSON.stringify(meta, null, 2) : ''),
  warn: (message: string, meta?: any) => console.warn(message, meta ? JSON.stringify(meta, null, 2) : ''),
  info: (message: string, meta?: any) => console.info(message, meta ? JSON.stringify(meta, null, 2) : '')
};

/**
 * Error handler middleware configuration
 */
export interface ErrorHandlerOptions {
  logger?: Logger;
  includeStackTrace?: boolean;
  trustProxy?: boolean;
}

/**
 * Generate request ID for tracking
 */
function generateRequestId(): string {
  return `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * Get client IP address
 */
function getClientIp(req: Request, trustProxy: boolean = false): string {
  if (trustProxy && req.headers['x-forwarded-for']) {
    return req.headers['x-forwarded-for'].toString().split(',')[0].trim();
  }
  return req.connection.remoteAddress || req.socket.remoteAddress || 'unknown';
}

/**
 * Sanitize error message for production
 */
function sanitizeErrorMessage(error: Error, isDevelopment: boolean): string {
  // In development, show original message
  if (isDevelopment) {
    return error.message;
  }

  // In production, sanitize certain error types
  if (error.name === 'CastError' || error.name === 'ValidationError') {
    return error.message;
  }

  // For internal errors, return generic message
  if (error instanceof AppError && error.statusCode >= 500) {
    return 'An internal error occurred';
  }

  return error.message;
}

/**
 * Handle Prisma/Database specific errors
 */
function handleDatabaseError(error: any): AppError {
  // Prisma Client errors
  if (error.code) {
    switch (error.code) {
      case 'P2002':
        return new ConflictError('A record with this data already exists', [error.message]);
      case 'P2025':
        return new NotFoundError('Record not found', [error.message]);
      case 'P2003':
        return new BadRequestError('Foreign key constraint failed', [error.message]);
      case 'P2011':
        return new BadRequestError('Null constraint violation', [error.message]);
      case 'P2012':
        return new BadRequestError('Missing required value', [error.message]);
      case 'P2014':
        return new BadRequestError('Invalid ID provided', [error.message]);
      case 'P1001':
        return new DatabaseConnectionError('Cannot reach database server', [error.message]);
      case 'P1002':
        return new DatabaseConnectionError('Database server timeout', [error.message]);
      case 'P1008':
        return new DatabaseConnectionError('Operations timed out', [error.message]);
      default:
        return new DatabaseError(`Database operation failed: ${error.code}`, [error.message]);
    }
  }

  return new DatabaseError('Database operation failed', [error.message]);
}

/**
 * Handle JSON parsing errors
 */
function handleJSONError(error: any): AppError {
  return new BadRequestError('Invalid JSON in request body', [error.message]);
}

/**
 * Handle multipart/form-data errors
 */
function handleMulterError(error: any): AppError {
  switch (error.code) {
    case 'LIMIT_FILE_SIZE':
      return new FileSizeError('File size too large', [error.message]);
    case 'LIMIT_FILE_COUNT':
      return new FileUploadError('Too many files', [error.message]);
    case 'LIMIT_UNEXPECTED_FILE':
      return new FileUploadError('Unexpected file field', [error.message]);
    default:
      return new FileUploadError('File upload failed', [error.message]);
  }
}

/**
 * Main error handling middleware
 */
export function createErrorHandler(options: ErrorHandlerOptions = {}) {
  const {
    logger = consoleLogger,
    includeStackTrace = process.env.NODE_ENV === 'development',
    trustProxy = false
  } = options;

  return (error: Error, req: Request, res: Response, next: NextFunction): void => {
    // Skip if response already sent
    if (res.headersSent) {
      return next(error);
    }

    let appError: AppError;

    // Convert known error types to AppError
    if (error instanceof ValidationError) {
      appError = new BadRequestError(error.message, 400, 'VALIDATION_ERROR', error.errors);
    } else if (error instanceof AppError) {
      appError = error;
    } else if (error.name === 'SyntaxError' && 'body' in error) {
      appError = handleJSONError(error);
    } else if (error.name === 'MulterError') {
      appError = handleMulterError(error);
    } else if (error.code && typeof error.code === 'string' && error.code.startsWith('P')) {
      appError = handleDatabaseError(error);
    } else {
      // Unknown error - treat as internal server error
      appError = new InternalServerError('An unexpected error occurred');
    }

    // Generate request ID for tracking
    const requestId = generateRequestId();
    const clientIp = getClientIp(req, trustProxy);

    // Log error details
    const logContext = {
      requestId,
      method: req.method,
      url: req.url,
      userAgent: req.get('User-Agent'),
      clientIp,
      userId: (req as any).user?.id,
      statusCode: appError.statusCode,
      errorCode: appError.code,
      stack: includeStackTrace ? error.stack : undefined
    };

    if (appError.statusCode >= 500) {
      logger.error(`Error ${appError.statusCode}: ${appError.message}`, logContext);
    } else {
      logger.warn(`Error ${appError.statusCode}: ${appError.message}`, logContext);
    }

    // Prepare response
    const isDevelopment = process.env.NODE_ENV === 'development';
    const errorResponse: ErrorResponse = {
      error: {
        message: sanitizeErrorMessage(appError, isDevelopment),
        code: appError.code,
        details: appError.details,
        timestamp: new Date().toISOString(),
        path: req.url,
        requestId
      }
    };

    // Add stack trace in development
    if (includeStackTrace && isDevelopment) {
      (errorResponse.error as any).stack = error.stack;
    }

    // Set appropriate headers
    res.status(appError.statusCode);
    res.set('X-Request-ID', requestId);

    // Send JSON response
    res.json(errorResponse);
  };
}

/**
 * 404 handler middleware (should be used before error handler)
 */
export function notFoundHandler(req: Request, res: Response, next: NextFunction): void {
  const error = new NotFoundError(`Route ${req.method} ${req.path} not found`);
  next(error);
}

/**
 * Async handler wrapper to catch promise rejections
 */
export function asyncHandler<T extends Request, U extends Response>(
  fn: (req: T, res: U, next: NextFunction) => Promise<any>
) {
  return (req: T, res: U, next: NextFunction) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}

/**
 * Rate limiting error handler
 */
export function rateLimitHandler(req: Request, res: Response, next: NextFunction): void {
  const error = new TooManyRequestsError('Too many requests from this IP');
  next(error);
}

/**
 * CORS error handler
 */
export function corsErrorHandler(req: Request, res: Response, next: NextFunction): void {
  const error = new ForbiddenError('CORS policy violation');
  next(error);
}

/**
 * Default error handler with sensible defaults
 */
export const errorHandler = createErrorHandler({
  logger: consoleLogger,
  includeStackTrace: process.env.NODE_ENV === 'development',
  trustProxy: process.env.NODE_ENV === 'production'
});