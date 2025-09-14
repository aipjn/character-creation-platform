import { Character } from '@prisma/client';
import {
  ExportOptions,
  ExportResult,
  exportCharacter,
  exportMultipleCharacters,
  downloadExportResult,
  getAvailableFormats,
  validateExportOptions,
} from '../utils/exportUtils';

export interface DownloadProgress {
  characterId: string;
  progress: number;
  status: 'pending' | 'downloading' | 'processing' | 'completed' | 'failed';
  error?: string;
}

export interface BulkDownloadProgress {
  total: number;
  completed: number;
  failed: number;
  characters: DownloadProgress[];
  overallStatus: 'pending' | 'processing' | 'completed' | 'failed' | 'cancelled';
}

export class DownloadService {
  private activeDownloads = new Map<string, AbortController>();
  private progressCallbacks = new Map<string, (progress: BulkDownloadProgress) => void>();

  /**
   * Downloads a single character
   */
  async downloadCharacter(
    character: Character,
    options: ExportOptions,
    onProgress?: (progress: DownloadProgress) => void
  ): Promise<ExportResult> {
    const downloadId = `character-${character.id}-${Date.now()}`;
    const controller = new AbortController();
    this.activeDownloads.set(downloadId, controller);

    try {
      // Validate options
      const validationErrors = validateExportOptions(options);
      if (validationErrors.length > 0) {
        throw new Error(`Invalid options: ${validationErrors.join(', ')}`);
      }

      // Check if format is available for this character
      const availableFormats = getAvailableFormats(character);
      if (!availableFormats.includes(options.format)) {
        throw new Error(`Format ${options.format} not available for this character`);
      }

      // Update progress
      onProgress?.({
        characterId: character.id,
        progress: 0,
        status: 'downloading',
      });

      // Perform the export
      const result = await exportCharacter(character, options);

      if (result.success) {
        onProgress?.({
          characterId: character.id,
          progress: 100,
          status: 'completed',
        });

        // Trigger browser download
        downloadExportResult(result);
      } else {
        onProgress?.({
          characterId: character.id,
          progress: 0,
          status: 'failed',
          error: result.error,
        });
      }

      return result;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Download failed';
      
      onProgress?.({
        characterId: character.id,
        progress: 0,
        status: 'failed',
        error: errorMessage,
      });

      return {
        success: false,
        filename: `${character.name}.${options.format}`,
        error: errorMessage,
      };
    } finally {
      this.activeDownloads.delete(downloadId);
    }
  }

  /**
   * Downloads multiple characters as a ZIP file
   */
  async downloadMultipleCharacters(
    characters: Character[],
    options: ExportOptions,
    onProgress?: (progress: BulkDownloadProgress) => void
  ): Promise<ExportResult> {
    const downloadId = `bulk-${Date.now()}`;
    const controller = new AbortController();
    this.activeDownloads.set(downloadId, controller);

    if (onProgress) {
      this.progressCallbacks.set(downloadId, onProgress);
    }

    const progressState: BulkDownloadProgress = {
      total: characters.length,
      completed: 0,
      failed: 0,
      characters: characters.map(char => ({
        characterId: char.id,
        progress: 0,
        status: 'pending',
      })),
      overallStatus: 'processing',
    };

    try {
      // Validate options
      const validationErrors = validateExportOptions(options);
      if (validationErrors.length > 0) {
        throw new Error(`Invalid options: ${validationErrors.join(', ')}`);
      }

      if (characters.length === 0) {
        throw new Error('No characters provided for download');
      }

      // Initial progress update
      onProgress?.(progressState);

      // Filter characters that can be exported in the requested format
      const exportableCharacters = characters.filter(char => {
        const availableFormats = getAvailableFormats(char);
        const canExport = availableFormats.includes(options.format);
        
        if (!canExport) {
          // Update progress for non-exportable character
          const charProgress = progressState.characters.find(p => p.characterId === char.id);
          if (charProgress) {
            charProgress.status = 'failed';
            charProgress.error = `Format ${options.format} not available`;
            progressState.failed++;
          }
        }
        
        return canExport;
      });

      if (exportableCharacters.length === 0) {
        throw new Error(`No characters can be exported in ${options.format} format`);
      }

      // Update progress after filtering
      onProgress?.(progressState);

      // Perform bulk export
      const result = await exportMultipleCharacters(exportableCharacters, options);

      // Update final progress
      if (result.success) {
        progressState.characters.forEach(charProgress => {
          if (charProgress.status !== 'failed') {
            charProgress.status = 'completed';
            charProgress.progress = 100;
            progressState.completed++;
          }
        });
        progressState.overallStatus = progressState.failed > 0 ? 'completed' : 'completed';

        // Trigger browser download
        downloadExportResult(result);
      } else {
        progressState.characters.forEach(charProgress => {
          if (charProgress.status !== 'failed') {
            charProgress.status = 'failed';
            charProgress.error = result.error;
            progressState.failed++;
          }
        });
        progressState.overallStatus = 'failed';
      }

      onProgress?.(progressState);
      return result;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Bulk download failed';
      
      progressState.overallStatus = 'failed';
      progressState.characters.forEach(charProgress => {
        if (charProgress.status !== 'failed') {
          charProgress.status = 'failed';
          charProgress.error = errorMessage;
          progressState.failed++;
        }
      });

      onProgress?.(progressState);

      return {
        success: false,
        filename: 'characters_export.zip',
        error: errorMessage,
      };
    } finally {
      this.activeDownloads.delete(downloadId);
      this.progressCallbacks.delete(downloadId);
    }
  }

