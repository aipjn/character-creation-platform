/**
 * File upload validation utilities
 * Handles file type, size, and format validation for photo uploads
 */

export interface ValidationResult {
  isValid: boolean;
  error?: string;
}

export interface UploadValidatorConfig {
  maxFileSize: number; // in bytes
  allowedMimeTypes: string[];
  allowedExtensions: string[];
}

export class UploadValidator {
  private config: UploadValidatorConfig;

  constructor(config?: Partial<UploadValidatorConfig>) {
    this.config = {
      maxFileSize: config?.maxFileSize || 5 * 1024 * 1024, // 5MB default
      allowedMimeTypes: config?.allowedMimeTypes || [
        'image/jpeg',
        'image/jpg',
        'image/png',
        'image/webp'
      ],
      allowedExtensions: config?.allowedExtensions || [
        '.jpg',
        '.jpeg',
        '.png',
        '.webp'
      ]
    };
  }

  /**
   * Validates a single file
   */
  validateFile(file: File): ValidationResult {
    // Check file size
    if (file.size > this.config.maxFileSize) {
      const maxSizeMB = Math.round(this.config.maxFileSize / (1024 * 1024));
      return {
        isValid: false,
        error: `File size exceeds ${maxSizeMB}MB limit`
      };
    }

    // Check MIME type
    if (!this.config.allowedMimeTypes.includes(file.type)) {
      return {
        isValid: false,
        error: 'File type not supported. Please upload JPG, PNG, or WebP images.'
      };
    }

    // Check file extension
    const fileExtension = this.getFileExtension(file.name);
    if (!this.config.allowedExtensions.includes(fileExtension)) {
      return {
        isValid: false,
        error: 'File extension not supported. Please upload JPG, PNG, or WebP images.'
      };
    }

    return { isValid: true };
  }

  /**
   * Validates multiple files
   */
  validateFiles(files: File[]): ValidationResult {
    for (const file of files) {
      const result = this.validateFile(file);
      if (!result.isValid) {
        return result;
      }
    }
    return { isValid: true };
  }

  /**
   * Validates file by checking if it's an actual image
   */
  async validateImageFile(file: File): Promise<ValidationResult> {
    const basicValidation = this.validateFile(file);
    if (!basicValidation.isValid) {
      return basicValidation;
    }

    return new Promise((resolve) => {
      const img = new Image();
      const url = URL.createObjectURL(file);

      img.onload = () => {
        URL.revokeObjectURL(url);
        resolve({ isValid: true });
      };

      img.onerror = () => {
        URL.revokeObjectURL(url);
        resolve({
          isValid: false,
          error: 'File is not a valid image'
        });
      };

      img.src = url;
    });
  }

  /**
   * Gets file extension from filename
   */
  private getFileExtension(filename: string): string {
    return filename.toLowerCase().substring(filename.lastIndexOf('.'));
  }

  /**
   * Formats file size to human readable string
   */
  static formatFileSize(bytes: number): string {
    if (bytes === 0) return '0 Bytes';
    
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    
    return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + ' ' + sizes[i];
  }
}

// Default validator instance
export const defaultValidator = new UploadValidator();