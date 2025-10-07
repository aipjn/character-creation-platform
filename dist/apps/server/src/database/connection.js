"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.DatabaseConnection = exports.getDatabaseConnection = exports.createDatabaseConnection = void 0;
const client_1 = require("@prisma/client");
const pg_1 = require("pg");
class DatabaseConnection {
    constructor(config) {
        this.prismaClient = null;
        this.pgPool = null;
        this.isConnected = false;
        this.config = {
            maxConnections: 20,
            connectionTimeoutMs: 2000,
            idleTimeoutMs: 30000,
            retryAttempts: 5,
            retryDelayMs: 5000,
            ...config,
        };
    }
    static getInstance(config) {
        if (!DatabaseConnection.instance) {
            if (!config?.url) {
                throw new Error('Database URL is required for first initialization');
            }
            DatabaseConnection.instance = new DatabaseConnection(config);
        }
        return DatabaseConnection.instance;
    }
    initializePrismaClient() {
        if (!this.prismaClient) {
            this.prismaClient = new client_1.PrismaClient({
                datasources: {
                    db: {
                        url: this.config.url,
                    },
                },
                log: process.env.NODE_ENV === 'development'
                    ? ['query', 'info', 'warn', 'error']
                    : ['error'],
                errorFormat: 'pretty',
            });
            this.setupGracefulShutdown();
        }
        return this.prismaClient;
    }
    initializePostgreSQLPool() {
        if (!this.pgPool) {
            this.pgPool = new pg_1.Pool({
                connectionString: this.config.url,
                max: this.config.maxConnections,
                idleTimeoutMillis: this.config.idleTimeoutMs,
                connectionTimeoutMillis: this.config.connectionTimeoutMs,
                application_name: 'character-creator-api',
            });
            this.pgPool.on('error', (err) => {
                console.error('PostgreSQL pool error:', err);
                this.isConnected = false;
            });
            this.pgPool.on('connect', () => {
                console.log('New PostgreSQL client connected');
            });
            this.pgPool.on('remove', () => {
                console.log('PostgreSQL client removed from pool');
            });
        }
        return this.pgPool;
    }
    getPrismaClient() {
        return this.initializePrismaClient();
    }
    getPostgreSQLPool() {
        return this.initializePostgreSQLPool();
    }
    async getPostgreSQLClient() {
        const pool = this.getPostgreSQLPool();
        return await pool.connect();
    }
    async testConnection() {
        try {
            const prisma = this.getPrismaClient();
            await prisma.$executeRaw `SELECT 1 as test`;
            this.isConnected = true;
            return true;
        }
        catch (error) {
            console.error('Database connection test failed:', error);
            this.isConnected = false;
            return false;
        }
    }
    async connect() {
        const maxRetries = this.config.retryAttempts;
        const delay = this.config.retryDelayMs;
        for (let attempt = 1; attempt <= maxRetries; attempt++) {
            try {
                const isConnected = await this.testConnection();
                if (isConnected) {
                    console.log(`Database connected successfully on attempt ${attempt}`);
                    this.isConnected = true;
                    return;
                }
                throw new Error('Connection test failed');
            }
            catch (error) {
                console.error(`Database connection attempt ${attempt}/${maxRetries} failed:`, error instanceof Error ? error.message : error);
                if (attempt === maxRetries) {
                    throw new Error(`Failed to connect to database after ${maxRetries} attempts`);
                }
                console.log(`Retrying connection in ${delay / 1000} seconds...`);
                await this.sleep(delay);
            }
        }
    }
    isConnectedToDatabase() {
        return this.isConnected;
    }
    async transaction(fn) {
        const prisma = this.getPrismaClient();
        return await prisma.$transaction(async (tx) => {
            return await fn(tx);
        });
    }
    async executeRawQuery(query, params = []) {
        const client = await this.getPostgreSQLClient();
        try {
            const result = await client.query(query, params);
            return result.rows;
        }
        finally {
            client.release();
        }
    }
    async disconnect() {
        try {
            console.log('Closing database connections...');
            if (this.prismaClient) {
                await this.prismaClient.$disconnect();
                this.prismaClient = null;
                console.log('Prisma client disconnected');
            }
            if (this.pgPool) {
                await this.pgPool.end();
                this.pgPool = null;
                console.log('PostgreSQL pool closed');
            }
            this.isConnected = false;
            console.log('All database connections closed successfully');
        }
        catch (error) {
            console.error('Error during database disconnect:', error);
            throw error;
        }
    }
    setupGracefulShutdown() {
        const cleanup = async () => {
            await this.disconnect();
            process.exit(0);
        };
        process.on('SIGINT', cleanup);
        process.on('SIGTERM', cleanup);
        process.on('SIGUSR1', cleanup);
        process.on('SIGUSR2', cleanup);
    }
    sleep(ms) {
        return new Promise((resolve) => setTimeout(resolve, ms));
    }
}
exports.DatabaseConnection = DatabaseConnection;
const createDatabaseConnection = (config) => {
    return DatabaseConnection.getInstance(config);
};
exports.createDatabaseConnection = createDatabaseConnection;
const getDatabaseConnection = () => {
    const databaseUrl = process.env.DATABASE_URL;
    if (!databaseUrl) {
        throw new Error('DATABASE_URL environment variable is not set');
    }
    return DatabaseConnection.getInstance({ url: databaseUrl });
};
exports.getDatabaseConnection = getDatabaseConnection;
//# sourceMappingURL=connection.js.map