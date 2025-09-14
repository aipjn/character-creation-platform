/**
 * API Versioning Middleware
 * Handles API version detection, validation, and routing
 */

import { Request, Response, NextFunction } from 'express';
import { ApiRequest, ApiResponse, ApiVersion, API_CONSTANTS } from '../types/api';

/**
 * API Version configuration
 */
export interface ApiVersionConfig {
  defaultVersion: string;
  supportedVersions: string[];
  deprecatedVersions: { [version: string]: string }; // version -> supportedUntil date
  versionHeader: string;
  versionParam: string;
  enableVersionRedirect: boolean;
  enableDeprecationWarnings: boolean;
}

/**
 * Default versioning configuration
 */
export const DEFAULT_VERSION_CONFIG: ApiVersionConfig = {
  defaultVersion: API_CONSTANTS.VERSIONS.V1,
  supportedVersions: [API_CONSTANTS.VERSIONS.V1],
  deprecatedVersions: {},
  versionHeader: 'X-API-Version',
  versionParam: 'version',
  enableVersionRedirect: true,
  enableDeprecationWarnings: true
};

/**
 * Version detection sources in order of priority
 */
export enum VersionSource {
  PATH = 'path',
  HEADER = 'header',
  QUERY = 'query',
  DEFAULT = 'default'
}

/**
 * Detected version information
 */
export interface DetectedVersion {
  version: string;
  source: VersionSource;
  isSupported: boolean;
  isDeprecated: boolean;
  deprecatedUntil?: string;
}

/**
 * API Version Manager
 */
export class ApiVersionManager {
  private config: ApiVersionConfig;
  private versionInfo: Map<string, ApiVersion>;

  constructor(config: Partial<ApiVersionConfig> = {}) {
    this.config = { ...DEFAULT_VERSION_CONFIG, ...config };
    this.versionInfo = this.initializeVersionInfo();
  }

  /**
   * Initialize version information
   */
  private initializeVersionInfo(): Map<string, ApiVersion> {
    const versionMap = new Map<string, ApiVersion>();

    this.config.supportedVersions.forEach(version => {
      const isDeprecated = version in this.config.deprecatedVersions;
      const supportedUntil = isDeprecated ? this.config.deprecatedVersions[version] : undefined;

      versionMap.set(version, {
        version,
        deprecated: isDeprecated,
        supportedUntil,
        routes: this.getRoutesForVersion(version)
      });
    });

    return versionMap;
  }

  /**
   * Get available routes for a version
   */
  private getRoutesForVersion(version: string): string[] {
    // TODO: This could be enhanced to read from route definitions
    const baseRoutes = [
      '/users',
      '/characters',
      '/health'
    ];

    return baseRoutes.map(route => `/api/${version}${route}`);
  }

  /**
   * Detect API version from request
   */
  detectVersion(req: Request): DetectedVersion {
    // 1. Try to get version from path (highest priority)
    const pathVersion = this.extractVersionFromPath(req.path);
    if (pathVersion) {
      return {
        version: pathVersion,
        source: VersionSource.PATH,
        isSupported: this.isVersionSupported(pathVersion),
        isDeprecated: this.isVersionDeprecated(pathVersion),
        deprecatedUntil: this.config.deprecatedVersions[pathVersion]
      };
    }

    // 2. Try to get version from header
    const headerVersion = req.get(this.config.versionHeader);
    if (headerVersion && this.isVersionSupported(headerVersion)) {
      return {
        version: headerVersion,
        source: VersionSource.HEADER,
        isSupported: true,
        isDeprecated: this.isVersionDeprecated(headerVersion),
        deprecatedUntil: this.config.deprecatedVersions[headerVersion]
      };
    }

    // 3. Try to get version from query parameter
    const queryVersion = req.query[this.config.versionParam] as string;
    if (queryVersion && this.isVersionSupported(queryVersion)) {
      return {
        version: queryVersion,
        source: VersionSource.QUERY,
        isSupported: true,
        isDeprecated: this.isVersionDeprecated(queryVersion),
        deprecatedUntil: this.config.deprecatedVersions[queryVersion]
      };
    }

    // 4. Use default version
    return {
      version: this.config.defaultVersion,
      source: VersionSource.DEFAULT,
      isSupported: true,
      isDeprecated: this.isVersionDeprecated(this.config.defaultVersion),
      deprecatedUntil: this.config.deprecatedVersions[this.config.defaultVersion]
    };
  }

