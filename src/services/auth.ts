/**
 * Authentication Service
 * Handles user authentication, registration, and session management with Auth0
 */

import { EventEmitter } from 'events';
import { Request, Response, NextFunction } from 'express';
import { ManagementClient, AuthenticationClient, User as Auth0User } from 'auth0';
import jwt from 'jsonwebtoken';
import * as JwksClient from 'jwks-client';
import { 
  AUTH0_CONFIG, 
  JWT_CONFIG, 
  SOCIAL_PROVIDERS_CONFIG,
  getManagementClient,
  getAuthenticationClient 
} from '../config/auth0';
import { ENV_CONFIG } from '../config/env';

// User interfaces
export interface User {
  id: string;
  auth0Id: string;
  email: string;
  name: string;
  picture?: string;
  emailVerified: boolean;
  createdAt: Date;
  updatedAt: Date;
  lastLogin?: Date;
  metadata?: Record<string, any>;
  roles?: string[];
}

export interface AuthenticationResult {
  success: boolean;
  user?: User;
  accessToken?: string;
  refreshToken?: string;
  expiresIn?: number;
  error?: string;
}

export interface UserRegistrationData {
  email: string;
  password: string;
  name: string;
  metadata?: Record<string, any>;
}

export interface SocialLoginOptions {
  provider: 'google' | 'github';
  redirectUrl?: string;
  state?: string;
}

// Auth service events
export type AuthEvent = 
  | 'user:login'
  | 'user:logout' 
  | 'user:register'
  | 'user:update'
  | 'token:refresh'
  | 'error';

export interface AuthEventPayload {
  userId?: string;
  email?: string;
  provider?: string;
  error?: Error;
  metadata?: Record<string, any>;
}

/**
 * Authentication Service Class
 */
export class AuthService extends EventEmitter {
  private managementClient: ManagementClient;
  private authClient: AuthenticationClient;
  private jwksClient: any;

  constructor() {
    super();
    this.managementClient = getManagementClient();
    this.authClient = getAuthenticationClient();
    this.jwksClient = new (JwksClient as any)({
      jwksUri: JWT_CONFIG.jwksUri,
      requestHeaders: {},
      timeout: 30000,
      cache: JWT_CONFIG.cache,
      rateLimit: JWT_CONFIG.rateLimit,
      jwksRequestsPerMinute: JWT_CONFIG.jwksRequestsPerMinute
    });
  }

