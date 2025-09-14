/**
 * Scenes API Routes - Simplified Version
 * RESTful endpoints for scene management
 */

import express from 'express';
import { ApiResponse, API_CONSTANTS } from '../../types/api';

const router = express.Router();

/**
 * GET /api/v1/scenes
 * List scenes
 */
router.get('/', async (req: express.Request, res: express.Response) => {
  try {
    const mockScenes = [
      {
        id: '1',
        name: 'Medieval Castle',
        description: 'A majestic castle scene for fantasy characters',
        imageUrl: 'https://example.com/castle.jpg',
        charactersCount: 3,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      }
    ];

    const response: ApiResponse = {
      success: true,
      data: mockScenes,
      meta: {
        timestamp: new Date().toISOString(),
        requestId: req.get('X-Request-ID') || 'unknown',
        version: '1.0.0',
        path: req.path
      }
    };

    return res.json(response);
  } catch (error) {
    const response: ApiResponse = {
      success: false,
      error: {
        code: API_CONSTANTS.ERROR_CODES.INTERNAL_ERROR,
        message: 'Internal server error',
        statusCode: API_CONSTANTS.HTTP_STATUS.INTERNAL_SERVER_ERROR
      },
      meta: {
        timestamp: new Date().toISOString(),
        requestId: req.get('X-Request-ID') || 'unknown',
        version: '1.0.0',
        path: req.path
      }
    };

    return res.status(API_CONSTANTS.HTTP_STATUS.INTERNAL_SERVER_ERROR).json(response);
  }
});

export default router;