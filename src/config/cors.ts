/**
 * CORS Configuration
 * Cross-Origin Resource Sharing configuration for Express server
 */

import { CorsOptions } from 'cors';
import { ENV_CONFIG, isDevelopment, isProduction } from './env';

/**
 * Default CORS configuration for development
 */
const developmentCorsConfig: CorsOptions = {
  origin: (origin, callback) => {
    // Allow requests with no origin (mobile apps, curl, etc.)
    if (!origin) return callback(null, true);
    
    // Allow all origins in development
    return callback(null, true);
  },
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: [
    'Origin',
    'X-Requested-With',
    'Content-Type',
    'Accept',
    'Authorization',
    'Cache-Control',
    'X-File-Name',
    'X-File-Size',
    'X-File-Type',
    'X-Request-ID'
  ],
  exposedHeaders: [
    'X-Total-Count',
    'X-Page-Count',
    'X-Current-Page',
    'X-Per-Page',
    'X-Rate-Limit-Limit',
    'X-Rate-Limit-Remaining',
    'X-Rate-Limit-Reset',
    'X-Request-ID'
  ],
  credentials: true,
  maxAge: 86400, // 24 hours
  preflightContinue: false,
  optionsSuccessStatus: 204
};

/**
 * Production CORS configuration with strict origin validation
 */
const productionCorsConfig: CorsOptions = {
  origin: (origin, callback) => {
    // Allow requests with no origin (mobile apps, server-to-server, etc.)
    if (!origin) {
      return callback(null, true);
    }

    const allowedOrigins = ENV_CONFIG.ALLOWED_ORIGINS;
    
    // Check if origin is in allowed list
    if (allowedOrigins.includes('*')) {
      console.warn('CORS: Allowing all origins in production - this may be a security risk');
      return callback(null, true);
    }

    // Exact match check
    if (allowedOrigins.includes(origin)) {
      return callback(null, true);
    }

    // Pattern matching for subdomain support
    const isAllowed = allowedOrigins.some(allowedOrigin => {
      // Support wildcard subdomains (e.g., *.example.com)
      if (allowedOrigin.startsWith('*.')) {
        const domain = allowedOrigin.slice(2); // Remove *.
        return origin.endsWith(`.${domain}`) || origin === domain;
      }
      
      // Support protocol-agnostic origins
      if (allowedOrigin.startsWith('//')) {
        return origin.includes(allowedOrigin.slice(2));
      }
      
      return false;
    });

    if (isAllowed) {
      return callback(null, true);
    }

    // Log blocked requests for monitoring
    console.warn(`CORS: Blocked request from origin: ${origin}`);
    return callback(new Error(`Origin ${origin} not allowed by CORS policy`), false);
  },
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: [
    'Origin',
    'X-Requested-With',
    'Content-Type',
    'Accept',
    'Authorization',
    'Cache-Control',
    'X-File-Name',
    'X-File-Size',
    'X-File-Type',
    'X-Request-ID'
  ],
  exposedHeaders: [
    'X-Total-Count',
    'X-Page-Count',
    'X-Current-Page',
    'X-Per-Page',
    'X-Rate-Limit-Limit',
    'X-Rate-Limit-Remaining',
    'X-Rate-Limit-Reset',
    'X-Request-ID'
  ],
  credentials: ENV_CONFIG.CORS_CREDENTIALS,
  maxAge: ENV_CONFIG.CORS_MAX_AGE,
  preflightContinue: false,
  optionsSuccessStatus: 204
};

/**
 * Test environment CORS configuration
 */
const testCorsConfig: CorsOptions = {
  origin: true, // Allow all origins in test
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: '*',
  exposedHeaders: '*',
  credentials: true,
  maxAge: 0, // Don't cache preflight in tests
  preflightContinue: false,
  optionsSuccessStatus: 200
};

/**
 * API-specific CORS configuration for different endpoints
 */
export const apiCorsConfig: CorsOptions = {
  origin: (origin, callback) => {
    if (isDevelopment()) {
      const devOrigin = developmentCorsConfig.origin;
      if (typeof devOrigin === 'function') {
        return devOrigin(origin, callback);
      }
      return callback(null, devOrigin === true);
    }
    
    if (isProduction()) {
      const prodOrigin = productionCorsConfig.origin;
      if (typeof prodOrigin === 'function') {
        return prodOrigin(origin, callback);
      }
      return callback(null, prodOrigin === true);
    }
    
    // Test environment
    return callback(null, true);
  },
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: [
    'Origin',
    'X-Requested-With',
    'Content-Type',
    'Accept',
    'Authorization',
    'X-API-Key',
    'X-Client-Version',
    'X-Request-ID'
  ],
  exposedHeaders: [
    'X-API-Version',
    'X-Request-ID',
    'X-Response-Time',
    'X-Rate-Limit-Limit',
    'X-Rate-Limit-Remaining',
    'X-Rate-Limit-Reset'
  ],
  credentials: false, // API endpoints typically don't need credentials
  maxAge: 300, // 5 minutes for API preflight
  preflightContinue: false,
  optionsSuccessStatus: 204
};

/**
 * Upload-specific CORS configuration
 */
