/**
 * Core Configuration
 * Essential configuration for the character creator platform
 */

import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

export interface CoreConfig {
  // Server
  server: {
    port: number;
    host: string;
    nodeEnv: 'development' | 'production' | 'test';
  };
  
  // Database (optional for now)
  database?: {
    url: string;
  };
  
  // Security
  auth?: {
    jwtSecret: string;
    jwtExpiresIn: string;
  };
  
  // Storage
  storage: {
    provider: 'local';
    uploadPath: string;
    maxFileSize: number;
  };
  
  // Server management
  gracefulShutdown: {
    timeout: number;
    signals: string[];
  };
}

// Default configuration
export const config: CoreConfig = {
  server: {
    port: parseInt(process.env['PORT'] || '3000', 10),
    host: process.env['HOST'] || 'localhost',
    nodeEnv: (process.env['NODE_ENV'] || 'development') as 'development' | 'production' | 'test',
  },
  
  // Only include database if URL is provided
  ...(process.env['DATABASE_URL'] && {
    database: {
      url: process.env['DATABASE_URL'],
    },
  }),
  
  // Only include auth if secrets are provided  
  ...(process.env['JWT_SECRET'] && {
    auth: {
      jwtSecret: process.env['JWT_SECRET'],
      jwtExpiresIn: process.env['JWT_EXPIRES_IN'] || '24h',
    },
  }),
  
  storage: {
    provider: 'local',
    uploadPath: process.env['UPLOAD_PATH'] || './uploads',
    maxFileSize: parseInt(process.env['MAX_FILE_SIZE'] || '10485760', 10), // 10MB
  },
  
  gracefulShutdown: {
    timeout: parseInt(process.env['SHUTDOWN_TIMEOUT'] || '30000', 10),
    signals: ['SIGTERM', 'SIGINT', 'SIGUSR2'],
  },
};

export const isDevelopment = () => config.server.nodeEnv === 'development';
export const isProduction = () => config.server.nodeEnv === 'production';
export const isTest = () => config.server.nodeEnv === 'test';
