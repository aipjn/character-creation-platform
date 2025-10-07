"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.API_CONSTANTS = void 0;
exports.API_CONSTANTS = {
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
            WINDOW_MS: 15 * 60 * 1000,
            MAX_REQUESTS: 100
        },
        STRICT: {
            WINDOW_MS: 15 * 60 * 1000,
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
    },
    ERROR_CODES: {
        VALIDATION_ERROR: 'VALIDATION_ERROR',
        NOT_FOUND: 'NOT_FOUND',
        UNAUTHORIZED: 'UNAUTHORIZED',
        FORBIDDEN: 'FORBIDDEN',
        RATE_LIMITED: 'RATE_LIMITED',
        INTERNAL_ERROR: 'INTERNAL_ERROR',
        SERVICE_UNAVAILABLE: 'SERVICE_UNAVAILABLE'
    }
};
//# sourceMappingURL=api.js.map