# Database Layer - Updated Documentation

This directory contains the enhanced database layer implementation for the Character Creation Platform.

## New Architecture Overview

The database layer follows a clean architecture pattern with enhanced connection management and health monitoring:

- **Legacy Configuration** (`src/config/database.ts`): Original database connection utilities
- **Connection Management** (`src/database/connection.ts`): **NEW** - Centralized database connection handling with pooling
- **Health Monitoring** (`src/database/health.ts`): **NEW** - Comprehensive database health checks and monitoring
- **Seeding System** (`src/seeds/`): **NEW** - Database seeding system for development and testing data
- **Models** (`src/models/`): Data access layer with business logic
- **Schema** (`prisma/schema.prisma`): Prisma schema definition
- **Migrations** (`migrations/`): Database migration files

## New Database Connection Management

### Connection Class Features

The new `DatabaseConnection` class provides:

- **Singleton Pattern**: Single instance per application
- **Connection Pooling**: Both Prisma and raw PostgreSQL connections
- **Health Monitoring**: Built-in connection testing
- **Retry Logic**: Automatic connection retry with exponential backoff
- **Graceful Shutdown**: Proper cleanup on application termination
- **Transaction Support**: Easy transaction handling

### Usage Examples

```typescript
import { getDatabaseConnection } from './database/connection';

// Get database connection instance
const dbConnection = getDatabaseConnection();

// Get Prisma client with connection pooling
const prisma = dbConnection.getPrismaClient();

// Connect with retry logic
await dbConnection.connect();

// Execute transactions safely
const result = await dbConnection.transaction(async (tx) => {
  const user = await tx.user.create({ data: { email: 'test@example.com' } });
  const character = await tx.character.create({ 
    data: { userId: user.id, prompt: 'A hero', name: 'Hero' }
  });
  return { user, character };
});

// Execute raw SQL with connection pooling
const results = await dbConnection.executeRawQuery(
  'SELECT style_type, COUNT(*) as count FROM characters GROUP BY style_type',
  []
);

// Test connection
const isHealthy = await dbConnection.testConnection();

// Graceful shutdown
await dbConnection.disconnect();
```

## Health Monitoring System

### Health Checker Features

The new `DatabaseHealthChecker` provides:

- **Comprehensive Health Checks**: Tests both Prisma and PostgreSQL connections
- **Performance Monitoring**: Response time tracking
- **Table Accessibility**: Validates core table access
- **Migration Status**: Checks for pending migrations
- **Periodic Monitoring**: Automatic background health checks
- **Detailed Metrics**: Connection pool statistics and error tracking

### Health Check Usage

```typescript
import { getDatabaseHealthChecker } from './database/health';

const healthChecker = getDatabaseHealthChecker();

// Perform comprehensive health check
const health = await healthChecker.performHealthCheck();
console.log('Overall status:', health.overall.status);
console.log('Prisma response time:', health.prisma.responseTimeMs + 'ms');
console.log('PostgreSQL active connections:', health.postgresql.activeConnections);

// Start periodic monitoring (every 30 seconds)
healthChecker.startPeriodicHealthChecks(30000);

// Quick connectivity check
const isConnected = await healthChecker.quickHealthCheck();

// Get database statistics
const stats = await healthChecker.getDatabaseStats();
console.log('Total users:', stats.userCount);
console.log('Users created today:', stats.recentActivity.usersToday);

// Stop monitoring
healthChecker.stopPeriodicHealthChecks();
```

### Health Status Response

```typescript
interface DatabaseHealth {
  status: 'healthy' | 'degraded' | 'unhealthy';
  prisma: {
    responseTimeMs: number;
    connectionStatus: 'healthy' | 'degraded' | 'unhealthy';
    lastCheckTime: Date;
  };
  postgresql: {
    responseTimeMs: number;
    connectionStatus: 'healthy' | 'degraded' | 'unhealthy';
    activeConnections?: number;
    totalConnections?: number;
    lastCheckTime: Date;
  };
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
```

## Database Seeding System

### Seeding Features

The new seeding system provides:

- **Environment-Aware**: Different seeds for development/production/test
- **Idempotent**: Safe to run multiple times
- **Transactional**: All-or-nothing seeding
- **Comprehensive Data**: Character templates, users, and sample characters
- **Flexible Options**: Force overwrite, verbose logging

### Available Seeds

1. **Character Templates**: 10 predefined character templates covering all style types
2. **Development Users**: 5 test users with different subscription tiers
3. **Sample Characters**: 8 example characters with various statuses

### Seeding Usage

```bash
# Command line usage
npx ts-node src/seeds/index.ts --env=development --force --verbose

# Clear existing data
npx ts-node src/seeds/index.ts --clear --env=development
```

```typescript
// Programmatic usage
import { seedDatabase, clearSeedData } from './seeds';

// Seed development data
await seedDatabase({ 
  environment: 'development', 
  force: true, 
  verbose: true 
});

// Clear seed data
await clearSeedData({ environment: 'development' });
```

### Seed Data Details

#### Character Templates
- **Fantasy Warrior**: Complete armor and weapon setup
- **Cyberpunk Hacker**: Futuristic tech aesthetic
- **Anime Schoolgirl**: Traditional Japanese school style
- **Steampunk Inventor**: Victorian-era mechanical theme
- **Realistic Portrait**: Professional photography style
- **Cartoon Hero**: Comic book superhero design
- **Minimalist Avatar**: Clean geometric design
- **Fantasy Mage**: Magical spellcaster theme
- **Space Explorer**: Sci-fi astronaut design
- **Viking Berserker**: Norse warrior aesthetic

