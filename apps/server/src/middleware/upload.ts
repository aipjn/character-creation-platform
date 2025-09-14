/**
 * Upload Middleware
 * File upload handling with validation, security, and AWS S3 integration
 */

import multer from 'multer';
import { Request, Response, NextFunction } from 'express';
import path from 'path';
import crypto from 'crypto';
import { ApiRequest, ApiResponse, UploadedFile, FileUploadConfig, API_CONSTANTS } from '../types/api';

/**
 * Supported file types for uploads
 */
export const SUPPORTED_IMAGE_TYPES = {
  'image/jpeg': '.jpg',
  'image/jpg': '.jpg',
  'image/png': '.png',
  'image/gif': '.gif',
  'image/webp': '.webp',
  'image/bmp': '.bmp',
  'image/tiff': '.tiff'
} as const;

export const SUPPORTED_DOCUMENT_TYPES = {
  'application/pdf': '.pdf',
  'text/plain': '.txt',
  'application/json': '.json'
} as const;

export const ALL_SUPPORTED_TYPES = {
  ...SUPPORTED_IMAGE_TYPES,
  ...SUPPORTED_DOCUMENT_TYPES
} as const;

/**
 * Default upload configuration
 */
export const DEFAULT_UPLOAD_CONFIG: FileUploadConfig = {
  maxFileSize: 10 * 1024 * 1024, // 10MB
  allowedMimeTypes: Object.keys(SUPPORTED_IMAGE_TYPES),
  destinationPath: 'uploads',
  preserveOriginalName: false
};

/**
 * Upload validation error types
 */
export class UploadError extends Error {
  constructor(
    message: string,
    public code: string,
    public statusCode: number = 400
  ) {
    super(message);
    this.name = 'UploadError';
  }
}

/**
 * File validation utilities
 */
export class FileValidator {
  /**
   * Validate file MIME type
   */
  static validateMimeType(mimetype: string, allowedTypes: string[]): boolean {
    return allowedTypes.includes(mimetype);
  }

  /**
   * Validate file size
   */
  static validateFileSize(size: number, maxSize: number): boolean {
    return size <= maxSize;
  }

  /**
   * Validate file extension matches MIME type
   */
  static validateExtension(filename: string, mimetype: string): boolean {
    const extension = path.extname(filename).toLowerCase();
    const expectedExtension = ALL_SUPPORTED_TYPES[mimetype as keyof typeof ALL_SUPPORTED_TYPES];
    return expectedExtension === extension;
  }

  /**
   * Check for potentially malicious file patterns
   */
  static checkForMaliciousContent(filename: string, buffer: Buffer): boolean {
    // Check filename for dangerous patterns
    const dangerousPatterns = [
      /\.php$/i,
      /\.exe$/i,
      /\.bat$/i,
      /\.cmd$/i,
      /\.scr$/i,
      /\.com$/i,
      /\.pif$/i,
      /\.sh$/i,
      /\.js$/i,
      /\.html$/i,
      /\.htm$/i
    ];

    for (const pattern of dangerousPatterns) {
      if (pattern.test(filename)) {
        return true;
      }
    }

    // Check for script injection in file headers (basic check)
    const headerString = buffer.slice(0, 512).toString('utf8');
    const scriptPatterns = [
      /<script/i,
      /javascript:/i,
      /vbscript:/i,
      /onload=/i,
      /onerror=/i
    ];

    for (const pattern of scriptPatterns) {
      if (pattern.test(headerString)) {
        return true;
      }
    }

    return false;
  }

  /**
   * Comprehensive file validation
   */
  static validateFile(
    file: Express.Multer.File,
    config: FileUploadConfig
  ): { isValid: boolean; errors: string[] } {
    const errors: string[] = [];

    // Check MIME type
    if (!this.validateMimeType(file.mimetype, config.allowedMimeTypes)) {
      errors.push(`File type ${file.mimetype} is not allowed`);
    }

    // Check file size
    if (!this.validateFileSize(file.size, config.maxFileSize)) {
      errors.push(`File size ${file.size} exceeds maximum allowed size of ${config.maxFileSize} bytes`);
    }

    // Check extension matches MIME type
    if (!this.validateExtension(file.originalname, file.mimetype)) {
      errors.push('File extension does not match MIME type');
    }

    // Check for malicious content
    if (this.checkForMaliciousContent(file.originalname, file.buffer)) {
      errors.push('File contains potentially malicious content');
    }

    return {
      isValid: errors.length === 0,
      errors
    };
  }
}

