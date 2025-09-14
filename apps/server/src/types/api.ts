/**
 * API Types for Express Server Architecture
 * Stream B Coordination File - Shared between Express Server (Stream A) and API Routes (Stream B)
 */

import { Request, Response, NextFunction } from 'express';

// Base API Response Types
export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: ApiError;
  meta?: ApiMeta;
}

export interface ApiError {
  code: string;
  message: string;
  details?: any;
  statusCode?: number;
}

export interface ApiMeta {
  timestamp: string;
  requestId: string;
  version: string;
  path: string;
}

// Request/Response Handler Types
export interface ApiRequest<T = any> extends Request {
  body: T;
  user?: User;
  requestId: string;
  startTime: number;
}

export interface ApiResponseHandler extends Response {
  success: (data?: any, meta?: Partial<ApiMeta>) => void;
  error: (error: ApiError | string, statusCode?: number) => void;
}

// Middleware Types
export type ApiMiddleware = (
  req: ApiRequest,
  res: ApiResponseHandler,
  next: NextFunction
) => void | Promise<void>;

export type AsyncApiHandler<T = any> = (
  req: ApiRequest<T>,
  res: ApiResponseHandler,
  next: NextFunction
) => Promise<void>;

// User Types (minimal, will be extended by auth stream)
export interface User {
  id: string;
  email: string;
  role: 'user' | 'admin';
  createdAt: string;
  updatedAt: string;
}

// Character Types (basic structure for API endpoints)
export interface Character {
  id: string;
  name: string;
  description: string;
  imageUrl?: string;
  userId: string;
  tags: string[];
  createdAt: string;
  updatedAt: string;
}

export interface CreateCharacterRequest {
  name: string;
  description: string;
  tags?: string[];
}

export interface UpdateCharacterRequest {
  name?: string;
  description?: string;
  tags?: string[];
}

