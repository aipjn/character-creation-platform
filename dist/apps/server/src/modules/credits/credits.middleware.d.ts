import { Request, Response, NextFunction } from 'express';
declare global {
    namespace Express {
        interface Request {
            creditCost?: number;
            creditDeducted?: boolean;
        }
    }
}
export declare function checkCredits(apiEndpoint: string): (req: Request, res: Response, next: NextFunction) => Promise<any>;
//# sourceMappingURL=credits.middleware.d.ts.map