export const uploadCorsConfig: CorsOptions = {
  origin: (origin, callback) => {
    if (isDevelopment()) {
      const devOrigin = developmentCorsConfig.origin;
      if (typeof devOrigin === 'function') {
        return devOrigin(origin, callback);
      }
      return callback(null, devOrigin === true);
    }
    const prodOrigin = productionCorsConfig.origin;
    if (typeof prodOrigin === 'function') {
      return prodOrigin(origin, callback);
    }
    return callback(null, prodOrigin === true);
  },
  methods: ['POST', 'PUT', 'OPTIONS'],
  allowedHeaders: [
    'Origin',
    'X-Requested-With',
    'Content-Type',
    'Accept',
    'Authorization',
    'X-File-Name',
    'X-File-Size',
    'X-File-Type'
  ],
  exposedHeaders: [
    'Location',
    'X-Upload-ID',
    'X-File-URL'
  ],
  credentials: true,
  maxAge: 3600, // 1 hour for upload preflight
  preflightContinue: false,
  optionsSuccessStatus: 204
};

/**
 * WebSocket CORS configuration (for future use)
 */
export const websocketCorsConfig = {
  origin: (origin: string) => {
    if (isDevelopment()) {
      return true;
    }
    
    if (!origin) return false;
    
    const allowedOrigins = ENV_CONFIG.ALLOWED_ORIGINS;
    return allowedOrigins.includes('*') || allowedOrigins.includes(origin);
  },
  credentials: true
};

/**
 * Health check CORS configuration (minimal)
 */
export const healthCheckCorsConfig: CorsOptions = {
  origin: '*',
  methods: ['GET', 'OPTIONS'],
  allowedHeaders: ['Content-Type'],
  exposedHeaders: [],
  credentials: false,
  maxAge: 86400, // 24 hours
  preflightContinue: false,
  optionsSuccessStatus: 200
};

/**
 * Get CORS configuration based on environment
 */
export const getCorsConfig = (): CorsOptions => {
  if (isDevelopment()) {
    return developmentCorsConfig;
  }
  
  if (isProduction()) {
    return productionCorsConfig;
  }
  
  // Test environment
  return testCorsConfig;
};

/**
 * Validate CORS configuration
 */
export const validateCorsConfig = (config: CorsOptions): {
  isValid: boolean;
  warnings: string[];
  errors: string[];
} => {
  const warnings: string[] = [];
  const errors: string[] = [];

  // Check for security issues in production
  if (isProduction()) {
    if (config.origin === true || (Array.isArray(config.origin) && config.origin.includes('*'))) {
      warnings.push('CORS origin is set to allow all origins in production');
    }
    
    if (config.credentials && config.origin === true) {
      errors.push('CORS credentials cannot be used with wildcard origin');
    }
  }

  // Check allowed headers
  const allowedHeaders = Array.isArray(config.allowedHeaders) ? config.allowedHeaders : [];
  if (allowedHeaders.includes('*')) {
    warnings.push('CORS allowedHeaders includes wildcard - may be overly permissive');
  }

  // Check methods
  const methods = Array.isArray(config.methods) ? config.methods : [];
  if (methods.includes('*')) {
    warnings.push('CORS methods includes wildcard - may be overly permissive');
  }

  return {
    isValid: errors.length === 0,
    warnings,
    errors
  };
};

/**
 * CORS middleware factory for different endpoint types
 */
export const createCorsMiddleware = (type: 'default' | 'api' | 'upload' | 'health' = 'default') => {
  let config: CorsOptions;
  
  switch (type) {
    case 'api':
      config = apiCorsConfig;
      break;
    case 'upload':
      config = uploadCorsConfig;
      break;
    case 'health':
      config = healthCheckCorsConfig;
      break;
    default:
      config = getCorsConfig();
      break;
  }
  
  // Validate configuration
  const validation = validateCorsConfig(config);
  if (validation.warnings.length > 0) {
    console.warn(`CORS ${type} configuration warnings:`, validation.warnings.join(', '));
  }
  if (!validation.isValid) {
    console.error(`CORS ${type} configuration errors:`, validation.errors.join(', '));
  }
  
  return config;
};

/**
 * Dynamic CORS origin validator
 */
export const createOriginValidator = (additionalOrigins: string[] = []) => {
  return (origin: string | undefined, callback: (err: Error | null, allow?: boolean) => void) => {
    if (!origin) {
      return callback(null, true);
    }

    const baseAllowedOrigins = ENV_CONFIG.ALLOWED_ORIGINS;
    const allAllowedOrigins = [...baseAllowedOrigins, ...additionalOrigins];

    // Check if origin is allowed
    const isAllowed = allAllowedOrigins.some(allowedOrigin => {
      if (allowedOrigin === '*') return true;
      if (allowedOrigin === origin) return true;
      
      // Wildcard subdomain support
      if (allowedOrigin.startsWith('*.')) {
        const domain = allowedOrigin.slice(2);
        return origin.endsWith(`.${domain}`) || origin === domain;
      }
      
      return false;
    });

    if (isAllowed) {
      callback(null, true);
    } else {
      console.warn(`CORS: Blocked request from origin: ${origin}`);
      callback(new Error(`Origin ${origin} not allowed by CORS policy`), false);
    }
  };
};

// Export default CORS configuration
export const corsConfig = getCorsConfig();
export default corsConfig;