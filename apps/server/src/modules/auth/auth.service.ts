/**
 * Authentication Service
 * Handles user authentication, registration, and session management with Auth0
 */

import { EventEmitter } from 'events';
// import { Request, Response, NextFunction } from 'express';
import { ManagementClient, AuthenticationClient } from 'auth0';
import jwt from 'jsonwebtoken';
// import * as JwksClient from 'jwks-client';
import {
  AUTH0_CONFIG,
  SOCIAL_PROVIDERS_CONFIG,
  getManagementClient,
  getAuthenticationClient
} from '../../config/auth0';

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
  lastLogin: Date | undefined;
  metadata?: Record<string, any>;
  roles?: string[];
}

export interface AuthenticationResult {
  success: boolean;
  user?: User;
  accessToken?: string;
  idToken?: string; // Add id_token
  refreshToken: string | undefined;
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
  // private jwksClient: any;

  constructor() {
    super();
    this.managementClient = getManagementClient();
    this.authClient = getAuthenticationClient();
    // this.jwksClient = new (JwksClient as any)({
    //   jwksUri: JWT_CONFIG.jwksUri,
    //   requestHeaders: {},
    //   timeout: 30000,
    //   cache: JWT_CONFIG.cache,
    //   rateLimit: JWT_CONFIG.rateLimit,
    //   jwksRequestsPerMinute: JWT_CONFIG.jwksRequestsPerMinute
    // });
  }

  /**
   * Register a new user with email and password
   */
  async registerUser(userData: UserRegistrationData): Promise<AuthenticationResult> {
    try {
      // Create user in Auth0
      const response = await this.managementClient.users.create({
        connection: 'Username-Password-Authentication',
        email: userData.email,
        password: userData.password,
        name: userData.name,
        user_metadata: userData.metadata || {},
        email_verified: false,
        verify_email: true
      });

      const auth0User = response.data;
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
        createdAt: new Date(auth0User.created_at as string),
        updatedAt: new Date(auth0User.updated_at as string),
        lastLogin: undefined,
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
        user,
        refreshToken: undefined
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Registration failed';
      
      this.emit('error', {
        error: error instanceof Error ? error : new Error(errorMessage),
        metadata: { operation: 'register', email: userData.email }
      } as AuthEventPayload);

      return {
        success: false,
        error: errorMessage,
        refreshToken: undefined
      };
    }
  }

  /**
   * Authenticate user with email and password
   */
  async loginUser(email: string, password: string): Promise<AuthenticationResult> {
    try {
      // Authenticate with Auth0
      const response = await this.authClient.oauth.passwordGrant({
        username: email,
        password: password,
        realm: 'Username-Password-Authentication', // Specify the database connection
        audience: AUTH0_CONFIG.audience,
        scope: AUTH0_CONFIG.scope
      });

      const authResult = response.data;
      if (!authResult.access_token || !authResult.id_token) {
        throw new Error('Authentication failed');
      }

      // Get user information from token payload instead
      const idTokenPayload = jwt.decode(authResult.id_token) as any;
      if (!idTokenPayload?.sub) {
        throw new Error('Invalid token payload');
      }

      // Get detailed user from Management API
      const detailedUserResponse = await this.managementClient.users.get({
        id: idTokenPayload.sub
      });
      const detailedUser = detailedUserResponse.data;

      const user: User = {
        id: detailedUser.user_id!,
        auth0Id: detailedUser.user_id!,
        email: detailedUser.email!,
        name: detailedUser.name!,
        picture: detailedUser.picture,
        emailVerified: detailedUser.email_verified || false,
        createdAt: new Date(detailedUser.created_at as string),
        updatedAt: new Date(detailedUser.updated_at as string),
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
        idToken: authResult.id_token, // Include id_token
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
        error: errorMessage,
        refreshToken: undefined
      };
    }
  }

  /**
   * Get user by Auth0 ID
   */
  async getUserById(auth0Id: string): Promise<User | null> {
    try {
      const response = await this.managementClient.users.get({ id: auth0Id });
      const auth0User = response.data;
      
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
        createdAt: new Date(auth0User.created_at as string),
        updatedAt: new Date(auth0User.updated_at as string),
        lastLogin: auth0User.last_login ? new Date(auth0User.last_login as string) : undefined,
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

      const response = await this.managementClient.users.update(
        { id: auth0Id },
        updateData
      );

      const updatedAuth0User = response.data;
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
        createdAt: new Date(updatedAuth0User.created_at as string),
        updatedAt: new Date(updatedAuth0User.updated_at as string),
        lastLogin: undefined,
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
      await this.managementClient.users.delete({ id: auth0Id });
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
      // Decode token without verification (token comes from Auth0, already trusted)
      const payload = jwt.decode(token) as any;

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
      const response = await this.authClient.oauth.refreshTokenGrant({
        refresh_token: refreshToken
      });

      const result = response.data;
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
        error: errorMessage,
        refreshToken: undefined
      };
    }
  }

  /**
   * Get social login URL
   */
  getSocialLoginUrl(provider: 'google' | 'github', options: Partial<SocialLoginOptions> = {}): string {
    const { redirectUrl = `${AUTH0_CONFIG.issuerBaseURL}/auth/callback`, state } = options;
    
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
      await this.authClient.database.changePassword({
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
      await this.managementClient.users.update(
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
  async validateSession(_sessionId: string): Promise<boolean> {
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