#### Development Users
- **Admin User**: PRO tier, 50 daily quota
- **Premium Tester**: PREMIUM tier, 15 daily quota  
- **Free User**: FREE tier, 3 daily quota
- **Test Users**: Various subscription levels for testing

## Setup and Configuration

### Environment Variables

```env
# Required
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/character_creation?schema=public"

# Optional - Connection Pool Settings
DB_MAX_CONNECTIONS=20
DB_CONNECTION_TIMEOUT_MS=2000
DB_IDLE_TIMEOUT_MS=30000
DB_RETRY_ATTEMPTS=5
DB_RETRY_DELAY_MS=5000
```

### Quick Setup with New Tools

```bash
# 1. Setup database connection
npm install

# 2. Generate Prisma client  
npx prisma generate

# 3. Push schema to database
npx prisma db push

# 4. Seed initial data with new system
npx ts-node src/seeds/index.ts --env=development --verbose

# 5. Test connection and health
npx ts-node -e "
import { getDatabaseConnection, getDatabaseHealthChecker } from './src/database';
(async () => {
  const db = getDatabaseConnection();
  await db.connect();
  const health = await getDatabaseHealthChecker().performHealthCheck();
  console.log('Health:', health.overall.status);
  await db.disconnect();
})();
"
```

## Migration Management

### Creating Migrations

```bash
# Create new migration
npx prisma migrate dev --name add_new_feature

# Reset database (development only)
npx prisma migrate reset

# Deploy migrations (production)
npx prisma migrate deploy
```

### Migration Best Practices

1. **Always test migrations** on development data first
2. **Backup production database** before major migrations
3. **Use transactions** for complex multi-step migrations
4. **Test rollback scenarios** when possible
5. **Monitor health checks** during migration deployment

## Performance Optimization

### Connection Pooling

- **Prisma Client**: Built-in connection pooling with query optimization
- **PostgreSQL Pool**: Raw connection pooling for complex queries (max 20 connections)
- **Health Monitoring**: Automatic detection of pool exhaustion

### Query Optimization

```typescript
// Use the new connection system for optimized queries
const dbConnection = getDatabaseConnection();

// Efficient pagination
const characters = await prisma.character.findMany({
  skip: page * limit,
  take: limit,
  select: { id: true, name: true, thumbnailUrl: true }, // Only needed fields
  where: { isPublic: true },
  orderBy: { createdAt: 'desc' },
});

// Raw query with connection pooling for analytics
const styleStats = await dbConnection.executeRawQuery(`
  SELECT style_type, COUNT(*) as count, AVG(EXTRACT(EPOCH FROM (updated_at - created_at))) as avg_generation_time
  FROM characters 
  WHERE generation_status = 'COMPLETED' 
  GROUP BY style_type
`);
```

## Monitoring and Troubleshooting

### Health Monitoring

```typescript
// Setup comprehensive monitoring
const healthChecker = getDatabaseHealthChecker();

// Monitor in production
healthChecker.startPeriodicHealthChecks(60000); // Every minute

// Handle health alerts
setInterval(async () => {
  const health = await healthChecker.getLastHealthCheck();
  if (health?.overall.status === 'unhealthy') {
    console.error('Database unhealthy:', health.overall.errors);
    // Send alert to monitoring system
  }
}, 30000);
```

### Debug Information

```typescript
// Get detailed database information
const stats = await healthChecker.getDatabaseStats();
const health = await healthChecker.performHealthCheck();

console.log({
  stats,
  health,
  connectionStatus: dbConnection.isConnectedToDatabase(),
  uptime: health.overall.uptime,
});
```

## Integration with Existing Code

### Migrating from Legacy Connection

```typescript
// Old way (still works)
import { getPrismaClient } from '../config/database';
const prisma = getPrismaClient();

// New way (recommended)
import { getDatabaseConnection } from './database/connection';
const dbConnection = getDatabaseConnection();
const prisma = dbConnection.getPrismaClient();

// Benefits of new approach:
// - Better error handling
// - Connection pooling
// - Health monitoring
// - Transaction support
// - Graceful shutdown
```

### Adding Health Checks to APIs

```typescript
// Add to your Express app
app.get('/api/health', async (req, res) => {
  const healthChecker = getDatabaseHealthChecker();
  const health = await healthChecker.performHealthCheck();
  
  res.status(health.overall.status === 'healthy' ? 200 : 503).json({
    status: health.overall.status,
    database: {
      prisma: health.prisma.connectionStatus,
      postgresql: health.postgresql.connectionStatus,
      responseTime: Math.max(health.prisma.responseTimeMs, health.postgresql.responseTimeMs),
    },
    uptime: health.overall.uptime,
    checks: health.overall.checks,
  });
});
```

## Testing

### Test Database Setup

```typescript
// Test configuration with new connection system
import { createDatabaseConnection } from './database/connection';

const testDbConnection = createDatabaseConnection({
  url: process.env.TEST_DATABASE_URL,
  maxConnections: 5,
  retryAttempts: 3,
});

beforeAll(async () => {
  await testDbConnection.connect();
});

afterAll(async () => {
  await testDbConnection.disconnect();
});
```

## Future Enhancements

### Planned Features

1. **Database Metrics Dashboard**: Web interface for health monitoring
2. **Connection Pool Analytics**: Detailed pool usage statistics
3. **Query Performance Insights**: Slow query detection and optimization
4. **Automated Backup System**: Scheduled database backups
5. **Migration Rollback Tools**: Safe migration reversal capabilities

### Contributing

When working with the new database layer:

1. **Use the new connection system** for all new code
2. **Add health checks** for new database operations
3. **Update seeds** when adding new data types
4. **Test connection handling** in error scenarios
5. **Document performance implications** of new queries

This enhanced database layer provides production-ready reliability, monitoring, and development tooling for the Character Creation Platform.