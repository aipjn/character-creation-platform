import { PrismaClient } from '@prisma/client';
import { Pool, PoolClient } from 'pg';
interface DatabaseConfig {
    url: string;
    maxConnections?: number;
    connectionTimeoutMs?: number;
    idleTimeoutMs?: number;
    retryAttempts?: number;
    retryDelayMs?: number;
}
declare class DatabaseConnection {
    private static instance;
    private prismaClient;
    private pgPool;
    private config;
    private isConnected;
    private constructor();
    static getInstance(config?: DatabaseConfig): DatabaseConnection;
    private initializePrismaClient;
    private initializePostgreSQLPool;
    getPrismaClient(): PrismaClient;
    getPostgreSQLPool(): Pool;
    getPostgreSQLClient(): Promise<PoolClient>;
    testConnection(): Promise<boolean>;
    connect(): Promise<void>;
    isConnectedToDatabase(): boolean;
    transaction<T>(fn: (prisma: PrismaClient) => Promise<T>): Promise<T>;
    executeRawQuery<T = any>(query: string, params?: any[]): Promise<T[]>;
    disconnect(): Promise<void>;
    private setupGracefulShutdown;
    private sleep;
}
export declare const createDatabaseConnection: (config: DatabaseConfig) => DatabaseConnection;
export declare const getDatabaseConnection: () => DatabaseConnection;
export { DatabaseConnection };
export type { DatabaseConfig };
//# sourceMappingURL=connection.d.ts.map