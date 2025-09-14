/**
 * Auth0 Configuration
 * Centralized Auth0 setup and configuration for authentication
 */

import { auth } from 'express-openid-connect';
import { Request, Response, NextFunction } from 'express';
import { ManagementClient, AuthenticationClient } from 'auth0';
import { ENV_CONFIG } from './env';

// Auth0 Environment Configuration Interface
export interface Auth0Config {
  domain: string;
  clientId: string;
  clientSecret: string;
  audience: string;
  scope: string;
  issuerBaseURL: string;
  baseURL: string;
  secret: string;
  idpLogout: boolean;
  authRequired: boolean;
  auth0Logout: boolean;
  enableTelemetry: boolean;
  legacySameSiteCookie: boolean;
}

// Auth0 Social Provider Configuration
export interface SocialProviderConfig {
  google: {
    enabled: boolean;
    clientId?: string;
    clientSecret?: string;
  };
  github: {
    enabled: boolean;
    clientId?: string;
    clientSecret?: string;
  };
}

// JWT Configuration for Auth0
export interface JWTConfig {
  algorithm: string;
  issuer: string;
  audience: string;
  jwksUri: string;
  cache: boolean;
  rateLimit: boolean;
  jwksRequestsPerMinute: number;
}

/**
 * Parse Auth0 environment variables
 */
const parseAuth0EnvVars = () => {
  const requiredVars = ['AUTH0_DOMAIN', 'AUTH0_CLIENT_ID', 'AUTH0_CLIENT_SECRET'];
  const missingVars = requiredVars.filter(varName => !process.env[varName]);
  
  if (missingVars.length > 0) {
    throw new Error(`Missing required Auth0 environment variables: ${missingVars.join(', ')}`);
  }

  return {
    AUTH0_DOMAIN: process.env.AUTH0_DOMAIN!,
    AUTH0_CLIENT_ID: process.env.AUTH0_CLIENT_ID!,
    AUTH0_CLIENT_SECRET: process.env.AUTH0_CLIENT_SECRET!,
    AUTH0_AUDIENCE: process.env.AUTH0_AUDIENCE || `https://${process.env.AUTH0_DOMAIN}/api/v2/`,
    AUTH0_SCOPE: process.env.AUTH0_SCOPE || 'openid profile email',
    AUTH0_BASE_URL: process.env.AUTH0_BASE_URL || ENV_CONFIG.NODE_ENV === 'production' 
      ? process.env.PRODUCTION_URL || 'https://localhost:3000'
      : 'http://localhost:3000',
    AUTH0_SESSION_SECRET: process.env.AUTH0_SESSION_SECRET || ENV_CONFIG.JWT_SECRET,
    
    // Social Providers
    AUTH0_GOOGLE_CLIENT_ID: process.env.AUTH0_GOOGLE_CLIENT_ID,
    AUTH0_GOOGLE_CLIENT_SECRET: process.env.AUTH0_GOOGLE_CLIENT_SECRET,
    AUTH0_GITHUB_CLIENT_ID: process.env.AUTH0_GITHUB_CLIENT_ID,
    AUTH0_GITHUB_CLIENT_SECRET: process.env.AUTH0_GITHUB_CLIENT_SECRET,
    
    // Optional configurations
    AUTH0_ENABLE_TELEMETRY: process.env.AUTH0_ENABLE_TELEMETRY !== 'false',
    AUTH0_IDP_LOGOUT: process.env.AUTH0_IDP_LOGOUT !== 'false',
    AUTH0_AUTH_REQUIRED: process.env.AUTH0_AUTH_REQUIRED !== 'false',
  };
};

// Parse environment variables
const auth0EnvVars = parseAuth0EnvVars();

/**
 * Auth0 Configuration Object
 */
export const AUTH0_CONFIG: Auth0Config = {
  domain: auth0EnvVars.AUTH0_DOMAIN,
  clientId: auth0EnvVars.AUTH0_CLIENT_ID,
  clientSecret: auth0EnvVars.AUTH0_CLIENT_SECRET,
  audience: auth0EnvVars.AUTH0_AUDIENCE,
  scope: auth0EnvVars.AUTH0_SCOPE,
  issuerBaseURL: `https://${auth0EnvVars.AUTH0_DOMAIN}`,
  baseURL: auth0EnvVars.AUTH0_BASE_URL,
  secret: auth0EnvVars.AUTH0_SESSION_SECRET,
  idpLogout: auth0EnvVars.AUTH0_IDP_LOGOUT,
  authRequired: false, // We'll handle this with middleware
  auth0Logout: true,
  enableTelemetry: auth0EnvVars.AUTH0_ENABLE_TELEMETRY,
  legacySameSiteCookie: false
};

