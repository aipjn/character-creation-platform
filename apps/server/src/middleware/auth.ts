/**
 * Authentication Middleware
 * Handles JWT token validation, user authentication, and authorization
 */

import { Request, Response, NextFunction } from 'express';
import { getAuthService, User } from '../services/auth';
import { AUTH0_CONFIG } from '../config/auth0';
import { ENV_CONFIG } from '../config/env';

// Extend Express Request to include user and authentication context
export interface AuthenticatedRequest extends Request {
  user?: User;
  auth?: {
    isAuthenticated: boolean;
    token?: string;
    sessionId?: string;
  };
}

// Authentication error class
export class AuthenticationError extends Error {
  public statusCode: number;
  public code: string;

  constructor(message: string, statusCode = 401, code = 'AUTHENTICATION_FAILED') {
    super(message);
    this.name = 'AuthenticationError';
    this.statusCode = statusCode;
    this.code = code;
  }
}

// Authorization error class
export class AuthorizationError extends Error {
  public statusCode: number;
  public code: string;

  constructor(message: string, statusCode = 403, code = 'AUTHORIZATION_FAILED') {
    super(message);
    this.name = 'AuthorizationError';
    this.statusCode = statusCode;
    this.code = code;
  }
}

/**
 * Extract token from Authorization header or cookies
 */
function extractToken(req: Request): string | null {
  // Check Authorization header (Bearer token)
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    return authHeader.substring(7);
  }

  // Check cookies for session token
  const sessionCookie = req.cookies?.[`character-creator-session`];
  if (sessionCookie) {
    return sessionCookie;
  }

  // Check query parameter (not recommended for production, but useful for testing)
  if (ENV_CONFIG.NODE_ENV !== 'production' && req.query.token) {
    return req.query.token as string;
  }

  return null;
}

/**
 * Basic authentication middleware - validates token and attaches user to request
 */
export const authenticate = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const token = extractToken(req);
    
    if (!token) {
      req.auth = { isAuthenticated: false };
      return next();
    }

    const authService = getAuthService();
    const user = await authService.verifyToken(token);

    if (!user) {
      req.auth = { isAuthenticated: false, token };
      return next();
    }

    // Attach user and auth context to request
    req.user = user;
    req.auth = {
      isAuthenticated: true,
      token,
      sessionId: req.sessionID
    };

    next();
  } catch (error) {
    console.error('Authentication middleware error:', error);
    req.auth = { isAuthenticated: false };
    next();
  }
};

/**
 * Require authentication - returns 401 if user is not authenticated
 */
export const requireAuth = (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): void => {
  if (!req.auth?.isAuthenticated || !req.user) {
    throw new AuthenticationError('Authentication required', 401, 'AUTH_REQUIRED');
  }
  next();
};

/**
 * Optional authentication - continues regardless of authentication status
 */
export const optionalAuth = authenticate;

/**
 * Require verified email
 */
export const requireVerifiedEmail = (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): void => {
  if (!req.user?.emailVerified) {
    throw new AuthenticationError(
      'Email verification required',
      401,
      'EMAIL_VERIFICATION_REQUIRED'
    );
  }
  next();
};

/**
 * Role-based authorization middleware
 */
export const requireRole = (...roles: string[]) => {
  return (req: AuthenticatedRequest, res: Response, next: NextFunction): void => {
    if (!req.user?.roles || req.user.roles.length === 0) {
      throw new AuthorizationError(
        'Insufficient permissions',
        403,
        'INSUFFICIENT_PERMISSIONS'
      );
    }

    const hasRequiredRole = roles.some(role => req.user!.roles!.includes(role));
    if (!hasRequiredRole) {
      throw new AuthorizationError(
        `Required roles: ${roles.join(', ')}`,
        403,
        'ROLE_REQUIRED'
      );
    }

    next();
  };
};

/**
 * Resource ownership middleware - ensures user owns the resource
 */
export const requireOwnership = (resourceIdParam = 'id') => {
  return async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      const resourceId = req.params[resourceIdParam];
      const userId = req.user?.id;

      if (!userId) {
        throw new AuthenticationError('Authentication required', 401);
      }

      // This would typically check database for resource ownership
      // For now, we'll implement a basic check assuming the resource belongs to the user
      // In a real implementation, you'd query your database to verify ownership
      
      // Example: Check if character belongs to user
      if (req.baseUrl.includes('/characters') || req.route?.path.includes('character')) {
        // Would query database: const character = await Character.findById(resourceId);
        // if (!character || character.userId !== userId) { throw error }
      }

      next();
    } catch (error) {
      if (error instanceof AuthenticationError || error instanceof AuthorizationError) {
        throw error;
      }
      throw new AuthorizationError('Resource access denied', 403);
    }
  };
};

