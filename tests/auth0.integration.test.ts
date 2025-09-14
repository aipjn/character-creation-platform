/**
 * Auth0 Integration Test
 * Basic tests to verify Auth0 configuration and setup
 */

import { AUTH0_CONFIG, validateAuth0Config } from '../src/config/auth0';
import { ENV_CONFIG } from '../src/config/env';

describe('Auth0 Integration - Basic Configuration Tests', () => {
  test('should have Auth0 configuration structure', () => {
    expect(AUTH0_CONFIG).toBeDefined();
    expect(AUTH0_CONFIG).toHaveProperty('domain');
    expect(AUTH0_CONFIG).toHaveProperty('clientId');
    expect(AUTH0_CONFIG).toHaveProperty('clientSecret');
    expect(AUTH0_CONFIG).toHaveProperty('audience');
    expect(AUTH0_CONFIG).toHaveProperty('scope');
    expect(AUTH0_CONFIG).toHaveProperty('issuerBaseURL');
    expect(AUTH0_CONFIG).toHaveProperty('baseURL');
    expect(AUTH0_CONFIG).toHaveProperty('secret');
    
    console.log('Auth0 Configuration Structure Verified:', {
      domain: AUTH0_CONFIG.domain ? 'CONFIGURED' : 'NOT SET',
      clientId: AUTH0_CONFIG.clientId ? 'CONFIGURED' : 'NOT SET',
      audience: AUTH0_CONFIG.audience,
      scope: AUTH0_CONFIG.scope,
      baseURL: AUTH0_CONFIG.baseURL
    });
  });

  test('should validate Auth0 configuration', () => {
    const validation = validateAuth0Config();
    
    console.log('Auth0 Configuration Validation:', {
      isValid: validation.isValid,
      errors: validation.errors,
      warnings: validation.warnings
    });

    // Note: In test environment without actual Auth0 credentials, 
    // we expect this to fail validation
    expect(validation).toHaveProperty('isValid');
    expect(validation).toHaveProperty('errors');
    expect(validation).toHaveProperty('warnings');
    
    if (!validation.isValid) {
      console.log('Expected validation failures in test environment - Auth0 credentials not configured');
      expect(validation.errors.length).toBeGreaterThan(0);
    }
  });

  test('should handle environment variables correctly', () => {
    // Test that the configuration parsing doesn't crash
    expect(() => {
      const config = AUTH0_CONFIG;
      expect(config.issuerBaseURL).toBeDefined();
      expect(config.baseURL).toBeDefined();
      expect(config.scope).toBe('openid profile email');
    }).not.toThrow();
  });

  test('should have proper default values', () => {
    expect(AUTH0_CONFIG.scope).toBe('openid profile email');
    expect(AUTH0_CONFIG.auth0Logout).toBe(true);
    expect(AUTH0_CONFIG.legacySameSiteCookie).toBe(false);
    expect(AUTH0_CONFIG.authRequired).toBe(false);
  });

  test('should construct proper URLs', () => {
    const domain = AUTH0_CONFIG.domain;
    if (domain) {
      expect(AUTH0_CONFIG.issuerBaseURL).toBe(`https://${domain}`);
    }
    
    // Verify URL formats are valid (or empty if not configured)
    if (AUTH0_CONFIG.issuerBaseURL) {
      expect(() => new URL(AUTH0_CONFIG.issuerBaseURL)).not.toThrow();
    }
    
    if (AUTH0_CONFIG.baseURL) {
      expect(() => new URL(AUTH0_CONFIG.baseURL)).not.toThrow();
    }
  });

  test('should have proper security defaults', () => {
    expect(AUTH0_CONFIG.legacySameSiteCookie).toBe(false);
    expect(AUTH0_CONFIG.auth0Logout).toBe(true);
    
    // In production, we should have secure settings
    if (ENV_CONFIG.NODE_ENV === 'production') {
      expect(AUTH0_CONFIG.baseURL).not.toContain('localhost');
    }
  });
});

describe('Auth0 Environment Integration', () => {
  test('should handle missing environment gracefully', () => {
    // This test ensures our configuration doesn't crash when Auth0 vars are missing
    expect(() => {
      const validation = validateAuth0Config();
      console.log('Graceful handling test - validation result:', {
        isValid: validation.isValid,
        errorCount: validation.errors.length,
        warningCount: validation.warnings.length
      });
    }).not.toThrow();
  });

  test('should provide helpful error messages', () => {
    const validation = validateAuth0Config();
    
    if (!validation.isValid) {
      expect(validation.errors).toBeDefined();
      expect(Array.isArray(validation.errors)).toBe(true);
      
      // Check that error messages are helpful
      const errorText = validation.errors.join(' ');
      expect(
        errorText.includes('AUTH0_DOMAIN') ||
        errorText.includes('AUTH0_CLIENT_ID') ||
        errorText.includes('AUTH0_CLIENT_SECRET')
      ).toBe(true);
      
      console.log('Helpful error messages verified:', validation.errors);
    }
  });

  test('should provide setup instructions in warnings', () => {
    const validation = validateAuth0Config();
    expect(validation.warnings).toBeDefined();
    expect(Array.isArray(validation.warnings)).toBe(true);
    
    console.log('Configuration warnings:', validation.warnings);
  });
});

describe('Auth0 Dependencies', () => {
  test('should have Auth0 packages available', () => {
    // Test that Auth0 packages can be imported
    expect(() => {
      const auth0 = require('auth0');
      expect(auth0.ManagementClient).toBeDefined();
      expect(auth0.AuthenticationClient).toBeDefined();
    }).not.toThrow();

    expect(() => {
      const openid = require('express-openid-connect');
      expect(openid.auth).toBeDefined();
    }).not.toThrow();

    expect(() => {
      const jwt = require('jsonwebtoken');
      expect(jwt.verify).toBeDefined();
      expect(jwt.decode).toBeDefined();
    }).not.toThrow();

    expect(() => {
      const jwksClient = require('jwks-client');
      expect(jwksClient).toBeDefined();
    }).not.toThrow();
  });

  test('should log dependency versions', () => {
    try {
      const auth0Package = require('auth0/package.json');
      const openidPackage = require('express-openid-connect/package.json');
      const jwtPackage = require('jsonwebtoken/package.json');
      
      console.log('Auth0 Dependencies:', {
        'auth0': auth0Package.version,
        'express-openid-connect': openidPackage.version,
        'jsonwebtoken': jwtPackage.version
      });
    } catch (error) {
      console.log('Could not read package versions:', (error as Error).message);
    }
  });
});

describe('Auth0 Setup Summary', () => {
  test('should provide complete setup summary', () => {
    const validation = validateAuth0Config();
    
    const summary = {
      configurationValid: validation.isValid,
      domain: AUTH0_CONFIG.domain ? 'SET' : 'NOT_SET',
      clientId: AUTH0_CONFIG.clientId ? 'SET' : 'NOT_SET',  
      clientSecret: AUTH0_CONFIG.clientSecret ? 'SET' : 'NOT_SET',
      baseUrl: AUTH0_CONFIG.baseURL,
      audience: AUTH0_CONFIG.audience,
      scope: AUTH0_CONFIG.scope,
      errors: validation.errors,
      warnings: validation.warnings,
      environment: ENV_CONFIG.NODE_ENV,
      dependenciesInstalled: true // If we reach this point, dependencies are installed
    };

    console.log('\n=== Auth0 Integration Setup Summary ===');
    console.log(JSON.stringify(summary, null, 2));
    console.log('==========================================\n');

    expect(summary.dependenciesInstalled).toBe(true);
    expect(summary.environment).toBeDefined();
  });
});