/**
 * Social Provider Configuration
 */
export const SOCIAL_PROVIDERS_CONFIG: SocialProviderConfig = {
  google: {
    enabled: !!(auth0EnvVars.AUTH0_GOOGLE_CLIENT_ID && auth0EnvVars.AUTH0_GOOGLE_CLIENT_SECRET),
    clientId: auth0EnvVars.AUTH0_GOOGLE_CLIENT_ID,
    clientSecret: auth0EnvVars.AUTH0_GOOGLE_CLIENT_SECRET
  },
  github: {
    enabled: !!(auth0EnvVars.AUTH0_GITHUB_CLIENT_ID && auth0EnvVars.AUTH0_GITHUB_CLIENT_SECRET),
    clientId: auth0EnvVars.AUTH0_GITHUB_CLIENT_ID,
    clientSecret: auth0EnvVars.AUTH0_GITHUB_CLIENT_SECRET
  }
};

/**
 * JWT Configuration for token validation
 */
export const JWT_CONFIG: JWTConfig = {
  algorithm: 'RS256',
  issuer: `https://${auth0EnvVars.AUTH0_DOMAIN}/`,
  audience: auth0EnvVars.AUTH0_AUDIENCE,
  jwksUri: `https://${auth0EnvVars.AUTH0_DOMAIN}/.well-known/jwks.json`,
  cache: true,
  rateLimit: true,
  jwksRequestsPerMinute: 5
};

/**
 * Auth0 Management Client for server-side operations
 */
export const createManagementClient = (): ManagementClient => {
  return new ManagementClient({
    domain: AUTH0_CONFIG.domain,
    clientId: AUTH0_CONFIG.clientId,
    clientSecret: AUTH0_CONFIG.clientSecret,
    scope: 'read:users update:users create:users delete:users',
    audience: `https://${AUTH0_CONFIG.domain}/api/v2/`,
    tokenProvider: {
      enableCache: true,
      cacheTTLInSeconds: 10
    }
  });
};

/**
 * Auth0 Authentication Client for authentication operations
 */
export const createAuthenticationClient = (): AuthenticationClient => {
  return new AuthenticationClient({
    domain: AUTH0_CONFIG.domain,
    clientId: AUTH0_CONFIG.clientId,
    clientSecret: AUTH0_CONFIG.clientSecret
  });
};

/**
 * Express OpenID Connect configuration
 */
export const getAuth0Middleware = () => {
  return auth({
    issuerBaseURL: AUTH0_CONFIG.issuerBaseURL,
    baseURL: AUTH0_CONFIG.baseURL,
    clientID: AUTH0_CONFIG.clientId,
    clientSecret: AUTH0_CONFIG.clientSecret,
    secret: AUTH0_CONFIG.secret,
    authRequired: AUTH0_CONFIG.authRequired,
    idpLogout: AUTH0_CONFIG.idpLogout,
    auth0Logout: AUTH0_CONFIG.auth0Logout,
    enableTelemetry: AUTH0_CONFIG.enableTelemetry,
    legacySameSiteCookie: AUTH0_CONFIG.legacySameSiteCookie,
    authorizationParams: {
      response_type: 'code',
      audience: AUTH0_CONFIG.audience,
      scope: AUTH0_CONFIG.scope
    },
    session: {
      rolling: true,
      rollingDuration: 24 * 60 * 60, // 24 hours
      absoluteDuration: 7 * 24 * 60 * 60, // 7 days
      cookie: {
        httpOnly: true,
        secure: ENV_CONFIG.NODE_ENV === 'production',
        sameSite: 'lax' as const,
        domain: ENV_CONFIG.NODE_ENV === 'production' 
          ? process.env.COOKIE_DOMAIN 
          : undefined
      },
      name: 'character-creator-session'
    },
    routes: {
      login: '/auth/login',
      logout: '/auth/logout',
      callback: '/auth/callback',
      postLogoutRedirect: '/'
    }
  });
};

/**
 * Auth0 Route Handlers
 */
