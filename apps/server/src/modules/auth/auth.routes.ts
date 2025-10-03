/**
 * Simplified Auth Routes - JWT Token Only
 * No express-openid-connect, just direct Auth0 API calls
 */

import express from 'express';
import { getAuthService } from './auth.service';

const router = express.Router();
const authService = getAuthService();

/**
 * POST /auth/login
 * Login with email and password
 */
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'INVALID_INPUT',
          message: 'Email and password are required',
        },
      });
    }

    const result = await authService.loginUser(email, password);

    if (!result.success) {
      return res.status(401).json({
        success: false,
        error: {
          code: 'AUTHENTICATION_FAILED',
          message: result.error || 'Invalid credentials',
        },
      });
    }

    return res.json({
      success: true,
      data: {
        user: result.user,
        token: result.accessToken,
      },
    });
  } catch (error) {
    console.error('[AUTH] Login error:', error);
    return res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Login failed',
      },
    });
  }
});

/**
 * POST /auth/register
 * Register new user
 */
router.post('/register', async (req, res) => {
  try {
    const { email, password, name } = req.body;

    if (!email || !password || !name) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'INVALID_INPUT',
          message: 'Email, password, and name are required',
        },
      });
    }

    const result = await authService.registerUser({ email, password, name });

    if (!result.success) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'REGISTRATION_FAILED',
          message: result.error || 'Registration failed',
        },
      });
    }

    return res.json({
      success: true,
      data: {
        user: result.user,
        message: 'Registration successful. Please verify your email.',
      },
    });
  } catch (error) {
    console.error('[AUTH] Registration error:', error);
    return res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Registration failed',
      },
    });
  }
});

/**
 * GET /auth/me
 * Get current user by Bearer token
 */
router.get('/me', async (req, res) => {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({
      success: false,
      error: {
        code: 'UNAUTHORIZED',
        message: 'No token provided',
      },
    });
  }

  try {
    const token = authHeader.substring(7);
    const user = await authService.verifyToken(token);

    if (!user) {
      return res.status(401).json({
        success: false,
        error: {
          code: 'UNAUTHORIZED',
          message: 'Invalid token',
        },
      });
    }

    return res.json({
      success: true,
      data: {
        user: {
          id: user.id,
          email: user.email,
          name: user.name,
          picture: user.picture,
          emailVerified: user.emailVerified,
        },
      },
    });
  } catch (error) {
    console.error('[AUTH] Token verification failed:', error);
    return res.status(401).json({
      success: false,
      error: {
        code: 'UNAUTHORIZED',
        message: 'Invalid token',
      },
    });
  }
});

/**
 * POST /auth/logout
 * Logout (client-side token removal)
 */
router.post('/logout', (req, res) => {
  return res.json({
    success: true,
    message: 'Logged out successfully',
  });
});

export default router;
