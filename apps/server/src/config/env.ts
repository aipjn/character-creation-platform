/**
 * Environment Configuration Management
 * Centralized configuration loading and validation
 */

import dotenv from 'dotenv';
import { ServerConfig } from '../types/api';

// Load environment variables from .env file
dotenv.config();

// Environment validation
export interface EnvConfig {
  // Server Configuration
  NODE_ENV: 'development' | 'production' | 'test';
  PORT: number;
  HOST: string;
  
  // Database Configuration
  DATABASE_URL: string;
  DATABASE_MAX_CONNECTIONS: number;
  DATABASE_CONNECTION_TIMEOUT: number;
  DATABASE_QUERY_TIMEOUT: number;
  DATABASE_IDLE_TIMEOUT: number;
  DATABASE_MAX_RETRIES: number;
  
  // Security Configuration
  JWT_SECRET: string;
  JWT_EXPIRES_IN: string;
  BCRYPT_SALT_ROUNDS: number;
  
  // CORS Configuration
  ALLOWED_ORIGINS: string[];
  CORS_CREDENTIALS: boolean;
  CORS_MAX_AGE: number;
  
  // Rate Limiting Configuration
  RATE_LIMIT_WINDOW_MS: number;
  RATE_LIMIT_MAX_REQUESTS: number;
  RATE_LIMIT_SKIP_SUCCESSFUL: boolean;
  
  // Logging Configuration
  LOG_LEVEL: 'error' | 'warn' | 'info' | 'debug';
  ENABLE_REQUEST_LOGGING: boolean;
  ENABLE_STRUCTURED_LOGGING: boolean;
  
  // File Upload Configuration
  MAX_FILE_SIZE: number;
  ALLOWED_FILE_TYPES: string[];
  UPLOAD_PATH: string;
  
  // External API Configuration
  NANOBANANA_API_KEY: string;
  NANOBANANA_API_URL: string;
  NANOBANANA_MODEL: string;
  
  // AWS Configuration
  AWS_REGION: string;
  AWS_S3_BUCKET_NAME: string;
  AWS_ACCESS_KEY_ID: string;
  AWS_SECRET_ACCESS_KEY: string;
  AWS_CLOUDFRONT_DOMAIN_NAME: string;
  
  // Redis Configuration (optional)
  REDIS_URL?: string;
  REDIS_PASSWORD?: string;
  REDIS_DB?: number;
  
  // Monitoring Configuration
  ENABLE_METRICS: boolean;
  ENABLE_HEALTH_CHECKS: boolean;
  HEALTH_CHECK_INTERVAL_MS: number;
  
  // Webhook Configuration
  WEBHOOK_URL?: string;
  WEBHOOK_SECRET?: string;
  WEBHOOK_RETRY_ATTEMPTS: number;
  
  // Feature Flags
  ENABLE_BATCH_PROCESSING: boolean;
  ENABLE_WEBSOCKETS: boolean;
  ENABLE_API_DOCS: boolean;
  ENABLE_DEBUG_LOGS: boolean;
}

/**
 * Parse and validate environment variables
 */
const parseEnvVar = {
  string: (key: string, defaultValue?: string, required = false): string => {
    const value = process.env[key];
    if (!value && required && !defaultValue) {
      throw new Error(`Required environment variable ${key} is not set`);
    }
    return value || defaultValue || '';
  },
  
  number: (key: string, defaultValue?: number, required = false): number => {
    const value = process.env[key];
    if (!value && required && defaultValue === undefined) {
      throw new Error(`Required environment variable ${key} is not set`);
    }
    const parsed = parseInt(value || String(defaultValue || 0), 10);
    if (isNaN(parsed)) {
      throw new Error(`Environment variable ${key} must be a valid number`);
    }
    return parsed;
  },
  
  boolean: (key: string, defaultValue = false): boolean => {
    const value = process.env[key];
    if (!value) return defaultValue;
    return value.toLowerCase() === 'true' || value === '1';
  },
  
  array: (key: string, separator = ',', defaultValue: string[] = []): string[] => {
    const value = process.env[key];
    if (!value) return defaultValue;
    return value.split(separator).map(item => item.trim()).filter(Boolean);
  },
  
  enum: <T extends string>(key: string, allowedValues: T[], defaultValue?: T, required = false): T => {
    const value = process.env[key] as T;
    if (!value && required && !defaultValue) {
      throw new Error(`Required environment variable ${key} is not set`);
    }
    const finalValue = value || defaultValue;
    if (finalValue && !allowedValues.includes(finalValue)) {
      throw new Error(`Environment variable ${key} must be one of: ${allowedValues.join(', ')}`);
    }
    return finalValue as T;
  }
};

