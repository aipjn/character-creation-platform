import { PrismaClient } from '@prisma/client';
import { Pool } from 'pg';
declare let prisma: PrismaClient | null;
export declare const getPrismaClient: () => PrismaClient;
export declare const getPgPool: () => Pool;
export declare const checkDatabaseConnection: () => Promise<boolean>;
export declare const connectWithRetry: (maxRetries?: number, delay?: number) => Promise<void>;
export declare const disconnectDatabase: () => Promise<void>;
export default prisma;
//# sourceMappingURL=database.d.ts.map