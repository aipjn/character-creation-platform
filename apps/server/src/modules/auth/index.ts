/**
 * Auth Module Exports
 * Central export point for authentication module
 */

// Export service
export * from './auth.service';
export { default as authService } from './auth.service';
export { getAuthService } from './auth.service';

// Export middleware
export * from './auth.middleware';

// Export routes
export { default as authRoutes } from './auth.routes';