/**
 * Load and validate environment configuration
 */
export const loadEnvConfig = (): EnvConfig => {
  try {
    return {
      // Server Configuration
      NODE_ENV: parseEnvVar.enum('NODE_ENV', ['development', 'production', 'test'], 'development'),
      PORT: parseEnvVar.number('PORT', 3000),
      HOST: parseEnvVar.string('HOST', '0.0.0.0'),
      
      // Database Configuration
      DATABASE_URL: parseEnvVar.string('DATABASE_URL', undefined, true),
      DATABASE_MAX_CONNECTIONS: parseEnvVar.number('DATABASE_MAX_CONNECTIONS', 20),
      DATABASE_CONNECTION_TIMEOUT: parseEnvVar.number('DATABASE_CONNECTION_TIMEOUT', 5000),
      DATABASE_QUERY_TIMEOUT: parseEnvVar.number('DATABASE_QUERY_TIMEOUT', 30000),
      DATABASE_IDLE_TIMEOUT: parseEnvVar.number('DATABASE_IDLE_TIMEOUT', 30000),
      DATABASE_MAX_RETRIES: parseEnvVar.number('DATABASE_MAX_RETRIES', 3),
      
      // Security Configuration
      JWT_SECRET: parseEnvVar.string('JWT_SECRET', 'default-jwt-secret-change-in-production'),
      JWT_EXPIRES_IN: parseEnvVar.string('JWT_EXPIRES_IN', '24h'),
      BCRYPT_SALT_ROUNDS: parseEnvVar.number('BCRYPT_SALT_ROUNDS', 12),
      
      // CORS Configuration
      ALLOWED_ORIGINS: parseEnvVar.array('ALLOWED_ORIGINS', ',', ['*']),
      CORS_CREDENTIALS: parseEnvVar.boolean('CORS_CREDENTIALS', true),
      CORS_MAX_AGE: parseEnvVar.number('CORS_MAX_AGE', 86400), // 24 hours
      
      // Rate Limiting Configuration
      RATE_LIMIT_WINDOW_MS: parseEnvVar.number('RATE_LIMIT_WINDOW_MS', 15 * 60 * 1000), // 15 minutes
      RATE_LIMIT_MAX_REQUESTS: parseEnvVar.number('RATE_LIMIT_MAX_REQUESTS', 100),
      RATE_LIMIT_SKIP_SUCCESSFUL: parseEnvVar.boolean('RATE_LIMIT_SKIP_SUCCESSFUL', false),
      
      // Logging Configuration
      LOG_LEVEL: parseEnvVar.enum('LOG_LEVEL', ['error', 'warn', 'info', 'debug'], 'info'),
      ENABLE_REQUEST_LOGGING: parseEnvVar.boolean('ENABLE_REQUEST_LOGGING', true),
      ENABLE_STRUCTURED_LOGGING: parseEnvVar.boolean('ENABLE_STRUCTURED_LOGGING', false),
      
      // File Upload Configuration
      MAX_FILE_SIZE: parseEnvVar.number('MAX_FILE_SIZE', 10 * 1024 * 1024), // 10MB
      ALLOWED_FILE_TYPES: parseEnvVar.array('ALLOWED_FILE_TYPES', ',', [
        'image/jpeg', 'image/png', 'image/webp', 'image/gif'
      ]),
      UPLOAD_PATH: parseEnvVar.string('UPLOAD_PATH', './uploads'),
      
      // External API Configuration
      NANOBANANA_API_KEY: parseEnvVar.string('NANOBANANA_API_KEY', ''),
      NANOBANANA_API_URL: parseEnvVar.string('NANOBANANA_API_URL', 'https://api.nanobanana.ai/v1'),
      NANOBANANA_MODEL: parseEnvVar.string('NANOBANANA_MODEL', 'nano-banana'),
      
      // AWS Configuration
      AWS_REGION: parseEnvVar.string('AWS_REGION', 'us-east-1'),
      AWS_S3_BUCKET_NAME: parseEnvVar.string('AWS_S3_BUCKET_NAME', ''),
      AWS_ACCESS_KEY_ID: parseEnvVar.string('AWS_ACCESS_KEY_ID', ''),
      AWS_SECRET_ACCESS_KEY: parseEnvVar.string('AWS_SECRET_ACCESS_KEY', ''),
      AWS_CLOUDFRONT_DOMAIN_NAME: parseEnvVar.string('AWS_CLOUDFRONT_DOMAIN_NAME', ''),
      
      // Redis Configuration
      REDIS_URL: parseEnvVar.string('REDIS_URL'),
      REDIS_PASSWORD: parseEnvVar.string('REDIS_PASSWORD'),
      REDIS_DB: parseEnvVar.number('REDIS_DB', 0),
      
      // Monitoring Configuration
      ENABLE_METRICS: parseEnvVar.boolean('ENABLE_METRICS', true),
      ENABLE_HEALTH_CHECKS: parseEnvVar.boolean('ENABLE_HEALTH_CHECKS', true),
      HEALTH_CHECK_INTERVAL_MS: parseEnvVar.number('HEALTH_CHECK_INTERVAL_MS', 30000), // 30 seconds
      
      // Webhook Configuration
      WEBHOOK_URL: parseEnvVar.string('WEBHOOK_URL'),
      WEBHOOK_SECRET: parseEnvVar.string('WEBHOOK_SECRET'),
      WEBHOOK_RETRY_ATTEMPTS: parseEnvVar.number('WEBHOOK_RETRY_ATTEMPTS', 3),
      
      // Feature Flags
      ENABLE_BATCH_PROCESSING: parseEnvVar.boolean('ENABLE_BATCH_PROCESSING', true),
      ENABLE_WEBSOCKETS: parseEnvVar.boolean('ENABLE_WEBSOCKETS', false),
      ENABLE_API_DOCS: parseEnvVar.boolean('ENABLE_API_DOCS', true),
      ENABLE_DEBUG_LOGS: parseEnvVar.boolean('ENABLE_DEBUG_LOGS', false)
    };
  } catch (error) {
    console.error('Environment configuration error:', error);
    process.exit(1);
  }
};

