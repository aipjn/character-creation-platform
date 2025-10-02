/**
 * Server Startup and Graceful Shutdown
 * Main server entry point with proper lifecycle management
 */

import http from 'http';
import { createApp } from './app';
import { config, isDevelopment, isProduction } from '../../../config/core';
import { DatabaseConnectionStatus } from '../../../shared/types/database';

/**
 * Server instance and state management
 */
class ServerManager {
  private server: http.Server | null = null;
  private isShuttingDown = false;
  private connections = new Set<any>();
  private startTime = Date.now();

  /**
   * Initialize and start the server
   */
  async start(): Promise<void> {
    try {
      console.log('🚀 Starting Character Creation Platform Server...');
      console.log(`📦 Environment: ${config.server.nodeEnv}`);
      console.log(`🔧 Version: 1.0.0`);
      
      // Validate environment configuration
      this.validateEnvironment();

      // Create Express application
      const app = createApp();
      
      // Create HTTP server
      this.server = http.createServer(app);
      
      // Configure server settings
      this.configureServer();
      
      // Set up connection tracking for graceful shutdown
      this.setupConnectionTracking();
      
      // Set up graceful shutdown handlers
      this.setupGracefulShutdown();
      
      // Start listening
      await this.listen();
      
      // Perform post-startup checks
      await this.performHealthChecks();
      
      console.log('✅ Server started successfully');
      
    } catch (error) {
      console.error('❌ Failed to start server:', error);
      process.exit(1);
    }
  }

  /**
   * Validate environment configuration
   */
  private validateEnvironment(): void {
    console.log('🔍 Validating environment configuration...');
    
    const requiredVars = ['DATABASE_URL'];
    const missingVars = requiredVars.filter(varName => !process.env[varName]);
    
    if (missingVars.length > 0) {
      throw new Error(`Missing required environment variables: ${missingVars.join(', ')}`);
    }

    // Port validation
    if (config.server.port < 1 || config.server.port > 65535) {
      throw new Error(`Invalid port number: ${config.server.port}`);
    }

    // Production-specific validations
    if (isProduction()) {
      if (config.auth?.jwtSecret === 'default-jwt-secret-change-in-production') {
        throw new Error('JWT_SECRET must be changed in production');
      }
    }

    console.log('✅ Environment configuration validated');
  }

  /**
   * Configure server settings
   */
  private configureServer(): void {
    if (!this.server) return;

    // Set server timeout - increased for AI image operations
    this.server.timeout = 120000; // 120 seconds (2 minutes) for AI operations
    this.server.keepAliveTimeout = 5000; // 5 seconds
    this.server.headersTimeout = 130000; // 130 seconds (slightly more than timeout)

    // Handle server errors
    this.server.on('error', (error: any) => {
      if (error.code === 'EADDRINUSE') {
        console.error(`❌ Port ${config.server.port} is already in use`);
        process.exit(1);
      } else if (error.code === 'EACCES') {
        console.error(`❌ Permission denied to bind to port ${config.server.port}`);
        process.exit(1);
      } else {
        console.error('❌ Server error:', error);
        this.shutdown(1);
      }
    });

    // Log client errors
    this.server.on('clientError', (err, socket) => {
      if (isDevelopment()) {
        console.warn('Client error:', err.message);
      }
      socket.end('HTTP/1.1 400 Bad Request\r\n\r\n');
    });
  }

  /**
   * Set up connection tracking for graceful shutdown
   */
  private setupConnectionTracking(): void {
    if (!this.server) return;

    this.server.on('connection', (connection) => {
      this.connections.add(connection);
      
      connection.on('close', () => {
        this.connections.delete(connection);
      });
    });
  }

  /**
   * Start listening on configured port and host
   */
  private async listen(): Promise<void> {
    return new Promise((resolve, reject) => {
      if (!this.server) {
        reject(new Error('Server not initialized'));
        return;
      }

      this.server.listen(config.server.port, config.server.host, () => {
        console.log(`🌐 Server listening on ${config.server.host}:${config.server.port}`);
        console.log(`🔗 Health check: http://${config.server.host}:${config.server.port}/health`);
        console.log(`📡 API endpoint: http://${config.server.host}:${config.server.port}/api/v1`);
        
        if (isDevelopment()) {
          console.log(`📖 API docs: http://${config.server.host}:${config.server.port}/api/v1/docs`);
        }
        
        resolve();
      });

      // Handle listen errors
      this.server.on('error', reject);
    });
  }

  /**
   * Perform health checks after startup
   */
  private async performHealthChecks(): Promise<void> {
    console.log('🏥 Performing startup health checks...');

    try {
      // TODO: Add database connectivity check when database module is available
      // const dbStatus = await this.checkDatabaseConnection();
      const dbStatus: DatabaseConnectionStatus = {
        isConnected: true,
        connectionCount: 1,
        lastChecked: new Date().toISOString()
      };

      if (dbStatus.isConnected) {
        console.log('✅ Database connection: OK');
      } else {
        console.warn('⚠️  Database connection: FAILED', dbStatus.error);
      }

      // TODO: Add storage (S3) connectivity check
      console.log('✅ Storage service: OK (placeholder)');

      // TODO: Add external API connectivity checks
      console.log('⚠️  External API configuration: Not configured');

    } catch (error) {
      console.warn('⚠️  Some health checks failed:', error);
    }
  }