  /**
   * Extract version from request path
   */
  private extractVersionFromPath(path: string): string | null {
    const versionMatch = path.match(/^\/api\/(v\d+)/);
    return versionMatch ? versionMatch[1] : null;
  }

  /**
   * Check if version is supported
   */
  isVersionSupported(version: string): boolean {
    return this.config.supportedVersions.includes(version);
  }

  /**
   * Check if version is deprecated
   */
  isVersionDeprecated(version: string): boolean {
    return version in this.config.deprecatedVersions;
  }

  /**
   * Get version information
   */
  getVersionInfo(version: string): ApiVersion | undefined {
    return this.versionInfo.get(version);
  }

  /**
   * Get all supported versions
   */
  getAllVersions(): ApiVersion[] {
    return Array.from(this.versionInfo.values());
  }

  /**
   * Add or update version
   */
  addVersion(version: ApiVersion): void {
    this.versionInfo.set(version.version, version);
    
    // Update config arrays
    if (!this.config.supportedVersions.includes(version.version)) {
      this.config.supportedVersions.push(version.version);
    }
    
    if (version.deprecated && version.supportedUntil) {
      this.config.deprecatedVersions[version.version] = version.supportedUntil;
    }
  }

  /**
   * Remove version support
   */
  removeVersion(version: string): boolean {
    const removed = this.versionInfo.delete(version);
    
    if (removed) {
      this.config.supportedVersions = this.config.supportedVersions.filter(v => v !== version);
      delete this.config.deprecatedVersions[version];
    }
    
    return removed;
  }
}

/**
 * Default version manager instance
 */
export const defaultVersionManager = new ApiVersionManager();

/**
 * API version detection middleware
 */
export function versionDetection(config?: Partial<ApiVersionConfig>) {
  const versionManager = config ? new ApiVersionManager(config) : defaultVersionManager;

  return (req: ApiRequest, res: Response, next: NextFunction): void => {
    const detectedVersion = versionManager.detectVersion(req);

    // Add version info to request
    (req as any).apiVersion = detectedVersion;
    (req as any).versionManager = versionManager;

    // Check if version is supported
    if (!detectedVersion.isSupported) {
      const response: ApiResponse = {
        success: false,
        error: {
          code: 'UNSUPPORTED_API_VERSION',
          message: `API version ${detectedVersion.version} is not supported`,
          details: {
            requestedVersion: detectedVersion.version,
            supportedVersions: versionManager.getAllVersions().map(v => v.version),
            source: detectedVersion.source
          },
          statusCode: API_CONSTANTS.HTTP_STATUS.BAD_REQUEST
        },
        meta: {
          timestamp: new Date().toISOString(),
          requestId: req.requestId,
          version: detectedVersion.version,
          path: req.path
        }
      };

      return res.status(API_CONSTANTS.HTTP_STATUS.BAD_REQUEST).json(response);
    }

    // Add version headers to response
    res.setHeader('X-API-Version', detectedVersion.version);
    res.setHeader('X-API-Version-Source', detectedVersion.source);

    // Add deprecation warning if needed
    if (detectedVersion.isDeprecated && versionManager.config.enableDeprecationWarnings) {
      const deprecationMessage = detectedVersion.deprecatedUntil 
        ? `API version ${detectedVersion.version} is deprecated and will be removed on ${detectedVersion.deprecatedUntil}`
        : `API version ${detectedVersion.version} is deprecated`;

      res.setHeader('Warning', `299 - "${deprecationMessage}"`);
      res.setHeader('X-API-Deprecation', detectedVersion.deprecatedUntil || 'true');

      // Log deprecation warning
      console.warn(`${new Date().toISOString()} [DEPRECATION] ${req.method} ${req.path} - ${deprecationMessage} - Request ID: ${req.requestId}`);
    }

    next();
  };
}