  /**
   * Cancels an active download
   */
  cancelDownload(downloadId: string): boolean {
    const controller = this.activeDownloads.get(downloadId);
    if (controller) {
      controller.abort();
      this.activeDownloads.delete(downloadId);
      
      // Update progress if callback exists
      const callback = this.progressCallbacks.get(downloadId);
      if (callback) {
        callback({
          total: 0,
          completed: 0,
          failed: 0,
          characters: [],
          overallStatus: 'cancelled',
        });
        this.progressCallbacks.delete(downloadId);
      }
      
      return true;
    }
    return false;
  }

  /**
   * Cancels all active downloads
   */
  cancelAllDownloads(): void {
    for (const [downloadId] of this.activeDownloads) {
      this.cancelDownload(downloadId);
    }
  }

  /**
   * Gets the number of active downloads
   */
  getActiveDownloadCount(): number {
    return this.activeDownloads.size;
  }

  /**
   * Gets download statistics for a user's characters
   */
  getDownloadStats(characters: Character[]): {
    totalCharacters: number;
    downloadableByFormat: Record<string, number>;
    charactersWithImages: number;
    charactersCompleted: number;
  } {
    const stats = {
      totalCharacters: characters.length,
      downloadableByFormat: {
        png: 0,
        jpg: 0,
        webp: 0,
        json: characters.length, // All characters can be exported as JSON
      },
      charactersWithImages: 0,
      charactersCompleted: 0,
    };

    characters.forEach(character => {
      if (character.generationStatus === 'COMPLETED') {
        stats.charactersCompleted++;
      }
      
      if (character.s3Url && character.generationStatus === 'COMPLETED') {
        stats.charactersWithImages++;
        stats.downloadableByFormat.png++;
        stats.downloadableByFormat.jpg++;
        stats.downloadableByFormat.webp++;
      }
    });

    return stats;
  }

  /**
   * Validates if a download operation can proceed
   */
  canDownload(characters: Character[], format: string): {
    canDownload: boolean;
    reasons: string[];
  } {
    const reasons: string[] = [];

    if (characters.length === 0) {
      reasons.push('No characters selected');
    }

    if (!['png', 'jpg', 'webp', 'json'].includes(format)) {
      reasons.push('Invalid export format');
    }

    if (format !== 'json') {
      const charactersWithImages = characters.filter(
        char => char.s3Url && char.generationStatus === 'COMPLETED'
      );
      
      if (charactersWithImages.length === 0) {
        reasons.push(`No characters have images available for ${format} export`);
      }
    }

    return {
      canDownload: reasons.length === 0,
      reasons,
    };
  }

  /**
   * Estimates download size for characters
   */
  async estimateDownloadSize(
    characters: Character[],
    format: string
  ): Promise<{
    estimatedSize: number;
    sizeUnit: string;
    characterCount: number;
  }> {
    let estimatedSize = 0;
    let characterCount = 0;

    for (const character of characters) {
      const availableFormats = getAvailableFormats(character);
      
      if (availableFormats.includes(format as any)) {
        characterCount++;
        
        // Rough size estimates based on format
        switch (format) {
          case 'json':
            estimatedSize += 2; // ~2KB per character JSON
            break;
          case 'png':
            estimatedSize += 500; // ~500KB per PNG
            break;
          case 'jpg':
            estimatedSize += 100; // ~100KB per JPG
            break;
          case 'webp':
            estimatedSize += 80; // ~80KB per WebP
            break;
        }
      }
    }

    // Add ZIP overhead for multiple files
    if (characterCount > 1) {
      estimatedSize += Math.ceil(estimatedSize * 0.1); // 10% ZIP overhead
    }

    const sizeInMB = estimatedSize / 1024;
    
    return {
      estimatedSize: sizeInMB > 1 ? Math.round(sizeInMB) : estimatedSize,
      sizeUnit: sizeInMB > 1 ? 'MB' : 'KB',
      characterCount,
    };
  }
}

// Singleton instance
export const downloadService = new DownloadService();
export default downloadService;