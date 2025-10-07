"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getAuthenticationClient = exports.getManagementClient = exports.validateAuth0Config = exports.createAuthenticationClient = exports.createManagementClient = exports.SOCIAL_PROVIDERS_CONFIG = exports.AUTH0_CONFIG = void 0;
const auth0_1 = require("auth0");
const parseAuth0EnvVars = () => {
    const requiredVars = ['AUTH0_DOMAIN', 'AUTH0_CLIENT_ID', 'AUTH0_CLIENT_SECRET'];
    const missingVars = requiredVars.filter(varName => !process.env[varName]);
    if (missingVars.length > 0) {
        throw new Error(`Missing required Auth0 environment variables: ${missingVars.join(', ')}`);
    }
    return {
        AUTH0_DOMAIN: process.env.AUTH0_DOMAIN,
        AUTH0_CLIENT_ID: process.env.AUTH0_CLIENT_ID,
        AUTH0_CLIENT_SECRET: process.env.AUTH0_CLIENT_SECRET,
        AUTH0_AUDIENCE: process.env.AUTH0_AUDIENCE || `https://${process.env.AUTH0_DOMAIN}/api/v2/`,
        AUTH0_SCOPE: process.env.AUTH0_SCOPE || 'openid profile email',
    };
};
const auth0EnvVars = parseAuth0EnvVars();
exports.AUTH0_CONFIG = {
    domain: auth0EnvVars.AUTH0_DOMAIN,
    clientId: auth0EnvVars.AUTH0_CLIENT_ID,
    clientSecret: auth0EnvVars.AUTH0_CLIENT_SECRET,
    audience: auth0EnvVars.AUTH0_AUDIENCE,
    scope: auth0EnvVars.AUTH0_SCOPE,
    issuerBaseURL: `https://${auth0EnvVars.AUTH0_DOMAIN}`,
};
exports.SOCIAL_PROVIDERS_CONFIG = {
    google: {
        enabled: process.env.AUTH0_GOOGLE_ENABLED === 'true',
        connection: 'google-oauth2'
    },
    github: {
        enabled: process.env.AUTH0_GITHUB_ENABLED === 'true',
        connection: 'github'
    }
};
const createManagementClient = () => {
    return new auth0_1.ManagementClient({
        domain: exports.AUTH0_CONFIG.domain,
        clientId: exports.AUTH0_CONFIG.clientId,
        clientSecret: exports.AUTH0_CONFIG.clientSecret
    });
};
exports.createManagementClient = createManagementClient;
const createAuthenticationClient = () => {
    return new auth0_1.AuthenticationClient({
        domain: exports.AUTH0_CONFIG.domain,
        clientId: exports.AUTH0_CONFIG.clientId,
        clientSecret: exports.AUTH0_CONFIG.clientSecret
    });
};
exports.createAuthenticationClient = createAuthenticationClient;
const validateAuth0Config = () => {
    const errors = [];
    const warnings = [];
    if (!exports.AUTH0_CONFIG.domain) {
        errors.push('AUTH0_DOMAIN is required');
    }
    if (!exports.AUTH0_CONFIG.clientId) {
        errors.push('AUTH0_CLIENT_ID is required');
    }
    if (!exports.AUTH0_CONFIG.clientSecret) {
        errors.push('AUTH0_CLIENT_SECRET is required');
    }
    try {
        new URL(exports.AUTH0_CONFIG.issuerBaseURL);
    }
    catch {
        errors.push('AUTH0_DOMAIN must be a valid domain');
    }
    return {
        isValid: errors.length === 0,
        errors,
        warnings
    };
};
exports.validateAuth0Config = validateAuth0Config;
const validation = (0, exports.validateAuth0Config)();
if (validation.warnings.length > 0) {
    console.warn('Auth0 configuration warnings:', validation.warnings.join(', '));
}
if (!validation.isValid) {
    console.error('Auth0 configuration errors:', validation.errors.join(', '));
}
const getManagementClient = () => (0, exports.createManagementClient)();
exports.getManagementClient = getManagementClient;
const getAuthenticationClient = () => (0, exports.createAuthenticationClient)();
exports.getAuthenticationClient = getAuthenticationClient;
exports.default = {
    AUTH0_CONFIG: exports.AUTH0_CONFIG,
    getManagementClient: exports.getManagementClient,
    getAuthenticationClient: exports.getAuthenticationClient,
    validateAuth0Config: exports.validateAuth0Config
};
//# sourceMappingURL=auth0.js.map