/**
 * Credits API Routes
 * RESTful endpoints for credit management
 */

import express from 'express';
import { ApiResponse, API_CONSTANTS } from '../../types/api';
import { CreditService } from './credits.service';
import { authMiddleware } from '../auth/auth.middleware';

const router = express.Router();

/**
 * GET /api/v1/credits
 * Get user credits balance and stats
 */
router.get('/', ...authMiddleware.required, async (req: any, res: express.Response) => {
  try {
    const userId = req.user?.id || req.user?.auth0Id;

    if (!userId) {
      const response: ApiResponse = {
        success: false,
        error: {
          code: API_CONSTANTS.ERROR_CODES.UNAUTHORIZED,
          message: 'User not authenticated',
          statusCode: API_CONSTANTS.HTTP_STATUS.UNAUTHORIZED,
        },
        meta: {
          timestamp: new Date().toISOString(),
          requestId: req.get('X-Request-ID') || 'unknown',
          version: '1.0.0',
          path: req.path,
        },
      };
      return res.status(API_CONSTANTS.HTTP_STATUS.UNAUTHORIZED).json(response);
    }

    const userCredits = await CreditService.getUserCredits(userId);

    if (!userCredits) {
      const response: ApiResponse = {
        success: false,
        error: {
          code: 'CREDITS_NOT_FOUND',
          message: 'User credits not found',
          statusCode: 404,
        },
        meta: {
          timestamp: new Date().toISOString(),
          requestId: req.get('X-Request-ID') || 'unknown',
          version: '1.0.0',
          path: req.path,
        },
      };
      return res.status(404).json(response);
    }

    const response: ApiResponse = {
      success: true,
      data: {
        balance: userCredits.remainingCredits,
        totalEarned: userCredits.totalCreditsEarned,
        totalSpent: userCredits.totalCreditsSpent,
        dailyCredits: userCredits.dailyCredits,
        lastReset: userCredits.lastResetDate,
      },
      meta: {
        timestamp: new Date().toISOString(),
        requestId: req.get('X-Request-ID') || 'unknown',
        version: '1.0.0',
        path: req.path,
      },
    };

    return res.json(response);
  } catch (error: any) {
    console.error('Get credits error:', error);

    const response: ApiResponse = {
      success: false,
      error: {
        code: API_CONSTANTS.ERROR_CODES.INTERNAL_ERROR,
        message: error.message || 'Failed to get credits',
        statusCode: API_CONSTANTS.HTTP_STATUS.INTERNAL_SERVER_ERROR,
      },
      meta: {
        timestamp: new Date().toISOString(),
        requestId: req.get('X-Request-ID') || 'unknown',
        version: '1.0.0',
        path: req.path,
      },
    };

    return res.status(API_CONSTANTS.HTTP_STATUS.INTERNAL_SERVER_ERROR).json(response);
  }
});

/**
 * GET /api/v1/credits/history
 * Get credit transaction history
 */
router.get('/history', ...authMiddleware.required, async (req: any, res: express.Response) => {
  try {
    const userId = req.user?.id || req.user?.auth0Id;

    if (!userId) {
      const response: ApiResponse = {
        success: false,
        error: {
          code: API_CONSTANTS.ERROR_CODES.UNAUTHORIZED,
          message: 'User not authenticated',
          statusCode: API_CONSTANTS.HTTP_STATUS.UNAUTHORIZED,
        },
        meta: {
          timestamp: new Date().toISOString(),
          requestId: req.get('X-Request-ID') || 'unknown',
          version: '1.0.0',
          path: req.path,
        },
      };
      return res.status(API_CONSTANTS.HTTP_STATUS.UNAUTHORIZED).json(response);
    }

    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 20;
    const offset = (page - 1) * limit;

    const transactions = await CreditService.getCreditHistory(userId, limit, offset);

    const response: ApiResponse = {
      success: true,
      data: {
        items: transactions,
        pagination: {
          page,
          limit,
          offset,
          total: transactions.length,
        },
      },
      meta: {
        timestamp: new Date().toISOString(),
        requestId: req.get('X-Request-ID') || 'unknown',
        version: '1.0.0',
        path: req.path,
      },
    };

    return res.json(response);
  } catch (error: any) {
    console.error('Get credit history error:', error);

    const response: ApiResponse = {
      success: false,
      error: {
        code: API_CONSTANTS.ERROR_CODES.INTERNAL_ERROR,
        message: error.message || 'Failed to get credit history',
        statusCode: API_CONSTANTS.HTTP_STATUS.INTERNAL_SERVER_ERROR,
      },
      meta: {
        timestamp: new Date().toISOString(),
        requestId: req.get('X-Request-ID') || 'unknown',
        version: '1.0.0',
        path: req.path,
      },
    };

    return res.status(API_CONSTANTS.HTTP_STATUS.INTERNAL_SERVER_ERROR).json(response);
  }
});

/**
 * POST /api/v1/credits/grant
 * Grant credits to user (Admin only)
 */
router.post('/grant', ...authMiddleware.required, async (req: any, res: express.Response) => {
  try {
    // Check if user is admin
    if (req.user?.role !== 'admin') {
      const response: ApiResponse = {
        success: false,
        error: {
          code: API_CONSTANTS.ERROR_CODES.FORBIDDEN,
          message: 'Admin access required',
          statusCode: API_CONSTANTS.HTTP_STATUS.FORBIDDEN,
        },
        meta: {
          timestamp: new Date().toISOString(),
          requestId: req.get('X-Request-ID') || 'unknown',
          version: '1.0.0',
          path: req.path,
        },
      };
      return res.status(API_CONSTANTS.HTTP_STATUS.FORBIDDEN).json(response);
    }

    const { userId, credits, description } = req.body;

    if (!userId || !credits || credits <= 0) {
      const response: ApiResponse = {
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Valid userId and positive credits amount are required',
          statusCode: 400,
        },
        meta: {
          timestamp: new Date().toISOString(),
          requestId: req.get('X-Request-ID') || 'unknown',
          version: '1.0.0',
          path: req.path,
        },
      };
      return res.status(400).json(response);
    }

    const transaction = await CreditService.grantCredits(userId, credits, description);

    const response: ApiResponse = {
      success: true,
      data: {
        transaction,
      },
      meta: {
        timestamp: new Date().toISOString(),
        requestId: req.get('X-Request-ID') || 'unknown',
        version: '1.0.0',
        path: req.path,
      },
    };

    return res.json(response);
  } catch (error: any) {
    console.error('Grant credits error:', error);

    const response: ApiResponse = {
      success: false,
      error: {
        code: API_CONSTANTS.ERROR_CODES.INTERNAL_ERROR,
        message: error.message || 'Failed to grant credits',
        statusCode: API_CONSTANTS.HTTP_STATUS.INTERNAL_SERVER_ERROR,
      },
      meta: {
        timestamp: new Date().toISOString(),
        requestId: req.get('X-Request-ID') || 'unknown',
        version: '1.0.0',
        path: req.path,
      },
    };

    return res.status(API_CONSTANTS.HTTP_STATUS.INTERNAL_SERVER_ERROR).json(response);
  }
});

export default router;