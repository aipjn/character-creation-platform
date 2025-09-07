import { Character } from '@prisma/client';

export type ExportFormat = 'png' | 'jpg' | 'webp' | 'json';

export interface ExportOptions {
  format: ExportFormat;
  quality?: number; // 0.1 to 1.0 for jpg/webp
  includeMetadata?: boolean;
  maxWidth?: number;
  maxHeight?: number;
}

export interface ExportResult {
  success: boolean;
  data?: Blob | string;
  filename: string;
  error?: string;
}

export interface CharacterExportData {
  character: Omit<Character, 'userId'>;
  exportedAt: string;
  format: ExportFormat;
  version: string;
}

/**
 * Generates a filename for character export
 */
export const generateExportFilename = (
  character: Character,
  format: ExportFormat
): string => {
  const sanitizedName = character.name.replace(/[^a-zA-Z0-9-_]/g, '_');
  const timestamp = new Date().toISOString().slice(0, 10);
  const extension = format === 'json' ? 'json' : format;
  
  return `character_${sanitizedName}_${timestamp}.${extension}`;
};

/**
 * Downloads image from URL and converts to different formats
 */
export const processImageForExport = async (
  imageUrl: string,
  options: ExportOptions
): Promise<Blob> => {
  try {
    // Fetch the original image
    const response = await fetch(imageUrl);
    if (!response.ok) {
      throw new Error(`Failed to fetch image: ${response.statusText}`);
    }
    
    const imageBlob = await response.blob();
    
    // If requesting original format or no conversion needed
    if (options.format === 'png' && imageBlob.type === 'image/png') {
      return imageBlob;
    }
    
    // Create canvas for image processing
    const img = new Image();
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    
    if (!ctx) {
      throw new Error('Canvas context not available');
    }
    
    return new Promise((resolve, reject) => {
      img.onload = () => {
        // Calculate dimensions respecting max width/height
        let { width, height } = img;
        
        if (options.maxWidth && width > options.maxWidth) {
          height = (height * options.maxWidth) / width;
          width = options.maxWidth;
        }
        
        if (options.maxHeight && height > options.maxHeight) {
          width = (width * options.maxHeight) / height;
          height = options.maxHeight;
        }
        
        canvas.width = width;
        canvas.height = height;
        
        // Draw image on canvas
        ctx.drawImage(img, 0, 0, width, height);
        
        // Convert to desired format
        const mimeType = options.format === 'jpg' 
          ? 'image/jpeg' 
          : `image/${options.format}`;
        
        canvas.toBlob(
          (blob) => {
            if (blob) {
              resolve(blob);
            } else {
              reject(new Error('Failed to convert image'));
            }
          },
          mimeType,
          options.quality || 0.9
        );
      };
      
      img.onerror = () => reject(new Error('Failed to load image'));
      img.src = URL.createObjectURL(imageBlob);
    });
  } catch (error) {
    throw new Error(`Image processing failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
};

/**
 * Exports character data as JSON
 */
export const exportCharacterAsJSON = (
  character: Character,
  options: ExportOptions
): CharacterExportData => {
  const exportData: CharacterExportData = {
    character: {
      id: character.id,
      name: character.name,
      prompt: character.prompt,
      styleType: character.styleType,
      s3Url: character.s3Url,
      thumbnailUrl: character.thumbnailUrl,
      tags: character.tags,
      isPublic: character.isPublic,
      generationStatus: character.generationStatus,
      createdAt: character.createdAt,
      updatedAt: character.updatedAt,
    },
    exportedAt: new Date().toISOString(),
    format: options.format,
    version: '1.0',
  };
  
  return exportData;
};

/**
 * Main export function for characters
 */
export const exportCharacter = async (
  character: Character,
  options: ExportOptions
): Promise<ExportResult> => {
  try {
    const filename = generateExportFilename(character, options.format);
    
    if (options.format === 'json') {
      const jsonData = exportCharacterAsJSON(character, options);
      return {
        success: true,
        data: JSON.stringify(jsonData, null, 2),
        filename,
      };
    }
    
    // For image formats
    if (!character.s3Url) {
      return {
        success: false,
        filename,
        error: 'Character image not available for export',
      };
    }
    
    const imageBlob = await processImageForExport(character.s3Url, options);
    
    return {
      success: true,
      data: imageBlob,
      filename,
    };
  } catch (error) {
    return {
      success: false,
      filename: generateExportFilename(character, options.format),
      error: error instanceof Error ? error.message : 'Export failed',
    };
  }
};

/**
 * Exports multiple characters in a ZIP file
 */
export const exportMultipleCharacters = async (
  characters: Character[],
  options: ExportOptions
): Promise<ExportResult> => {
  try {
    // Import JSZip dynamically to avoid bundling if not used
    const JSZip = (await import('jszip')).default;
    const zip = new JSZip();
    
    const timestamp = new Date().toISOString().slice(0, 10);
    
    for (const character of characters) {
      const result = await exportCharacter(character, options);
      
      if (result.success && result.data) {
        if (typeof result.data === 'string') {
          // JSON data
          zip.file(result.filename, result.data);
        } else {
          // Image blob
          zip.file(result.filename, result.data);
        }
      }
    }
    
    const zipBlob = await zip.generateAsync({ type: 'blob' });
    
    return {
      success: true,
      data: zipBlob,
      filename: `characters_export_${timestamp}.zip`,
    };
  } catch (error) {
    return {
      success: false,
      filename: 'characters_export.zip',
      error: error instanceof Error ? error.message : 'Bulk export failed',
    };
  }
};

/**
 * Triggers browser download for export result
 */
export const downloadExportResult = (result: ExportResult): void => {
  if (!result.success || !result.data) {
    console.error('Cannot download failed export:', result.error);
    return;
  }
  
  const blob = typeof result.data === 'string' 
    ? new Blob([result.data], { type: 'application/json' })
    : result.data;
  
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  
  link.href = url;
  link.download = result.filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  
  // Clean up the URL object
  setTimeout(() => URL.revokeObjectURL(url), 100);
};

/**
 * Gets available export formats for a character
 */
export const getAvailableFormats = (character: Character): ExportFormat[] => {
  const formats: ExportFormat[] = ['json'];
  
  // Only add image formats if character has an image
  if (character.s3Url && character.generationStatus === 'COMPLETED') {
    formats.push('png', 'jpg', 'webp');
  }
  
  return formats;
};

/**
 * Validates export options
 */
export const validateExportOptions = (options: ExportOptions): string[] => {
  const errors: string[] = [];
  
  if (!['png', 'jpg', 'webp', 'json'].includes(options.format)) {
    errors.push('Invalid export format');
  }
  
  if (options.quality !== undefined) {
    if (options.quality < 0.1 || options.quality > 1.0) {
      errors.push('Quality must be between 0.1 and 1.0');
    }
    if (options.format === 'png') {
      errors.push('Quality setting not applicable for PNG format');
    }
  }
  
  if (options.maxWidth && options.maxWidth < 1) {
    errors.push('Max width must be positive');
  }
  
  if (options.maxHeight && options.maxHeight < 1) {
    errors.push('Max height must be positive');
  }
  
  return errors;
};