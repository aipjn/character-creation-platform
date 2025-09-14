/**
 * Auth0 Integration Tests
 * Tests for Auth0 configuration, authentication service, and middleware
 */

import { getAuthService, AuthService } from '../src/services/auth';
import { authenticate, requireAuth, authErrorHandler } from '../src/middleware/auth';
import { AUTH0_CONFIG, validateAuth0Config } from '../src/config/auth0';
import { Response, NextFunction } from 'express';

// Mock Auth0 clients for testing
jest.mock('auth0', () => ({
  ManagementClient: jest.fn().mockImplementation(() => ({
    createUser: jest.fn(),
    getUser: jest.fn(),
    updateUser: jest.fn(),
    deleteUser: jest.fn(),
  })),
  AuthenticationClient: jest.fn().mockImplementation(() => ({
    passwordGrant: jest.fn(),
    getProfile: jest.fn(),
    refreshToken: jest.fn(),
    requestChangePasswordEmail: jest.fn(),
  }))
}));

jest.mock('jwks-client', () => ({
  JwksClient: jest.fn().mockImplementation(() => ({
    getSigningKey: jest.fn().mockResolvedValue({
      getPublicKey: () => 'mock-public-key'
    })
  }))
}));

jest.mock('jsonwebtoken', () => ({
  verify: jest.fn(),
  decode: jest.fn().mockReturnValue({
    header: { kid: 'mock-kid' },
    payload: { sub: 'auth0|123' }
  })
}));

describe('Auth0 Configuration', () => {
  beforeEach(() => {
    // Reset environment variables
    delete process.env['AUTH0_DOMAIN'];
    delete process.env['AUTH0_CLIENT_ID'];
    delete process.env['AUTH0_CLIENT_SECRET'];
  });

  test('should validate Auth0 configuration correctly', () => {
    // Set valid environment variables
    process.env['AUTH0_DOMAIN'] = 'test-tenant.auth0.com';
    process.env['AUTH0_CLIENT_ID'] = 'test-client-id';
    process.env['AUTH0_CLIENT_SECRET'] = 'test-client-secret';
    process.env['AUTH0_SESSION_SECRET'] = 'test-session-secret-that-is-long-enough';

    const validation = validateAuth0Config();
    expect(validation.isValid).toBe(true);
    expect(validation.errors).toHaveLength(0);
  });

  test('should fail validation with missing required variables', () => {
    const validation = validateAuth0Config();
    expect(validation.isValid).toBe(false);
    expect(validation.errors.length).toBeGreaterThan(0);
    expect(validation.errors.some(error => error.includes('AUTH0_DOMAIN'))).toBe(true);
  });

  test('should have correct AUTH0_CONFIG structure', () => {
    expect(AUTH0_CONFIG).toHaveProperty('domain');
    expect(AUTH0_CONFIG).toHaveProperty('clientId');
    expect(AUTH0_CONFIG).toHaveProperty('clientSecret');
    expect(AUTH0_CONFIG).toHaveProperty('audience');
    expect(AUTH0_CONFIG).toHaveProperty('scope');
    expect(AUTH0_CONFIG).toHaveProperty('issuerBaseURL');
    expect(AUTH0_CONFIG).toHaveProperty('baseURL');
    expect(AUTH0_CONFIG).toHaveProperty('secret');
  });
});

