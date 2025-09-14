/**
 * AWS S3 Service Integration
 * Handles file upload, download, and management operations for character assets
 */

import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  DeleteObjectCommand,
  DeleteObjectsCommand,
  HeadObjectCommand,
  ListObjectsV2Command,
  CreateMultipartUploadCommand,
  UploadPartCommand,
  CompleteMultipartUploadCommand,
  AbortMultipartUploadCommand,
  CopyObjectCommand
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { CreateInvalidationCommand } from '@aws-sdk/client-cloudfront';
import {
  getS3Client,
  getCloudFrontClient,
  bucketConfig,
  presignedUrlConfig,
  cloudfrontConfig
} from '../config/aws.js';
import { generateThumbnail, optimizeImage, validateImageFile } from '../utils/image.js';

// Types for file operations
export interface FileUploadOptions {
  userId: string;
  folder: keyof typeof bucketConfig.folders;
  filename: string;
  contentType: string;
  metadata?: Record<string, string>;
  generateThumbnail?: boolean;
  optimize?: boolean;
}

export interface FileMetadata {
  key: string;
  size: number;
  lastModified: Date;
  contentType: string;
  metadata: Record<string, string>;
  url: string;
  thumbnailUrl?: string;
}

export interface PresignedUrlOptions {
  operation: 'upload' | 'download';
  expiresIn?: number;
  contentType?: string;
  contentLength?: number;
}

export interface MultipartUploadSession {
  uploadId: string;
  key: string;
  partSize: number;
  totalParts: number;
}

export interface BulkDownloadOptions {
  keys: string[];
  zipFilename: string;
  expiresIn?: number;
}

/**
 * S3 Service class for handling all file operations
 */
export class S3Service {
  private s3Client: S3Client;
  private bucketName: string;

  constructor() {
    this.s3Client = getS3Client();
    this.bucketName = bucketConfig.name;
  }

  /**
   * Upload a file to S3 with optional optimization and thumbnail generation
   */
  async uploadFile(
    buffer: Buffer,
    options: FileUploadOptions
  ): Promise<{ key: string; url: string; thumbnailUrl?: string }> {
    // Validate file
    if (options.contentType.startsWith('image/')) {
      validateImageFile(buffer, options.contentType);
    }

    // Generate S3 key
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const key = `${bucketConfig.folders[options.folder]}${options.userId}/${timestamp}-${options.filename}`;

    let processedBuffer = buffer;
    let thumbnailKey: string | undefined;

    // Optimize image if requested
    if (options.optimize && options.contentType.startsWith('image/')) {
      processedBuffer = await optimizeImage(buffer, {
        quality: 85,
        format: 'webp',
        maxWidth: 2048,
        maxHeight: 2048
      });
    }

    // Generate thumbnail if requested
    if (options.generateThumbnail && options.contentType.startsWith('image/')) {
      const thumbnailBuffer = await generateThumbnail(buffer, {
        width: 300,
        height: 300,
        quality: 80
      });
      
      thumbnailKey = `${bucketConfig.folders.thumbnails}${options.userId}/${timestamp}-thumb-${options.filename}`;
      
      await this.s3Client.send(new PutObjectCommand({
        Bucket: this.bucketName,
        Key: thumbnailKey,
        Body: thumbnailBuffer,
        ContentType: 'image/webp',
        Metadata: {
          ...options.metadata,
          originalKey: key,
          type: 'thumbnail'
        }
      }));
    }

    // Upload main file
    const uploadCommand = new PutObjectCommand({
      Bucket: this.bucketName,
      Key: key,
      Body: processedBuffer,
      ContentType: options.contentType,
      Metadata: {
        ...options.metadata,
        userId: options.userId,
        uploadedAt: new Date().toISOString()
      }
    });

    await this.s3Client.send(uploadCommand);

    const url = `https://${this.bucketName}.s3.${bucketConfig.region}.amazonaws.com/${key}`;
    const thumbnailUrl = thumbnailKey 
      ? `https://${this.bucketName}.s3.${bucketConfig.region}.amazonaws.com/${thumbnailKey}`
      : undefined;

    return { key, url, thumbnailUrl };
  }

