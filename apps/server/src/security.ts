/**
 * Security Configuration
 * Security headers, rate limiting, and protection middleware configuration
 */

import helmet, { HelmetOptions } from 'helmet';
import rateLimit, { RateLimitRequestHandler, Options as RateLimitOptions } from 'express-rate-limit';
import { ENV_CONFIG, isDevelopment, isProduction } from './env';
import { ApiRequest, ApiResponseHandler } from '../types/api';

/**
 * Helmet (Security Headers) Configuration
 */
export const getHelmetConfig = (): HelmetOptions => {
  const baseConfig: HelmetOptions = {
    // Content Security Policy
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
        scriptSrc: ["'self'", "'unsafe-eval'", "'unsafe-inline'"], // Unsafe eval/inline for development
        imgSrc: ["'self'", "data:", "https:", "blob:"],
        connectSrc: ["'self'", "ws:", "wss:", "https://api.nanobanana.ai"],
        fontSrc: ["'self'", "https://fonts.gstatic.com"],
        objectSrc: ["'none'"],
        mediaSrc: ["'self'", "blob:"],
        frameSrc: ["'none'"],
        baseUri: ["'self'"],
        formAction: ["'self'"],
        upgradeInsecureRequests: []
      }
    },
    
    // Cross-Origin Policies
    crossOriginEmbedderPolicy: false, // Disabled for API compatibility
    crossOriginOpenerPolicy: { policy: 'same-origin-allow-popups' },
    crossOriginResourcePolicy: { policy: 'cross-origin' },
    
    // DNS Prefetch Control
    dnsPrefetchControl: { allow: false },
    
    // X-Frame-Options
    frameguard: { action: 'deny' },
    
    // Hide X-Powered-By header
    hidePoweredBy: true,
    
    // HTTP Strict Transport Security (HSTS)
    hsts: {
      maxAge: 31536000, // 1 year
      includeSubDomains: true,
      preload: true
    },
    
    // X-Download-Options for IE8+
    ieNoOpen: true,
    
    // X-Content-Type-Options
    noSniff: true,
    
    // Origin-Agent-Cluster
    originAgentCluster: true,
    
    // X-Permitted-Cross-Domain-Policies
    permittedCrossDomainPolicies: false,
    
    // Referrer Policy
    referrerPolicy: { policy: 'no-referrer-when-downgrade' },
    
    // X-XSS-Protection
    xssFilter: true
  };

  // Development-specific adjustments
  if (isDevelopment()) {
    // More permissive CSP for development
    if (baseConfig.contentSecurityPolicy && typeof baseConfig.contentSecurityPolicy === 'object') {
      baseConfig.contentSecurityPolicy.directives = {
        ...baseConfig.contentSecurityPolicy.directives,
        scriptSrc: ["'self'", "'unsafe-eval'", "'unsafe-inline'"],
        styleSrc: ["'self'", "'unsafe-inline'"],
        connectSrc: ["'self'", "ws:", "wss:", "http:", "https:"]
      };
    }
    
    // Disable HSTS in development
    baseConfig.hsts = false;
  }

  // Production-specific adjustments
  if (isProduction()) {
    // Stricter CSP for production
    if (baseConfig.contentSecurityPolicy && typeof baseConfig.contentSecurityPolicy === 'object') {
      baseConfig.contentSecurityPolicy.directives = {
        ...baseConfig.contentSecurityPolicy.directives,
        scriptSrc: ["'self'"],
        styleSrc: ["'self'", "https://fonts.googleapis.com"],
        upgradeInsecureRequests: []
      };
    }
  }

  return baseConfig;
};

/**
 * Rate Limiting Configuration
 */
export interface RateLimitConfig {
  windowMs: number;
  max: number;
  message?: any;
  standardHeaders?: boolean;
  legacyHeaders?: boolean;
  store?: any;
  keyGenerator?: (req: any) => string;
  skip?: (req: any) => boolean;
  onLimitReached?: (req: any, res: any, options: any) => void;
}

/**
 * Standard rate limit configuration
 */
export const standardRateLimit: RateLimitConfig = {
  windowMs: ENV_CONFIG.RATE_LIMIT_WINDOW_MS, // 15 minutes
  max: ENV_CONFIG.RATE_LIMIT_MAX_REQUESTS, // 100 requests per window
  message: {
    error: 'Too many requests from this IP, please try again later.',
    code: 'RATE_LIMITED',
    retryAfter: ENV_CONFIG.RATE_LIMIT_WINDOW_MS / 1000
  },
  standardHeaders: true, // Return rate limit info in the `RateLimit-*` headers
  legacyHeaders: false, // Disable the `X-RateLimit-*` headers
  keyGenerator: (req: ApiRequest) => {
    // Use forwarded IP if behind proxy, otherwise use connection IP
    return req.ip || req.socket.remoteAddress || 'unknown';
  },
  skip: (req: ApiRequest) => {
    // Skip rate limiting for health checks
    return req.path === '/health' || req.path === '/api/health';
  },
  onLimitReached: (req: ApiRequest, res: ApiResponseHandler, options: any) => {
    console.warn(`Rate limit exceeded for IP: ${req.ip}, path: ${req.path}`);
  }
};

