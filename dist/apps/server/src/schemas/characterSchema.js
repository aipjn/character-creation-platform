"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.CharacterSchema = void 0;
const enums_1 = require("../../../../shared/types/enums");
class CharacterSchema {
    static validateName(name) {
        const errors = [];
        if (name !== undefined) {
            if (typeof name !== 'string') {
                errors.push('Character name must be a string');
                return { isValid: false, errors };
            }
            const trimmedName = name.trim();
            if (trimmedName.length === 0) {
                errors.push('Character name cannot be empty if provided');
            }
            if (trimmedName.length > this.MAX_NAME_LENGTH) {
                errors.push(`Character name must be ${this.MAX_NAME_LENGTH} characters or less`);
            }
            const nameRegex = /^[a-zA-Z0-9\s\-'".!?()]+$/;
            if (!nameRegex.test(trimmedName)) {
                errors.push('Character name contains invalid characters');
            }
        }
        return {
            isValid: errors.length === 0,
            errors
        };
    }
    static validatePrompt(prompt) {
        const errors = [];
        if (!prompt || typeof prompt !== 'string') {
            errors.push('Character prompt is required and must be a string');
            return { isValid: false, errors };
        }
        const trimmedPrompt = prompt.trim();
        if (trimmedPrompt.length === 0) {
            errors.push('Character prompt cannot be empty');
        }
        if (trimmedPrompt.length < 10) {
            errors.push('Character prompt must be at least 10 characters long');
        }
        if (trimmedPrompt.length > this.MAX_PROMPT_LENGTH) {
            errors.push(`Character prompt must be ${this.MAX_PROMPT_LENGTH} characters or less`);
        }
        const harmfulPatterns = [
            /<script[^>]*>.*?<\/script>/gi,
            /javascript:/gi,
            /vbscript:/gi,
            /onload=/gi,
            /onerror=/gi,
            /onclick=/gi
        ];
        for (const pattern of harmfulPatterns) {
            if (pattern.test(trimmedPrompt)) {
                errors.push('Character prompt contains potentially harmful content');
                break;
            }
        }
        return {
            isValid: errors.length === 0,
            errors
        };
    }
    static validateUserId(userId) {
        const errors = [];
        if (!userId || typeof userId !== 'string') {
            errors.push('User ID is required and must be a string');
            return { isValid: false, errors };
        }
        const trimmedUserId = userId.trim();
        if (trimmedUserId.length === 0) {
            errors.push('User ID cannot be empty');
        }
        const cuidRegex = /^c[a-z0-9]{24}$/;
        if (!cuidRegex.test(trimmedUserId)) {
            errors.push('User ID must be a valid CUID format');
        }
        return {
            isValid: errors.length === 0,
            errors
        };
    }
    static validateStyleType(styleType) {
        const errors = [];
        if (styleType !== undefined) {
            const validTypes = enums_1.STYLE_TYPES;
            if (!validTypes.includes(styleType)) {
                errors.push(`Style type must be one of: ${validTypes.join(', ')}`);
            }
        }
        return {
            isValid: errors.length === 0,
            errors
        };
    }
    static validateGenerationStatus(status) {
        const errors = [];
        if (status !== undefined) {
            const validStatuses = enums_1.GENERATION_STATUSES;
            if (!validStatuses.includes(status)) {
                errors.push(`Generation status must be one of: ${validStatuses.join(', ')}`);
            }
        }
        return {
            isValid: errors.length === 0,
            errors
        };
    }
    static validateTags(tags) {
        const errors = [];
        if (tags !== undefined) {
            if (!Array.isArray(tags)) {
                errors.push('Tags must be an array');
                return { isValid: false, errors };
            }
            if (tags.length > this.MAX_TAGS) {
                errors.push(`Maximum ${this.MAX_TAGS} tags allowed`);
            }
            for (let i = 0; i < tags.length; i++) {
                const tag = tags[i];
                if (typeof tag !== 'string') {
                    errors.push(`Tag at index ${i} must be a string`);
                    continue;
                }
                const trimmedTag = tag.trim();
                if (trimmedTag.length === 0) {
                    errors.push(`Tag at index ${i} cannot be empty`);
                    continue;
                }
                if (trimmedTag.length > this.MAX_TAG_LENGTH) {
                    errors.push(`Tag "${trimmedTag}" must be ${this.MAX_TAG_LENGTH} characters or less`);
                }
                const tagRegex = /^[a-zA-Z0-9\s\-_]+$/;
                if (!tagRegex.test(trimmedTag)) {
                    errors.push(`Tag "${trimmedTag}" contains invalid characters`);
                }
            }
            const uniqueTags = new Set(tags.map(tag => tag.trim().toLowerCase()));
            if (uniqueTags.size !== tags.length) {
                errors.push('Duplicate tags are not allowed');
            }
        }
        return {
            isValid: errors.length === 0,
            errors
        };
    }
    static validateUrl(url, fieldName) {
        const errors = [];
        if (url !== undefined) {
            if (typeof url !== 'string') {
                errors.push(`${fieldName} must be a string`);
                return { isValid: false, errors };
            }
            const trimmedUrl = url.trim();
            if (trimmedUrl.length === 0) {
                errors.push(`${fieldName} cannot be empty if provided`);
            }
            if (trimmedUrl.length > this.MAX_URL_LENGTH) {
                errors.push(`${fieldName} must be ${this.MAX_URL_LENGTH} characters or less`);
            }
            try {
                const urlObj = new URL(trimmedUrl);
                if (!['http:', 'https:'].includes(urlObj.protocol)) {
                    errors.push(`${fieldName} must use HTTP or HTTPS protocol`);
                }
            }
            catch {
                errors.push(`${fieldName} must be a valid URL`);
            }
        }
        return {
            isValid: errors.length === 0,
            errors
        };
    }
    static validateBoolean(value, fieldName) {
        const errors = [];
        if (value !== undefined && typeof value !== 'boolean') {
            errors.push(`${fieldName} must be a boolean value`);
        }
        return {
            isValid: errors.length === 0,
            errors
        };
    }
    static validateMetadata(metadata) {
        const errors = [];
        if (metadata !== undefined && metadata !== null) {
            try {
                const serialized = JSON.stringify(metadata);
                if (serialized.length > 65536) {
                    errors.push('Metadata must be 64KB or less when serialized');
                }
                if (typeof metadata !== 'object' || Array.isArray(metadata)) {
                    errors.push('Metadata must be a JSON object');
                }
            }
            catch (error) {
                errors.push('Metadata must be valid JSON');
            }
        }
        return {
            isValid: errors.length === 0,
            errors
        };
    }
    static validateCreateInput(input) {
        const allErrors = [];
        const userIdValidation = this.validateUserId(input.userId);
        allErrors.push(...userIdValidation.errors);
        const promptValidation = this.validatePrompt(input.prompt);
        allErrors.push(...promptValidation.errors);
        const nameValidation = this.validateName(input.name);
        allErrors.push(...nameValidation.errors);
        const styleTypeValidation = this.validateStyleType(input.styleType);
        allErrors.push(...styleTypeValidation.errors);
        const tagsValidation = this.validateTags(input.tags);
        allErrors.push(...tagsValidation.errors);
        const isPublicValidation = this.validateBoolean(input.isPublic, 'isPublic');
        allErrors.push(...isPublicValidation.errors);
        const imageUrlValidation = this.validateUrl(input.imageUrl, 'Image URL');
        allErrors.push(...imageUrlValidation.errors);
        const metadataValidation = this.validateMetadata(input.metadata);
        allErrors.push(...metadataValidation.errors);
        return {
            isValid: allErrors.length === 0,
            errors: allErrors
        };
    }
    static validateUpdateInput(input) {
        const allErrors = [];
        const nameValidation = this.validateName(input.name);
        allErrors.push(...nameValidation.errors);
        if (input.prompt !== undefined) {
            const promptValidation = this.validatePrompt(input.prompt);
            allErrors.push(...promptValidation.errors);
        }
        const styleTypeValidation = this.validateStyleType(input.styleType);
        allErrors.push(...styleTypeValidation.errors);
        const statusValidation = this.validateGenerationStatus(input.generationStatus);
        allErrors.push(...statusValidation.errors);
        const tagsValidation = this.validateTags(input.tags);
        allErrors.push(...tagsValidation.errors);
        const isPublicValidation = this.validateBoolean(input.isPublic, 'isPublic');
        allErrors.push(...isPublicValidation.errors);
        const imageUrlValidation = this.validateUrl(input.imageUrl, 'Image URL');
        allErrors.push(...imageUrlValidation.errors);
        const thumbnailValidation = this.validateUrl(input.thumbnailUrl, 'Thumbnail URL');
        allErrors.push(...thumbnailValidation.errors);
        const metadataValidation = this.validateMetadata(input.metadata);
        allErrors.push(...metadataValidation.errors);
        const hasFields = Object.keys(input).length > 0;
        if (!hasFields) {
            allErrors.push('At least one field must be provided for update');
        }
        return {
            isValid: allErrors.length === 0,
            errors: allErrors
        };
    }
    static sanitizeCreateInput(input) {
        return {
            userId: input.userId.trim(),
            name: input.name?.trim(),
            prompt: input.prompt.trim(),
            styleType: input.styleType,
            tags: input.tags?.map(tag => tag.trim()).filter(tag => tag.length > 0),
            isPublic: input.isPublic,
            metadata: input.metadata,
            imageUrl: input.imageUrl?.trim()
        };
    }
    static sanitizeUpdateInput(input) {
        const sanitized = {};
        if (input.name !== undefined) {
            sanitized.name = input.name.trim();
        }
        if (input.prompt !== undefined) {
            sanitized.prompt = input.prompt.trim();
        }
        if (input.styleType !== undefined) {
            sanitized.styleType = input.styleType;
        }
        if (input.tags !== undefined) {
            sanitized.tags = input.tags.map(tag => tag.trim()).filter(tag => tag.length > 0);
        }
        if (input.isPublic !== undefined) {
            sanitized.isPublic = input.isPublic;
        }
        if (input.imageUrl !== undefined) {
            sanitized.imageUrl = input.imageUrl.trim();
        }
        if (input.thumbnailUrl !== undefined) {
            sanitized.thumbnailUrl = input.thumbnailUrl.trim();
        }
        if (input.generationStatus !== undefined) {
            sanitized.generationStatus = input.generationStatus;
        }
        if (input.metadata !== undefined) {
            sanitized.metadata = input.metadata;
        }
        return sanitized;
    }
}
exports.CharacterSchema = CharacterSchema;
CharacterSchema.MAX_NAME_LENGTH = 100;
CharacterSchema.MAX_PROMPT_LENGTH = 2000;
CharacterSchema.MAX_TAGS = 20;
CharacterSchema.MAX_TAG_LENGTH = 50;
CharacterSchema.MAX_URL_LENGTH = 2048;
//# sourceMappingURL=characterSchema.js.map