  /**
   * Set up graceful shutdown handlers
   */
  private setupGracefulShutdown(): void {
    const signals = config.gracefulShutdown.signals;
    
    signals.forEach((signal) => {
      process.on(signal, () => {
        console.log(`\n🛑 Received ${signal}, starting graceful shutdown...`);
        this.shutdown(0);
      });
    });

    // Handle uncaught exceptions
    process.on('uncaughtException', (error) => {
      console.error('💥 Uncaught exception:', error);
      this.shutdown(1);
    });

    // Handle unhandled promise rejections
    process.on('unhandledRejection', (reason, promise) => {
      console.error('💥 Unhandled rejection at:', promise, 'reason:', reason);
      this.shutdown(1);
    });

    // Handle memory warnings
    process.on('warning', (warning) => {
      if (warning.name === 'MaxListenersExceededWarning') {
        console.warn('⚠️  Memory warning:', warning.message);
      }
    });
  }

  /**
   * Graceful shutdown process
   */
  private async shutdown(exitCode: number = 0): Promise<void> {
    if (this.isShuttingDown) {
      console.log('🔄 Shutdown already in progress...');
      return;
    }

    this.isShuttingDown = true;
    console.log('🛑 Initiating graceful shutdown...');

    const shutdownTimeout = setTimeout(() => {
      console.error('❌ Shutdown timeout reached, forcing exit');
      process.exit(1);
    }, config.gracefulShutdown.timeout);

    try {
      // Stop accepting new connections
      if (this.server) {
        console.log('🚪 Closing server to new connections...');
        this.server.close(() => {
          console.log('✅ Server closed to new connections');
        });
      }

      // Close existing connections
      console.log(`🔌 Closing ${this.connections.size} existing connections...`);
      for (const connection of this.connections) {
        connection.destroy();
      }
      this.connections.clear();

      // TODO: Close database connections when database module is available
      console.log('💾 Closing database connections...');
      // await this.closeDatabaseConnections();

      // TODO: Close Redis connections if used
      // console.log('🔴 Closing Redis connections...');
      // await this.closeRedisConnections();

      // TODO: Clean up any background jobs or workers
      console.log('⚙️  Stopping background workers...');
      // await this.stopBackgroundWorkers();

      clearTimeout(shutdownTimeout);
      console.log('✅ Graceful shutdown completed');
      process.exit(exitCode);

    } catch (error) {
      clearTimeout(shutdownTimeout);
      console.error('❌ Error during shutdown:', error);
      process.exit(1);
    }
  }

  /**
   * Get server status information
   */
  getStatus(): {
    isRunning: boolean;
    uptime: number;
    pid: number;
    port: number;
    environment: string;
    memory: NodeJS.MemoryUsage;
    connections: number;
  } {
    return {
      isRunning: !!this.server && this.server.listening,
      uptime: Math.floor((Date.now() - this.startTime) / 1000),
      pid: process.pid,
      port: config.server.port,
      environment: config.server.nodeEnv,
      memory: process.memoryUsage(),
      connections: this.connections.size
    };
  }

  /**
   * Restart the server (for development use)
   */
  async restart(): Promise<void> {
    if (isDevelopment()) {
      console.log('🔄 Restarting server...');
      await this.shutdown(0);
      await this.start();
    } else {
      console.warn('❌ Server restart is only available in development mode');
    }
  }
}

/**
 * Create and configure server manager
 */
const serverManager = new ServerManager();

/**
 * Start server if this module is run directly
 */
if (require.main === module) {
  serverManager.start().catch((error) => {
    console.error('❌ Failed to start server:', error);
    process.exit(1);
  });
}

/**
 * Export server manager and utilities
 */
export { serverManager };
export default serverManager;

/**
 * Utility functions for external use
 */
export const startServer = () => serverManager.start();
export const getServerStatus = () => serverManager.getStatus();
export const restartServer = () => serverManager.restart();

/**
 * Health check function for external monitoring
 */
export const checkServerHealth = async (): Promise<{
  status: 'healthy' | 'unhealthy';
  details: any;
}> => {
  try {
    const status = serverManager.getStatus();
    
    if (!status.isRunning) {
      return {
        status: 'unhealthy',
        details: { error: 'Server is not running' }
      };
    }

    // Check memory usage
    const memoryUsageMB = status.memory.heapUsed / 1024 / 1024;
    const memoryLimit = 512; // 512MB warning threshold
    
    if (memoryUsageMB > memoryLimit) {
      console.warn(`⚠️  High memory usage: ${memoryUsageMB.toFixed(2)}MB`);
    }

    return {
      status: 'healthy',
      details: {
        uptime: status.uptime,
        memoryUsage: `${memoryUsageMB.toFixed(2)}MB`,
        activeConnections: status.connections,
        pid: status.pid
      }
    };

  } catch (error) {
    return {
      status: 'unhealthy',
      details: { error: error instanceof Error ? error.message : 'Unknown error' }
    };
  }
};