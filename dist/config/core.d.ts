export interface CoreConfig {
    server: {
        port: number;
        host: string;
        nodeEnv: 'development' | 'production' | 'test';
    };
    database?: {
        url: string;
    };
    auth?: {
        jwtSecret: string;
        jwtExpiresIn: string;
    };
    storage: {
        provider: 'local';
        uploadPath: string;
        maxFileSize: number;
    };
    gracefulShutdown: {
        timeout: number;
        signals: string[];
    };
}
export declare const config: CoreConfig;
export declare const isDevelopment: () => boolean;
export declare const isProduction: () => boolean;
export declare const isTest: () => boolean;
//# sourceMappingURL=core.d.ts.map