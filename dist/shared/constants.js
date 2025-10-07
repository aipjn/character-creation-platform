"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.DEFAULT_VALUES = exports.FILE_LIMITS = exports.CHARACTER_LIMITS = exports.HTTP_STATUS = exports.API_ENDPOINTS = void 0;
exports.API_ENDPOINTS = {
    HEALTH: '/health',
    API_V1: '/api/v1',
    CHARACTERS: '/api/v1/characters',
    USERS: '/api/v1/users',
    UPLOAD: '/api/v1/upload'
};
exports.HTTP_STATUS = {
    OK: 200,
    CREATED: 201,
    BAD_REQUEST: 400,
    UNAUTHORIZED: 401,
    FORBIDDEN: 403,
    NOT_FOUND: 404,
    INTERNAL_SERVER_ERROR: 500
};
exports.CHARACTER_LIMITS = {
    MAX_NAME_LENGTH: 100,
    MAX_DESCRIPTION_LENGTH: 1000,
    MAX_TAGS: 10,
    MAX_TAG_LENGTH: 50
};
exports.FILE_LIMITS = {
    MAX_FILE_SIZE: 10 * 1024 * 1024,
    ALLOWED_IMAGE_TYPES: ['image/jpeg', 'image/png', 'image/webp'],
    ALLOWED_EXTENSIONS: ['.jpg', '.jpeg', '.png', '.webp']
};
exports.DEFAULT_VALUES = {
    CHARACTER_VERSION: 1,
    PUBLIC_CHARACTER: false,
    DEFAULT_PORT: 3000
};
//# sourceMappingURL=constants.js.map