describe('AuthService', () => {
  let authService: AuthService;

  beforeEach(() => {
    // Set up valid environment variables for Auth0
    process.env['AUTH0_DOMAIN'] = 'test-tenant.auth0.com';
    process.env['AUTH0_CLIENT_ID'] = 'test-client-id';
    process.env['AUTH0_CLIENT_SECRET'] = 'test-client-secret';
    process.env['AUTH0_SESSION_SECRET'] = 'test-session-secret-that-is-long-enough';

    authService = getAuthService();
    jest.clearAllMocks();
  });

  test('should create AuthService instance', () => {
    expect(authService).toBeInstanceOf(AuthService);
  });

  test('should register user successfully', async () => {
    const mockAuth0User = {
      user_id: 'auth0|123',
      email: 'test@example.com',
      name: 'Test User',
      email_verified: false,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      user_metadata: {}
    };

    // Mock successful user creation
    const mockCreateUser = jest.fn().mockResolvedValue(mockAuth0User);
    (authService as any).managementClient.createUser = mockCreateUser;

    const userData = {
      email: 'test@example.com',
      password: 'SecurePassword123!',
      name: 'Test User'
    };

    const result = await authService.registerUser(userData);

    expect(result.success).toBe(true);
    expect(result.user).toBeDefined();
    expect(result.user?.email).toBe(userData.email);
    expect(mockCreateUser).toHaveBeenCalledWith({
      connection: 'Username-Password-Authentication',
      email: userData.email,
      password: userData.password,
      name: userData.name,
      user_metadata: {},
      email_verified: false,
      verify_email: true
    });
  });

  test('should handle registration failure', async () => {
    const mockCreateUser = jest.fn().mockRejectedValue(new Error('User creation failed'));
    (authService as any).managementClient.createUser = mockCreateUser;

    const userData = {
      email: 'test@example.com',
      password: 'SecurePassword123!',
      name: 'Test User'
    };

    const result = await authService.registerUser(userData);

    expect(result.success).toBe(false);
    expect(result.error).toBeDefined();
    expect(result.user).toBeUndefined();
  });

  test('should login user successfully', async () => {
    const mockAuthResult = {
      access_token: 'mock-access-token',
      refresh_token: 'mock-refresh-token',
      expires_in: 3600
    };

    const mockUserInfo = {
      sub: 'auth0|123'
    };

    const mockDetailedUser = {
      user_id: 'auth0|123',
      email: 'test@example.com',
      name: 'Test User',
      email_verified: true,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      user_metadata: {}
    };

    const mockPasswordGrant = jest.fn().mockResolvedValue(mockAuthResult);
    const mockGetProfile = jest.fn().mockResolvedValue(mockUserInfo);
    const mockGetUser = jest.fn().mockResolvedValue(mockDetailedUser);
    const mockUpdateUser = jest.fn().mockResolvedValue({});

    (authService as any).authClient.passwordGrant = mockPasswordGrant;
    (authService as any).authClient.getProfile = mockGetProfile;
    (authService as any).managementClient.getUser = mockGetUser;
    (authService as any).managementClient.updateUser = mockUpdateUser;

    const result = await authService.loginUser('test@example.com', 'password123');

    expect(result.success).toBe(true);
    expect(result.user).toBeDefined();
    expect(result.accessToken).toBe(mockAuthResult.access_token);
    expect(result.refreshToken).toBe(mockAuthResult.refresh_token);
  });

  test('should get available social providers', () => {
    const providers = authService.getAvailableSocialProviders();
    
    expect(providers).toBeInstanceOf(Array);
    expect(providers).toHaveLength(2);
    expect(providers.find(p => p.provider === 'google')).toBeDefined();
    expect(providers.find(p => p.provider === 'github')).toBeDefined();
  });

  test('should send password reset email', async () => {
    const mockRequestChangePasswordEmail = jest.fn().mockResolvedValue({});
    (authService as any).authClient.requestChangePasswordEmail = mockRequestChangePasswordEmail;

    const result = await authService.sendPasswordResetEmail('test@example.com');

    expect(result).toBe(true);
    expect(mockRequestChangePasswordEmail).toHaveBeenCalledWith({
      email: 'test@example.com',
      connection: 'Username-Password-Authentication'
    });
  });
});

describe('Authentication Middleware', () => {
  let mockReq: any;
  let mockRes: Partial<Response>;
  let mockNext: NextFunction;

  beforeEach(() => {
    mockReq = {
      headers: {},
      cookies: {},
      query: {},
    };
    mockRes = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis(),
      clearCookie: jest.fn(),
    };
    mockNext = jest.fn();

    jest.clearAllMocks();
  });

  test('should handle missing token correctly', async () => {
    await authenticate(mockReq, mockRes as Response, mockNext);

    expect(mockReq.auth).toEqual({ isAuthenticated: false });
    expect(mockNext).toHaveBeenCalled();
  });

  test('should extract token from Authorization header', async () => {
    mockReq.headers.authorization = 'Bearer mock-token';

    // Mock the auth service verification
    const mockVerifyToken = jest.fn().mockResolvedValue(null);
    jest.spyOn(require('../src/services/auth'), 'getAuthService').mockReturnValue({
      verifyToken: mockVerifyToken
    });

    await authenticate(mockReq, mockRes as Response, mockNext);

    expect(mockVerifyToken).toHaveBeenCalledWith('mock-token');
    expect(mockReq.auth).toEqual({ 
      isAuthenticated: false, 
      token: 'mock-token' 
    });
    expect(mockNext).toHaveBeenCalled();
  });

  test('should require authentication', () => {
    // Test without authentication
    mockReq.auth = { isAuthenticated: false };

    expect(() => {
      requireAuth(mockReq, mockRes as Response, mockNext);
    }).toThrow('Authentication required');

    // Test with authentication
    mockReq = { 
      auth: { isAuthenticated: true },
      user: { id: 'user123', email: 'test@example.com' }
    };

    requireAuth(mockReq, mockRes as Response, mockNext);
    expect(mockNext).toHaveBeenCalled();
  });

  test('should handle authentication errors', () => {
    const authError = new (require('../src/middleware/auth').AuthenticationError)(
      'Test auth error',
      401,
      'TEST_ERROR'
    );

    authErrorHandler(authError, mockReq, mockRes as Response, mockNext);

    expect(mockRes.status).toHaveBeenCalledWith(401);
    expect(mockRes.json).toHaveBeenCalledWith({
      error: {
        message: 'Test auth error',
        code: 'TEST_ERROR',
        type: 'AuthenticationError'
      }
    });
  });
});

