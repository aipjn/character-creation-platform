/**
 * Image Processing Utilities
 * Handles image optimization, resizing, format conversion, and validation
 */

import sharp from 'sharp';
import { bucketConfig } from '../config/aws.js';

// Types for image operations
export interface ImageOptimizationOptions {
  quality?: number;
  format?: 'jpeg' | 'png' | 'webp' | 'avif';
  maxWidth?: number;
  maxHeight?: number;
  progressive?: boolean;
  removeMetadata?: boolean;
}

export interface ThumbnailOptions {
  width: number;
  height: number;
  quality?: number;
  format?: 'jpeg' | 'png' | 'webp';
  fit?: 'cover' | 'contain' | 'fill' | 'inside' | 'outside';
  position?: string;
}

export interface ImageValidationResult {
  isValid: boolean;
  error?: string;
  metadata?: {
    width: number;
    height: number;
    format: string;
    size: number;
    hasAlpha: boolean;
  };
}

export interface ResizeOptions {
  width?: number;
  height?: number;
  fit?: 'cover' | 'contain' | 'fill' | 'inside' | 'outside';
  position?: string;
  background?: { r: number; g: number; b: number; alpha?: number };
}

/**
 * Validate image file format, size, and dimensions
 */
export async function validateImageFile(
  buffer: Buffer,
  expectedMimeType?: string
): Promise<ImageValidationResult> {
  try {
    const metadata = await sharp(buffer).metadata();
    
    if (!metadata.format || !metadata.width || !metadata.height) {
      return {
        isValid: false,
        error: 'Invalid image format or corrupted file'
      };
    }

    // Check if file format matches expected MIME type
    if (expectedMimeType) {
      const formatMap: Record<string, string[]> = {
        'image/jpeg': ['jpeg', 'jpg'],
        'image/png': ['png'],
        'image/webp': ['webp'],
        'image/gif': ['gif'],
        'image/avif': ['avif']
      };

      const allowedFormats = formatMap[expectedMimeType.toLowerCase()];
      if (allowedFormats && !allowedFormats.includes(metadata.format)) {
        return {
          isValid: false,
          error: `Image format ${metadata.format} does not match expected type ${expectedMimeType}`
        };
      }
    }

    // Check if MIME type is allowed
    if (!bucketConfig.allowedMimeTypes.includes(expectedMimeType || `image/${metadata.format}`)) {
      return {
        isValid: false,
        error: `Image format ${metadata.format} is not allowed`
      };
    }

    // Check file size
    if (buffer.length > bucketConfig.maxFileSize) {
      return {
        isValid: false,
        error: `File size ${buffer.length} bytes exceeds maximum allowed size ${bucketConfig.maxFileSize} bytes`
      };
    }

    // Check dimensions (reasonable limits)
    const maxDimension = 8192; // 8K resolution
    if (metadata.width > maxDimension || metadata.height > maxDimension) {
      return {
        isValid: false,
        error: `Image dimensions ${metadata.width}x${metadata.height} exceed maximum allowed ${maxDimension}x${maxDimension}`
      };
    }

    return {
      isValid: true,
      metadata: {
        width: metadata.width,
        height: metadata.height,
        format: metadata.format,
        size: buffer.length,
        hasAlpha: metadata.hasAlpha || false
      }
    };
  } catch (error) {
    return {
      isValid: false,
      error: `Image validation failed: ${error instanceof Error ? error.message : 'Unknown error'}`
    };
  }
}

/**
 * Optimize image for web delivery
 */
export async function optimizeImage(
  buffer: Buffer,
  options: ImageOptimizationOptions = {}
): Promise<Buffer> {
  const {
    quality = 85,
    format = 'webp',
    maxWidth = 2048,
    maxHeight = 2048,
    progressive = true,
    removeMetadata = true
  } = options;

  let pipeline = sharp(buffer);

  // Remove metadata if requested
  if (removeMetadata) {
    pipeline = pipeline.withMetadata(false);
  }

  // Resize if dimensions exceed limits
  const metadata = await sharp(buffer).metadata();
  if (metadata.width && metadata.height) {
    if (metadata.width > maxWidth || metadata.height > maxHeight) {
      pipeline = pipeline.resize(maxWidth, maxHeight, {
        fit: 'inside',
        withoutEnlargement: true
      });
    }
  }

  // Apply format-specific optimizations
  switch (format) {
    case 'jpeg':
      pipeline = pipeline.jpeg({
        quality,
        progressive,
        mozjpeg: true
      });
      break;
    
    case 'png':
      pipeline = pipeline.png({
        quality,
        progressive,
        compressionLevel: 9,
        adaptiveFiltering: true
      });
      break;
    
    case 'webp':
      pipeline = pipeline.webp({
        quality,
        effort: 6,
        nearLossless: quality >= 90
      });
      break;
    
    case 'avif':
      pipeline = pipeline.avif({
        quality,
        effort: 4
      });
      break;
  }

  return pipeline.toBuffer();
}

/**
 * Generate thumbnail image
 */
export async function generateThumbnail(
  buffer: Buffer,
  options: ThumbnailOptions
): Promise<Buffer> {
  const {
    width,
    height,
    quality = 80,
    format = 'webp',
    fit = 'cover',
    position = 'center'
  } = options;

  let pipeline = sharp(buffer)
    .resize(width, height, { fit, position })
    .withMetadata(false); // Remove metadata for thumbnails

  // Apply format-specific settings
  switch (format) {
    case 'jpeg':
      pipeline = pipeline.jpeg({ quality, mozjpeg: true });
      break;
    
    case 'png':
      pipeline = pipeline.png({ quality, compressionLevel: 9 });
      break;
    
    case 'webp':
      pipeline = pipeline.webp({ quality, effort: 6 });
      break;
  }

  return pipeline.toBuffer();
}

