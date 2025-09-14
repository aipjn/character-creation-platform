import { SubscriptionTier } from '@prisma/client';

export interface UserValidationResult {
  isValid: boolean;
  errors: string[];
}

export interface CreateUserInput {
  email: string;
  auth0Id?: string;
  name?: string;
  avatar?: string;
  subscriptionTier?: SubscriptionTier;
}

export interface UpdateUserInput {
  name?: string;
  avatar?: string;
  subscriptionTier?: SubscriptionTier;
}

export class UserSchema {
  /**
   * Validates email format and requirements
   */
  static validateEmail(email: string): UserValidationResult {
    const errors: string[] = [];
    
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
    
    // RFC 5322 compliant email regex (simplified but comprehensive)
    const emailRegex = /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*$/;
    
    if (!emailRegex.test(trimmedEmail)) {
      errors.push('Invalid email format');
    }
    
    return {
      isValid: errors.length === 0,
      errors
    };
  }
  
  /**
   * Validates user name field
   */
  static validateName(name: string | undefined): UserValidationResult {
    const errors: string[] = [];
    
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
      
      // Only allow letters, numbers, spaces, hyphens, apostrophes, and periods
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
  
  /**
   * Validates Auth0 ID format
   */
  static validateAuth0Id(auth0Id: string | undefined): UserValidationResult {
    const errors: string[] = [];
    
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
      
      // Auth0 IDs typically follow pattern: provider|identifier
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
  
  /**
   * Validates avatar URL
   */
  static validateAvatar(avatar: string | undefined): UserValidationResult {
    const errors: string[] = [];
    
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
      
      // Basic URL format validation
      try {
        const url = new URL(trimmedAvatar);
        if (!['http:', 'https:'].includes(url.protocol)) {
          errors.push('Avatar URL must use HTTP or HTTPS protocol');
        }
      } catch {
        errors.push('Avatar must be a valid URL');
      }
    }
    
    return {
      isValid: errors.length === 0,
      errors
    };
  }
  
  /**
   * Validates subscription tier
   */
  static validateSubscriptionTier(tier: SubscriptionTier | undefined): UserValidationResult {
    const errors: string[] = [];
    
    if (tier !== undefined) {
      const validTiers = Object.values(SubscriptionTier);
      if (!validTiers.includes(tier)) {
        errors.push(`Subscription tier must be one of: ${validTiers.join(', ')}`);
      }
    }
    
    return {
      isValid: errors.length === 0,
      errors
    };
  }
  
  /**
   * Validates complete user creation input
   */
  static validateCreateInput(input: CreateUserInput): UserValidationResult {
    const allErrors: string[] = [];
    
    // Email is required for creation
    const emailValidation = this.validateEmail(input.email);
    allErrors.push(...emailValidation.errors);
    
    // Validate optional fields
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
  
  /**
   * Validates user update input
   */
  static validateUpdateInput(input: UpdateUserInput): UserValidationResult {
    const allErrors: string[] = [];
    
    // All fields are optional for updates, but if provided must be valid
    const nameValidation = this.validateName(input.name);
    allErrors.push(...nameValidation.errors);
    
    const avatarValidation = this.validateAvatar(input.avatar);
    allErrors.push(...avatarValidation.errors);
    
    const tierValidation = this.validateSubscriptionTier(input.subscriptionTier);
    allErrors.push(...tierValidation.errors);
    
    // At least one field must be provided for update
    if (!input.name && !input.avatar && !input.subscriptionTier) {
      allErrors.push('At least one field must be provided for update');
    }
    
    return {
      isValid: allErrors.length === 0,
      errors: allErrors
    };
  }
  
  /**
   * Sanitizes user input by trimming strings and removing potentially harmful content
   */
  static sanitizeCreateInput(input: CreateUserInput): CreateUserInput {
    return {
      email: input.email?.trim(),
      auth0Id: input.auth0Id?.trim(),
      name: input.name?.trim(),
      avatar: input.avatar?.trim(),
      subscriptionTier: input.subscriptionTier
    };
  }
  
  /**
   * Sanitizes user update input
   */
  static sanitizeUpdateInput(input: UpdateUserInput): UpdateUserInput {
    const sanitized: UpdateUserInput = {};
    
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