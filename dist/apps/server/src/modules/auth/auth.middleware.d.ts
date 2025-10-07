import { Request, Response, NextFunction } from 'express';
import { User } from './auth.service';
export interface AuthenticatedRequest extends Request {
    user?: User;
    sessionID?: string;
    auth?: {
        isAuthenticated: boolean;
        token?: string;
        sessionId?: string;
    };
}
export declare class AuthenticationError extends Error {
    statusCode: number;
    code: string;
    constructor(message: string, statusCode?: number, code?: string);
}
export declare class AuthorizationError extends Error {
    statusCode: number;
    code: string;
    constructor(message: string, statusCode?: number, code?: string);
}
export declare const authenticate: (req: AuthenticatedRequest, res: Response, next: NextFunction) => Promise<void>;
export declare const optionalAuth: (req: AuthenticatedRequest, res: Response, next: NextFunction) => Promise<void>;
export declare const requireVerifiedEmail: (req: AuthenticatedRequest, res: Response, next: NextFunction) => void;
export declare const requireRole: (...roles: string[]) => (req: AuthenticatedRequest, res: Response, next: NextFunction) => void;
export declare const requireOwnership: (resourceIdParam?: string) => (req: AuthenticatedRequest, res: Response, next: NextFunction) => Promise<void>;
export declare const userRateLimit: (maxRequests?: number, windowMs?: number) => (req: AuthenticatedRequest, res: Response, next: NextFunction) => void;
export declare const validateSession: (req: AuthenticatedRequest, res: Response, next: NextFunction) => Promise<void>;
export declare const logout: (req: AuthenticatedRequest, res: Response, next: NextFunction) => Promise<void>;
export declare const authErrorHandler: (error: Error, req: Request, res: Response, next: NextFunction) => void;
export declare const createAuthMiddleware: (options?: {
    required?: boolean;
    roles?: string[];
    requireEmailVerification?: boolean;
    requireOwnership?: boolean;
    resourceIdParam?: string;
}) => ((req: AuthenticatedRequest, res: Response, next: NextFunction) => void)[];
declare const _default: {
    authenticate: (req: AuthenticatedRequest, res: Response, next: NextFunction) => Promise<void>;
    optionalAuth: (req: AuthenticatedRequest, res: Response, next: NextFunction) => Promise<void>;
    requireVerifiedEmail: (req: AuthenticatedRequest, res: Response, next: NextFunction) => void;
    requireRole: (...roles: string[]) => (req: AuthenticatedRequest, res: Response, next: NextFunction) => void;
    requireOwnership: (resourceIdParam?: string) => (req: AuthenticatedRequest, res: Response, next: NextFunction) => Promise<void>;
    userRateLimit: (maxRequests?: number, windowMs?: number) => (req: AuthenticatedRequest, res: Response, next: NextFunction) => void;
    validateSession: (req: AuthenticatedRequest, res: Response, next: NextFunction) => Promise<void>;
    logout: (req: AuthenticatedRequest, res: Response, next: NextFunction) => Promise<void>;
    authErrorHandler: (error: Error, req: Request, res: Response, next: NextFunction) => void;
    createAuthMiddleware: (options?: {
        required?: boolean;
        roles?: string[];
        requireEmailVerification?: boolean;
        requireOwnership?: boolean;
        resourceIdParam?: string;
    }) => ((req: AuthenticatedRequest, res: Response, next: NextFunction) => void)[];
};
export default _default;
//# sourceMappingURL=auth.middleware.d.ts.map