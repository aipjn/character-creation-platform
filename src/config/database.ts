import { PrismaClient } from '@prisma/client';
import { Pool } from 'pg';

// Prisma client singleton
let prisma: PrismaClient | null = null;

export const getPrismaClient = (): PrismaClient => {
  if (!prisma) {
    prisma = new PrismaClient({
      log: process.env['NODE_ENV'] === 'development' ? ['query', 'info', 'warn', 'error'] : ['error'],
      errorFormat: 'pretty',
    });

    // Handle graceful shutdown
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

// Raw PostgreSQL connection pool for complex queries
let pgPool: Pool | null = null;

export const getPgPool = (): Pool => {
  if (!pgPool) {
    pgPool = new Pool({
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

// Database connection health check
export const checkDatabaseConnection = async (): Promise<boolean> => {
  try {
    const prisma = getPrismaClient();
    await prisma.$executeRaw`SELECT 1`;
    return true;
  } catch (error) {
    console.error('Database connection failed:', error);
    return false;
  }
};

// Database connection utility with retry logic
export const connectWithRetry = async (maxRetries = 5, delay = 5000): Promise<void> => {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const isConnected = await checkDatabaseConnection();
      if (isConnected) {
        console.log('Database connected successfully');
        return;
      }
      throw new Error('Connection check failed');
    } catch (error) {
      console.error(`Database connection attempt ${attempt}/${maxRetries} failed:`, error);
      
      if (attempt === maxRetries) {
        throw new Error(`Failed to connect to database after ${maxRetries} attempts`);
      }
      
      console.log(`Retrying in ${delay / 1000} seconds...`);
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }
};

// Graceful shutdown function
export const disconnectDatabase = async (): Promise<void> => {
  try {
    await prisma?.$disconnect();
    await pgPool?.end();
    console.log('Database connections closed');
  } catch (error) {
    console.error('Error closing database connections:', error);
  }
};

export default prisma;