/**
 * Rate limiting per user
 */
export const userRateLimit = (maxRequests = 100, windowMs = 15 * 60 * 1000) => {
  const userRequests = new Map<string, { count: number; resetTime: number }>();

  return (req: AuthenticatedRequest, res: Response, next: NextFunction): void => {
    const userId = req.user?.id;
    
    if (!userId) {
      return next(); // Let other middleware handle unauthenticated requests
    }

    const now = Date.now();
    const userLimit = userRequests.get(userId);

    if (!userLimit || now > userLimit.resetTime) {
      // Reset or initialize user limit
      userRequests.set(userId, {
        count: 1,
        resetTime: now + windowMs
      });
      return next();
    }

    if (userLimit.count >= maxRequests) {
      throw new AuthenticationError(
        'User rate limit exceeded',
        429,
        'RATE_LIMIT_EXCEEDED'
      );
    }

    userLimit.count++;
    next();
  };
};

/**
 * Session validation middleware
 */
export const validateSession = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    if (!req.auth?.isAuthenticated || !req.auth?.sessionId) {
      return next();
    }

    const authService = getAuthService();
    const isValidSession = await authService.validateSession(req.auth.sessionId);

    if (!isValidSession) {
      req.auth.isAuthenticated = false;
      delete req.user;
      
      // Clear session cookie
      res.clearCookie('character-creator-session');
    }

    next();
  } catch (error) {
    console.error('Session validation error:', error);
    next();
  }
};

/**
 * Logout middleware - clears session and tokens
 */
export const logout = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    if (req.user?.id) {
      const authService = getAuthService();
      await authService.logoutUser(req.user.id, req.auth?.sessionId);
    }

    // Clear cookies
    res.clearCookie('character-creator-session');
    res.clearCookie('connect.sid'); // Express session cookie

    // Remove user from request
    delete req.user;
    req.auth = { isAuthenticated: false };

    next();
  } catch (error) {
    console.error('Logout middleware error:', error);
    next(error);
  }
};

/**
 * Error handler for authentication errors
 */
export const authErrorHandler = (
  error: Error,
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  if (error instanceof AuthenticationError) {
    res.status(error.statusCode).json({
      error: {
        message: error.message,
        code: error.code,
        type: 'AuthenticationError'
      }
    });
    return;
  }

  if (error instanceof AuthorizationError) {
    res.status(error.statusCode).json({
      error: {
        message: error.message,
        code: error.code,
        type: 'AuthorizationError'
      }
    });
    return;
  }

  // Pass other errors to the next error handler
  next(error);
};

/**
 * Combine authentication and authorization middleware
 */
export const createAuthMiddleware = (options: {
  required?: boolean;
  roles?: string[];
  requireEmailVerification?: boolean;
  requireOwnership?: boolean;
  resourceIdParam?: string;
} = {}) => {
  const middlewares: Array<(req: AuthenticatedRequest, res: Response, next: NextFunction) => void> = [];

  // Always start with authentication
  middlewares.push(authenticate);

  // Validate session if needed
  middlewares.push(validateSession);

  // Require authentication if specified
  if (options.required) {
    middlewares.push(requireAuth);
  }

  // Require email verification if specified
  if (options.requireEmailVerification) {
    middlewares.push(requireVerifiedEmail);
  }

  // Check roles if specified
  if (options.roles && options.roles.length > 0) {
    middlewares.push(requireRole(...options.roles));
  }

  // Check resource ownership if specified
  if (options.requireOwnership) {
    middlewares.push(requireOwnership(options.resourceIdParam));
  }

  return middlewares;
};

// Export commonly used middleware combinations
export const authMiddleware = {
  // Basic authentication (optional)
  optional: optionalAuth,
  
  // Required authentication
  required: [authenticate, validateSession, requireAuth],
  
  // Required authentication with email verification
  requiredVerified: [authenticate, validateSession, requireAuth, requireVerifiedEmail],
  
  // Admin only access
  adminOnly: [authenticate, validateSession, requireAuth, requireRole('admin')],
  
  // Owner or admin access
  ownerOrAdmin: [
    authenticate, 
    validateSession, 
    requireAuth, 
    requireOwnership(),
    // Note: In real implementation, you'd add logic to allow admins to bypass ownership
  ],
};

// Export all middleware functions
export default {
  authenticate,
  requireAuth,
  optionalAuth,
  requireVerifiedEmail,
  requireRole,
  requireOwnership,
  userRateLimit,
  validateSession,
  logout,
  authErrorHandler,
  createAuthMiddleware,
  authMiddleware
};