  /**
   * Register a new user with email and password
   */
  async registerUser(userData: UserRegistrationData): Promise<AuthenticationResult> {
    try {
      // Create user in Auth0
      const auth0User = await this.managementClient.createUser({
        connection: 'Username-Password-Authentication',
        email: userData.email,
        password: userData.password,
        name: userData.name,
        user_metadata: userData.metadata || {},
        email_verified: false,
        verify_email: true
      });

      if (!auth0User.user_id) {
        throw new Error('Failed to create user in Auth0');
      }

      // Convert Auth0 user to our User interface
      const user: User = {
        id: auth0User.user_id,
        auth0Id: auth0User.user_id,
        email: auth0User.email!,
        name: auth0User.name!,
        picture: auth0User.picture,
        emailVerified: auth0User.email_verified || false,
        createdAt: new Date(auth0User.created_at!),
        updatedAt: new Date(auth0User.updated_at!),
        metadata: auth0User.user_metadata
      };

      // Emit registration event
      this.emit('user:register', {
        userId: user.id,
        email: user.email,
        metadata: { registrationMethod: 'email' }
      } as AuthEventPayload);

      return {
        success: true,
        user
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Registration failed';
      
      this.emit('error', {
        error: error instanceof Error ? error : new Error(errorMessage),
        metadata: { operation: 'register', email: userData.email }
      } as AuthEventPayload);

      return {
        success: false,
        error: errorMessage
      };
    }
  }

  /**
   * Authenticate user with email and password
   */
  async loginUser(email: string, password: string): Promise<AuthenticationResult> {
    try {
      // Authenticate with Auth0
      const authResult = await this.authClient.passwordGrant({
        username: email,
        password: password,
        audience: AUTH0_CONFIG.audience,
        scope: AUTH0_CONFIG.scope
      });

      if (!authResult.access_token) {
        throw new Error('Authentication failed');
      }

      // Get user information
      const userInfo = await this.authClient.getProfile(authResult.access_token);
      
      // Get detailed user from Management API
      const detailedUser = await this.managementClient.getUser({
        id: userInfo.sub!
      });

      const user: User = {
        id: detailedUser.user_id!,
        auth0Id: detailedUser.user_id!,
        email: detailedUser.email!,
        name: detailedUser.name!,
        picture: detailedUser.picture,
        emailVerified: detailedUser.email_verified || false,
        createdAt: new Date(detailedUser.created_at!),
        updatedAt: new Date(detailedUser.updated_at!),
        lastLogin: new Date(),
        metadata: detailedUser.user_metadata
      };

      // Update last login timestamp
      await this.updateUserLastLogin(user.id);

      // Emit login event
      this.emit('user:login', {
        userId: user.id,
        email: user.email,
        metadata: { loginMethod: 'email' }
      } as AuthEventPayload);

      return {
        success: true,
        user,
        accessToken: authResult.access_token,
        refreshToken: authResult.refresh_token,
        expiresIn: authResult.expires_in
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Login failed';
      
      this.emit('error', {
        error: error instanceof Error ? error : new Error(errorMessage),
        metadata: { operation: 'login', email }
      } as AuthEventPayload);

      return {
        success: false,
        error: errorMessage
      };
    }
  }

  /**
   * Get user by Auth0 ID
   */
  async getUserById(auth0Id: string): Promise<User | null> {
    try {
      const auth0User = await this.managementClient.getUser({ id: auth0Id });
      
      if (!auth0User || !auth0User.user_id) {
        return null;
      }

      return {
        id: auth0User.user_id,
        auth0Id: auth0User.user_id,
        email: auth0User.email!,
        name: auth0User.name!,
        picture: auth0User.picture,
        emailVerified: auth0User.email_verified || false,
        createdAt: new Date(auth0User.created_at!),
        updatedAt: new Date(auth0User.updated_at!),
        lastLogin: auth0User.last_login ? new Date(auth0User.last_login) : undefined,
        metadata: auth0User.user_metadata
      };
    } catch (error) {
      console.error('Error fetching user by ID:', error);
      return null;
    }
  }

  /**
   * Update user profile
   */
  async updateUser(auth0Id: string, updates: Partial<User>): Promise<User | null> {
    try {
      const updateData: any = {};
      
      if (updates.name) updateData.name = updates.name;
      if (updates.picture) updateData.picture = updates.picture;
      if (updates.metadata) updateData.user_metadata = updates.metadata;

      const updatedAuth0User = await this.managementClient.updateUser(
        { id: auth0Id },
        updateData
      );

      if (!updatedAuth0User || !updatedAuth0User.user_id) {
        return null;
      }

      const user: User = {
        id: updatedAuth0User.user_id,
        auth0Id: updatedAuth0User.user_id,
        email: updatedAuth0User.email!,
        name: updatedAuth0User.name!,
        picture: updatedAuth0User.picture,
        emailVerified: updatedAuth0User.email_verified || false,
        createdAt: new Date(updatedAuth0User.created_at!),
        updatedAt: new Date(updatedAuth0User.updated_at!),
        metadata: updatedAuth0User.user_metadata
      };

      this.emit('user:update', {
        userId: user.id,
        email: user.email,
        metadata: { updatedFields: Object.keys(updates) }
      } as AuthEventPayload);

      return user;
    } catch (error) {
      console.error('Error updating user:', error);
      this.emit('error', {
        error: error instanceof Error ? error : new Error('User update failed'),
        metadata: { operation: 'updateUser', auth0Id }
      } as AuthEventPayload);
      return null;
    }
  }

  /**
   * Delete user account
   */
  async deleteUser(auth0Id: string): Promise<boolean> {
    try {
      await this.managementClient.deleteUser({ id: auth0Id });
      return true;
    } catch (error) {
      console.error('Error deleting user:', error);
      this.emit('error', {
        error: error instanceof Error ? error : new Error('User deletion failed'),
        metadata: { operation: 'deleteUser', auth0Id }
      } as AuthEventPayload);
      return false;
    }
  }

  /**
   * Verify JWT token and extract user information
   */
  async verifyToken(token: string): Promise<User | null> {
    try {
      // Get signing key from JWKS
      const decodedToken = jwt.decode(token, { complete: true });
      if (!decodedToken || typeof decodedToken === 'string' || !decodedToken.header.kid) {
        throw new Error('Invalid token format');
      }

      const key = await this.jwksClient.getSigningKey(decodedToken.header.kid);
      const signingKey = key.getPublicKey();

      // Verify token
      const payload = jwt.verify(token, signingKey, {
        audience: JWT_CONFIG.audience,
        issuer: JWT_CONFIG.issuer,
        algorithms: [JWT_CONFIG.algorithm as jwt.Algorithm]
      }) as any;

      if (!payload.sub) {
        throw new Error('Invalid token payload');
      }

      // Get user information
      return await this.getUserById(payload.sub);
    } catch (error) {
      console.error('Token verification failed:', error);
      return null;
    }
  }

  /**
   * Refresh access token
   */
  async refreshAccessToken(refreshToken: string): Promise<AuthenticationResult> {
    try {
      const result = await this.authClient.refreshToken({
        refresh_token: refreshToken
      });

      if (!result.access_token) {
        throw new Error('Failed to refresh token');
      }

      this.emit('token:refresh', {
        metadata: { success: true }
      } as AuthEventPayload);

      return {
        success: true,
        accessToken: result.access_token,
        refreshToken: result.refresh_token,
        expiresIn: result.expires_in
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Token refresh failed';
      
      this.emit('error', {
        error: error instanceof Error ? error : new Error(errorMessage),
        metadata: { operation: 'refreshToken' }
      } as AuthEventPayload);

      return {
        success: false,
        error: errorMessage
      };
    }
  }

  /**
   * Get social login URL
   */
  getSocialLoginUrl(provider: 'google' | 'github', options: SocialLoginOptions = {}): string {
    const { redirectUrl = `${AUTH0_CONFIG.baseURL}/auth/callback`, state } = options;
    
    const connection = provider === 'google' ? 'google-oauth2' : 'github';
    const params = new URLSearchParams({
      response_type: 'code',
      client_id: AUTH0_CONFIG.clientId,
      redirect_uri: redirectUrl,
      scope: AUTH0_CONFIG.scope,
      connection,
      ...(state && { state })
    });

    return `${AUTH0_CONFIG.issuerBaseURL}/authorize?${params.toString()}`;
  }

  /**
   * Handle logout
   */
  async logoutUser(auth0Id: string, sessionId?: string): Promise<void> {
    try {
      this.emit('user:logout', {
        userId: auth0Id,
        metadata: { sessionId }
      } as AuthEventPayload);
    } catch (error) {
      console.error('Logout error:', error);
      this.emit('error', {
        error: error instanceof Error ? error : new Error('Logout failed'),
        metadata: { operation: 'logout', auth0Id }
      } as AuthEventPayload);
    }
  }

  /**
   * Send password reset email
   */
  async sendPasswordResetEmail(email: string): Promise<boolean> {
    try {
      await this.authClient.requestChangePasswordEmail({
        email,
        connection: 'Username-Password-Authentication'
      });
      return true;
    } catch (error) {
      console.error('Password reset email failed:', error);
      this.emit('error', {
        error: error instanceof Error ? error : new Error('Password reset failed'),
        metadata: { operation: 'passwordReset', email }
      } as AuthEventPayload);
      return false;
    }
  }

  /**
   * Check if social provider is enabled
   */
  isSocialProviderEnabled(provider: 'google' | 'github'): boolean {
    return SOCIAL_PROVIDERS_CONFIG[provider].enabled;
  }

  /**
   * Get available social providers
   */
  getAvailableSocialProviders(): Array<{ provider: string; enabled: boolean }> {
    return [
      { provider: 'google', enabled: SOCIAL_PROVIDERS_CONFIG.google.enabled },
      { provider: 'github', enabled: SOCIAL_PROVIDERS_CONFIG.github.enabled }
    ];
  }

  /**
   * Update user's last login timestamp
   */
  private async updateUserLastLogin(auth0Id: string): Promise<void> {
    try {
      await this.managementClient.updateUser(
        { id: auth0Id },
        { user_metadata: { lastLogin: new Date().toISOString() } }
      );
    } catch (error) {
      console.error('Failed to update last login:', error);
    }
  }

  /**
   * Validate user session
   */
  async validateSession(sessionId: string): Promise<boolean> {
    // This would integrate with your session storage (Redis, database, etc.)
    // For now, we'll assume session validation is handled by the middleware
    return true;
  }

  /**
   * Clean up expired sessions
   */
  async cleanupExpiredSessions(): Promise<void> {
    // Implementation would depend on session storage mechanism
    console.log('Cleaning up expired sessions...');
  }
}

// Singleton instance
let authServiceInstance: AuthService | null = null;

/**
 * Get the auth service singleton instance
 */
export const getAuthService = (): AuthService => {
  if (!authServiceInstance) {
    authServiceInstance = new AuthService();
  }
  return authServiceInstance;
};

// Export default instance
export default getAuthService();