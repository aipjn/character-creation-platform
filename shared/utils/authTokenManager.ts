/**
 * Authentication Token Manager for nanoBanana API
 * Handles API key management, token validation, and refresh logic
 */

export interface AuthToken {
  value: string;
  type: 'api-key' | 'bearer';
  expiresAt?: Date;
  scope?: string[];
}

export interface AuthConfig {
  apiKey?: string;
  autoRefresh?: boolean;
  refreshThresholdMs?: number;
  tokenRefreshUrl?: string;
  tokenValidationUrl?: string;
}

export interface ApiError {
  code: string;
  message: string;
  statusCode?: number;
  retryable: boolean;
}

export class AuthTokenManager {
  private currentToken: AuthToken | null = null;
  private refreshPromise: Promise<AuthToken> | null = null;
  private config: AuthConfig;
  private refreshTimeoutId: NodeJS.Timeout | null = null;

  constructor(config: Partial<AuthConfig> = {}) {
    this.config = {
      apiKey: config.apiKey || process.env.NANOBANANA_API_KEY || '',
      autoRefresh: false, // nanoBanana uses static API keys
      refreshThresholdMs: 300000, // 5 minutes before expiration
      ...config
    };

    // Initialize with API key
    if (this.config.apiKey) {
      this.currentToken = {
        value: this.config.apiKey,
        type: 'api-key'
      };
    }
  }

  /**
   * Get the current valid authentication token
   */
  public async getValidToken(): Promise<AuthToken> {
    if (!this.currentToken) {
      throw new AuthError('AUTH_TOKEN_MISSING', 'No authentication token available');
    }

    // For API keys, check if they look valid
    if (this.currentToken.type === 'api-key') {
      if (!this.validateApiKeyFormat(this.currentToken.value)) {
        throw new AuthError('AUTH_TOKEN_INVALID', 'API key format is invalid');
      }
      return this.currentToken;
    }

    // For bearer tokens, check expiration
    if (this.currentToken.type === 'bearer' && this.isTokenExpiringSoon()) {
      return await this.refreshTokenIfNeeded();
    }

    return this.currentToken;
  }

  /**
   * Get authorization header for API requests
   */
  public async getAuthHeader(): Promise<Record<string, string>> {
    const token = await this.getValidToken();
    
    switch (token.type) {
      case 'api-key':
        return { Authorization: `Bearer ${token.value}` };
      case 'bearer':
        return { Authorization: `Bearer ${token.value}` };
      default:
        throw new AuthError('AUTH_TOKEN_INVALID', `Unsupported token type: ${token.type}`);
    }
  }

  /**
   * Update the API key (for configuration changes)
   */
  public updateApiKey(apiKey: string): void {
    if (!this.validateApiKeyFormat(apiKey)) {
      throw new AuthError('AUTH_TOKEN_INVALID', 'Invalid API key format');
    }

    this.currentToken = {
      value: apiKey,
      type: 'api-key'
    };

    this.config.apiKey = apiKey;
  }

  /**
   * Validate API key format
   */
  private validateApiKeyFormat(apiKey: string): boolean {
    // Basic validation for common API key formats
    if (!apiKey || typeof apiKey !== 'string') {
      return false;
    }

    // Check minimum length
    if (apiKey.length < 10) {
      return false;
    }

    // Check for common prefixes
    const validPrefixes = ['sk-', 'api-', 'key-', 'token-'];
    const hasValidPrefix = validPrefixes.some(prefix => apiKey.startsWith(prefix));
    
    // Either has valid prefix or is long enough to be a valid key
    return hasValidPrefix || apiKey.length >= 32;
  }

  /**
   * Check if the current token is expiring soon
   */
  private isTokenExpiringSoon(): boolean {
    if (!this.currentToken?.expiresAt) {
      return false; // No expiration, assume it's valid
    }

    const now = new Date();
    const threshold = new Date(this.currentToken.expiresAt.getTime() - this.config.refreshThresholdMs!);
    
    return now >= threshold;
  }

  /**
   * Refresh token if needed (for future bearer token support)
   */
  private async refreshTokenIfNeeded(): Promise<AuthToken> {
    if (!this.config.tokenRefreshUrl) {
      throw new AuthError('AUTH_REFRESH_UNSUPPORTED', 'Token refresh not configured');
    }

    // Prevent multiple concurrent refresh requests
    if (this.refreshPromise) {
      return await this.refreshPromise;
    }

    this.refreshPromise = this.performTokenRefresh();
    
    try {
      const newToken = await this.refreshPromise;
      this.scheduleTokenRefresh(newToken);
      return newToken;
    } finally {
      this.refreshPromise = null;
    }
  }

