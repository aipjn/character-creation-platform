import { ManagementClient, AuthenticationClient } from 'auth0';
export interface Auth0Config {
    domain: string;
    clientId: string;
    clientSecret: string;
    audience: string;
    scope: string;
    issuerBaseURL: string;
}
export declare const AUTH0_CONFIG: Auth0Config;
export declare const SOCIAL_PROVIDERS_CONFIG: {
    google: {
        enabled: boolean;
        connection: string;
    };
    github: {
        enabled: boolean;
        connection: string;
    };
};
export declare const createManagementClient: () => ManagementClient;
export declare const createAuthenticationClient: () => AuthenticationClient;
export declare const validateAuth0Config: () => {
    isValid: boolean;
    errors: string[];
    warnings: string[];
};
export declare const getManagementClient: () => ManagementClient;
export declare const getAuthenticationClient: () => AuthenticationClient;
declare const _default: {
    AUTH0_CONFIG: Auth0Config;
    getManagementClient: () => ManagementClient;
    getAuthenticationClient: () => AuthenticationClient;
    validateAuth0Config: () => {
        isValid: boolean;
        errors: string[];
        warnings: string[];
    };
};
export default _default;
//# sourceMappingURL=auth0.d.ts.map