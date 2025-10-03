/**
 * Auth0 Configuration - Simplified
 * Only Management and Authentication clients, no express-openid-connect
 */

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
};

/**
 * Social Providers Configuration
 */
export const SOCIAL_PROVIDERS_CONFIG = {
  google: {
    enabled: process.env.AUTH0_GOOGLE_ENABLED === 'true',
    connection: 'google-oauth2'
  },
  github: {
    enabled: process.env.AUTH0_GITHUB_ENABLED === 'true',
    connection: 'github'
  }
};

/**
 * Auth0 Management Client for server-side operations
 */
export const createManagementClient = (): ManagementClient => {
  return new ManagementClient({
    domain: AUTH0_CONFIG.domain,
    clientId: AUTH0_CONFIG.clientId,
    clientSecret: AUTH0_CONFIG.clientSecret
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

  // URL format validations
  try {
    new URL(AUTH0_CONFIG.issuerBaseURL);
  } catch {
    errors.push('AUTH0_DOMAIN must be a valid domain');
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
}

// Export clients
export const getManagementClient = (): ManagementClient => createManagementClient();
export const getAuthenticationClient = (): AuthenticationClient => createAuthenticationClient();

// Default export
export default {
  AUTH0_CONFIG,
  getManagementClient,
  getAuthenticationClient,
  validateAuth0Config
};