  /**
   * Perform the actual token refresh
   */
  private async performTokenRefresh(): Promise<AuthToken> {
    if (!this.config.tokenRefreshUrl || !this.currentToken) {
      throw new AuthError('AUTH_REFRESH_FAILED', 'Token refresh configuration missing');
    }

    try {
      const response = await fetch(this.config.tokenRefreshUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${this.currentToken.value}`
        },
        body: JSON.stringify({
          grant_type: 'refresh_token',
          refresh_token: this.currentToken.value
        })
      });

      if (!response.ok) {
        throw new AuthError(
          'AUTH_REFRESH_FAILED', 
          `Token refresh failed: ${response.status} ${response.statusText}`
        );
      }

      const data = await response.json();
      
      const newToken: AuthToken = {
        value: data.access_token,
        type: 'bearer',
        expiresAt: data.expires_in ? new Date(Date.now() + data.expires_in * 1000) : undefined,
        scope: data.scope?.split(' ')
      };

      this.currentToken = newToken;
      return newToken;
    } catch (error) {
      if (error instanceof AuthError) {
        throw error;
      }
      
      throw new AuthError(
        'AUTH_REFRESH_FAILED',
        `Token refresh failed: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  /**
   * Schedule automatic token refresh
   */
  private scheduleTokenRefresh(token: AuthToken): void {
    if (!this.config.autoRefresh || !token.expiresAt) {
      return;
    }

    // Clear existing timeout
    if (this.refreshTimeoutId) {
      clearTimeout(this.refreshTimeoutId);
    }

    const refreshAt = new Date(token.expiresAt.getTime() - this.config.refreshThresholdMs!);
    const delayMs = Math.max(0, refreshAt.getTime() - Date.now());

    this.refreshTimeoutId = setTimeout(async () => {
      try {
        await this.refreshTokenIfNeeded();
      } catch (error) {
        console.error('Automatic token refresh failed:', error);
        // Could emit an event here for error handling
      }
    }, delayMs);
  }

  /**
   * Validate token with the API provider
   */
  public async validateToken(): Promise<boolean> {
    if (!this.config.tokenValidationUrl || !this.currentToken) {
      // For API keys without validation endpoint, assume valid if format is correct
      return this.currentToken?.type === 'api-key' 
        ? this.validateApiKeyFormat(this.currentToken.value)
        : false;
    }

    try {
      const headers = await this.getAuthHeader();
      const response = await fetch(this.config.tokenValidationUrl, {
        method: 'GET',
        headers
      });

      return response.ok;
    } catch (error) {
      console.error('Token validation failed:', error);
      return false;
    }
  }

  /**
   * Get token information
   */
  public getTokenInfo(): Partial<AuthToken> | null {
    if (!this.currentToken) {
      return null;
    }

    // Return safe information (no actual token value)
    return {
      type: this.currentToken.type,
      expiresAt: this.currentToken.expiresAt,
      scope: this.currentToken.scope
    };
  }

  /**
   * Check if token is expired
   */
  public isTokenExpired(): boolean {
    if (!this.currentToken?.expiresAt) {
      return false; // No expiration date means it doesn't expire
    }

    return new Date() >= this.currentToken.expiresAt;
  }

  /**
   * Clear the current token
   */
  public clearToken(): void {
    this.currentToken = null;
    
    if (this.refreshTimeoutId) {
      clearTimeout(this.refreshTimeoutId);
      this.refreshTimeoutId = null;
    }
  }

  /**
   * Destroy the token manager and cleanup resources
   */
  public destroy(): void {
    this.clearToken();
    this.refreshPromise = null;
  }
}

/**
 * Custom error class for authentication-related errors
 */
export class AuthError extends Error implements ApiError {
  public readonly code: string;
  public readonly statusCode?: number;
  public readonly retryable: boolean;

  constructor(code: string, message: string, statusCode?: number, retryable: boolean = false) {
    super(message);
    this.name = 'AuthError';
    this.code = code;
    this.statusCode = statusCode;
    this.retryable = retryable;
  }
}

/**
 * Token manager factory function
 */
export const createAuthTokenManager = (config?: Partial<AuthConfig>): AuthTokenManager => {
  return new AuthTokenManager(config);
};

/**
 * Singleton token manager instance
 */
let defaultTokenManager: AuthTokenManager | null = null;

export const getDefaultAuthTokenManager = (): AuthTokenManager => {
  if (!defaultTokenManager) {
    defaultTokenManager = new AuthTokenManager();
  }
  return defaultTokenManager;
};

/**
 * Utility function to get auth headers quickly
 */
export const getAuthHeaders = async (): Promise<Record<string, string>> => {
  const tokenManager = getDefaultAuthTokenManager();
  return await tokenManager.getAuthHeader();
};

export default AuthTokenManager;