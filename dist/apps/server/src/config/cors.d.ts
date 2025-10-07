import { CorsOptions } from 'cors';
export declare const apiCorsConfig: CorsOptions;
export declare const uploadCorsConfig: CorsOptions;
export declare const websocketCorsConfig: {
    origin: (origin: string) => boolean;
    credentials: boolean;
};
export declare const healthCheckCorsConfig: CorsOptions;
export declare const getCorsConfig: () => CorsOptions;
export declare const validateCorsConfig: (config: CorsOptions) => {
    isValid: boolean;
    warnings: string[];
    errors: string[];
};
export declare const createCorsMiddleware: (type?: "default" | "api" | "upload" | "health") => CorsOptions;
export declare const createOriginValidator: (additionalOrigins?: string[]) => (origin: string | undefined, callback: (err: Error | null, allow?: boolean) => void) => void;
export declare const corsConfig: CorsOptions;
export default corsConfig;
//# sourceMappingURL=cors.d.ts.map