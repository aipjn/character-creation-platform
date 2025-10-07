"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createAuthMiddleware = exports.authErrorHandler = exports.logout = exports.validateSession = exports.userRateLimit = exports.requireOwnership = exports.requireRole = exports.requireVerifiedEmail = exports.optionalAuth = exports.authenticate = exports.AuthorizationError = exports.AuthenticationError = void 0;
const auth_service_1 = require("./auth.service");
const requireAuth_1 = require("../../middleware/requireAuth");
const env_1 = require("../../config/env");
class AuthenticationError extends Error {
    constructor(message, statusCode = 401, code = 'AUTHENTICATION_FAILED') {
        super(message);
        this.name = 'AuthenticationError';
        this.statusCode = statusCode;
        this.code = code;
    }
}
exports.AuthenticationError = AuthenticationError;
class AuthorizationError extends Error {
    constructor(message, statusCode = 403, code = 'AUTHORIZATION_FAILED') {
        super(message);
        this.name = 'AuthorizationError';
        this.statusCode = statusCode;
        this.code = code;
    }
}
exports.AuthorizationError = AuthorizationError;
function extractToken(req) {
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
        return authHeader.substring(7);
    }
    const sessionCookie = req.cookies?.[`character-creator-session`];
    if (sessionCookie) {
        return sessionCookie;
    }
    if (env_1.ENV_CONFIG.NODE_ENV !== 'production' && req.query.token) {
        return req.query.token;
    }
    return null;
}
const authenticate = async (req, res, next) => {
    try {
        const token = extractToken(req);
        if (!token) {
            req.auth = { isAuthenticated: false };
            return next();
        }
        const authService = (0, auth_service_1.getAuthService)();
        const user = await authService.verifyToken(token);
        if (!user) {
            req.auth = { isAuthenticated: false, token };
            return next();
        }
        req.user = user;
        req.auth = {
            isAuthenticated: true,
            token,
            sessionId: req.sessionID
        };
        next();
    }
    catch (error) {
        console.error('Authentication middleware error:', error);
        req.auth = { isAuthenticated: false };
        next();
    }
};
exports.authenticate = authenticate;
exports.optionalAuth = exports.authenticate;
const requireVerifiedEmail = (req, res, next) => {
    if (!req.user?.emailVerified) {
        throw new AuthenticationError('Email verification required', 401, 'EMAIL_VERIFICATION_REQUIRED');
    }
    next();
};
exports.requireVerifiedEmail = requireVerifiedEmail;
const requireRole = (...roles) => {
    return (req, res, next) => {
        if (!req.user?.roles || req.user.roles.length === 0) {
            throw new AuthorizationError('Insufficient permissions', 403, 'INSUFFICIENT_PERMISSIONS');
        }
        const hasRequiredRole = roles.some(role => req.user.roles.includes(role));
        if (!hasRequiredRole) {
            throw new AuthorizationError(`Required roles: ${roles.join(', ')}`, 403, 'ROLE_REQUIRED');
        }
        next();
    };
};
exports.requireRole = requireRole;
const requireOwnership = (resourceIdParam = 'id') => {
    return async (req, res, next) => {
        try {
            const _resourceId = req.params[resourceIdParam];
            const userId = req.user?.id;
            if (!userId) {
                throw new AuthenticationError('Authentication required', 401);
            }
            if (req.baseUrl.includes('/characters') || req.route?.path.includes('character')) {
            }
            next();
        }
        catch (error) {
            if (error instanceof AuthenticationError || error instanceof AuthorizationError) {
                throw error;
            }
            throw new AuthorizationError('Resource access denied', 403);
        }
    };
};
exports.requireOwnership = requireOwnership;
const userRateLimit = (maxRequests = 100, windowMs = 15 * 60 * 1000) => {
    const userRequests = new Map();
    return (req, res, next) => {
        const userId = req.user?.id;
        if (!userId) {
            return next();
        }
        const now = Date.now();
        const userLimit = userRequests.get(userId);
        if (!userLimit || now > userLimit.resetTime) {
            userRequests.set(userId, {
                count: 1,
                resetTime: now + windowMs
            });
            return next();
        }
        if (userLimit.count >= maxRequests) {
            throw new AuthenticationError('User rate limit exceeded', 429, 'RATE_LIMIT_EXCEEDED');
        }
        userLimit.count++;
        next();
    };
};
exports.userRateLimit = userRateLimit;
const validateSession = async (req, res, next) => {
    try {
        if (!req.auth?.isAuthenticated || !req.auth?.sessionId) {
            return next();
        }
        const authService = (0, auth_service_1.getAuthService)();
        const isValidSession = await authService.validateSession(req.auth.sessionId);
        if (!isValidSession) {
            req.auth.isAuthenticated = false;
            delete req.user;
            res.clearCookie('character-creator-session');
        }
        next();
    }
    catch (error) {
        console.error('Session validation error:', error);
        next();
    }
};
exports.validateSession = validateSession;
const logout = async (req, res, next) => {
    try {
        if (req.user?.id) {
            const authService = (0, auth_service_1.getAuthService)();
            await authService.logoutUser(req.user.id, req.auth?.sessionId);
        }
        res.clearCookie('character-creator-session');
        res.clearCookie('connect.sid');
        delete req.user;
        req.auth = { isAuthenticated: false };
        next();
    }
    catch (error) {
        console.error('Logout middleware error:', error);
        next(error);
    }
};
exports.logout = logout;
const authErrorHandler = (error, req, res, next) => {
    if (error instanceof AuthenticationError) {
        res.status(error.statusCode).json({
            error: {
                message: error.message,
                code: error.code,
                type: 'AuthenticationError'
            }
        });
        return;
    }
    if (error instanceof AuthorizationError) {
        res.status(error.statusCode).json({
            error: {
                message: error.message,
                code: error.code,
                type: 'AuthorizationError'
            }
        });
        return;
    }
    next(error);
};
exports.authErrorHandler = authErrorHandler;
const createAuthMiddleware = (options = {}) => {
    const middlewares = [];
    middlewares.push(exports.authenticate);
    middlewares.push(exports.validateSession);
    if (options.required) {
        middlewares.push(requireAuth_1.requireAuth);
    }
    if (options.requireEmailVerification) {
        middlewares.push(exports.requireVerifiedEmail);
    }
    if (options.roles && options.roles.length > 0) {
        middlewares.push((0, exports.requireRole)(...options.roles));
    }
    if (options.requireOwnership) {
        middlewares.push((0, exports.requireOwnership)(options.resourceIdParam));
    }
    return middlewares;
};
exports.createAuthMiddleware = createAuthMiddleware;
exports.default = {
    authenticate: exports.authenticate,
    optionalAuth: exports.optionalAuth,
    requireVerifiedEmail: exports.requireVerifiedEmail,
    requireRole: exports.requireRole,
    requireOwnership: exports.requireOwnership,
    userRateLimit: exports.userRateLimit,
    validateSession: exports.validateSession,
    logout: exports.logout,
    authErrorHandler: exports.authErrorHandler,
    createAuthMiddleware: exports.createAuthMiddleware
};
//# sourceMappingURL=auth.middleware.js.map