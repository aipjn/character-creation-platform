import { CHARACTER_LIMITS, FILE_LIMITS } from '@shared/constants';

export interface ValidationResult {
  isValid: boolean;
  errors: string[];
}

export class ValidationUtils {
  static validateCharacterName(name: string): ValidationResult {
    const errors: string[] = [];
    
    if (!name || name.trim().length === 0) {
      errors.push('Character name is required');
    }
    
    if (name.length > CHARACTER_LIMITS.MAX_NAME_LENGTH) {
      errors.push(`Character name must be ${CHARACTER_LIMITS.MAX_NAME_LENGTH} characters or less`);
    }
    
    return {
      isValid: errors.length === 0,
      errors
    };
  }

  static validateCharacterDescription(description: string): ValidationResult {
    const errors: string[] = [];
    
    if (description && description.length > CHARACTER_LIMITS.MAX_DESCRIPTION_LENGTH) {
      errors.push(`Description must be ${CHARACTER_LIMITS.MAX_DESCRIPTION_LENGTH} characters or less`);
    }
    
    return {
      isValid: errors.length === 0,
      errors
    };
  }

  static validateCharacterTags(tags: string[]): ValidationResult {
    const errors: string[] = [];
    
    if (tags.length > CHARACTER_LIMITS.MAX_TAGS) {
      errors.push(`Maximum ${CHARACTER_LIMITS.MAX_TAGS} tags allowed`);
    }
    
    for (const tag of tags) {
      if (tag.length > CHARACTER_LIMITS.MAX_TAG_LENGTH) {
        errors.push(`Tag "${tag}" must be ${CHARACTER_LIMITS.MAX_TAG_LENGTH} characters or less`);
      }
    }
    
    return {
      isValid: errors.length === 0,
      errors
    };
  }

  static validateEmail(email: string): ValidationResult {
    const errors: string[] = [];
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    
    if (!email || email.trim().length === 0) {
      errors.push('Email is required');
    } else if (!emailRegex.test(email)) {
      errors.push('Invalid email format');
    }
    
    return {
      isValid: errors.length === 0,
      errors
    };
  }

  static validateFileType(fileName: string, mimeType: string): ValidationResult {
    const errors: string[] = [];
    
    if (!FILE_LIMITS.ALLOWED_IMAGE_TYPES.includes(mimeType)) {
      errors.push('Invalid file type. Only JPEG, PNG, and WebP images are allowed');
    }
    
    const extension = fileName.toLowerCase().substring(fileName.lastIndexOf('.'));
    if (!FILE_LIMITS.ALLOWED_EXTENSIONS.includes(extension)) {
      errors.push('Invalid file extension');
    }
    
    return {
      isValid: errors.length === 0,
      errors
    };
  }

  static validateFileSize(size: number): ValidationResult {
    const errors: string[] = [];
    
    if (size > FILE_LIMITS.MAX_FILE_SIZE) {
      errors.push(`File size must be ${FILE_LIMITS.MAX_FILE_SIZE / (1024 * 1024)}MB or less`);
    }
    
    return {
      isValid: errors.length === 0,
      errors
    };
  }
}