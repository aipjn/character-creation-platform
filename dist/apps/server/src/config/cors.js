"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.corsConfig = exports.createOriginValidator = exports.createCorsMiddleware = exports.validateCorsConfig = exports.getCorsConfig = exports.healthCheckCorsConfig = exports.websocketCorsConfig = exports.uploadCorsConfig = exports.apiCorsConfig = void 0;
const env_1 = require("./env");
const developmentCorsConfig = {
    origin: (origin, callback) => {
        if (!origin)
            return callback(null, true);
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
    maxAge: 86400,
    preflightContinue: false,
    optionsSuccessStatus: 204
};
const productionCorsConfig = {
    origin: (origin, callback) => {
        if (!origin) {
            return callback(null, true);
        }
        const allowedOrigins = env_1.ENV_CONFIG.ALLOWED_ORIGINS;
        if (allowedOrigins.includes('*')) {
            console.warn('CORS: Allowing all origins in production - this may be a security risk');
            return callback(null, true);
        }
        if (allowedOrigins.includes(origin)) {
            return callback(null, true);
        }
        const isAllowed = allowedOrigins.some(allowedOrigin => {
            if (allowedOrigin.startsWith('*.')) {
                const domain = allowedOrigin.slice(2);
                return origin.endsWith(`.${domain}`) || origin === domain;
            }
            if (allowedOrigin.startsWith('//')) {
                return origin.includes(allowedOrigin.slice(2));
            }
            return false;
        });
        if (isAllowed) {
            return callback(null, true);
        }
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
    credentials: env_1.ENV_CONFIG.CORS_CREDENTIALS,
    maxAge: env_1.ENV_CONFIG.CORS_MAX_AGE,
    preflightContinue: false,
    optionsSuccessStatus: 204
};
const testCorsConfig = {
    origin: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: '*',
    exposedHeaders: '*',
    credentials: true,
    maxAge: 0,
    preflightContinue: false,
    optionsSuccessStatus: 200
};
exports.apiCorsConfig = {
    origin: (origin, callback) => {
        if ((0, env_1.isDevelopment)()) {
            const devOrigin = developmentCorsConfig.origin;
            if (typeof devOrigin === 'function') {
                return devOrigin(origin, callback);
            }
            return callback(null, devOrigin === true);
        }
        if ((0, env_1.isProduction)()) {
            const prodOrigin = productionCorsConfig.origin;
            if (typeof prodOrigin === 'function') {
                return prodOrigin(origin, callback);
            }
            return callback(null, prodOrigin === true);
        }
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
    credentials: false,
    maxAge: 300,
    preflightContinue: false,
    optionsSuccessStatus: 204
};
exports.uploadCorsConfig = {
    origin: (origin, callback) => {
        if ((0, env_1.isDevelopment)()) {
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
    maxAge: 3600,
    preflightContinue: false,
    optionsSuccessStatus: 204
};
exports.websocketCorsConfig = {
    origin: (origin) => {
        if ((0, env_1.isDevelopment)()) {
            return true;
        }
        if (!origin)
            return false;
        const allowedOrigins = env_1.ENV_CONFIG.ALLOWED_ORIGINS;
        return allowedOrigins.includes('*') || allowedOrigins.includes(origin);
    },
    credentials: true
};
exports.healthCheckCorsConfig = {
    origin: '*',
    methods: ['GET', 'OPTIONS'],
    allowedHeaders: ['Content-Type'],
    exposedHeaders: [],
    credentials: false,
    maxAge: 86400,
    preflightContinue: false,
    optionsSuccessStatus: 200
};
const getCorsConfig = () => {
    if ((0, env_1.isDevelopment)()) {
        return developmentCorsConfig;
    }
    if ((0, env_1.isProduction)()) {
        return productionCorsConfig;
    }
    return testCorsConfig;
};
exports.getCorsConfig = getCorsConfig;
const validateCorsConfig = (config) => {
    const warnings = [];
    const errors = [];
    if ((0, env_1.isProduction)()) {
        if (config.origin === true || (Array.isArray(config.origin) && config.origin.includes('*'))) {
            warnings.push('CORS origin is set to allow all origins in production');
        }
        if (config.credentials && config.origin === true) {
            errors.push('CORS credentials cannot be used with wildcard origin');
        }
    }
    const allowedHeaders = Array.isArray(config.allowedHeaders) ? config.allowedHeaders : [];
    if (allowedHeaders.includes('*')) {
        warnings.push('CORS allowedHeaders includes wildcard - may be overly permissive');
    }
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
exports.validateCorsConfig = validateCorsConfig;
const createCorsMiddleware = (type = 'default') => {
    let config;
    switch (type) {
        case 'api':
            config = exports.apiCorsConfig;
            break;
        case 'upload':
            config = exports.uploadCorsConfig;
            break;
        case 'health':
            config = exports.healthCheckCorsConfig;
            break;
        default:
            config = (0, exports.getCorsConfig)();
            break;
    }
    const validation = (0, exports.validateCorsConfig)(config);
    if (validation.warnings.length > 0) {
        console.warn(`CORS ${type} configuration warnings:`, validation.warnings.join(', '));
    }
    if (!validation.isValid) {
        console.error(`CORS ${type} configuration errors:`, validation.errors.join(', '));
    }
    return config;
};
exports.createCorsMiddleware = createCorsMiddleware;
const createOriginValidator = (additionalOrigins = []) => {
    return (origin, callback) => {
        if (!origin) {
            return callback(null, true);
        }
        const baseAllowedOrigins = env_1.ENV_CONFIG.ALLOWED_ORIGINS;
        const allAllowedOrigins = [...baseAllowedOrigins, ...additionalOrigins];
        const isAllowed = allAllowedOrigins.some(allowedOrigin => {
            if (allowedOrigin === '*')
                return true;
            if (allowedOrigin === origin)
                return true;
            if (allowedOrigin.startsWith('*.')) {
                const domain = allowedOrigin.slice(2);
                return origin.endsWith(`.${domain}`) || origin === domain;
            }
            return false;
        });
        if (isAllowed) {
            callback(null, true);
        }
        else {
            console.warn(`CORS: Blocked request from origin: ${origin}`);
            callback(new Error(`Origin ${origin} not allowed by CORS policy`), false);
        }
    };
};
exports.createOriginValidator = createOriginValidator;
exports.corsConfig = (0, exports.getCorsConfig)();
exports.default = exports.corsConfig;
//# sourceMappingURL=cors.js.map