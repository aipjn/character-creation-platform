/**
 * Auth API Routes
 * Authentication and authorization endpoints
 */

import express from 'express';
import { 
  ApiResponse,
  API_CONSTANTS 
} from '../../types/api';

const router = express.Router();

/**
 * POST /api/v1/auth/verify
 * Verify authentication token
 */
router.post('/verify', async (req: express.Request, res: express.Response) => {
  try {
    const authHeader = req.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      const response: ApiResponse = {
        success: false,
        error: {
          code: API_CONSTANTS.ERROR_CODES.UNAUTHORIZED,
          message: 'Authorization token required',
          statusCode: API_CONSTANTS.HTTP_STATUS.UNAUTHORIZED
        },
        meta: {
          timestamp: new Date().toISOString(),
          requestId: req.get('X-Request-ID') || 'unknown',
          version: '1.0.0',
          path: req.path
        }
      };

      return res.status(API_CONSTANTS.HTTP_STATUS.UNAUTHORIZED).json(response);
    }

    const token = authHeader.substring(7); // Remove 'Bearer ' prefix

    // For development, accept any non-empty token
    if (!token || token.trim().length === 0) {
      const response: ApiResponse = {
        success: false,
        error: {
          code: API_CONSTANTS.ERROR_CODES.UNAUTHORIZED,
          message: 'Invalid token',
          statusCode: API_CONSTANTS.HTTP_STATUS.UNAUTHORIZED
        },
        meta: {
          timestamp: new Date().toISOString(),
          requestId: req.get('X-Request-ID') || 'unknown',
          version: '1.0.0',
          path: req.path
        }
      };

      return res.status(API_CONSTANTS.HTTP_STATUS.UNAUTHORIZED).json(response);
    }

    // Return demo user for any valid token
    const user = {
      id: 'demo_user',
      name: 'Demo User',
      email: 'demo@example.com',
      credits: 10
    };

    const response: ApiResponse = {
      success: true,
      data: {
        user,
        token
      },
      meta: {
        timestamp: new Date().toISOString(),
        requestId: req.get('X-Request-ID') || 'unknown',
        version: '1.0.0',
        path: req.path
      }
    };

    return res.json(response);
  } catch (error) {
    console.error('Error verifying token:', error);
    
    const response: ApiResponse = {
      success: false,
      error: {
        code: API_CONSTANTS.ERROR_CODES.INTERNAL_ERROR,
        message: 'Failed to verify token',
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