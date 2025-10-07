import { Request, Response, NextFunction } from 'express';
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
export type ApiMiddleware = (req: ApiRequest, res: ApiResponseHandler, next: NextFunction) => void | Promise<void>;
export type AsyncApiHandler<T = any> = (req: ApiRequest<T>, res: ApiResponseHandler, next: NextFunction) => Promise<void>;
export interface User {
    id: string;
    auth0Id: string | null;
    email: string;
    name: string | null;
}
export interface Character {
    id: string;
    name: string;
    description: string;
    enhancedDescription?: string;
    imageUrl?: string;
    thumbnailUrl?: string;
    userId: string;
    tags: string[];
    createdAt: string;
    updatedAt: string;
    metadata?: any;
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
export interface SearchParams {
    query?: string;
    tags?: string[];
    userId?: string;
    dateFrom?: string;
    dateTo?: string;
}
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
export interface ValidationError {
    field: string;
    message: string;
    value?: any;
}
export interface ValidationResult {
    isValid: boolean;
    errors: ValidationError[];
}
export interface RateLimitConfig {
    windowMs: number;
    max: number;
    message?: string;
    standardHeaders?: boolean;
    legacyHeaders?: boolean;
    skipSuccessfulRequests?: boolean;
    skipFailedRequests?: boolean;
}
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
export interface ErrorHandlerConfig {
    includeStack: boolean;
    logErrors: boolean;
    trustProxy: boolean;
}
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
export interface DatabaseConnectionStatus {
    connected: boolean;
    error?: string;
    connectionTime?: number;
    lastHealthCheck?: string;
}
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
export interface RequestMetrics {
    totalRequests: number;
    successfulRequests: number;
    failedRequests: number;
    averageResponseTime: number;
    requestsByEndpoint: Record<string, number>;
    errorsByType: Record<string, number>;
}
export interface WebSocketMessage {
    type: string;
    payload: any;
    timestamp: string;
    userId?: string;
}
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
export interface ApiVersion {
    version: string;
    deprecated: boolean;
    supportedUntil?: string;
    routes: string[];
}
export declare const API_CONSTANTS: {
    readonly VERSIONS: {
        readonly V1: "v1";
        readonly V2: "v2";
    };
    readonly DEFAULT_PAGINATION: {
        readonly PAGE: 1;
        readonly LIMIT: 20;
        readonly MAX_LIMIT: 100;
    };
    readonly RATE_LIMITS: {
        readonly STANDARD: {
            readonly WINDOW_MS: number;
            readonly MAX_REQUESTS: 100;
        };
        readonly STRICT: {
            readonly WINDOW_MS: number;
            readonly MAX_REQUESTS: 20;
        };
    };
    readonly HTTP_STATUS: {
        readonly OK: 200;
        readonly CREATED: 201;
        readonly BAD_REQUEST: 400;
        readonly UNAUTHORIZED: 401;
        readonly FORBIDDEN: 403;
        readonly NOT_FOUND: 404;
        readonly CONFLICT: 409;
        readonly UNPROCESSABLE_ENTITY: 422;
        readonly TOO_MANY_REQUESTS: 429;
        readonly INTERNAL_SERVER_ERROR: 500;
        readonly SERVICE_UNAVAILABLE: 503;
    };
    readonly ERROR_CODES: {
        readonly VALIDATION_ERROR: "VALIDATION_ERROR";
        readonly NOT_FOUND: "NOT_FOUND";
        readonly UNAUTHORIZED: "UNAUTHORIZED";
        readonly FORBIDDEN: "FORBIDDEN";
        readonly RATE_LIMITED: "RATE_LIMITED";
        readonly INTERNAL_ERROR: "INTERNAL_ERROR";
        readonly SERVICE_UNAVAILABLE: "SERVICE_UNAVAILABLE";
    };
};
export type ApiEndpoint = `/api/${string}`;
export type HttpMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
export type ContentType = 'application/json' | 'multipart/form-data' | 'application/x-www-form-urlencoded';
//# sourceMappingURL=api.d.ts.map