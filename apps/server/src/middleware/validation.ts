import { Request, Response, NextFunction } from 'express';
import { UserSchema, CreateUserInput, UpdateUserInput } from '../schemas/userSchema';
import { CharacterSchema, CreateCharacterInput, UpdateCharacterInput } from '../schemas/characterSchema';

// Extended Request interface to include validated data
export interface ValidatedRequest<T = any> extends Request {
  validatedData?: T;
}

// Validation error class
export class ValidationError extends Error {
  public statusCode: number;
  public errors: string[];

  constructor(errors: string[]) {
    super('Validation failed');
    this.name = 'ValidationError';
    this.statusCode = 400;
    this.errors = errors;
  }
}

/**
 * Generic validation middleware factory
 */
export function createValidationMiddleware<T>(
  validator: (data: any) => { isValid: boolean; errors: string[] },
  sanitizer?: (data: any) => T
) {
  return (req: ValidatedRequest<T>, res: Response, next: NextFunction) => {
    try {
      // Get data from request body
      const data = req.body;

      // Validate the data
      const validation = validator(data);

      if (!validation.isValid) {
        throw new ValidationError(validation.errors);
      }

      // Sanitize if sanitizer is provided
      if (sanitizer) {
        req.validatedData = sanitizer(data);
      } else {
        req.validatedData = data;
      }

      next();
    } catch (error) {
      next(error);
    }
  };
}

/**
 * Middleware to validate user creation input
 */
export const validateCreateUser = createValidationMiddleware<CreateUserInput>(
  UserSchema.validateCreateInput,
  UserSchema.sanitizeCreateInput
);

/**
 * Middleware to validate user update input
 */
export const validateUpdateUser = createValidationMiddleware<UpdateUserInput>(
  UserSchema.validateUpdateInput,
  UserSchema.sanitizeUpdateInput
);

/**
 * Middleware to validate character creation input
 */
export const validateCreateCharacter = createValidationMiddleware<CreateCharacterInput>(
  CharacterSchema.validateCreateInput,
  CharacterSchema.sanitizeCreateInput
);

/**
 * Middleware to validate character update input
 */
export const validateUpdateCharacter = createValidationMiddleware<UpdateCharacterInput>(
  CharacterSchema.validateUpdateInput,
  CharacterSchema.sanitizeUpdateInput
);

/**
 * Middleware to validate query parameters
 */
export function validateQueryParams(
  validator: (params: any) => { isValid: boolean; errors: string[] }
) {
  return (req: Request, res: Response, next: NextFunction) => {
    try {
      const validation = validator(req.query);

      if (!validation.isValid) {
        throw new ValidationError(validation.errors);
      }

      next();
    } catch (error) {
      next(error);
    }
  };
}

/**
 * Middleware to validate path parameters
 */
export function validatePathParams(
  validator: (params: any) => { isValid: boolean; errors: string[] }
) {
  return (req: Request, res: Response, next: NextFunction) => {
    try {
      const validation = validator(req.params);

      if (!validation.isValid) {
        throw new ValidationError(validation.errors);
      }

      next();
    } catch (error) {
      next(error);
    }
  };
}

/**
 * Common validators for path parameters
 */
export const PathValidators = {
  /**
   * Validates CUID format for IDs
   */
  validateId: (params: { id: string }) => {
    const errors: string[] = [];
    
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
  
  /**
   * Validates user ID parameter
   */
  validateUserId: (params: { userId: string }) => {
    const errors: string[] = [];
    
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
  
  /**
   * Validates character ID parameter
   */
  validateCharacterId: (params: { characterId: string }) => {
    const errors: string[] = [];
    
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

/**
 * Common validators for query parameters
 */
export const QueryValidators = {
  /**
   * Validates pagination parameters
   */
  validatePagination: (query: any) => {
    const errors: string[] = [];
    
    // Validate skip parameter
    if (query.skip !== undefined) {
      const skip = parseInt(query.skip, 10);
      if (isNaN(skip) || skip < 0) {
        errors.push('Skip parameter must be a non-negative number');
      }
    }
    
    // Validate take/limit parameter
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
  
  /**
   * Validates search parameters
   */
  validateSearch: (query: any) => {
    const errors: string[] = [];
    
    if (query.search !== undefined) {
      if (typeof query.search !== 'string') {
        errors.push('Search parameter must be a string');
      } else if (query.search.trim().length < 2) {
        errors.push('Search parameter must be at least 2 characters long');
      } else if (query.search.length > 100) {
        errors.push('Search parameter must be 100 characters or less');
      }
    }
    
    return {
      isValid: errors.length === 0,
      errors
    };
  },
  
  /**
   * Validates filter parameters for characters
   */
  validateCharacterFilters: (query: any) => {
    const errors: string[] = [];
    
    // Validate styleType filter
    if (query.styleType !== undefined) {
      const validStyles = ['REALISTIC', 'CARTOON', 'ANIME', 'FANTASY', 'CYBERPUNK', 'VINTAGE', 'MINIMALIST'];
      if (!validStyles.includes(query.styleType)) {
        errors.push(`Style type must be one of: ${validStyles.join(', ')}`);
      }
    }
    
    // Validate tags filter
    if (query.tags !== undefined) {
      let tags: string[];
      
      if (typeof query.tags === 'string') {
        tags = query.tags.split(',');
      } else if (Array.isArray(query.tags)) {
        tags = query.tags;
      } else {
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
    
    // Validate isPublic filter
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

/**
 * Middleware factory for validating file uploads
 */
export function validateFileUpload(options: {
  allowedTypes?: string[];
  maxSize?: number; // in bytes
  required?: boolean;
}) {
  const {
    allowedTypes = ['image/jpeg', 'image/png', 'image/webp'],
    maxSize = 10 * 1024 * 1024, // 10MB default
    required = false
  } = options;

  type BasicUploadedFile = {
    mimetype: string;
    size: number;
    originalname?: string;
  };

  return (req: Request, res: Response, next: NextFunction) => {
    try {
      const { file } = req as Request & { file?: BasicUploadedFile };
      const errors: string[] = [];

      if (!file && required) {
        errors.push('File upload is required');
      }

      if (file) {
        // Validate file type
        if (!allowedTypes.includes(file.mimetype)) {
          errors.push(`File type ${file.mimetype} is not allowed. Allowed types: ${allowedTypes.join(', ')}`);
        }

        // Validate file size
        if (file.size > maxSize) {
          errors.push(`File size ${file.size} bytes exceeds maximum allowed size of ${maxSize} bytes`);
        }

        // Validate filename
        if (file.originalname && file.originalname.length > 255) {
          errors.push('Filename must be 255 characters or less');
        }
      }

      if (errors.length > 0) {
        throw new ValidationError(errors);
      }

      next();
    } catch (error) {
      next(error);
    }
  };
}

/**
 * Content-Type validation middleware
 */
export function validateContentType(expectedTypes: string[]) {
  return (req: Request, res: Response, next: NextFunction) => {
    try {
      const contentType = req.get('Content-Type');
      
      if (!contentType) {
        throw new ValidationError(['Content-Type header is required']);
      }
      
      const isValidContentType = expectedTypes.some(type => 
        contentType.startsWith(type)
      );
      
      if (!isValidContentType) {
        throw new ValidationError([
          `Invalid Content-Type. Expected one of: ${expectedTypes.join(', ')}, got: ${contentType}`
        ]);
      }
      
      next();
    } catch (error) {
      next(error);
    }
  };
}