/**
 * Generate secure filename
 */
export function generateSecureFilename(originalName: string, preserveOriginal: boolean = false): string {
  if (preserveOriginal) {
    const timestamp = Date.now();
    const random = crypto.randomBytes(4).toString('hex');
    const extension = path.extname(originalName);
    const basename = path.basename(originalName, extension);
    return `${timestamp}_${random}_${basename}${extension}`;
  } else {
    const timestamp = Date.now();
    const random = crypto.randomBytes(8).toString('hex');
    const extension = path.extname(originalName);
    return `${timestamp}_${random}${extension}`;
  }
}

/**
 * Create multer storage configuration
 */
export function createStorageConfig(config: FileUploadConfig): multer.StorageEngine {
  return multer.memoryStorage(); // Use memory storage for S3 upload
}

/**
 * Create multer file filter
 */
export function createFileFilter(config: FileUploadConfig): multer.Options['fileFilter'] {
  return (req: Request, file: Express.Multer.File, callback: multer.FileFilterCallback) => {
    // Basic MIME type check
    if (!config.allowedMimeTypes.includes(file.mimetype)) {
      const error = new UploadError(
        `File type ${file.mimetype} is not allowed`,
        'INVALID_FILE_TYPE'
      );
      return callback(error as any, false);
    }

    callback(null, true);
  };
}

/**
 * Create multer configuration
 */
export function createMulterConfig(config: Partial<FileUploadConfig> = {}): multer.Options {
  const uploadConfig = { ...DEFAULT_UPLOAD_CONFIG, ...config };

  return {
    storage: createStorageConfig(uploadConfig),
    fileFilter: createFileFilter(uploadConfig),
    limits: {
      fileSize: uploadConfig.maxFileSize,
      files: 10, // Max 10 files per request
      fieldSize: 1024 * 1024, // 1MB field size limit
      fields: 20 // Max 20 fields
    }
  };
}

/**
 * Single file upload middleware
 */
export function singleFileUpload(
  fieldName: string,
  config?: Partial<FileUploadConfig>
): multer.Multer {
  const multerConfig = createMulterConfig(config);
  return multer(multerConfig).single(fieldName);
}

/**
 * Multiple files upload middleware
 */
export function multipleFilesUpload(
  fieldName: string,
  maxCount: number = 10,
  config?: Partial<FileUploadConfig>
): multer.Multer {
  const multerConfig = createMulterConfig(config);
  return multer(multerConfig).array(fieldName, maxCount);
}

/**
 * Fields upload middleware for different field types
 */
export function fieldsUpload(
  fields: multer.Field[],
  config?: Partial<FileUploadConfig>
): multer.Multer {
  const multerConfig = createMulterConfig(config);
  return multer(multerConfig).fields(fields);
}

/**
 * Upload validation middleware
 * Validates uploaded files after multer processing
 */
export function validateUpload(config: Partial<FileUploadConfig> = {}) {
  const uploadConfig = { ...DEFAULT_UPLOAD_CONFIG, ...config };

  return (req: ApiRequest, res: Response, next: NextFunction): void => {
    try {
      const files = req.files as Express.Multer.File[] | { [fieldname: string]: Express.Multer.File[] } | undefined;
      const file = req.file as Express.Multer.File | undefined;

      let filesToValidate: Express.Multer.File[] = [];

      // Collect all files to validate
      if (file) {
        filesToValidate.push(file);
      }

      if (files) {
        if (Array.isArray(files)) {
          filesToValidate.push(...files);
        } else {
          // files is an object with field names as keys
          Object.values(files).forEach(fieldFiles => {
            filesToValidate.push(...fieldFiles);
          });
        }
      }

      // Validate each file
      for (const fileToValidate of filesToValidate) {
        const validation = FileValidator.validateFile(fileToValidate, uploadConfig);
        
        if (!validation.isValid) {
          const response: ApiResponse = {
            success: false,
            error: {
              code: API_CONSTANTS.ERROR_CODES.VALIDATION_ERROR,
              message: 'File validation failed',
              details: validation.errors,
              statusCode: API_CONSTANTS.HTTP_STATUS.BAD_REQUEST
            },
            meta: {
              timestamp: new Date().toISOString(),
              requestId: req.requestId,
              version: '1.0.0',
              path: req.path
            }
          };

          return res.status(API_CONSTANTS.HTTP_STATUS.BAD_REQUEST).json(response);
        }
      }

      next();
    } catch (error) {
      const response: ApiResponse = {
        success: false,
        error: {
          code: API_CONSTANTS.ERROR_CODES.INTERNAL_ERROR,
          message: 'File validation error',
          statusCode: API_CONSTANTS.HTTP_STATUS.INTERNAL_SERVER_ERROR
        },
        meta: {
          timestamp: new Date().toISOString(),
          requestId: req.requestId,
          version: '1.0.0',
          path: req.path
        }
      };

      res.status(API_CONSTANTS.HTTP_STATUS.INTERNAL_SERVER_ERROR).json(response);
    }
  };
}

