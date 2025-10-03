/**
 * Authentication Middleware
 * Validates JWT token and attaches user to request
 */

import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { PrismaClient } from '@prisma/client';
import { API_CONSTANTS } from '../types/api';

const prisma = new PrismaClient();

// Extend Express Request to include user
declare global {
  namespace Express {
    interface Request {
      user?: {
        id: string;
        auth0Id: string | null;
        email: string;
        name: string | null;
      };
    }
  }
}

/**
 * Require authentication - rejects requests without valid token
 */
export async function requireAuth(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      res.status(API_CONSTANTS.HTTP_STATUS.UNAUTHORIZED).json({
        success: false,
        error: {
          code: API_CONSTANTS.ERROR_CODES.UNAUTHORIZED,
          message: 'Authentication required',
          statusCode: API_CONSTANTS.HTTP_STATUS.UNAUTHORIZED
        }
      });
      return;
    }

    const token = authHeader.substring(7);
    const payload = jwt.decode(token) as any;

    if (!payload?.sub) {
      res.status(API_CONSTANTS.HTTP_STATUS.UNAUTHORIZED).json({
        success: false,
        error: {
          code: API_CONSTANTS.ERROR_CODES.UNAUTHORIZED,
          message: 'Invalid token',
          statusCode: API_CONSTANTS.HTTP_STATUS.UNAUTHORIZED
        }
      });
      return;
    }

    // Get user from database
    const dbUser = await prisma.user.findUnique({
      where: { auth0Id: payload.sub },
      select: {
        id: true,
        auth0Id: true,
        email: true,
        name: true
      }
    });

    if (!dbUser) {
      res.status(API_CONSTANTS.HTTP_STATUS.UNAUTHORIZED).json({
        success: false,
        error: {
          code: API_CONSTANTS.ERROR_CODES.UNAUTHORIZED,
          message: 'User not found',
          statusCode: API_CONSTANTS.HTTP_STATUS.UNAUTHORIZED
        }
      });
      return;
    }

    // Attach user to request
    req.user = dbUser;
    next();
  } catch (error) {
    console.error('Auth middleware error:', error);
    res.status(API_CONSTANTS.HTTP_STATUS.UNAUTHORIZED).json({
      success: false,
      error: {
        code: API_CONSTANTS.ERROR_CODES.UNAUTHORIZED,
        message: 'Authentication failed',
        statusCode: API_CONSTANTS.HTTP_STATUS.UNAUTHORIZED
      }
    });
  }
}

/**
 * Optional authentication - allows requests without token, but validates if present
 */
export async function optionalAuth(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const authHeader = req.headers.authorization;

    if (authHeader && authHeader.startsWith('Bearer ')) {
      const token = authHeader.substring(7);
      const payload = jwt.decode(token) as any;

      if (payload?.sub) {
        const dbUser = await prisma.user.findUnique({
          where: { auth0Id: payload.sub },
          select: {
            id: true,
            auth0Id: true,
            email: true,
            name: true
          }
        });

        if (dbUser) {
          req.user = dbUser;
        }
      }
    }

    next();
  } catch (error) {
    // Don't block request on optional auth errors
    console.error('Optional auth error:', error);
    next();
  }
}
