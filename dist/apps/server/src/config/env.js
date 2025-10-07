"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.isTest = exports.isDevelopment = exports.isProduction = exports.DATABASE_CONFIG = exports.SERVER_CONFIG = exports.ENV_CONFIG = exports.getDatabaseConfig = exports.createServerConfig = exports.validateEnvConfig = exports.loadEnvConfig = void 0;
const dotenv_1 = __importDefault(require("dotenv"));
dotenv_1.default.config();
const parseEnvVar = {
    string: (key, defaultValue, required = false) => {
        const value = process.env[key];
        if (!value && required && !defaultValue) {
            throw new Error(`Required environment variable ${key} is not set`);
        }
        return value || defaultValue || '';
    },
    number: (key, defaultValue, required = false) => {
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
    boolean: (key, defaultValue = false) => {
        const value = process.env[key];
        if (!value)
            return defaultValue;
        return value.toLowerCase() === 'true' || value === '1';
    },
    array: (key, separator = ',', defaultValue = []) => {
        const value = process.env[key];
        if (!value)
            return defaultValue;
        return value.split(separator).map(item => item.trim()).filter(Boolean);
    },
    enum: (key, allowedValues, defaultValue, required = false) => {
        const value = process.env[key];
        if (!value && required && !defaultValue) {
            throw new Error(`Required environment variable ${key} is not set`);
        }
        const finalValue = value || defaultValue;
        if (finalValue && !allowedValues.includes(finalValue)) {
            throw new Error(`Environment variable ${key} must be one of: ${allowedValues.join(', ')}`);
        }
        return finalValue;
    }
};
const loadEnvConfig = () => {
    try {
        return {
            NODE_ENV: parseEnvVar.enum('NODE_ENV', ['development', 'production', 'test'], 'development'),
            PORT: parseEnvVar.number('PORT', 3000),
            HOST: parseEnvVar.string('HOST', '0.0.0.0'),
            DATABASE_URL: parseEnvVar.string('DATABASE_URL', undefined, true),
            DATABASE_MAX_CONNECTIONS: parseEnvVar.number('DATABASE_MAX_CONNECTIONS', 20),
            DATABASE_CONNECTION_TIMEOUT: parseEnvVar.number('DATABASE_CONNECTION_TIMEOUT', 5000),
            DATABASE_QUERY_TIMEOUT: parseEnvVar.number('DATABASE_QUERY_TIMEOUT', 30000),
            DATABASE_IDLE_TIMEOUT: parseEnvVar.number('DATABASE_IDLE_TIMEOUT', 30000),
            DATABASE_MAX_RETRIES: parseEnvVar.number('DATABASE_MAX_RETRIES', 3),
            JWT_SECRET: parseEnvVar.string('JWT_SECRET', 'default-jwt-secret-change-in-production'),
            JWT_EXPIRES_IN: parseEnvVar.string('JWT_EXPIRES_IN', '24h'),
            BCRYPT_SALT_ROUNDS: parseEnvVar.number('BCRYPT_SALT_ROUNDS', 12),
            ALLOWED_ORIGINS: parseEnvVar.array('ALLOWED_ORIGINS', ',', ['*']),
            CORS_CREDENTIALS: parseEnvVar.boolean('CORS_CREDENTIALS', true),
            CORS_MAX_AGE: parseEnvVar.number('CORS_MAX_AGE', 86400),
            RATE_LIMIT_WINDOW_MS: parseEnvVar.number('RATE_LIMIT_WINDOW_MS', 15 * 60 * 1000),
            RATE_LIMIT_MAX_REQUESTS: parseEnvVar.number('RATE_LIMIT_MAX_REQUESTS', 100),
            RATE_LIMIT_SKIP_SUCCESSFUL: parseEnvVar.boolean('RATE_LIMIT_SKIP_SUCCESSFUL', false),
            LOG_LEVEL: parseEnvVar.enum('LOG_LEVEL', ['error', 'warn', 'info', 'debug'], 'info'),
            ENABLE_REQUEST_LOGGING: parseEnvVar.boolean('ENABLE_REQUEST_LOGGING', true),
            ENABLE_STRUCTURED_LOGGING: parseEnvVar.boolean('ENABLE_STRUCTURED_LOGGING', false),
            MAX_FILE_SIZE: parseEnvVar.number('MAX_FILE_SIZE', 10 * 1024 * 1024),
            ALLOWED_FILE_TYPES: parseEnvVar.array('ALLOWED_FILE_TYPES', ',', [
                'image/jpeg', 'image/png', 'image/webp', 'image/gif'
            ]),
            UPLOAD_PATH: parseEnvVar.string('UPLOAD_PATH', './uploads'),
            NANOBANANA_API_KEY: parseEnvVar.string('NANOBANANA_API_KEY', ''),
            NANOBANANA_API_URL: parseEnvVar.string('NANOBANANA_API_URL', 'https://api.nanobanana.ai/v1'),
            NANOBANANA_MODEL: parseEnvVar.string('NANOBANANA_MODEL', 'nano-banana'),
            REDIS_URL: parseEnvVar.string('REDIS_URL'),
            REDIS_PASSWORD: parseEnvVar.string('REDIS_PASSWORD'),
            REDIS_DB: parseEnvVar.number('REDIS_DB', 0),
            ENABLE_METRICS: parseEnvVar.boolean('ENABLE_METRICS', true),
            ENABLE_HEALTH_CHECKS: parseEnvVar.boolean('ENABLE_HEALTH_CHECKS', true),
            HEALTH_CHECK_INTERVAL_MS: parseEnvVar.number('HEALTH_CHECK_INTERVAL_MS', 30000),
            WEBHOOK_URL: parseEnvVar.string('WEBHOOK_URL'),
            WEBHOOK_SECRET: parseEnvVar.string('WEBHOOK_SECRET'),
            WEBHOOK_RETRY_ATTEMPTS: parseEnvVar.number('WEBHOOK_RETRY_ATTEMPTS', 3),
            ENABLE_BATCH_PROCESSING: parseEnvVar.boolean('ENABLE_BATCH_PROCESSING', true),
            ENABLE_WEBSOCKETS: parseEnvVar.boolean('ENABLE_WEBSOCKETS', false),
            ENABLE_API_DOCS: parseEnvVar.boolean('ENABLE_API_DOCS', true),
            ENABLE_DEBUG_LOGS: parseEnvVar.boolean('ENABLE_DEBUG_LOGS', false)
        };
    }
    catch (error) {
        console.error('Environment configuration error:', error);
        process.exit(1);
    }
};
exports.loadEnvConfig = loadEnvConfig;
const validateEnvConfig = (config) => {
    const errors = [];
    const warnings = [];
    if (!config.DATABASE_URL) {
        errors.push('DATABASE_URL is required');
    }
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
    if (!config.REDIS_URL && config.NODE_ENV === 'production') {
        warnings.push('REDIS_URL is not set, caching will be disabled');
    }
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
exports.validateEnvConfig = validateEnvConfig;
const createServerConfig = (envConfig) => {
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
            timeout: 30000,
            signals: ['SIGTERM', 'SIGINT', 'SIGUSR2']
        }
    };
};
exports.createServerConfig = createServerConfig;
const getDatabaseConfig = (envConfig) => {
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
exports.getDatabaseConfig = getDatabaseConfig;
exports.ENV_CONFIG = (0, exports.loadEnvConfig)();
const validation = (0, exports.validateEnvConfig)(exports.ENV_CONFIG);
if (validation.warnings.length > 0) {
    console.warn('Environment configuration warnings:', validation.warnings.join(', '));
}
if (!validation.isValid) {
    console.error('Environment configuration errors:', validation.errors.join(', '));
    process.exit(1);
}
exports.SERVER_CONFIG = (0, exports.createServerConfig)(exports.ENV_CONFIG);
exports.DATABASE_CONFIG = (0, exports.getDatabaseConfig)(exports.ENV_CONFIG);
const isProduction = () => exports.ENV_CONFIG.NODE_ENV === 'production';
exports.isProduction = isProduction;
const isDevelopment = () => exports.ENV_CONFIG.NODE_ENV === 'development';
exports.isDevelopment = isDevelopment;
const isTest = () => exports.ENV_CONFIG.NODE_ENV === 'test';
exports.isTest = isTest;
exports.default = exports.ENV_CONFIG;
//# sourceMappingURL=env.js.map