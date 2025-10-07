"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getAuthService = exports.AuthService = void 0;
const events_1 = require("events");
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const auth0_1 = require("../../config/auth0");
const client_1 = require("@prisma/client");
const prisma = new client_1.PrismaClient();
class AuthService extends events_1.EventEmitter {
    constructor() {
        super();
        this.managementClient = (0, auth0_1.getManagementClient)();
        this.authClient = (0, auth0_1.getAuthenticationClient)();
    }
    async registerUser(userData) {
        try {
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
            const user = {
                id: auth0User.user_id,
                auth0Id: auth0User.user_id,
                email: auth0User.email,
                name: auth0User.name,
                picture: auth0User.picture,
                emailVerified: auth0User.email_verified || false,
                createdAt: new Date(auth0User.created_at),
                updatedAt: new Date(auth0User.updated_at),
                lastLogin: undefined,
                metadata: auth0User.user_metadata
            };
            const syncedUser = await this.syncUserToDatabase(user);
            this.emit('user:register', {
                userId: syncedUser.id,
                email: syncedUser.email,
                metadata: { registrationMethod: 'email' }
            });
            return {
                success: true,
                user: syncedUser,
                refreshToken: undefined
            };
        }
        catch (error) {
            const errorMessage = this.formatAuthError(error, 'Registration failed');
            console.error('[AUTH] registerUser error:', error);
            this.emit('error', {
                error: error instanceof Error ? error : new Error(errorMessage),
                metadata: { operation: 'register', email: userData.email }
            });
            return {
                success: false,
                error: errorMessage,
                refreshToken: undefined
            };
        }
    }
    async loginUser(email, password) {
        try {
            const response = await this.authClient.oauth.passwordGrant({
                username: email,
                password: password,
                realm: 'Username-Password-Authentication',
                audience: auth0_1.AUTH0_CONFIG.audience,
                scope: auth0_1.AUTH0_CONFIG.scope
            });
            const authResult = response.data;
            if (!authResult.access_token || !authResult.id_token) {
                throw new Error('Authentication failed');
            }
            const idTokenPayload = jsonwebtoken_1.default.decode(authResult.id_token);
            if (!idTokenPayload?.sub) {
                throw new Error('Invalid token payload');
            }
            const detailedUserResponse = await this.managementClient.users.get({
                id: idTokenPayload.sub
            });
            const detailedUser = detailedUserResponse.data;
            const user = {
                id: detailedUser.user_id,
                auth0Id: detailedUser.user_id,
                email: detailedUser.email,
                name: detailedUser.name,
                picture: detailedUser.picture,
                emailVerified: detailedUser.email_verified || false,
                createdAt: new Date(detailedUser.created_at),
                updatedAt: new Date(detailedUser.updated_at),
                lastLogin: new Date(),
                metadata: detailedUser.user_metadata
            };
            const syncedUser = await this.syncUserToDatabase(user);
            await this.updateUserLastLogin(user.auth0Id);
            this.emit('user:login', {
                userId: syncedUser.id,
                email: syncedUser.email,
                metadata: { loginMethod: 'email' }
            });
            return {
                success: true,
                user: syncedUser,
                accessToken: authResult.access_token,
                idToken: authResult.id_token,
                refreshToken: authResult.refresh_token,
                expiresIn: authResult.expires_in
            };
        }
        catch (error) {
            const errorMessage = this.formatAuthError(error, 'Login failed');
            console.error('[AUTH] loginUser error:', error);
            this.emit('error', {
                error: error instanceof Error ? error : new Error(errorMessage),
                metadata: { operation: 'login', email }
            });
            return {
                success: false,
                error: errorMessage,
                refreshToken: undefined
            };
        }
    }
    async getUserById(auth0Id) {
        try {
            const response = await this.managementClient.users.get({ id: auth0Id });
            const auth0User = response.data;
            if (!auth0User || !auth0User.user_id) {
                return null;
            }
            return {
                id: auth0User.user_id,
                auth0Id: auth0User.user_id,
                email: auth0User.email,
                name: auth0User.name,
                picture: auth0User.picture,
                emailVerified: auth0User.email_verified || false,
                createdAt: new Date(auth0User.created_at),
                updatedAt: new Date(auth0User.updated_at),
                lastLogin: auth0User.last_login ? new Date(auth0User.last_login) : undefined,
                metadata: auth0User.user_metadata
            };
        }
        catch (error) {
            console.error('Error fetching user by ID:', error);
            return null;
        }
    }
    formatAuthError(error, fallback) {
        const err = error;
        const responseData = err?.response?.data;
        const candidates = [
            responseData?.error_description,
            responseData?.description,
            responseData?.message,
            typeof responseData === 'string' ? responseData : undefined,
            err?.message,
        ];
        let message = fallback;
        for (const candidate of candidates) {
            if (typeof candidate === 'string' && candidate.trim()) {
                message = candidate.trim();
                break;
            }
        }
        const normalized = message.toLowerCase();
        if (normalized.includes('invalid_grant') || normalized.includes('wrong email or password')) {
            return 'Incorrect email or password. Please check your credentials and try again.';
        }
        if (normalized.includes('user already exists')) {
            return 'An account with this email already exists. Try logging in or resetting your password.';
        }
        if (normalized.includes('passwordstrength') || normalized.includes('password strength') || normalized.includes('password is too weak')) {
            return 'Password does not meet security requirements. Use at least 8 characters with upper & lower case letters, numbers, and a symbol.';
        }
        if (normalized.includes('invalid email')) {
            return 'The email address looks invalid. Please enter a valid email (example@domain.com).';
        }
        return message;
    }
    async updateUser(auth0Id, updates) {
        try {
            const updateData = {};
            if (updates.name)
                updateData.name = updates.name;
            if (updates.picture)
                updateData.picture = updates.picture;
            if (updates.metadata)
                updateData.user_metadata = updates.metadata;
            const response = await this.managementClient.users.update({ id: auth0Id }, updateData);
            const updatedAuth0User = response.data;
            if (!updatedAuth0User || !updatedAuth0User.user_id) {
                return null;
            }
            const user = {
                id: updatedAuth0User.user_id,
                auth0Id: updatedAuth0User.user_id,
                email: updatedAuth0User.email,
                name: updatedAuth0User.name,
                picture: updatedAuth0User.picture,
                emailVerified: updatedAuth0User.email_verified || false,
                createdAt: new Date(updatedAuth0User.created_at),
                updatedAt: new Date(updatedAuth0User.updated_at),
                lastLogin: undefined,
                metadata: updatedAuth0User.user_metadata
            };
            this.emit('user:update', {
                userId: user.id,
                email: user.email,
                metadata: { updatedFields: Object.keys(updates) }
            });
            return user;
        }
        catch (error) {
            console.error('Error updating user:', error);
            this.emit('error', {
                error: error instanceof Error ? error : new Error('User update failed'),
                metadata: { operation: 'updateUser', auth0Id }
            });
            return null;
        }
    }
    async deleteUser(auth0Id) {
        try {
            await this.managementClient.users.delete({ id: auth0Id });
            return true;
        }
        catch (error) {
            console.error('Error deleting user:', error);
            this.emit('error', {
                error: error instanceof Error ? error : new Error('User deletion failed'),
                metadata: { operation: 'deleteUser', auth0Id }
            });
            return false;
        }
    }
    async verifyToken(token) {
        try {
            const payload = jsonwebtoken_1.default.decode(token);
            if (!payload.sub) {
                throw new Error('Invalid token payload');
            }
            return await this.getUserById(payload.sub);
        }
        catch (error) {
            console.error('Token verification failed:', error);
            return null;
        }
    }
    async refreshAccessToken(refreshToken) {
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
            });
            return {
                success: true,
                accessToken: result.access_token,
                refreshToken: result.refresh_token,
                expiresIn: result.expires_in
            };
        }
        catch (error) {
            const errorMessage = error instanceof Error ? error.message : 'Token refresh failed';
            this.emit('error', {
                error: error instanceof Error ? error : new Error(errorMessage),
                metadata: { operation: 'refreshToken' }
            });
            return {
                success: false,
                error: errorMessage,
                refreshToken: undefined
            };
        }
    }
    getSocialLoginUrl(provider, options = {}) {
        const { redirectUrl = `${auth0_1.AUTH0_CONFIG.issuerBaseURL}/auth/callback`, state } = options;
        const connection = provider === 'google' ? 'google-oauth2' : 'github';
        const params = new URLSearchParams({
            response_type: 'code',
            client_id: auth0_1.AUTH0_CONFIG.clientId,
            redirect_uri: redirectUrl,
            scope: auth0_1.AUTH0_CONFIG.scope,
            connection,
            ...(state && { state })
        });
        return `${auth0_1.AUTH0_CONFIG.issuerBaseURL}/authorize?${params.toString()}`;
    }
    async logoutUser(auth0Id, sessionId) {
        try {
            this.emit('user:logout', {
                userId: auth0Id,
                metadata: { sessionId }
            });
        }
        catch (error) {
            console.error('Logout error:', error);
            this.emit('error', {
                error: error instanceof Error ? error : new Error('Logout failed'),
                metadata: { operation: 'logout', auth0Id }
            });
        }
    }
    async sendPasswordResetEmail(email) {
        try {
            await this.authClient.database.changePassword({
                email,
                connection: 'Username-Password-Authentication'
            });
            return true;
        }
        catch (error) {
            console.error('Password reset email failed:', error);
            this.emit('error', {
                error: error instanceof Error ? error : new Error('Password reset failed'),
                metadata: { operation: 'passwordReset', email }
            });
            return false;
        }
    }
    isSocialProviderEnabled(provider) {
        return auth0_1.SOCIAL_PROVIDERS_CONFIG[provider].enabled;
    }
    getAvailableSocialProviders() {
        return [
            { provider: 'google', enabled: auth0_1.SOCIAL_PROVIDERS_CONFIG.google.enabled },
            { provider: 'github', enabled: auth0_1.SOCIAL_PROVIDERS_CONFIG.github.enabled }
        ];
    }
    async syncUserToDatabase(auth0User) {
        try {
            let dbUser = await prisma.user.findUnique({
                where: { auth0Id: auth0User.auth0Id }
            });
            if (dbUser) {
                dbUser = await prisma.user.update({
                    where: { auth0Id: auth0User.auth0Id },
                    data: {
                        email: auth0User.email,
                        name: auth0User.name,
                        avatar: auth0User.picture
                    }
                });
                console.log(`[Auth] Updated user in database: ${dbUser.email}`);
            }
            else {
                dbUser = await prisma.user.findUnique({ where: { email: auth0User.email } });
                if (dbUser) {
                    dbUser = await prisma.user.update({
                        where: { email: auth0User.email },
                        data: {
                            auth0Id: auth0User.auth0Id,
                            name: auth0User.name,
                            avatar: auth0User.picture
                        }
                    });
                    console.log(`[Auth] Linked existing account to Auth0 user: ${dbUser.email}`);
                }
                else {
                    dbUser = await prisma.user.create({
                        data: {
                            email: auth0User.email,
                            auth0Id: auth0User.auth0Id,
                            name: auth0User.name,
                            avatar: auth0User.picture,
                            subscriptionTier: 'FREE',
                            dailyQuota: 3,
                            dailyUsed: 0,
                            totalGenerated: 0,
                            lastResetDate: new Date()
                        }
                    });
                    console.log(`[Auth] Created new user in database: ${dbUser.email}`);
                }
            }
            return {
                ...auth0User,
                id: dbUser.id
            };
        }
        catch (error) {
            if (error?.code === 'P2002' && Array.isArray(error?.meta?.target) && error.meta.target.includes('email')) {
                console.warn('[Auth] Unique constraint on email encountered, attempting to link existing account.');
                const existing = await prisma.user.findUnique({ where: { email: auth0User.email } });
                if (existing) {
                    const updated = await prisma.user.update({
                        where: { email: auth0User.email },
                        data: {
                            auth0Id: auth0User.auth0Id,
                            name: auth0User.name,
                            avatar: auth0User.picture
                        }
                    });
                    console.log(`[Auth] Linked existing account after constraint: ${updated.email}`);
                    return { ...auth0User, id: updated.id };
                }
            }
            console.error('[Auth] Failed to sync user to database:', error);
            return auth0User;
        }
    }
    async updateUserLastLogin(auth0Id) {
        try {
            await this.managementClient.users.update({ id: auth0Id }, { user_metadata: { lastLogin: new Date().toISOString() } });
        }
        catch (error) {
            console.error('Failed to update last login:', error);
        }
    }
    async validateSession(_sessionId) {
        return true;
    }
    async cleanupExpiredSessions() {
        console.log('Cleaning up expired sessions...');
    }
}
exports.AuthService = AuthService;
let authServiceInstance = null;
const getAuthService = () => {
    if (!authServiceInstance) {
        authServiceInstance = new AuthService();
    }
    return authServiceInstance;
};
exports.getAuthService = getAuthService;
exports.default = (0, exports.getAuthService)();
//# sourceMappingURL=auth.service.js.map