/**
 * API version validation middleware
 * Validates that the requested version matches the route version
 */
export function validateRouteVersion(expectedVersion: string) {
  return (req: ApiRequest, res: Response, next: NextFunction): void => {
    const detectedVersion = (req as any).apiVersion as DetectedVersion;

    if (!detectedVersion) {
      const response: ApiResponse = {
        success: false,
        error: {
          code: API_CONSTANTS.ERROR_CODES.INTERNAL_ERROR,
          message: 'Version detection middleware not configured',
          statusCode: API_CONSTANTS.HTTP_STATUS.INTERNAL_SERVER_ERROR
        },
        meta: {
          timestamp: new Date().toISOString(),
          requestId: req.requestId,
          version: '1.0.0',
          path: req.path
        }
      };

      return res.status(API_CONSTANTS.HTTP_STATUS.INTERNAL_SERVER_ERROR).json(response);
    }

    if (detectedVersion.version !== expectedVersion) {
      const response: ApiResponse = {
        success: false,
        error: {
          code: 'VERSION_MISMATCH',
          message: `Route expects version ${expectedVersion} but ${detectedVersion.version} was requested`,
          details: {
            expectedVersion,
            requestedVersion: detectedVersion.version,
            source: detectedVersion.source
          },
          statusCode: API_CONSTANTS.HTTP_STATUS.BAD_REQUEST
        },
        meta: {
          timestamp: new Date().toISOString(),
          requestId: req.requestId,
          version: detectedVersion.version,
          path: req.path
        }
      };

      return res.status(API_CONSTANTS.HTTP_STATUS.BAD_REQUEST).json(response);
    }

    next();
  };
}

/**
 * Version redirect middleware
 * Redirects unversioned requests to the default version
 */
export function versionRedirect(config?: Partial<ApiVersionConfig>) {
  const versionConfig = { ...DEFAULT_VERSION_CONFIG, ...config };

  return (req: Request, res: Response, next: NextFunction): void => {
    // Check if this is an API route without version
    if (req.path.startsWith('/api/') && !req.path.match(/^\/api\/v\d+/)) {
      if (versionConfig.enableVersionRedirect) {
        const newPath = req.path.replace('/api/', `/api/${versionConfig.defaultVersion}/`);
        return res.redirect(301, newPath);
      }
    }

    next();
  };
}

/**
 * Version information endpoint middleware
 * Provides information about available API versions
 */
export function versionInfo(config?: Partial<ApiVersionConfig>) {
  const versionManager = config ? new ApiVersionManager(config) : defaultVersionManager;

  return (req: ApiRequest, res: Response): void => {
    const versions = versionManager.getAllVersions();
    const currentVersion = (req as any).apiVersion as DetectedVersion;

    const response: ApiResponse<{
      current: string;
      supported: ApiVersion[];
      default: string;
    }> = {
      success: true,
      data: {
        current: currentVersion?.version || versionManager.config.defaultVersion,
        supported: versions,
        default: versionManager.config.defaultVersion
      },
      meta: {
        timestamp: new Date().toISOString(),
        requestId: req.requestId,
        version: currentVersion?.version || '1.0.0',
        path: req.path
      }
    };

    res.json(response);
  };
}

/**
 * Export versioning utilities
 */
export {
  ApiVersionConfig,
  DEFAULT_VERSION_CONFIG,
  ApiVersionManager,
  DetectedVersion,
  VersionSource
};