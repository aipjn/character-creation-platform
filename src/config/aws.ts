/**
 * AWS Configuration for Character Creation Platform
 * Handles S3, CloudFront, and other AWS service configurations
 */

import { S3Client, S3ClientConfig } from '@aws-sdk/client-s3';
import { CloudFrontClient } from '@aws-sdk/client-cloudfront';

// Environment variables validation
const requiredEnvVars = [
  'AWS_REGION',
  'AWS_ACCESS_KEY_ID',
  'AWS_SECRET_ACCESS_KEY',
  'AWS_S3_BUCKET_NAME'
] as const;

const validateEnvironment = (): void => {
  const missing = requiredEnvVars.filter(envVar => !process.env[envVar]);
  
  if (missing.length > 0) {
    throw new Error(
      `Missing required AWS environment variables: ${missing.join(', ')}`
    );
  }
};

// AWS S3 Configuration
export const s3Config: S3ClientConfig = {
  region: process.env.AWS_REGION || 'us-east-1',
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID || '',
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || ''
  },
  maxAttempts: 3,
  retryDelayOptions: {
    customBackoff: (retryCount: number) => {
      return Math.min(1000 * Math.pow(2, retryCount), 10000);
    }
  }
};

// S3 Bucket Configuration
export const bucketConfig = {
  name: process.env.AWS_S3_BUCKET_NAME || '',
  region: process.env.AWS_REGION || 'us-east-1',
  // Folder structure for organizing character assets
  folders: {
    characters: 'characters/',
    thumbnails: 'thumbnails/',
    temp: 'temp/',
    exports: 'exports/',
    user_uploads: 'user-uploads/'
  },
  // File upload limits
  maxFileSize: 50 * 1024 * 1024, // 50MB
  allowedMimeTypes: [
    'image/jpeg',
    'image/png',
    'image/webp',
    'image/gif',
    'application/zip'
  ]
} as const;

// CloudFront Configuration
export const cloudfrontConfig = {
  distributionId: process.env.AWS_CLOUDFRONT_DISTRIBUTION_ID || '',
  domainName: process.env.AWS_CLOUDFRONT_DOMAIN_NAME || '',
  // Cache policies for different file types
  cachePolicies: {
    images: {
      ttl: 86400, // 24 hours
      maxTtl: 31536000, // 1 year
      compress: true
    },
    thumbnails: {
      ttl: 604800, // 7 days
      maxTtl: 31536000, // 1 year
      compress: true
    },
    temp: {
      ttl: 3600, // 1 hour
      maxTtl: 3600, // 1 hour
      compress: false
    }
  }
} as const;

// Presigned URL Configuration
export const presignedUrlConfig = {
  // Default expiration times for different operations
  expirations: {
    upload: 3600, // 1 hour for uploads
    download: 300, // 5 minutes for downloads
    temp_access: 900, // 15 minutes for temporary access
    bulk_download: 7200 // 2 hours for bulk operations
  },
  // Security constraints
  security: {
    maxFileSize: bucketConfig.maxFileSize,
    allowedMimeTypes: bucketConfig.allowedMimeTypes,
    enforceContentType: true
  }
} as const;

// Initialize AWS clients
let s3Client: S3Client | null = null;
let cloudfrontClient: CloudFrontClient | null = null;

export const getS3Client = (): S3Client => {
  if (!s3Client) {
    try {
      validateEnvironment();
      s3Client = new S3Client(s3Config);
    } catch (error) {
      throw new Error(`Failed to initialize S3 client: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }
  return s3Client;
};

export const getCloudFrontClient = (): CloudFrontClient => {
  if (!cloudfrontClient) {
    try {
      validateEnvironment();
      cloudfrontClient = new CloudFrontClient({
        region: s3Config.region,
        credentials: s3Config.credentials
      });
    } catch (error) {
      throw new Error(`Failed to initialize CloudFront client: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }
  return cloudfrontClient;
};

// Health check function for AWS services
export const checkAWSConnection = async (): Promise<{
  s3: boolean;
  cloudfront: boolean;
  errors: string[];
}> => {
  const errors: string[] = [];
  let s3Available = false;
  let cloudfrontAvailable = false;

  try {
    const s3 = getS3Client();
    await s3.send({ input: {} } as any); // Basic connection test
    s3Available = true;
  } catch (error) {
    errors.push(`S3 connection failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }

  try {
    if (cloudfrontConfig.distributionId) {
      const cloudfront = getCloudFrontClient();
      // Basic CloudFront availability check would go here
      cloudfrontAvailable = true;
    } else {
      errors.push('CloudFront distribution ID not configured');
    }
  } catch (error) {
    errors.push(`CloudFront connection failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }

  return {
    s3: s3Available,
    cloudfront: cloudfrontAvailable,
    errors
  };
};

export default {
  s3Config,
  bucketConfig,
  cloudfrontConfig,
  presignedUrlConfig,
  getS3Client,
  getCloudFrontClient,
  checkAWSConnection
};