/**
 * Validate critical configuration
 */
export const validateEnvConfig = (config: EnvConfig): {
  isValid: boolean;
  errors: string[];
  warnings: string[];
} => {
  const errors: string[] = [];
  const warnings: string[] = [];

  // Critical validations
  if (!config.DATABASE_URL) {
    errors.push('DATABASE_URL is required');
  }

  // Production-specific validations
  if (config.NODE_ENV === 'production') {
    if (config.JWT_SECRET === 'default-jwt-secret-change-in-production') {
      errors.push('JWT_SECRET must be changed in production');
    }
    
    if (config.ALLOWED_ORIGINS.includes('*')) {
      warnings.push('CORS is set to allow all origins in production');
    }
    
    if (!config.ENABLE_STRUCTURED_LOGGING) {
      warnings.push('Structured logging is recommended for production');
    }
  }

  // Optional feature warnings
  if (!config.REDIS_URL && config.NODE_ENV === 'production') {
    warnings.push('REDIS_URL is not set, caching will be disabled');
  }

  // Performance warnings
  if (config.DATABASE_MAX_CONNECTIONS < 5) {
    warnings.push('DATABASE_MAX_CONNECTIONS is very low, consider increasing for better performance');
  }

  if (config.RATE_LIMIT_MAX_REQUESTS > 1000) {
    warnings.push('RATE_LIMIT_MAX_REQUESTS is very high, consider lowering for better security');
  }

  return {
    isValid: errors.length === 0,
    errors,
    warnings
  };
};

/**
 * Create server configuration from environment
 */
