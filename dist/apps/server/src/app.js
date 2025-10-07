"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.validateAppConfig = exports.addMiddleware = exports.addRoutes = exports.createApp = void 0;
const express_1 = __importDefault(require("express"));
const cors_1 = __importDefault(require("cors"));
const helmet_1 = __importDefault(require("helmet"));
const express_rate_limit_1 = __importDefault(require("express-rate-limit"));
const path_1 = __importDefault(require("path"));
const core_1 = require("../../../config/core");
const cors_2 = require("./config/cors");
const index_1 = __importDefault(require("./routes/v1/index"));
const createApp = () => {
    const app = (0, express_1.default)();
    if ((0, core_1.isProduction)()) {
        app.use((0, helmet_1.default)());
    }
    if ((0, core_1.isProduction)()) {
        app.use((0, express_rate_limit_1.default)({
            windowMs: 15 * 60 * 1000,
            max: 100,
            standardHeaders: true,
            legacyHeaders: false
        }));
    }
    app.use((0, cors_1.default)((0, cors_2.getCorsConfig)()));
    app.use(express_1.default.static('public'));
    const uploadsPath = path_1.default.resolve(process.cwd(), 'uploads');
    app.use('/uploads', express_1.default.static(uploadsPath));
    app.use(express_1.default.json({
        limit: core_1.config.storage.maxFileSize,
        verify: (req, _res, buf) => {
            req.rawBody = buf;
        }
    }));
    app.use(express_1.default.urlencoded({
        extended: true,
        limit: core_1.config.storage.maxFileSize
    }));
    app.use((req, res, next) => {
        const requestId = req.get('X-Request-ID') ||
            `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        req.requestId = requestId;
        res.setHeader('X-Request-ID', requestId);
        next();
    });
    app.use((req, res, next) => {
        const startTime = Date.now();
        const cleanup = () => {
            const responseTime = Date.now() - startTime;
            if (!res.headersSent) {
                res.setHeader('X-Response-Time', `${responseTime}ms`);
            }
            if (responseTime > 5000) {
                console.warn(`Slow request: ${req.method} ${req.path} took ${responseTime}ms`);
            }
        };
        res.on('finish', cleanup);
        res.on('close', cleanup);
        next();
    });
    app.get('/health', async (_req, res) => {
        try {
            const healthCheck = {
                status: 'healthy',
                timestamp: new Date().toISOString(),
                version: '1.0.0',
                environment: core_1.config.server.nodeEnv,
                uptime: process.uptime(),
                services: {
                    database: {
                        status: 'unknown',
                        lastChecked: new Date().toISOString()
                    },
                    storage: {
                        status: 'unknown',
                        lastChecked: new Date().toISOString()
                    }
                }
            };
            res.status(200).json(healthCheck);
        }
        catch (error) {
            const healthCheck = {
                status: 'unhealthy',
                timestamp: new Date().toISOString(),
                version: '1.0.0',
                environment: core_1.config.server.nodeEnv,
                uptime: process.uptime(),
                services: {
                    database: {
                        status: 'unhealthy',
                        error: 'Health check failed',
                        lastChecked: new Date().toISOString()
                    },
                    storage: {
                        status: 'unhealthy',
                        error: 'Health check failed',
                        lastChecked: new Date().toISOString()
                    }
                }
            };
            res.status(503).json(healthCheck);
        }
    });
    app.use('/api/v1', index_1.default);
    app.use('/api', (req, res) => {
        res.redirect(301, `/api/v1${req.path}`);
    });
    if ((0, core_1.isDevelopment)()) {
        app.get('/api/v1/docs', (req, res) => {
            res.json({
                success: true,
                data: {
                    message: 'API documentation endpoint',
                    documentation: 'OpenAPI/Swagger documentation will be available here',
                    version: '1.0.0'
                },
                meta: {
                    timestamp: new Date().toISOString(),
                    requestId: req.requestId,
                    version: '1.0.0',
                    path: req.path
                }
            });
        });
    }
    app.use('*', (req, res) => {
        res.status(404).json({
            success: false,
            error: {
                code: 'NOT_FOUND',
                message: `Cannot ${req.method} ${req.originalUrl}`,
                statusCode: 404
            },
            meta: {
                timestamp: new Date().toISOString(),
                requestId: req.requestId,
                version: '1.0.0',
                path: req.path
            }
        });
    });
    app.use((error, req, res, _next) => {
        console.error(`Error handling request ${req.requestId}:`, error);
        if (error.name === 'ValidationError') {
            return res.status(400).json({
                success: false,
                error: {
                    code: 'VALIDATION_ERROR',
                    message: 'Request validation failed',
                    details: error.message,
                    statusCode: 400
                },
                meta: {
                    timestamp: new Date().toISOString(),
                    requestId: req.requestId,
                    version: '1.0.0',
                    path: req.path
                }
            });
        }
        if (error.name === 'UnauthorizedError' || error.message.includes('unauthorized')) {
            return res.status(401).json({
                success: false,
                error: {
                    code: 'UNAUTHORIZED',
                    message: 'Authentication required',
                    statusCode: 401
                },
                meta: {
                    timestamp: new Date().toISOString(),
                    requestId: req.requestId,
                    version: '1.0.0',
                    path: req.path
                }
            });
        }
        if (error instanceof SyntaxError && 'body' in error) {
            return res.status(400).json({
                success: false,
                error: {
                    code: 'INVALID_JSON',
                    message: 'Invalid JSON in request body',
                    statusCode: 400
                },
                meta: {
                    timestamp: new Date().toISOString(),
                    requestId: req.requestId,
                    version: '1.0.0',
                    path: req.path
                }
            });
        }
        const statusCode = error.statusCode || error.status || 500;
        const message = (0, core_1.isProduction)()
            ? 'Internal server error'
            : error.message || 'An unexpected error occurred';
        return res.status(statusCode).json({
            success: false,
            error: {
                code: 'INTERNAL_ERROR',
                message,
                details: (0, core_1.isDevelopment)() ? error.stack : undefined,
                statusCode
            },
            meta: {
                timestamp: new Date().toISOString(),
                requestId: req.requestId,
                version: '1.0.0',
                path: req.path
            }
        });
    });
    return app;
};
exports.createApp = createApp;
const addRoutes = (app, routes) => {
    routes.forEach(({ path, router }) => {
        app.use(path, router);
        console.log(`Mounted routes at ${path}`);
    });
};
exports.addRoutes = addRoutes;
const addMiddleware = (app, middleware) => {
    middleware.forEach(({ path, handler }) => {
        if (path) {
            app.use(path, handler);
        }
        else {
            app.use(handler);
        }
    });
};
exports.addMiddleware = addMiddleware;
const validateAppConfig = () => {
    const warnings = [];
    const errors = [];
    if ((0, core_1.isProduction)() && !core_1.config.database?.url) {
        errors.push('DATABASE_URL is not configured for production');
    }
    if ((0, core_1.isDevelopment)()) {
        warnings.push('Running in development mode');
    }
    if ((0, core_1.isProduction)()) {
        if (!core_1.config.auth?.jwtSecret) {
            errors.push('JWT_SECRET is required for production');
        }
    }
    return {
        isValid: errors.length === 0,
        warnings,
        errors
    };
};
exports.validateAppConfig = validateAppConfig;
const appValidation = (0, exports.validateAppConfig)();
if (appValidation.warnings.length > 0) {
    console.warn('Application configuration warnings:', appValidation.warnings.join(', '));
}
if (!appValidation.isValid) {
    console.error('Application configuration errors:', appValidation.errors.join(', '));
}
exports.default = exports.createApp;
//# sourceMappingURL=app.js.map