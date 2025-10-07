import { EventEmitter } from 'events';
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
    idToken?: string;
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
export type AuthEvent = 'user:login' | 'user:logout' | 'user:register' | 'user:update' | 'token:refresh' | 'error';
export interface AuthEventPayload {
    userId?: string;
    email?: string;
    provider?: string;
    error?: Error;
    metadata?: Record<string, any>;
}
export declare class AuthService extends EventEmitter {
    private managementClient;
    private authClient;
    constructor();
    registerUser(userData: UserRegistrationData): Promise<AuthenticationResult>;
    loginUser(email: string, password: string): Promise<AuthenticationResult>;
    getUserById(auth0Id: string): Promise<User | null>;
    private formatAuthError;
    updateUser(auth0Id: string, updates: Partial<User>): Promise<User | null>;
    deleteUser(auth0Id: string): Promise<boolean>;
    verifyToken(token: string): Promise<User | null>;
    refreshAccessToken(refreshToken: string): Promise<AuthenticationResult>;
    getSocialLoginUrl(provider: 'google' | 'github', options?: Partial<SocialLoginOptions>): string;
    logoutUser(auth0Id: string, sessionId?: string): Promise<void>;
    sendPasswordResetEmail(email: string): Promise<boolean>;
    isSocialProviderEnabled(provider: 'google' | 'github'): boolean;
    getAvailableSocialProviders(): Array<{
        provider: string;
        enabled: boolean;
    }>;
    private syncUserToDatabase;
    private updateUserLastLogin;
    validateSession(_sessionId: string): Promise<boolean>;
    cleanupExpiredSessions(): Promise<void>;
}
export declare const getAuthService: () => AuthService;
declare const _default: AuthService;
export default _default;
//# sourceMappingURL=auth.service.d.ts.map