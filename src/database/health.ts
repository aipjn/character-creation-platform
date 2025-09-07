import { getDatabaseConnection } from './connection';

interface HealthMetrics {
  responseTimeMs: number;
  connectionStatus: 'healthy' | 'degraded' | 'unhealthy';
  activeConnections?: number;
  totalConnections?: number;
  lastCheckTime: Date;
}

interface DatabaseHealth {
  status: 'healthy' | 'degraded' | 'unhealthy';
  prisma: HealthMetrics;
  postgresql: HealthMetrics;
  overall: {
    status: 'healthy' | 'degraded' | 'unhealthy';
    uptime: number;
    checks: {
      connectivity: boolean;
      latency: boolean;
      tables: boolean;
      migrations: boolean;
    };
    errors: string[];
  };
}

class DatabaseHealthChecker {
  private static instance: DatabaseHealthChecker;
  private startTime: Date;
  private healthCheckInterval: NodeJS.Timeout | null = null;
  private lastHealthCheck: DatabaseHealth | null = null;

  private constructor() {
    this.startTime = new Date();
  }

  public static getInstance(): DatabaseHealthChecker {
    if (!DatabaseHealthChecker.instance) {
      DatabaseHealthChecker.instance = new DatabaseHealthChecker();
    }
    return DatabaseHealthChecker.instance;
  }

  /**
   * Perform comprehensive database health check
   */
  public async performHealthCheck(): Promise<DatabaseHealth> {
    const errors: string[] = [];
    const dbConnection = getDatabaseConnection();

    // Test Prisma connection
    const prismaHealth = await this.checkPrismaHealth();
    if (prismaHealth.connectionStatus !== 'healthy') {
      errors.push(`Prisma: ${prismaHealth.connectionStatus}`);
    }

    // Test PostgreSQL connection
    const postgresHealth = await this.checkPostgreSQLHealth();
    if (postgresHealth.connectionStatus !== 'healthy') {
      errors.push(`PostgreSQL: ${postgresHealth.connectionStatus}`);
    }

    // Test table accessibility
    const tablesCheck = await this.checkTablesAccessibility();
    if (!tablesCheck) {
      errors.push('Tables: Cannot access core tables');
    }

    // Test migrations status
    const migrationsCheck = await this.checkMigrationsStatus();
    if (!migrationsCheck) {
      errors.push('Migrations: Pending or failed migrations detected');
    }

    // Determine overall status
    const overallStatus = this.determineOverallStatus(
      prismaHealth,
      postgresHealth,
      errors
    );

    const health: DatabaseHealth = {
      status: overallStatus,
      prisma: prismaHealth,
      postgresql: postgresHealth,
      overall: {
        status: overallStatus,
        uptime: Date.now() - this.startTime.getTime(),
        checks: {
          connectivity: prismaHealth.connectionStatus === 'healthy' && 
                       postgresHealth.connectionStatus === 'healthy',
          latency: prismaHealth.responseTimeMs < 1000 && 
                  postgresHealth.responseTimeMs < 1000,
          tables: tablesCheck,
          migrations: migrationsCheck,
        },
        errors,
      },
    };

    this.lastHealthCheck = health;
    return health;
  }

  /**
   * Check Prisma ORM health
   */
  private async checkPrismaHealth(): Promise<HealthMetrics> {
    const startTime = Date.now();
    
    try {
      const dbConnection = getDatabaseConnection();
      const prisma = dbConnection.getPrismaClient();
      
      // Test basic query
      await prisma.$executeRaw`SELECT 1 as health_check`;
      
      const responseTime = Date.now() - startTime;
      
      return {
        responseTimeMs: responseTime,
        connectionStatus: responseTime < 1000 ? 'healthy' : 'degraded',
        lastCheckTime: new Date(),
      };
    } catch (error) {
      const responseTime = Date.now() - startTime;
      console.error('Prisma health check failed:', error);
      
      return {
        responseTimeMs: responseTime,
        connectionStatus: 'unhealthy',
        lastCheckTime: new Date(),
      };
    }
  }

  /**
   * Check PostgreSQL connection pool health
   */
  private async checkPostgreSQLHealth(): Promise<HealthMetrics> {
    const startTime = Date.now();
    
    try {
      const dbConnection = getDatabaseConnection();
      const pool = dbConnection.getPostgreSQLPool();
      
      // Test connection from pool
      const client = await dbConnection.getPostgreSQLClient();
      try {
        await client.query('SELECT 1 as health_check');
        
        const responseTime = Date.now() - startTime;
        
        return {
          responseTimeMs: responseTime,
          connectionStatus: responseTime < 1000 ? 'healthy' : 'degraded',
          activeConnections: pool.totalCount,
          totalConnections: pool.totalCount,
          lastCheckTime: new Date(),
        };
      } finally {
        client.release();
      }
    } catch (error) {
      const responseTime = Date.now() - startTime;
      console.error('PostgreSQL health check failed:', error);
      
      return {
        responseTimeMs: responseTime,
        connectionStatus: 'unhealthy',
        lastCheckTime: new Date(),
      };
    }
  }