/**
 * Strict rate limit for sensitive endpoints
 */
export const strictRateLimit: RateLimitConfig = {
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // 5 requests per window
  message: {
    error: 'Too many requests to this sensitive endpoint, please try again later.',
    code: 'STRICT_RATE_LIMITED',
    retryAfter: 15 * 60
  },
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req: ApiRequest) => `${req.ip}:${req.path}`,
  onLimitReached: (req: ApiRequest, res: ApiResponseHandler, options: any) => {
    console.error(`Strict rate limit exceeded for IP: ${req.ip}, path: ${req.path}`);
  }
};

/**
 * Lenient rate limit for public endpoints
 */
export const lenientRateLimit: RateLimitConfig = {
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 1000, // 1000 requests per window
  message: {
    error: 'Too many requests, please try again later.',
    code: 'RATE_LIMITED',
    retryAfter: 15 * 60
  },
  standardHeaders: true,
  legacyHeaders: false
};

/**
 * Upload-specific rate limit
 */
export const uploadRateLimit: RateLimitConfig = {
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 50, // 50 uploads per hour
  message: {
    error: 'Too many file uploads, please try again later.',
    code: 'UPLOAD_RATE_LIMITED',
    retryAfter: 60 * 60
  },
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req: ApiRequest) => {
    // Rate limit uploads by user if authenticated, otherwise by IP
    return req.user?.id || req.ip || 'unknown';
  }
};

/**
 * Create rate limit middleware
 */
export const createRateLimitMiddleware = (config: RateLimitConfig): RateLimitRequestHandler => {
  const options: RateLimitOptions = {
    ...config,
    handler: (req: ApiRequest, res: ApiResponseHandler) => {
      res.status(429).json(config.message);
    }
  };

  return rateLimit(options);
};

/**
 * Security middleware configurations
 */
