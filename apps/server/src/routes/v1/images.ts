/**
 * Secure Image Access API
 * Serves images with authentication and authorization checks
 */

import express from 'express';
import path from 'path';
import fs from 'fs';
import jwt from 'jsonwebtoken';
import { PrismaClient } from '@prisma/client';
import { requireAuth } from '../../middleware/requireAuth';
import { API_CONSTANTS } from '../../types/api';

const router = express.Router();
const prisma = new PrismaClient();

/**
 * Custom auth middleware for images that supports query parameter tokens
 * Required because HTML <img> tags cannot send Authorization headers
 */
async function imageAuth(req: express.Request, res: express.Response, next: express.NextFunction): Promise<void> {
  try {
    // Check for token in Authorization header first
    let token = '';
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      token = authHeader.substring(7);
    }

    // If no header token, check query parameter
    if (!token && req.query.token) {
      token = req.query.token as string;
    }

    if (!token) {
      res.status(401).json({
        success: false,
        error: {
          code: 'UNAUTHORIZED',
          message: 'Authentication required',
          statusCode: 401
        }
      });
      return;
    }

    // Decode and verify token
    const payload = jwt.decode(token) as any;
    if (!payload?.sub) {
      res.status(401).json({
        success: false,
        error: {
          code: 'UNAUTHORIZED',
          message: 'Invalid token',
          statusCode: 401
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
      res.status(401).json({
        success: false,
        error: {
          code: 'UNAUTHORIZED',
          message: 'User not found',
          statusCode: 401
        }
      });
      return;
    }

    // Attach user to request
    req.user = dbUser;
    next();
  } catch (error) {
    console.error('Image auth error:', error);
    res.status(401).json({
      success: false,
      error: {
        code: 'UNAUTHORIZED',
        message: 'Authentication failed',
        statusCode: 401
      }
    });
  }
}

/**
 * GET /api/v1/images/:type/:filename
 * Serve image file with permission check
 *
 * Types:
 * - characters: Character images
 * - variants: Theme variant images
 *
 * Supports authentication via:
 * - Authorization header: Bearer <token>
 * - Query parameter: ?token=<token>
 */
router.get('/:type/:filename', imageAuth, async (req: express.Request, res: express.Response): Promise<void> => {
  try {
    const { type, filename } = req.params;

    // Validate type
    if (type !== 'characters' && type !== 'variants') {
      res.status(API_CONSTANTS.HTTP_STATUS.BAD_REQUEST).json({
        success: false,
        error: {
          code: API_CONSTANTS.ERROR_CODES.VALIDATION_ERROR,
          message: 'Invalid image type',
          statusCode: API_CONSTANTS.HTTP_STATUS.BAD_REQUEST
        }
      });
      return;
    }

    // Extract ID from filename (format: {id}.png or {id}_thumb.png)
    const idMatch = filename?.match(/^(.+?)(?:_thumb)?\.png$/);
    if (!idMatch || !filename) {
      res.status(API_CONSTANTS.HTTP_STATUS.BAD_REQUEST).json({
        success: false,
        error: {
          code: API_CONSTANTS.ERROR_CODES.VALIDATION_ERROR,
          message: 'Invalid filename format',
          statusCode: API_CONSTANTS.HTTP_STATUS.BAD_REQUEST
        }
      });
      return;
    }

    const resourceId = idMatch[1];

    // Check permissions based on type
    let hasPermission = false;

    if (type === 'characters') {
      // Check if user owns this character
      const character = await prisma.character.findUnique({
        where: { id: resourceId },
        select: { userId: true }
      });

      if (character && character.userId === req.user!.id) {
        hasPermission = true;
      }
    } else if (type === 'variants') {
      // Extract variant ID (format: variant_timestamp_uuid)
      const variant = await prisma.themeVariant.findUnique({
        where: { id: resourceId },
        select: {
          theme: {
            select: {
              character: {
                select: { userId: true }
              }
            }
          }
        }
      });

      if (variant && variant.theme.character.userId === req.user!.id) {
        hasPermission = true;
      }
    }

    if (!hasPermission) {
      res.status(API_CONSTANTS.HTTP_STATUS.FORBIDDEN).json({
        success: false,
        error: {
          code: API_CONSTANTS.ERROR_CODES.FORBIDDEN,
          message: 'You do not have permission to access this image',
          statusCode: API_CONSTANTS.HTTP_STATUS.FORBIDDEN
        }
      });
      return;
    }

    // Construct file path
    const filePath = path.join(process.cwd(), 'uploads', type, filename);

    // Check if file exists
    if (!fs.existsSync(filePath)) {
      res.status(API_CONSTANTS.HTTP_STATUS.NOT_FOUND).json({
        success: false,
        error: {
          code: API_CONSTANTS.ERROR_CODES.NOT_FOUND,
          message: 'Image not found',
          statusCode: API_CONSTANTS.HTTP_STATUS.NOT_FOUND
        }
      });
      return;
    }

    // Serve the file
    res.setHeader('Content-Type', 'image/png');
    res.setHeader('Cache-Control', 'private, max-age=31536000'); // Cache for 1 year
    res.sendFile(filePath);

  } catch (error) {
    console.error('Error serving image:', error);
    res.status(API_CONSTANTS.HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
      success: false,
      error: {
        code: API_CONSTANTS.ERROR_CODES.INTERNAL_ERROR,
        message: 'Failed to serve image',
        statusCode: API_CONSTANTS.HTTP_STATUS.INTERNAL_SERVER_ERROR
      }
    });
  }
});

export default router;
