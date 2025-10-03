/**
 * API v1 Routes Index
 * Central router for all v1 API endpoints
 */

import express from 'express';
import { ApiResponse } from '../../types/api';

// Route imports
import { authRoutes } from '../../modules/auth';
// import { creditsRoutes } from '../../modules/credits'; // Temporarily disabled - schema issues
import usersRouter from './users';
import charactersRouter from './characters';
import collectionsRouter from './collections';
import scenesRouter from './scenes';
import themesRouter from './themes';

const router = express.Router();

/**
 * API v1 root endpoint
 * Provides information about available endpoints and API status
 */
router.get('/', (req: express.Request, res: express.Response) => {
  const response: ApiResponse = {
    success: true,
    data: {
      message: 'Character Creation Platform API v1.0',
      version: '1.0.0',
      documentation: '/api/v1/docs',
      endpoints: {
        auth: '/api/v1/auth',
        users: '/api/v1/users',
        characters: '/api/v1/characters',
        themes: '/api/v1/themes',
        collections: '/api/v1/collections',
        scenes: '/api/v1/scenes',
        credits: '/api/v1/credits',
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
      requestId: `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      version: '1.0.0',
      path: req.path
    }
  };

  res.json(response);
});

/**
 * Mount sub-routers
 */
router.use('/auth', authRoutes);
// router.use('/credits', creditsRoutes); // Temporarily disabled - schema issues
router.use('/users', usersRouter);
router.use('/characters', charactersRouter);
router.use('/themes', themesRouter);
router.use('/collections', collectionsRouter);
router.use('/scenes', scenesRouter);

/**
 * API v1 catch-all route for undefined endpoints
 */
router.use('*', (req: express.Request, res: express.Response) => {
  const response: ApiResponse = {
    success: false,
    error: {
      code: 'NOT_FOUND',
      message: `Cannot ${req.method} ${req.originalUrl}`,
      statusCode: 404
    },
    meta: {
      timestamp: new Date().toISOString(),
      requestId: `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      version: '1.0.0',
      path: req.path
    }
  };

  res.status(404).json(response);
});

export default router;