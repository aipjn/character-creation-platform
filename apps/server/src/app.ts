/**
 * Express Application Setup
 * Modular Express application with middleware, routing, and error handling
 */

import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import { config, isDevelopment, isProduction } from '../../../config/core';
import { getCorsConfig } from './config/cors';
// import { getHelmetConfig, standardRateLimit } from './config/security';

// Import our new v1 routes and middleware
import v1Routes from './routes/v1/index';
// import { requestLogger } from './middleware/logging';
// import { versionDetection, versionRedirect } from './middleware/apiVersion';

/**
 * Create Express application with full configuration
 */
export const createApp = (): express.Application => {
  const app = express();

  // Security middleware (disabled in development for inline scripts)
  if (isProduction()) {
    app.use(helmet());
  }
  
  // Rate limiting (temporarily disabled for development)
  if (isProduction()) {
    app.use(rateLimit({
      windowMs: 15 * 60 * 1000, // 15 minutes
      max: 100, // limit each IP to 100 requests per windowMs
      standardHeaders: true,
      legacyHeaders: false
    }));
  }

  // CORS configuration
  app.use(cors(getCorsConfig()));

  // Static file serving
  app.use(express.static('public'));

  // Body parsing middleware
  app.use(express.json({ 
    limit: config.storage.maxFileSize,
    verify: (req, _res, buf) => {
      // Store raw body for webhook signature verification
      (req as any).rawBody = buf;
    }
  }));
  app.use(express.urlencoded({ 
    extended: true, 
    limit: config.storage.maxFileSize 
  }));

  // Request ID middleware
  app.use((req, res, next) => {
    const requestId = req.get('X-Request-ID') || 
                     `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    (req as any).requestId = requestId;
    res.setHeader('X-Request-ID', requestId);
    next();
  });

  // Response time middleware
  app.use((req, res, next) => {
    const startTime = Date.now();
    
    const cleanup = () => {
      const responseTime = Date.now() - startTime;
      
      // Only set header if headers haven't been sent yet
      if (!res.headersSent) {
        res.setHeader('X-Response-Time', `${responseTime}ms`);
      }
      
      // Log slow requests
      if (responseTime > 5000) { // 5 seconds
        console.warn(`Slow request: ${req.method} ${req.path} took ${responseTime}ms`);
      }
    };
    
    res.on('finish', cleanup);
    res.on('close', cleanup);
    
    next();
  });

  // Enhanced request logging middleware (temporarily disabled)
  // if (ENV_CONFIG.ENABLE_REQUEST_LOGGING) {
  //   app.use(requestLogger({
  //     enableRequestLogging: true,
  //     enableResponseLogging: true,
  //     enableStructuredLogging: ENV_CONFIG.ENABLE_STRUCTURED_LOGGING,
  //     enableSlowRequestLogging: true,
  //     slowRequestThreshold: 5000,
  //     logLevel: isDevelopment() ? 'debug' : 'info',
  //     excludePaths: ['/health', '/favicon.ico', '/robots.txt'],
  //     includeRequestBody: false,
  //     includeResponseBody: false,
  //     maxBodySize: 10240
  //   }));
  // }

  // API versioning middleware (temporarily disabled)
  // app.use(versionDetection());
  // app.use(versionRedirect());

  // Health check endpoint
  app.get('/health', async (_req, res) => {
    try {
      const healthCheck = {
        status: 'healthy',
        timestamp: new Date().toISOString(),
        version: '1.0.0',
        environment: config.server.nodeEnv,
        uptime: process.uptime(),
        services: {
          database: {
            status: 'unknown', // Will be updated by database health check
            lastChecked: new Date().toISOString()
          },
          storage: {
            status: 'unknown', // Will be updated by storage health check
            lastChecked: new Date().toISOString()
          }
        }
      };

      res.status(200).json(healthCheck);
    } catch (error) {
      const healthCheck = {
        status: 'unhealthy',
        timestamp: new Date().toISOString(),
        version: '1.0.0',
        environment: config.server.nodeEnv,
        uptime: process.uptime(),
        services: {
          database: {
            status: 'unhealthy',
            error: 'Health check failed',
            lastChecked: new Date().toISOString()
          },
          storage: {
            status: 'unhealthy',
            error: 'Health check failed',
            lastChecked: new Date().toISOString()
          }
        }
      };

      res.status(503).json(healthCheck);
    }
  });

  // Mount API v1 routes
  app.use('/api/v1', v1Routes);

  // Legacy API redirect
  app.use('/api', (req, res) => {
    res.redirect(301, `/api/v1${req.path}`);
  });

  // API documentation endpoint (placeholder for future OpenAPI/Swagger integration)
  if (isDevelopment()) {
    app.get('/api/v1/docs', (req, res) => {
      res.json({
        success: true,
        data: {
          message: 'API documentation endpoint',
          documentation: 'OpenAPI/Swagger documentation will be available here',
          version: '1.0.0'
        },
        meta: {
          timestamp: new Date().toISOString(),
          requestId: (req as any).requestId,
          version: '1.0.0',
          path: req.path
        }
      });
    });
  }

  // 404 handler for undefined routes
  app.use('*', (req, res) => {
    res.status(404).json({
      success: false,
      error: {
        code: 'NOT_FOUND',
        message: `Cannot ${req.method} ${req.originalUrl}`,
        statusCode: 404
      },
      meta: {
        timestamp: new Date().toISOString(),
        requestId: (req as any).requestId,
        version: '1.0.0',
        path: req.path
      }
    });
  });

  // Global error handler
  app.use((error: Error, req: express.Request, res: express.Response, _next: express.NextFunction) => {
    // Log error
    console.error(`Error handling request ${(req as any).requestId}:`, error);

    // Handle specific error types
    if (error.name === 'ValidationError') {
      return res.status(400).json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Request validation failed',
          details: error.message,
          statusCode: 400
        },
        meta: {
          timestamp: new Date().toISOString(),
          requestId: (req as any).requestId,
          version: '1.0.0',
          path: req.path
        }
      });
    }

    if (error.name === 'UnauthorizedError' || error.message.includes('unauthorized')) {
      return res.status(401).json({
        success: false,
        error: {
          code: 'UNAUTHORIZED',
          message: 'Authentication required',
          statusCode: 401
        },
        meta: {
          timestamp: new Date().toISOString(),
          requestId: (req as any).requestId,
          version: '1.0.0',
          path: req.path
        }
      });
    }

    // Handle JSON parsing errors
    if (error instanceof SyntaxError && 'body' in error) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'INVALID_JSON',
          message: 'Invalid JSON in request body',
          statusCode: 400
        },
        meta: {
          timestamp: new Date().toISOString(),
          requestId: (req as any).requestId,
          version: '1.0.0',
          path: req.path
        }
      });
    }

    // Default error response
    const statusCode = (error as any).statusCode || (error as any).status || 500;
    const message = isProduction() 
      ? 'Internal server error' 
      : error.message || 'An unexpected error occurred';

    return res.status(statusCode).json({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message,
        details: isDevelopment() ? error.stack : undefined,
        statusCode
      },
      meta: {
        timestamp: new Date().toISOString(),
        requestId: (req as any).requestId,
        version: '1.0.0',
        path: req.path
      }
    });
  });

  return app;
};

/**
 * Add routes to the application
 * This will be used by Stream B for API route integration
 */
export const addRoutes = (app: express.Application, routes: {
  path: string;
  router: express.Router;
}[]) => {
  routes.forEach(({ path, router }) => {
    app.use(path, router);
    console.log(`Mounted routes at ${path}`);
  });
};

/**
 * Add middleware to specific paths
 */
export const addMiddleware = (app: express.Application, middleware: {
  path?: string;
  handler: express.RequestHandler;
}[]) => {
  middleware.forEach(({ path, handler }) => {
    if (path) {
      app.use(path, handler);
    } else {
      app.use(handler);
    }
  });
};

/**
 * Application configuration validation
 */
export const validateAppConfig = (): {
  isValid: boolean;
  warnings: string[];
  errors: string[];
} => {
  const warnings: string[] = [];
  const errors: string[] = [];

  // Check critical configurations
  if (isProduction() && !config.database?.url) {
    errors.push('DATABASE_URL is not configured for production');
  }

  // Development warnings
  if (isDevelopment()) {
    warnings.push('Running in development mode');
  }

  // Production checks
  if (isProduction()) {
    if (!config.auth?.jwtSecret) {
      errors.push('JWT_SECRET is required for production');
    }
  }

  return {
    isValid: errors.length === 0,
    warnings,
    errors
  };
};

// Validate app configuration on module load
const appValidation = validateAppConfig();
if (appValidation.warnings.length > 0) {
  console.warn('Application configuration warnings:', appValidation.warnings.join(', '));
}
if (!appValidation.isValid) {
  console.error('Application configuration errors:', appValidation.errors.join(', '));
}

// Export the configured app
export default createApp;