/**
 * API v1 Routes Index
 * Central router for all v1 API endpoints
 */

import express from 'express';
import { ApiResponse, ApiRequest, ApiResponseHandler } from '../../types/api';

// Route imports (will be uncommented as routes are implemented)
import usersRouter from './users';
import charactersRouter from './characters';

const router = express.Router();

/**
 * API v1 root endpoint
 * Provides information about available endpoints and API status
 */
router.get('/', (req: ApiRequest, res: express.Response) => {
  const response: ApiResponse = {
    success: true,
    data: {
      message: 'Character Creation Platform API v1.0',
      version: '1.0.0',
      documentation: '/api/v1/docs',
      endpoints: {
        users: '/api/v1/users',
        characters: '/api/v1/characters',
        health: '/health'
      },
      status: 'operational',
      rateLimit: {
        window: '15 minutes',
        limit: 100,
        remaining: 100 // This will be dynamic with actual rate limiting
      }
    },
    meta: {
      timestamp: new Date().toISOString(),
      requestId: req.requestId,
      version: '1.0.0',
      path: req.path
    }
  };

  res.json(response);
});

/**
 * Mount sub-routers
 */
router.use('/users', usersRouter);
router.use('/characters', charactersRouter);

/**
 * API v1 catch-all route for undefined endpoints
 */
router.use('*', (req: ApiRequest, res: express.Response) => {
  const response: ApiResponse = {
    success: false,
    error: {
      code: 'NOT_FOUND',
      message: `Cannot ${req.method} ${req.originalUrl}`,
      statusCode: 404
    },
    meta: {
      timestamp: new Date().toISOString(),
      requestId: req.requestId,
      version: '1.0.0',
      path: req.path
    }
  };

  res.status(404).json(response);
});

export default router;