/**
 * Upload error handler middleware
 */
export function handleUploadError() {
  return (error: any, req: ApiRequest, res: Response, next: NextFunction): void => {
    if (error instanceof multer.MulterError) {
      let message = 'File upload error';
      let code = API_CONSTANTS.ERROR_CODES.VALIDATION_ERROR;
      let statusCode = API_CONSTANTS.HTTP_STATUS.BAD_REQUEST;

      switch (error.code) {
        case 'LIMIT_FILE_SIZE':
          message = 'File size too large';
          code = 'FILE_TOO_LARGE';
          statusCode = API_CONSTANTS.HTTP_STATUS.UNPROCESSABLE_ENTITY;
          break;
        case 'LIMIT_FILE_COUNT':
          message = 'Too many files';
          code = 'TOO_MANY_FILES';
          break;
        case 'LIMIT_UNEXPECTED_FILE':
          message = 'Unexpected file field';
          code = 'UNEXPECTED_FILE';
          break;
        case 'LIMIT_PART_COUNT':
          message = 'Too many parts';
          code = 'TOO_MANY_PARTS';
          break;
        case 'LIMIT_FIELD_KEY':
          message = 'Field name too long';
          code = 'FIELD_NAME_TOO_LONG';
          break;
        case 'LIMIT_FIELD_VALUE':
          message = 'Field value too long';
          code = 'FIELD_VALUE_TOO_LONG';
          break;
        case 'LIMIT_FIELD_COUNT':
          message = 'Too many fields';
          code = 'TOO_MANY_FIELDS';
          break;
      }

      const response: ApiResponse = {
        success: false,
        error: {
          code,
          message,
          details: error.message,
          statusCode
        },
        meta: {
          timestamp: new Date().toISOString(),
          requestId: req.requestId,
          version: '1.0.0',
          path: req.path
        }
      };

      return res.status(statusCode).json(response);
    }

    if (error instanceof UploadError) {
      const response: ApiResponse = {
        success: false,
        error: {
          code: error.code,
          message: error.message,
          statusCode: error.statusCode
        },
        meta: {
          timestamp: new Date().toISOString(),
          requestId: req.requestId,
          version: '1.0.0',
          path: req.path
        }
      };

      return res.status(error.statusCode).json(response);
    }

    next(error);
  };
}

/**
 * Character image upload middleware
 * Specialized middleware for character image uploads
 */
export function characterImageUpload() {
  const config: Partial<FileUploadConfig> = {
    maxFileSize: 5 * 1024 * 1024, // 5MB for images
    allowedMimeTypes: Object.keys(SUPPORTED_IMAGE_TYPES),
    preserveOriginalName: false
  };

  return [
    singleFileUpload('image', config),
    validateUpload(config),
    handleUploadError()
  ];
}

/**
 * Profile avatar upload middleware
 */
export function avatarUpload() {
  const config: Partial<FileUploadConfig> = {
    maxFileSize: 2 * 1024 * 1024, // 2MB for avatars
    allowedMimeTypes: ['image/jpeg', 'image/png', 'image/gif', 'image/webp'],
    preserveOriginalName: false
  };

  return [
    singleFileUpload('avatar', config),
    validateUpload(config),
    handleUploadError()
  ];
}

/**
 * Convert multer file to UploadedFile interface
 */
export function convertToUploadedFile(file: Express.Multer.File, url?: string): UploadedFile {
  return {
    fieldname: file.fieldname,
    originalname: file.originalname,
    filename: generateSecureFilename(file.originalname),
    mimetype: file.mimetype,
    size: file.size,
    path: file.path || '',
    url
  };
}

/**
 * Export upload utilities
 */
export {
  FileUploadConfig,
  UploadedFile,
  DEFAULT_UPLOAD_CONFIG,
  FileValidator,
  generateSecureFilename,
  createMulterConfig
};