// Pagination Types
export interface PaginationParams {
  page?: number;
  limit?: number;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

export interface PaginatedResponse<T> {
  items: T[];
  pagination: {
    currentPage: number;
    totalPages: number;
    totalItems: number;
    itemsPerPage: number;
    hasNextPage: boolean;
    hasPreviousPage: boolean;
  };
}

// Search and Filter Types
export interface SearchParams {
  query?: string;
  tags?: string[];
  userId?: string;
  dateFrom?: string;
  dateTo?: string;
}

// API Route Configuration
export interface RouteConfig {
  path: string;
  method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  handler: AsyncApiHandler;
  middleware?: ApiMiddleware[];
  rateLimit?: {
    windowMs: number;
    max: number;
  };
  auth?: boolean;
  validation?: {
    body?: any;
    query?: any;
    params?: any;
  };
}

// Health Check Types
export interface HealthCheckResponse {
  status: 'healthy' | 'unhealthy' | 'degraded';
  timestamp: string;
  version: string;
  environment: string;
  uptime: number;
  services: {
    database: ServiceStatus;
    redis?: ServiceStatus;
    storage: ServiceStatus;
    external?: ServiceStatus[];
  };
}

export interface ServiceStatus {
  status: 'healthy' | 'unhealthy' | 'unknown';
  responseTime?: number;
  error?: string;
  lastChecked: string;
}

// Validation Types
export interface ValidationError {
  field: string;
  message: string;
  value?: any;
}

export interface ValidationResult {
  isValid: boolean;
  errors: ValidationError[];
}

// Rate Limiting Types
export interface RateLimitConfig {
  windowMs: number;
  max: number;
  message?: string;
  standardHeaders?: boolean;
  legacyHeaders?: boolean;
  skipSuccessfulRequests?: boolean;
  skipFailedRequests?: boolean;
}

// Security Types
export interface SecurityConfig {
  helmet: {
    contentSecurityPolicy?: any;
    crossOriginEmbedderPolicy?: boolean;
    crossOriginOpenerPolicy?: boolean;
    crossOriginResourcePolicy?: any;
    dnsPrefetchControl?: boolean;
    frameguard?: any;
    hidePoweredBy?: boolean;
    hsts?: any;
    ieNoOpen?: boolean;
    noSniff?: boolean;
    originAgentCluster?: boolean;
    permittedCrossDomainPolicies?: boolean;
    referrerPolicy?: any;
    xssFilter?: boolean;
  };
  cors: {
    origin: string | string[] | boolean | ((origin: string, callback: (err: Error | null, allow?: boolean) => void) => void);
    methods?: string[];
    allowedHeaders?: string[];
    exposedHeaders?: string[];
    credentials?: boolean;
    maxAge?: number;
    preflightContinue?: boolean;
    optionsSuccessStatus?: number;
  };
}

// Error Handling Types
export interface ErrorHandlerConfig {
  includeStack: boolean;
  logErrors: boolean;
  trustProxy: boolean;
}

// Server Configuration Types
export interface ServerConfig {
  port: number;
  host: string;
  env: 'development' | 'production' | 'test';
  cors: SecurityConfig['cors'];
  security: SecurityConfig['helmet'];
  rateLimit: RateLimitConfig;
  errorHandler: ErrorHandlerConfig;
  gracefulShutdown: {
    timeout: number;
    signals: string[];
  };
}

// Database Connection Types (minimal for server config)
export interface DatabaseConnectionStatus {
  connected: boolean;
  error?: string;
  connectionTime?: number;
  lastHealthCheck?: string;
}

// Logging Types
export interface LogContext {
  requestId: string;
  userId?: string;
  path: string;
  method: string;
  statusCode?: number;
  responseTime?: number;
  userAgent?: string;
  ip?: string;
}

export type LogLevel = 'error' | 'warn' | 'info' | 'debug';

// Metrics Types
export interface RequestMetrics {
  totalRequests: number;
  successfulRequests: number;
  failedRequests: number;
  averageResponseTime: number;
  requestsByEndpoint: Record<string, number>;
  errorsByType: Record<string, number>;
}

// WebSocket Types (for future real-time features)
export interface WebSocketMessage {
  type: string;
  payload: any;
  timestamp: string;
  userId?: string;
}

// File Upload Types
export interface FileUploadConfig {
  maxFileSize: number;
  allowedMimeTypes: string[];
  destinationPath: string;
  preserveOriginalName: boolean;
}

export interface UploadedFile {
  fieldname: string;
  originalname: string;
  filename: string;
  mimetype: string;
  size: number;
  path: string;
  url?: string;
}

// API Version Types
export interface ApiVersion {
  version: string;
  deprecated: boolean;
  supportedUntil?: string;
  routes: string[];
}

// Constants for Stream B coordination
export const API_CONSTANTS = {
  VERSIONS: {
    V1: 'v1',
    V2: 'v2'
  },
  DEFAULT_PAGINATION: {
    PAGE: 1,
    LIMIT: 20,
    MAX_LIMIT: 100
  },
  RATE_LIMITS: {
    STANDARD: {
      WINDOW_MS: 15 * 60 * 1000, // 15 minutes
      MAX_REQUESTS: 100
    },
    STRICT: {
      WINDOW_MS: 15 * 60 * 1000, // 15 minutes
      MAX_REQUESTS: 20
    }
  },
  HTTP_STATUS: {
    OK: 200,
    CREATED: 201,
    BAD_REQUEST: 400,
    UNAUTHORIZED: 401,
    FORBIDDEN: 403,
    NOT_FOUND: 404,
    CONFLICT: 409,
    UNPROCESSABLE_ENTITY: 422,
    TOO_MANY_REQUESTS: 429,
    INTERNAL_SERVER_ERROR: 500,
    SERVICE_UNAVAILABLE: 503
  } as const,
  ERROR_CODES: {
    VALIDATION_ERROR: 'VALIDATION_ERROR',
    NOT_FOUND: 'NOT_FOUND',
    UNAUTHORIZED: 'UNAUTHORIZED',
    FORBIDDEN: 'FORBIDDEN',
    RATE_LIMITED: 'RATE_LIMITED',
    INTERNAL_ERROR: 'INTERNAL_ERROR',
    SERVICE_UNAVAILABLE: 'SERVICE_UNAVAILABLE'
  } as const
} as const;

// Utility type helpers
export type ApiEndpoint = `/api/${string}`;
export type HttpMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
export type ContentType = 'application/json' | 'multipart/form-data' | 'application/x-www-form-urlencoded';

// Export all types for Stream B coordination
// export * from './character';
// export * from './generation'; // These files already exist - temporarily disabled due to Prisma dependencies