export const auth0Routes = {
  // Custom login with connection selection
  loginWithConnection: (connection: string) => {
    return (req: Request, res: Response, next: NextFunction) => {
      const returnTo = req.query.returnTo as string || '/dashboard';
      const loginUrl = `/auth/login?connection=${connection}&returnTo=${encodeURIComponent(returnTo)}`;
      res.redirect(loginUrl);
    };
  },

  // Social login handlers
  loginWithGoogle: (req: Request, res: Response) => {
    const returnTo = req.query.returnTo as string || '/dashboard';
    const loginUrl = `/auth/login?connection=google-oauth2&returnTo=${encodeURIComponent(returnTo)}`;
    res.redirect(loginUrl);
  },

  loginWithGitHub: (req: Request, res: Response) => {
    const returnTo = req.query.returnTo as string || '/dashboard';
    const loginUrl = `/auth/login?connection=github&returnTo=${encodeURIComponent(returnTo)}`;
    res.redirect(loginUrl);
  },

  // Custom logout handler
  logout: (req: Request, res: Response) => {
    const returnTo = req.query.returnTo as string || '/';
    res.oidc.logout({
      returnTo: `${AUTH0_CONFIG.baseURL}${returnTo}`
    });
  },

  // User profile endpoint
  profile: (req: Request, res: Response) => {
    if (!req.oidc.isAuthenticated()) {
      return res.status(401).json({ error: 'Not authenticated' });
    }

    const user = req.oidc.user;
    res.json({
      id: user?.sub,
      email: user?.email,
      name: user?.name,
      picture: user?.picture,
      emailVerified: user?.email_verified,
      lastLogin: user?.updated_at
    });
  }
};

/**
 * Validation function for Auth0 configuration
 */
export const validateAuth0Config = (): {
  isValid: boolean;
  errors: string[];
  warnings: string[];
} => {
  const errors: string[] = [];
  const warnings: string[] = [];

  // Required configuration checks
  if (!AUTH0_CONFIG.domain) {
    errors.push('AUTH0_DOMAIN is required');
  }

  if (!AUTH0_CONFIG.clientId) {
    errors.push('AUTH0_CLIENT_ID is required');
  }

  if (!AUTH0_CONFIG.clientSecret) {
    errors.push('AUTH0_CLIENT_SECRET is required');
  }

  if (!AUTH0_CONFIG.secret || AUTH0_CONFIG.secret.length < 32) {
    errors.push('AUTH0_SESSION_SECRET must be at least 32 characters long');
  }

  // Production-specific validations
  if (ENV_CONFIG.NODE_ENV === 'production') {
    if (AUTH0_CONFIG.baseURL.includes('localhost')) {
      errors.push('AUTH0_BASE_URL must use production URL in production environment');
    }

    if (AUTH0_CONFIG.secret === ENV_CONFIG.JWT_SECRET && ENV_CONFIG.JWT_SECRET === 'default-jwt-secret-change-in-production') {
      errors.push('AUTH0_SESSION_SECRET must be different from default JWT_SECRET in production');
    }
  }

  // Social provider warnings
  if (!SOCIAL_PROVIDERS_CONFIG.google.enabled && !SOCIAL_PROVIDERS_CONFIG.github.enabled) {
    warnings.push('No social providers configured. Users will only be able to use email/password authentication');
  }

  // URL format validations
  try {
    new URL(AUTH0_CONFIG.issuerBaseURL);
  } catch {
    errors.push('AUTH0_DOMAIN must be a valid domain');
  }

  try {
    new URL(AUTH0_CONFIG.baseURL);
  } catch {
    errors.push('AUTH0_BASE_URL must be a valid URL');
  }

  return {
    isValid: errors.length === 0,
    errors,
    warnings
  };
};

// Validate configuration on load
const validation = validateAuth0Config();
if (validation.warnings.length > 0) {
  console.warn('Auth0 configuration warnings:', validation.warnings.join(', '));
}
if (!validation.isValid) {
  console.error('Auth0 configuration errors:', validation.errors.join(', '));
  // Don't exit process here, let the application decide how to handle it
}

// Export clients (lazy initialization to avoid connection issues during module load)
export const getManagementClient = (): ManagementClient => createManagementClient();
export const getAuthenticationClient = (): AuthenticationClient => createAuthenticationClient();

// Default export
export default {
  AUTH0_CONFIG,
  SOCIAL_PROVIDERS_CONFIG,
  JWT_CONFIG,
  getAuth0Middleware,
  auth0Routes,
  getManagementClient,
  getAuthenticationClient,
  validateAuth0Config
};