export const createServerConfig = (envConfig: EnvConfig): ServerConfig => {
  return {
    port: envConfig.PORT,
    host: envConfig.HOST,
    env: envConfig.NODE_ENV,
    cors: {
      origin: envConfig.ALLOWED_ORIGINS.includes('*') 
        ? true 
        : envConfig.ALLOWED_ORIGINS,
      methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
      allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
      exposedHeaders: ['X-Total-Count', 'X-Page-Count'],
      credentials: envConfig.CORS_CREDENTIALS,
      maxAge: envConfig.CORS_MAX_AGE
    },
    security: {
      contentSecurityPolicy: {
        directives: {
          defaultSrc: ["'self'"],
          styleSrc: ["'self'", "'unsafe-inline'"],
          scriptSrc: ["'self'"],
          imgSrc: ["'self'", "data:", "https:"],
          connectSrc: ["'self'"],
          fontSrc: ["'self'"],
          objectSrc: ["'none'"],
          mediaSrc: ["'self'"],
          frameSrc: ["'none'"]
        }
      },
      crossOriginEmbedderPolicy: false,
      crossOriginOpenerPolicy: false,
      crossOriginResourcePolicy: { policy: 'cross-origin' },
      dnsPrefetchControl: true,
      frameguard: { action: 'deny' },
      hidePoweredBy: true,
      hsts: {
        maxAge: 31536000,
        includeSubDomains: true,
        preload: true
      },
      ieNoOpen: true,
      noSniff: true,
      originAgentCluster: true,
      permittedCrossDomainPolicies: false,
      referrerPolicy: { policy: 'no-referrer' },
      xssFilter: true
    },
    rateLimit: {
      windowMs: envConfig.RATE_LIMIT_WINDOW_MS,
      max: envConfig.RATE_LIMIT_MAX_REQUESTS,
      standardHeaders: true,
      legacyHeaders: false,
      skipSuccessfulRequests: envConfig.RATE_LIMIT_SKIP_SUCCESSFUL,
      skipFailedRequests: false,
      message: 'Too many requests, please try again later.'
    },
    errorHandler: {
      includeStack: envConfig.NODE_ENV === 'development',
      logErrors: true,
      trustProxy: envConfig.NODE_ENV === 'production'
    },
    gracefulShutdown: {
      timeout: 30000, // 30 seconds
      signals: ['SIGTERM', 'SIGINT', 'SIGUSR2']
    }
  };
};

/**
 * Get environment-specific database configuration
 */
export const getDatabaseConfig = (envConfig: EnvConfig) => {
  return {
    url: envConfig.DATABASE_URL,
    maxConnections: envConfig.DATABASE_MAX_CONNECTIONS,
    connectionTimeoutMs: envConfig.DATABASE_CONNECTION_TIMEOUT,
    queryTimeoutMs: envConfig.DATABASE_QUERY_TIMEOUT,
    idleTimeoutMs: envConfig.DATABASE_IDLE_TIMEOUT,
    maxRetries: envConfig.DATABASE_MAX_RETRIES,
    enableLogging: envConfig.NODE_ENV === 'development',
    enableSlowQueryLogging: true,
    slowQueryThresholdMs: 1000
  };
};

// Global environment configuration instance
export const ENV_CONFIG = loadEnvConfig();

// Validate configuration on load
const validation = validateEnvConfig(ENV_CONFIG);
if (validation.warnings.length > 0) {
  console.warn('Environment configuration warnings:', validation.warnings.join(', '));
}
if (!validation.isValid) {
  console.error('Environment configuration errors:', validation.errors.join(', '));
  process.exit(1);
}

// Export server configuration
export const SERVER_CONFIG = createServerConfig(ENV_CONFIG);
export const DATABASE_CONFIG = getDatabaseConfig(ENV_CONFIG);

// Helper functions for runtime configuration access
export const isProduction = () => ENV_CONFIG.NODE_ENV === 'production';
export const isDevelopment = () => ENV_CONFIG.NODE_ENV === 'development';
export const isTest = () => ENV_CONFIG.NODE_ENV === 'test';

// Export for other modules
export default ENV_CONFIG;