  /**
   * Download a file from S3
   */
  async downloadFile(key: string): Promise<{ buffer: Buffer; metadata: FileMetadata }> {
    const command = new GetObjectCommand({
      Bucket: this.bucketName,
      Key: key
    });

    const response = await this.s3Client.send(command);
    
    if (!response.Body) {
      throw new Error(`File not found: ${key}`);
    }

    const buffer = Buffer.from(await response.Body.transformToByteArray());
    
    const metadata: FileMetadata = {
      key,
      size: response.ContentLength || 0,
      lastModified: response.LastModified || new Date(),
      contentType: response.ContentType || 'application/octet-stream',
      metadata: response.Metadata || {},
      url: `https://${this.bucketName}.s3.${bucketConfig.region}.amazonaws.com/${key}`
    };

    return { buffer, metadata };
  }

  /**
   * Delete a file from S3
   */
  async deleteFile(key: string): Promise<void> {
    const command = new DeleteObjectCommand({
      Bucket: this.bucketName,
      Key: key
    });

    await this.s3Client.send(command);

    // Invalidate CloudFront cache if configured
    if (cloudfrontConfig.distributionId) {
      await this.invalidateCloudFrontCache([`/${key}`]);
    }
  }

  /**
   * Delete multiple files from S3
   */
  async deleteFiles(keys: string[]): Promise<{ deleted: string[]; errors: string[] }> {
    const command = new DeleteObjectsCommand({
      Bucket: this.bucketName,
      Delete: {
        Objects: keys.map(key => ({ Key: key }))
      }
    });

    const response = await this.s3Client.send(command);
    
    const deleted = response.Deleted?.map(obj => obj.Key || '') || [];
    const errors = response.Errors?.map(err => err.Message || 'Unknown error') || [];

    // Invalidate CloudFront cache if configured
    if (cloudfrontConfig.distributionId && deleted.length > 0) {
      await this.invalidateCloudFrontCache(deleted.map(key => `/${key}`));
    }

    return { deleted, errors };
  }

  /**
   * Generate a presigned URL for direct client upload/download
   */
  async generatePresignedUrl(
    key: string,
    options: PresignedUrlOptions
  ): Promise<string> {
    const expiresIn = options.expiresIn || presignedUrlConfig.expirations[
      options.operation === 'upload' ? 'upload' : 'download'
    ];

    let command;
    
    if (options.operation === 'upload') {
      command = new PutObjectCommand({
        Bucket: this.bucketName,
        Key: key,
        ContentType: options.contentType,
        ContentLength: options.contentLength
      });
    } else {
      command = new GetObjectCommand({
        Bucket: this.bucketName,
        Key: key
      });
    }

    return getSignedUrl(this.s3Client, command, { expiresIn });
  }

  /**
   * List files in a specific folder
   */
  async listFiles(
    folder: keyof typeof bucketConfig.folders,
    userId?: string,
    maxKeys: number = 100
  ): Promise<FileMetadata[]> {
    const prefix = userId 
      ? `${bucketConfig.folders[folder]}${userId}/`
      : bucketConfig.folders[folder];

    const command = new ListObjectsV2Command({
      Bucket: this.bucketName,
      Prefix: prefix,
      MaxKeys: maxKeys
    });

    const response = await this.s3Client.send(command);
    
    return (response.Contents || []).map(obj => ({
      key: obj.Key || '',
      size: obj.Size || 0,
      lastModified: obj.LastModified || new Date(),
      contentType: '', // Need to fetch separately if needed
      metadata: {},
      url: `https://${this.bucketName}.s3.${bucketConfig.region}.amazonaws.com/${obj.Key}`
    }));
  }

  /**
   * Get file metadata without downloading the file
   */
  async getFileMetadata(key: string): Promise<FileMetadata> {
    const command = new HeadObjectCommand({
      Bucket: this.bucketName,
      Key: key
    });

    const response = await this.s3Client.send(command);

    return {
      key,
      size: response.ContentLength || 0,
      lastModified: response.LastModified || new Date(),
      contentType: response.ContentType || 'application/octet-stream',
      metadata: response.Metadata || {},
      url: `https://${this.bucketName}.s3.${bucketConfig.region}.amazonaws.com/${key}`
    };
  }