describe('Auth0 Integration Flow', () => {
  beforeEach(() => {
    // Set up valid environment variables
    process.env['AUTH0_DOMAIN'] = 'test-tenant.auth0.com';
    process.env['AUTH0_CLIENT_ID'] = 'test-client-id';
    process.env['AUTH0_CLIENT_SECRET'] = 'test-client-secret';
    process.env['AUTH0_SESSION_SECRET'] = 'test-session-secret-that-is-long-enough';
  });

  test('should have complete Auth0 integration setup', () => {
    // Verify configuration
    const validation = validateAuth0Config();
    console.log('Auth0 Configuration Validation:', {
      isValid: validation.isValid,
      errors: validation.errors,
      warnings: validation.warnings
    });

    // Verify service initialization
    const authService = getAuthService();
    expect(authService).toBeInstanceOf(AuthService);

    // Verify available providers
    const providers = authService.getAvailableSocialProviders();
    console.log('Available Social Providers:', providers);

    // Test configuration values
    console.log('Auth0 Configuration:', {
      domain: AUTH0_CONFIG.domain,
      clientId: AUTH0_CONFIG.clientId ? 'SET' : 'NOT SET',
      audience: AUTH0_CONFIG.audience,
      baseURL: AUTH0_CONFIG.baseURL,
      scope: AUTH0_CONFIG.scope
    });

    expect(AUTH0_CONFIG.domain).toBeTruthy();
    expect(AUTH0_CONFIG.clientId).toBeTruthy();
    expect(AUTH0_CONFIG.issuerBaseURL).toBeTruthy();
  });

  test('should provide complete authentication flow', () => {
    const authService = getAuthService();

    // Test social login URL generation
    const googleLoginUrl = authService.getSocialLoginUrl('google');
    const githubLoginUrl = authService.getSocialLoginUrl('github');

    expect(googleLoginUrl).toContain('google-oauth2');
    expect(githubLoginUrl).toContain('github');
    expect(googleLoginUrl).toContain(AUTH0_CONFIG.domain);
    expect(githubLoginUrl).toContain(AUTH0_CONFIG.domain);

    console.log('Generated Login URLs:', {
      google: googleLoginUrl,
      github: githubLoginUrl
    });
  });
});

describe('Auth0 Environment Variables', () => {
  test('should handle missing environment variables gracefully', () => {
    // Remove all Auth0 environment variables
    const originalEnv = process.env;
    process.env = { ...originalEnv };
    delete process.env['AUTH0_DOMAIN'];
    delete process.env['AUTH0_CLIENT_ID'];
    delete process.env['AUTH0_CLIENT_SECRET'];

    expect(() => {
      // This should not crash the application
      const validation = validateAuth0Config();
      expect(validation.isValid).toBe(false);
      expect(validation.errors.length).toBeGreaterThan(0);
    }).not.toThrow();

    // Restore environment
    process.env = originalEnv;
  });

  test('should provide helpful error messages for missing configuration', () => {
    const validation = validateAuth0Config();
    
    if (!validation.isValid) {
      console.log('Configuration Errors (Expected in test):', validation.errors);
      expect(validation.errors.some(error => 
        error.includes('AUTH0_DOMAIN') || 
        error.includes('AUTH0_CLIENT_ID') || 
        error.includes('AUTH0_CLIENT_SECRET')
      )).toBe(true);
    }
  });
});