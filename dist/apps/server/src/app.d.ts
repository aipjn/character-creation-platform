import express from 'express';
export declare const createApp: () => express.Application;
export declare const addRoutes: (app: express.Application, routes: {
    path: string;
    router: express.Router;
}[]) => void;
export declare const addMiddleware: (app: express.Application, middleware: {
    path?: string;
    handler: express.RequestHandler;
}[]) => void;
export declare const validateAppConfig: () => {
    isValid: boolean;
    warnings: string[];
    errors: string[];
};
export default createApp;
//# sourceMappingURL=app.d.ts.map