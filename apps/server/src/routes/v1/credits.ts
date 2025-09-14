/**
 * Credits API Routes - Simplified Version
 * RESTful endpoints for credit management
 */

import express from 'express';
import { ApiResponse, API_CONSTANTS } from '../../types/api';

const router = express.Router();

/**
 * GET /api/v1/credits
 * Get user credits
 */
router.get('/', async (req: express.Request, res: express.Response) => {
  try {
    const mockCredits = {
      userId: (req.query['userId'] as string) || 'user1',
      balance: 100,
      used: 25,
      total: 125
    };

    const response: ApiResponse = {
      success: true,
      data: mockCredits,
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