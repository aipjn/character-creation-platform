"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.UserSchema = void 0;
const client_1 = require("@prisma/client");
class UserSchema {
    static validateEmail(email) {
        const errors = [];
        if (!email || typeof email !== 'string') {
            errors.push('Email is required and must be a string');
            return { isValid: false, errors };
        }
        const trimmedEmail = email.trim();
        if (trimmedEmail.length === 0) {
            errors.push('Email cannot be empty');
        }
        if (trimmedEmail.length > 254) {
            errors.push('Email must be 254 characters or less');
        }
        const emailRegex = /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*$/;
        if (!emailRegex.test(trimmedEmail)) {
            errors.push('Invalid email format');
        }
        return {
            isValid: errors.length === 0,
            errors
        };
    }
    static validateName(name) {
        const errors = [];
        if (name !== undefined) {
            if (typeof name !== 'string') {
                errors.push('Name must be a string');
                return { isValid: false, errors };
            }
            const trimmedName = name.trim();
            if (trimmedName.length === 0) {
                errors.push('Name cannot be empty if provided');
            }
            if (trimmedName.length > 100) {
                errors.push('Name must be 100 characters or less');
            }
            const nameRegex = /^[a-zA-Z0-9\s\-'.]+$/;
            if (!nameRegex.test(trimmedName)) {
                errors.push('Name contains invalid characters');
            }
        }
        return {
            isValid: errors.length === 0,
            errors
        };
    }
    static validateAuth0Id(auth0Id) {
        const errors = [];
        if (auth0Id !== undefined) {
            if (typeof auth0Id !== 'string') {
                errors.push('Auth0 ID must be a string');
                return { isValid: false, errors };
            }
            const trimmedAuth0Id = auth0Id.trim();
            if (trimmedAuth0Id.length === 0) {
                errors.push('Auth0 ID cannot be empty if provided');
            }
            if (trimmedAuth0Id.length > 255) {
                errors.push('Auth0 ID must be 255 characters or less');
            }
            const auth0IdRegex = /^[a-zA-Z0-9_\-|.]+$/;
            if (!auth0IdRegex.test(trimmedAuth0Id)) {
                errors.push('Auth0 ID format is invalid');
            }
        }
        return {
            isValid: errors.length === 0,
            errors
        };
    }
    static validateAvatar(avatar) {
        const errors = [];
        if (avatar !== undefined) {
            if (typeof avatar !== 'string') {
                errors.push('Avatar must be a string');
                return { isValid: false, errors };
            }
            const trimmedAvatar = avatar.trim();
            if (trimmedAvatar.length === 0) {
                errors.push('Avatar URL cannot be empty if provided');
            }
            if (trimmedAvatar.length > 2048) {
                errors.push('Avatar URL must be 2048 characters or less');
            }
            try {
                const url = new URL(trimmedAvatar);
                if (!['http:', 'https:'].includes(url.protocol)) {
                    errors.push('Avatar URL must use HTTP or HTTPS protocol');
                }
            }
            catch {
                errors.push('Avatar must be a valid URL');
            }
        }
        return {
            isValid: errors.length === 0,
            errors
        };
    }
    static validateSubscriptionTier(tier) {
        const errors = [];
        if (tier !== undefined) {
            const validTiers = Object.values(client_1.SubscriptionTier);
            if (!validTiers.includes(tier)) {
                errors.push(`Subscription tier must be one of: ${validTiers.join(', ')}`);
            }
        }
        return {
            isValid: errors.length === 0,
            errors
        };
    }
    static validateCreateInput(input) {
        const allErrors = [];
        const emailValidation = this.validateEmail(input.email);
        allErrors.push(...emailValidation.errors);
        const nameValidation = this.validateName(input.name);
        allErrors.push(...nameValidation.errors);
        const auth0IdValidation = this.validateAuth0Id(input.auth0Id);
        allErrors.push(...auth0IdValidation.errors);
        const avatarValidation = this.validateAvatar(input.avatar);
        allErrors.push(...avatarValidation.errors);
        const tierValidation = this.validateSubscriptionTier(input.subscriptionTier);
        allErrors.push(...tierValidation.errors);
        return {
            isValid: allErrors.length === 0,
            errors: allErrors
        };
    }
    static validateUpdateInput(input) {
        const allErrors = [];
        const nameValidation = this.validateName(input.name);
        allErrors.push(...nameValidation.errors);
        const avatarValidation = this.validateAvatar(input.avatar);
        allErrors.push(...avatarValidation.errors);
        const tierValidation = this.validateSubscriptionTier(input.subscriptionTier);
        allErrors.push(...tierValidation.errors);
        if (!input.name && !input.avatar && !input.subscriptionTier) {
            allErrors.push('At least one field must be provided for update');
        }
        return {
            isValid: allErrors.length === 0,
            errors: allErrors
        };
    }
    static sanitizeCreateInput(input) {
        return {
            email: input.email?.trim(),
            auth0Id: input.auth0Id?.trim(),
            name: input.name?.trim(),
            avatar: input.avatar?.trim(),
            subscriptionTier: input.subscriptionTier
        };
    }
    static sanitizeUpdateInput(input) {
        const sanitized = {};
        if (input.name !== undefined) {
            sanitized.name = input.name.trim();
        }
        if (input.avatar !== undefined) {
            sanitized.avatar = input.avatar.trim();
        }
        if (input.subscriptionTier !== undefined) {
            sanitized.subscriptionTier = input.subscriptionTier;
        }
        return sanitized;
    }
}
exports.UserSchema = UserSchema;
//# sourceMappingURL=userSchema.js.map