  /**
   * Start multipart upload for large files
   */
  async startMultipartUpload(
    key: string,
    contentType: string,
    metadata?: Record<string, string>
  ): Promise<MultipartUploadSession> {
    const command = new CreateMultipartUploadCommand({
      Bucket: this.bucketName,
      Key: key,
      ContentType: contentType,
      Metadata: metadata
    });

    const response = await this.s3Client.send(command);
    
    if (!response.UploadId) {
      throw new Error('Failed to start multipart upload');
    }

    // Calculate part size (5MB minimum, up to 10GB total)
    const partSize = 5 * 1024 * 1024; // 5MB
    const maxSize = 10 * 1024 * 1024 * 1024; // 10GB
    const totalParts = Math.ceil(maxSize / partSize);

    return {
      uploadId: response.UploadId,
      key,
      partSize,
      totalParts
    };
  }

  /**
   * Upload a part in multipart upload
   */
  async uploadPart(
    uploadSession: MultipartUploadSession,
    partNumber: number,
    buffer: Buffer
  ): Promise<string> {
    const command = new UploadPartCommand({
      Bucket: this.bucketName,
      Key: uploadSession.key,
      PartNumber: partNumber,
      UploadId: uploadSession.uploadId,
      Body: buffer
    });

    const response = await this.s3Client.send(command);
    
    if (!response.ETag) {
      throw new Error(`Failed to upload part ${partNumber}`);
    }

    return response.ETag;
  }

  /**
   * Complete multipart upload
   */
  async completeMultipartUpload(
    uploadSession: MultipartUploadSession,
    parts: Array<{ PartNumber: number; ETag: string }>
  ): Promise<string> {
    const command = new CompleteMultipartUploadCommand({
      Bucket: this.bucketName,
      Key: uploadSession.key,
      UploadId: uploadSession.uploadId,
      MultipartUpload: {
        Parts: parts
      }
    });

    const response = await this.s3Client.send(command);
    
    if (!response.Location) {
      throw new Error('Failed to complete multipart upload');
    }

    return response.Location;
  }

  /**
   * Abort multipart upload
   */
  async abortMultipartUpload(uploadSession: MultipartUploadSession): Promise<void> {
    const command = new AbortMultipartUploadCommand({
      Bucket: this.bucketName,
      Key: uploadSession.key,
      UploadId: uploadSession.uploadId
    });

    await this.s3Client.send(command);
  }

  /**
   * Copy file within S3
   */
  async copyFile(sourceKey: string, destinationKey: string): Promise<string> {
    const command = new CopyObjectCommand({
      Bucket: this.bucketName,
      CopySource: `${this.bucketName}/${sourceKey}`,
      Key: destinationKey
    });

    await this.s3Client.send(command);
    
    return `https://${this.bucketName}.s3.${bucketConfig.region}.amazonaws.com/${destinationKey}`;
  }

  /**
   * Invalidate CloudFront cache for specified paths
   */
  private async invalidateCloudFrontCache(paths: string[]): Promise<void> {
    if (!cloudfrontConfig.distributionId) {
      return;
    }

    try {
      const cloudfrontClient = getCloudFrontClient();
      
      const command = new CreateInvalidationCommand({
        DistributionId: cloudfrontConfig.distributionId,
        InvalidationBatch: {
          Paths: {
            Quantity: paths.length,
            Items: paths
          },
          CallerReference: `invalidation-${Date.now()}`
        }
      });

      await cloudfrontClient.send(command);
    } catch (error) {
      console.warn('Failed to invalidate CloudFront cache:', error);
      // Don't throw - cache invalidation failure shouldn't break file operations
    }
  }

  /**
   * Generate bulk download ZIP file
   */
  async createBulkDownload(options: BulkDownloadOptions): Promise<string> {
    const tempKey = `${bucketConfig.folders.temp}bulk-${Date.now()}-${options.zipFilename}`;
    
    // This would require additional implementation for ZIP creation
    // For now, return a presigned URL for the temp location
    const expiresIn = options.expiresIn || presignedUrlConfig.expirations.bulk_download;
    
    // Implementation would involve:
    // 1. Download all files specified in options.keys
    // 2. Create ZIP archive
    // 3. Upload ZIP to temp location
    // 4. Return presigned URL for download
    
    return this.generatePresignedUrl(tempKey, {
      operation: 'download',
      expiresIn
    });
  }
}

// Export singleton instance
export const s3Service = new S3Service();

export default s3Service;