export const securityMiddleware = {
  // Helmet middleware
  helmet: helmet(getHelmetConfig()),
  
  // Rate limiting middleware
  rateLimitStandard: createRateLimitMiddleware(standardRateLimit),
  rateLimitStrict: createRateLimitMiddleware(strictRateLimit),
  rateLimitLenient: createRateLimitMiddleware(lenientRateLimit),
  rateLimitUpload: createRateLimitMiddleware(uploadRateLimit),
  
  // Request size limiting
  requestSizeLimit: (req: ApiRequest, res: ApiResponseHandler, next: any) => {
    const contentLength = parseInt(req.get('Content-Length') || '0', 10);
    const maxSize = ENV_CONFIG.MAX_FILE_SIZE;
    
    if (contentLength > maxSize) {
      return res.status(413).json({
        error: 'Request entity too large',
        code: 'REQUEST_TOO_LARGE',
        maxSize: maxSize
      });
    }
    
    next();
  },
  
  // Content type validation
  contentTypeValidation: (allowedTypes: string[]) => {
    return (req: ApiRequest, res: ApiResponseHandler, next: any) => {
      if (req.method === 'POST' || req.method === 'PUT' || req.method === 'PATCH') {
        const contentType = req.get('Content-Type');
        
        if (!contentType) {
          return res.status(400).json({
            error: 'Content-Type header is required',
            code: 'MISSING_CONTENT_TYPE'
          });
        }
        
        const isAllowed = allowedTypes.some(type => contentType.includes(type));
        
        if (!isAllowed) {
          return res.status(415).json({
            error: 'Unsupported Media Type',
            code: 'UNSUPPORTED_MEDIA_TYPE',
            allowedTypes: allowedTypes
          });
        }
      }
      
      next();
    };
  },
  
  // Request ID middleware
  requestId: (req: ApiRequest, res: ApiResponseHandler, next: any) => {
    const requestId = req.get('X-Request-ID') || 
                     `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    req.requestId = requestId;
    res.setHeader('X-Request-ID', requestId);
    
    next();
  },
  
  // Response time middleware
  responseTime: (req: ApiRequest, res: ApiResponseHandler, next: any) => {
    req.startTime = Date.now();
    
    const cleanup = () => {
      const responseTime = Date.now() - req.startTime;
      res.setHeader('X-Response-Time', `${responseTime}ms`);
      
      // Log slow requests
      if (responseTime > 5000) { // 5 seconds
        console.warn(`Slow request: ${req.method} ${req.path} took ${responseTime}ms`);
      }
    };
    
    res.on('finish', cleanup);
    res.on('close', cleanup);
    
    next();
  },
  
  // IP whitelist/blacklist middleware
  createIPFilter: (whitelist?: string[], blacklist?: string[]) => {
    return (req: ApiRequest, res: ApiResponseHandler, next: any) => {
      const clientIP = req.ip;
      
      // Check blacklist first
      if (blacklist && blacklist.includes(clientIP)) {
        return res.status(403).json({
          error: 'Access denied',
          code: 'IP_BLOCKED'
        });
      }
      
      // Check whitelist if provided
      if (whitelist && whitelist.length > 0 && !whitelist.includes(clientIP)) {
        return res.status(403).json({
          error: 'Access denied',
          code: 'IP_NOT_WHITELISTED'
        });
      }
      
      next();
    };
  },
  
  // Security headers middleware (additional to helmet)
  securityHeaders: (req: ApiRequest, res: ApiResponseHandler, next: any) => {
    // Additional security headers
    res.setHeader('X-API-Version', '1.0');
    res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');
    
    // Remove server information
    res.removeHeader('X-Powered-By');
    res.removeHeader('Server');
    
    next();
  }
};

/**
 * Security configuration validation
 */
export const validateSecurityConfig = (): {
  isValid: boolean;
  warnings: string[];
  errors: string[];
} => {
  const warnings: string[] = [];
  const errors: string[] = [];

  // Check environment-specific configurations
  if (isProduction()) {
    if (ENV_CONFIG.RATE_LIMIT_MAX_REQUESTS > 1000) {
      warnings.push('Rate limit max requests is very high for production');
    }
    
    if (!ENV_CONFIG.CORS_CREDENTIALS) {
      warnings.push('CORS credentials are disabled in production');
    }
  }

  if (isDevelopment()) {
    if (ENV_CONFIG.RATE_LIMIT_MAX_REQUESTS < 10) {
      warnings.push('Rate limit max requests is very low for development');
    }
  }

  // Validate rate limiting configuration
  if (ENV_CONFIG.RATE_LIMIT_WINDOW_MS < 60000) { // Less than 1 minute
    warnings.push('Rate limit window is very short, may impact legitimate users');
  }

  return {
    isValid: errors.length === 0,
    warnings,
    errors
  };
};

/**
 * Get rate limit configuration by endpoint type
 */
export const getRateLimitByType = (type: 'standard' | 'strict' | 'lenient' | 'upload'): RateLimitRequestHandler => {
  switch (type) {
    case 'strict':
      return securityMiddleware.rateLimitStrict;
    case 'lenient':
      return securityMiddleware.rateLimitLenient;
    case 'upload':
      return securityMiddleware.rateLimitUpload;
    default:
      return securityMiddleware.rateLimitStandard;
  }
};

/**
 * Combined security middleware stack
 */
export const createSecurityStack = (options: {
  rateLimitType?: 'standard' | 'strict' | 'lenient' | 'upload';
  allowedContentTypes?: string[];
  ipWhitelist?: string[];
  ipBlacklist?: string[];
  enableRequestSizeLimit?: boolean;
} = {}) => {
  const middleware = [
    securityMiddleware.helmet,
    securityMiddleware.requestId,
    securityMiddleware.responseTime,
    securityMiddleware.securityHeaders
  ];

  // Add IP filtering if specified
  if (options.ipWhitelist || options.ipBlacklist) {
    middleware.push(securityMiddleware.createIPFilter(options.ipWhitelist, options.ipBlacklist));
  }

  // Add rate limiting
  middleware.push(getRateLimitByType(options.rateLimitType || 'standard'));

  // Add request size limiting
  if (options.enableRequestSizeLimit !== false) {
    middleware.push(securityMiddleware.requestSizeLimit);
  }

  // Add content type validation
  if (options.allowedContentTypes) {
    middleware.push(securityMiddleware.contentTypeValidation(options.allowedContentTypes));
  }

  return middleware;
};

// Validate security configuration on load
const securityValidation = validateSecurityConfig();
if (securityValidation.warnings.length > 0) {
  console.warn('Security configuration warnings:', securityValidation.warnings.join(', '));
}
if (!securityValidation.isValid) {
  console.error('Security configuration errors:', securityValidation.errors.join(', '));
}

export default securityMiddleware;