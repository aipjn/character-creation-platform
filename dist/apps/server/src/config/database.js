"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.disconnectDatabase = exports.connectWithRetry = exports.checkDatabaseConnection = exports.getPgPool = exports.getPrismaClient = void 0;
const client_1 = require("@prisma/client");
const pg_1 = require("pg");
let prisma = null;
const getPrismaClient = () => {
    if (!prisma) {
        prisma = new client_1.PrismaClient({
            log: process.env['NODE_ENV'] === 'development' ? ['query', 'info', 'warn', 'error'] : ['error'],
            errorFormat: 'pretty',
        });
        process.on('SIGINT', async () => {
            await prisma?.$disconnect();
            process.exit(0);
        });
        process.on('SIGTERM', async () => {
            await prisma?.$disconnect();
            process.exit(0);
        });
    }
    return prisma;
};
exports.getPrismaClient = getPrismaClient;
let pgPool = null;
const getPgPool = () => {
    if (!pgPool) {
        pgPool = new pg_1.Pool({
            connectionString: process.env['DATABASE_URL'],
            max: 20,
            idleTimeoutMillis: 30000,
            connectionTimeoutMillis: 2000,
        });
        pgPool.on('error', (err) => {
            console.error('PostgreSQL pool error:', err);
        });
    }
    return pgPool;
};
exports.getPgPool = getPgPool;
const checkDatabaseConnection = async () => {
    try {
        const prisma = (0, exports.getPrismaClient)();
        await prisma.$executeRaw `SELECT 1`;
        return true;
    }
    catch (error) {
        console.error('Database connection failed:', error);
        return false;
    }
};
exports.checkDatabaseConnection = checkDatabaseConnection;
const connectWithRetry = async (maxRetries = 5, delay = 5000) => {
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
        try {
            const isConnected = await (0, exports.checkDatabaseConnection)();
            if (isConnected) {
                console.log('Database connected successfully');
                return;
            }
            throw new Error('Connection check failed');
        }
        catch (error) {
            console.error(`Database connection attempt ${attempt}/${maxRetries} failed:`, error);
            if (attempt === maxRetries) {
                throw new Error(`Failed to connect to database after ${maxRetries} attempts`);
            }
            console.log(`Retrying in ${delay / 1000} seconds...`);
            await new Promise(resolve => setTimeout(resolve, delay));
        }
    }
};
exports.connectWithRetry = connectWithRetry;
const disconnectDatabase = async () => {
    try {
        await prisma?.$disconnect();
        await pgPool?.end();
        console.log('Database connections closed');
    }
    catch (error) {
        console.error('Error closing database connections:', error);
    }
};
exports.disconnectDatabase = disconnectDatabase;
exports.default = prisma;
//# sourceMappingURL=database.js.map