/**
 * Resize image to specific dimensions
 */
export async function resizeImage(
  buffer: Buffer,
  options: ResizeOptions
): Promise<Buffer> {
  const {
    width,
    height,
    fit = 'cover',
    position = 'center',
    background = { r: 255, g: 255, b: 255, alpha: 1 }
  } = options;

  return sharp(buffer)
    .resize(width, height, {
      fit,
      position,
      background
    })
    .toBuffer();
}

/**
 * Convert image to different format
 */
export async function convertImageFormat(
  buffer: Buffer,
  targetFormat: 'jpeg' | 'png' | 'webp' | 'avif',
  quality: number = 85
): Promise<Buffer> {
  let pipeline = sharp(buffer);

  switch (targetFormat) {
    case 'jpeg':
      pipeline = pipeline.jpeg({ quality, mozjpeg: true });
      break;
    
    case 'png':
      pipeline = pipeline.png({ quality, compressionLevel: 9 });
      break;
    
    case 'webp':
      pipeline = pipeline.webp({ quality, effort: 6 });
      break;
    
    case 'avif':
      pipeline = pipeline.avif({ quality, effort: 4 });
      break;
  }

  return pipeline.toBuffer();
}

/**
 * Get image metadata without processing
 */
export async function getImageMetadata(buffer: Buffer): Promise<{
  width: number;
  height: number;
  format: string;
  size: number;
  hasAlpha: boolean;
  density?: number;
  isAnimated?: boolean;
}> {
  const metadata = await sharp(buffer).metadata();
  
  return {
    width: metadata.width || 0,
    height: metadata.height || 0,
    format: metadata.format || 'unknown',
    size: buffer.length,
    hasAlpha: metadata.hasAlpha || false,
    density: metadata.density,
    isAnimated: metadata.pages ? metadata.pages > 1 : false
  };
}

/**
 * Create multiple sizes/formats for responsive images
 */
export async function createResponsiveImages(
  buffer: Buffer,
  sizes: Array<{ width: number; suffix: string }>
): Promise<Array<{ buffer: Buffer; width: number; suffix: string }>> {
  const results = [];
  
  for (const size of sizes) {
    const resizedBuffer = await sharp(buffer)
      .resize(size.width, undefined, {
        fit: 'inside',
        withoutEnlargement: true
      })
      .webp({ quality: 85, effort: 6 })
      .toBuffer();
    
    results.push({
      buffer: resizedBuffer,
      width: size.width,
      suffix: size.suffix
    });
  }
  
  return results;
}

/**
 * Apply watermark to image
 */
export async function applyWatermark(
  buffer: Buffer,
  watermarkBuffer: Buffer,
  options: {
    position?: 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right' | 'center';
    opacity?: number;
    margin?: number;
  } = {}
): Promise<Buffer> {
  const { position = 'bottom-right', opacity = 0.5, margin = 20 } = options;
  
  const image = sharp(buffer);
  const { width: imageWidth, height: imageHeight } = await image.metadata();
  
  if (!imageWidth || !imageHeight) {
    throw new Error('Unable to get image dimensions');
  }
  
  // Resize watermark proportionally (max 20% of image size)
  const maxWatermarkSize = Math.min(imageWidth, imageHeight) * 0.2;
  const watermark = await sharp(watermarkBuffer)
    .resize(maxWatermarkSize, maxWatermarkSize, {
      fit: 'inside',
      withoutEnlargement: true
    })
    .composite([{
      input: Buffer.from([255, 255, 255, Math.round(255 * (1 - opacity))]),
      raw: { width: 1, height: 1, channels: 4 },
      tile: true,
      blend: 'dest-out'
    }])
    .toBuffer();
  
  const { width: watermarkWidth, height: watermarkHeight } = await sharp(watermark).metadata();
  
  if (!watermarkWidth || !watermarkHeight) {
    throw new Error('Unable to get watermark dimensions');
  }
  
  // Calculate position
  let left = 0;
  let top = 0;
  
  switch (position) {
    case 'top-left':
      left = margin;
      top = margin;
      break;
    case 'top-right':
      left = imageWidth - watermarkWidth - margin;
      top = margin;
      break;
    case 'bottom-left':
      left = margin;
      top = imageHeight - watermarkHeight - margin;
      break;
    case 'bottom-right':
      left = imageWidth - watermarkWidth - margin;
      top = imageHeight - watermarkHeight - margin;
      break;
    case 'center':
      left = Math.floor((imageWidth - watermarkWidth) / 2);
      top = Math.floor((imageHeight - watermarkHeight) / 2);
      break;
  }
  
  return image
    .composite([{
      input: watermark,
      left,
      top
    }])
    .toBuffer();
}

/**
 * Detect if image contains transparent areas
 */
export async function hasTransparency(buffer: Buffer): Promise<boolean> {
  const metadata = await sharp(buffer).metadata();
  return metadata.hasAlpha || false;
}

/**
 * Remove background from image (basic implementation)
 */
export async function removeBackground(
  buffer: Buffer,
  backgroundColor: { r: number; g: number; b: number } = { r: 255, g: 255, b: 255 }
): Promise<Buffer> {
  // This is a basic implementation - in production, you'd want to use
  // a proper background removal service or AI model
  return sharp(buffer)
    .flatten({ background: backgroundColor })
    .toBuffer();
}

export default {
  validateImageFile,
  optimizeImage,
  generateThumbnail,
  resizeImage,
  convertImageFormat,
  getImageMetadata,
  createResponsiveImages,
  applyWatermark,
  hasTransparency,
  removeBackground
};