  /**
   * Check if core tables are accessible
   */
  private async checkTablesAccessibility(): Promise<boolean> {
    try {
      const dbConnection = getDatabaseConnection();
      const prisma = dbConnection.getPrismaClient();
      
      // Test access to core tables
      await Promise.all([
        prisma.user.findFirst({ take: 1 }),
        prisma.character.findFirst({ take: 1 }),
        prisma.characterTemplate.findFirst({ take: 1 }),
        prisma.generation.findFirst({ take: 1 }),
      ]);
      
      return true;
    } catch (error) {
      console.error('Table accessibility check failed:', error);
      return false;
    }
  }

  /**
   * Check migration status
   */
  private async checkMigrationsStatus(): Promise<boolean> {
    try {
      const dbConnection = getDatabaseConnection();
      
      // Check if _prisma_migrations table exists and has entries
      const result = await dbConnection.executeRawQuery<{ applied_steps_count: number }>(
        `SELECT applied_steps_count 
         FROM _prisma_migrations 
         WHERE finished_at IS NULL 
         LIMIT 1`
      );
      
      // If no pending migrations, it's healthy
      return result.length === 0;
    } catch (error) {
      // If migrations table doesn't exist, it might be a new setup
      console.warn('Migration status check failed:', error);
      return true; // Assume healthy if we can't check
    }
  }

  /**
   * Determine overall health status
   */
  private determineOverallStatus(
    prismaHealth: HealthMetrics,
    postgresHealth: HealthMetrics,
    errors: string[]
  ): 'healthy' | 'degraded' | 'unhealthy' {
    if (errors.length === 0 && 
        prismaHealth.connectionStatus === 'healthy' && 
        postgresHealth.connectionStatus === 'healthy') {
      return 'healthy';
    }

    if (prismaHealth.connectionStatus === 'unhealthy' || 
        postgresHealth.connectionStatus === 'unhealthy') {
      return 'unhealthy';
    }

    return 'degraded';
  }

  /**
   * Start periodic health checks
   */
  public startPeriodicHealthChecks(intervalMs = 30000): void {
    if (this.healthCheckInterval) {
      clearInterval(this.healthCheckInterval);
    }

    this.healthCheckInterval = setInterval(async () => {
      try {
        await this.performHealthCheck();
      } catch (error) {
        console.error('Periodic health check failed:', error);
      }
    }, intervalMs);

    console.log(`Started periodic database health checks every ${intervalMs / 1000}s`);
  }

  /**
   * Stop periodic health checks
   */
  public stopPeriodicHealthChecks(): void {
    if (this.healthCheckInterval) {
      clearInterval(this.healthCheckInterval);
      this.healthCheckInterval = null;
      console.log('Stopped periodic database health checks');
    }
  }

  /**
   * Get last health check result
   */
  public getLastHealthCheck(): DatabaseHealth | null {
    return this.lastHealthCheck;
  }

  /**
   * Quick connectivity check
   */
  public async quickHealthCheck(): Promise<boolean> {
    try {
      const dbConnection = getDatabaseConnection();
      return await dbConnection.testConnection();
    } catch (error) {
      console.error('Quick health check failed:', error);
      return false;
    }
  }

  /**
   * Get database statistics
   */
  public async getDatabaseStats(): Promise<{
    userCount: number;
    characterCount: number;
    templateCount: number;
    generationCount: number;
    recentActivity: {
      usersToday: number;
      charactersToday: number;
      generationsToday: number;
    };
  }> {
    try {
      const dbConnection = getDatabaseConnection();
      const prisma = dbConnection.getPrismaClient();
      
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      const [
        userCount,
        characterCount,
        templateCount,
        generationCount,
        usersToday,
        charactersToday,
        generationsToday,
      ] = await Promise.all([
        prisma.user.count(),
        prisma.character.count(),
        prisma.characterTemplate.count(),
        prisma.generation.count(),
        prisma.user.count({ where: { createdAt: { gte: today } } }),
        prisma.character.count({ where: { createdAt: { gte: today } } }),
        prisma.generation.count({ where: { createdAt: { gte: today } } }),
      ]);

      return {
        userCount,
        characterCount,
        templateCount,
        generationCount,
        recentActivity: {
          usersToday,
          charactersToday,
          generationsToday,
        },
      };
    } catch (error) {
      console.error('Failed to get database stats:', error);
      throw error;
    }
  }
}

// Factory function for easier usage
export const createDatabaseHealthChecker = (): DatabaseHealthChecker => {
  return DatabaseHealthChecker.getInstance();
};

// Default instance
export const getDatabaseHealthChecker = (): DatabaseHealthChecker => {
  return DatabaseHealthChecker.getInstance();
};

// Export the class and types
export { DatabaseHealthChecker };
export type { DatabaseHealth, HealthMetrics };