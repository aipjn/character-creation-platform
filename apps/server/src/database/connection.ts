import { PrismaClient } from '@prisma/client';
import { Pool, PoolClient } from 'pg';
import * as fs from 'fs';
import * as path from 'path';
import { ConnectionOptions } from 'tls';

interface DatabaseConfig {
  url: string;
  maxConnections?: number;
  connectionTimeoutMs?: number;
  idleTimeoutMs?: number;
  retryAttempts?: number;
  retryDelayMs?: number;
}

class DatabaseConnection {
  private static instance: DatabaseConnection;
  private prismaClient: PrismaClient | null = null;
  private pgPool: Pool | null = null;
  private config: DatabaseConfig;
  private isConnected = false;
  private sslConfig: (ConnectionOptions & { rejectUnauthorized?: boolean }) | undefined;

  private constructor(config: DatabaseConfig) {
    this.config = {
      maxConnections: 20,
      connectionTimeoutMs: 2000,
      idleTimeoutMs: 30000,
      retryAttempts: 5,
      retryDelayMs: 5000,
      ...config,
    };
    this.sslConfig = this.resolveSslConfiguration();
  }

  public static getInstance(config?: DatabaseConfig): DatabaseConnection {
    if (!DatabaseConnection.instance) {
      if (!config?.url) {
        throw new Error('Database URL is required for first initialization');
      }
      DatabaseConnection.instance = new DatabaseConnection(config);
    }
    return DatabaseConnection.instance;
  }

  /**
   * Initialize Prisma client with proper configuration
   */
  private initializePrismaClient(): PrismaClient {
    if (!this.prismaClient) {
      this.prismaClient = new PrismaClient({
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

      // Handle graceful shutdown for Prisma
      this.setupGracefulShutdown();
    }
    return this.prismaClient;
  }

  /**
   * Initialize PostgreSQL connection pool
   */
  private initializePostgreSQLPool(): Pool {
    if (!this.pgPool) {
      this.pgPool = new Pool({
        connectionString: this.config.url,
        max: this.config.maxConnections,
        idleTimeoutMillis: this.config.idleTimeoutMs,
        connectionTimeoutMillis: this.config.connectionTimeoutMs,
        application_name: 'character-creator-api',
        ssl: this.sslConfig,
      });

      // Handle pool errors
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

  /**
   * Get Prisma client instance
   */
  public getPrismaClient(): PrismaClient {
    return this.initializePrismaClient();
  }

  /**
   * Get PostgreSQL pool instance
   */
  public getPostgreSQLPool(): Pool {
    return this.initializePostgreSQLPool();
  }


  private resolveSslConfiguration(): (ConnectionOptions & { rejectUnauthorized?: boolean }) | undefined {
    const caPath = process.env.SUPABASE_CA_PATH;
    if (!caPath) {
      return undefined;
    }

    const resolvedPath = path.resolve(process.cwd(), caPath);

    try {
      const ca = fs.readFileSync(resolvedPath);
      return { ca: ca.toString(), rejectUnauthorized: true, servername: new URL(this.config.url).hostname };
    } catch (error) {
      console.warn('Unable to load Supabase CA certificate, falling back to insecure SSL configuration.', error);
      return { rejectUnauthorized: false };
    }
  }

  /**
   * Get a PostgreSQL client from the pool
   */
  public async getPostgreSQLClient(): Promise<PoolClient> {
    const pool = this.getPostgreSQLPool();
    return await pool.connect();
  }

  /**
   * Test database connection
   */
  public async testConnection(): Promise<boolean> {
    try {
      const prisma = this.getPrismaClient();
      await prisma.$executeRaw`SELECT 1 as test`;
      this.isConnected = true;
      return true;
    } catch (error) {
      console.error('Database connection test failed:', error);
      this.isConnected = false;
      return false;
    }
  }

  /**
   * Connect to database with retry logic
   */
  public async connect(): Promise<void> {
    const maxRetries = this.config.retryAttempts!;
    const delay = this.config.retryDelayMs!;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        const isConnected = await this.testConnection();
        if (isConnected) {
          console.log(`Database connected successfully on attempt ${attempt}`);
          this.isConnected = true;
          return;
        }
        throw new Error('Connection test failed');
      } catch (error) {
        console.error(
          `Database connection attempt ${attempt}/${maxRetries} failed:`,
          error instanceof Error ? error.message : error
        );

        if (attempt === maxRetries) {
          throw new Error(
            `Failed to connect to database after ${maxRetries} attempts`
          );
        }

        console.log(`Retrying connection in ${delay / 1000} seconds...`);
        await this.sleep(delay);
      }
    }
  }

  /**
   * Check if database is currently connected
   */
  public isConnectedToDatabase(): boolean {
    return this.isConnected;
  }

  /**
   * Execute a transaction with Prisma
   */
  public async transaction<T>(
    fn: (prisma: PrismaClient) => Promise<T>
  ): Promise<T> {
    const prisma = this.getPrismaClient();
    return await prisma.$transaction(async (tx) => {
      return await fn(tx as PrismaClient);
    });
  }

  /**
   * Execute raw SQL query with connection pooling
   */
  public async executeRawQuery<T = any>(
    query: string,
    params: any[] = []
  ): Promise<T[]> {
    const client = await this.getPostgreSQLClient();
    try {
      const result = await client.query(query, params);
      return result.rows;
    } finally {
      client.release();
    }
  }

  /**
   * Graceful shutdown of all database connections
   */
  public async disconnect(): Promise<void> {
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
    } catch (error) {
      console.error('Error during database disconnect:', error);
      throw error;
    }
  }

  /**
   * Setup graceful shutdown handlers
   */
  private setupGracefulShutdown(): void {
    const cleanup = async () => {
      await this.disconnect();
      process.exit(0);
    };

    process.on('SIGINT', cleanup);
    process.on('SIGTERM', cleanup);
    process.on('SIGUSR1', cleanup); // PM2 graceful shutdown
    process.on('SIGUSR2', cleanup); // PM2 graceful shutdown
  }

  /**
   * Utility function for delays
   */
  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}

// Factory function for easier usage
export const createDatabaseConnection = (config: DatabaseConfig): DatabaseConnection => {
  return DatabaseConnection.getInstance(config);
};

// Default instance using environment variable
export const getDatabaseConnection = (): DatabaseConnection => {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    throw new Error('DATABASE_URL environment variable is not set');
  }

  return DatabaseConnection.getInstance({ url: databaseUrl });
};

// Export the class for advanced usage
export { DatabaseConnection };
export type { DatabaseConfig };