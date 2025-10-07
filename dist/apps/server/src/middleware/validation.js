"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.QueryValidators = exports.PathValidators = exports.validateUpdateCharacter = exports.validateCreateCharacter = exports.validateUpdateUser = exports.validateCreateUser = exports.ValidationError = void 0;
exports.createValidationMiddleware = createValidationMiddleware;
exports.validateQueryParams = validateQueryParams;
exports.validatePathParams = validatePathParams;
exports.validateFileUpload = validateFileUpload;
exports.validateContentType = validateContentType;
const userSchema_1 = require("../schemas/userSchema");
const characterSchema_1 = require("../schemas/characterSchema");
class ValidationError extends Error {
    constructor(errors) {
        super('Validation failed');
        this.name = 'ValidationError';
        this.statusCode = 400;
        this.errors = errors;
    }
}
exports.ValidationError = ValidationError;
function createValidationMiddleware(validator, sanitizer) {
    return (req, res, next) => {
        try {
            const data = req.body;
            const validation = validator(data);
            if (!validation.isValid) {
                throw new ValidationError(validation.errors);
            }
            if (sanitizer) {
                req.validatedData = sanitizer(data);
            }
            else {
                req.validatedData = data;
            }
            next();
        }
        catch (error) {
            next(error);
        }
    };
}
exports.validateCreateUser = createValidationMiddleware(userSchema_1.UserSchema.validateCreateInput, userSchema_1.UserSchema.sanitizeCreateInput);
exports.validateUpdateUser = createValidationMiddleware(userSchema_1.UserSchema.validateUpdateInput, userSchema_1.UserSchema.sanitizeUpdateInput);
exports.validateCreateCharacter = createValidationMiddleware(characterSchema_1.CharacterSchema.validateCreateInput, characterSchema_1.CharacterSchema.sanitizeCreateInput);
exports.validateUpdateCharacter = createValidationMiddleware(characterSchema_1.CharacterSchema.validateUpdateInput, characterSchema_1.CharacterSchema.sanitizeUpdateInput);
function validateQueryParams(validator) {
    return (req, res, next) => {
        try {
            const validation = validator(req.query);
            if (!validation.isValid) {
                throw new ValidationError(validation.errors);
            }
            next();
        }
        catch (error) {
            next(error);
        }
    };
}
function validatePathParams(validator) {
    return (req, res, next) => {
        try {
            const validation = validator(req.params);
            if (!validation.isValid) {
                throw new ValidationError(validation.errors);
            }
            next();
        }
        catch (error) {
            next(error);
        }
    };
}
exports.PathValidators = {
    validateId: (params) => {
        const errors = [];
        if (!params.id || typeof params.id !== 'string') {
            errors.push('ID parameter is required and must be a string');
            return { isValid: false, errors };
        }
        const cuidRegex = /^c[a-z0-9]{24}$/;
        if (!cuidRegex.test(params.id)) {
            errors.push('ID must be a valid CUID format');
        }
        return {
            isValid: errors.length === 0,
            errors
        };
    },
    validateUserId: (params) => {
        const errors = [];
        if (!params.userId || typeof params.userId !== 'string') {
            errors.push('User ID parameter is required and must be a string');
            return { isValid: false, errors };
        }
        const cuidRegex = /^c[a-z0-9]{24}$/;
        if (!cuidRegex.test(params.userId)) {
            errors.push('User ID must be a valid CUID format');
        }
        return {
            isValid: errors.length === 0,
            errors
        };
    },
    validateCharacterId: (params) => {
        const errors = [];
        if (!params.characterId || typeof params.characterId !== 'string') {
            errors.push('Character ID parameter is required and must be a string');
            return { isValid: false, errors };
        }
        const cuidRegex = /^c[a-z0-9]{24}$/;
        if (!cuidRegex.test(params.characterId)) {
            errors.push('Character ID must be a valid CUID format');
        }
        return {
            isValid: errors.length === 0,
            errors
        };
    }
};
exports.QueryValidators = {
    validatePagination: (query) => {
        const errors = [];
        if (query.skip !== undefined) {
            const skip = parseInt(query.skip, 10);
            if (isNaN(skip) || skip < 0) {
                errors.push('Skip parameter must be a non-negative number');
            }
        }
        if (query.take !== undefined || query.limit !== undefined) {
            const take = parseInt(query.take || query.limit, 10);
            if (isNaN(take) || take < 1 || take > 100) {
                errors.push('Take/limit parameter must be a number between 1 and 100');
            }
        }
        return {
            isValid: errors.length === 0,
            errors
        };
    },
    validateSearch: (query) => {
        const errors = [];
        if (query.search !== undefined) {
            if (typeof query.search !== 'string') {
                errors.push('Search parameter must be a string');
            }
            else if (query.search.trim().length < 2) {
                errors.push('Search parameter must be at least 2 characters long');
            }
            else if (query.search.length > 100) {
                errors.push('Search parameter must be 100 characters or less');
            }
        }
        return {
            isValid: errors.length === 0,
            errors
        };
    },
    validateCharacterFilters: (query) => {
        const errors = [];
        if (query.styleType !== undefined) {
            const validStyles = ['REALISTIC', 'CARTOON', 'ANIME', 'FANTASY', 'CYBERPUNK', 'VINTAGE', 'MINIMALIST'];
            if (!validStyles.includes(query.styleType)) {
                errors.push(`Style type must be one of: ${validStyles.join(', ')}`);
            }
        }
        if (query.tags !== undefined) {
            let tags;
            if (typeof query.tags === 'string') {
                tags = query.tags.split(',');
            }
            else if (Array.isArray(query.tags)) {
                tags = query.tags;
            }
            else {
                errors.push('Tags parameter must be a string or array');
                return { isValid: false, errors };
            }
            if (tags.length > 10) {
                errors.push('Maximum 10 tags allowed for filtering');
            }
            for (const tag of tags) {
                if (typeof tag !== 'string' || tag.trim().length === 0) {
                    errors.push('All tags must be non-empty strings');
                    break;
                }
            }
        }
        if (query.isPublic !== undefined) {
            const isPublic = query.isPublic.toLowerCase();
            if (!['true', 'false'].includes(isPublic)) {
                errors.push('isPublic parameter must be "true" or "false"');
            }
        }
        return {
            isValid: errors.length === 0,
            errors
        };
    }
};
function validateFileUpload(options) {
    const { allowedTypes = ['image/jpeg', 'image/png', 'image/webp'], maxSize = 10 * 1024 * 1024, required = false } = options;
    return (req, res, next) => {
        try {
            const { file } = req;
            const errors = [];
            if (!file && required) {
                errors.push('File upload is required');
            }
            if (file) {
                if (!allowedTypes.includes(file.mimetype)) {
                    errors.push(`File type ${file.mimetype} is not allowed. Allowed types: ${allowedTypes.join(', ')}`);
                }
                if (file.size > maxSize) {
                    errors.push(`File size ${file.size} bytes exceeds maximum allowed size of ${maxSize} bytes`);
                }
                if (file.originalname && file.originalname.length > 255) {
                    errors.push('Filename must be 255 characters or less');
                }
            }
            if (errors.length > 0) {
                throw new ValidationError(errors);
            }
            next();
        }
        catch (error) {
            next(error);
        }
    };
}
function validateContentType(expectedTypes) {
    return (req, res, next) => {
        try {
            const contentType = req.get('Content-Type');
            if (!contentType) {
                throw new ValidationError(['Content-Type header is required']);
            }
            const isValidContentType = expectedTypes.some(type => contentType.startsWith(type));
            if (!isValidContentType) {
                throw new ValidationError([
                    `Invalid Content-Type. Expected one of: ${expectedTypes.join(', ')}, got: ${contentType}`
                ]);
            }
            next();
        }
        catch (error) {
            next(error);
        }
    };
}
//# sourceMappingURL=validation.js.map