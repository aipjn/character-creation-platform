# Database Layer

This directory contains the database layer implementation for the Character Creation Platform.

## Architecture Overview

The database layer follows a clean architecture pattern with:

- **Configuration** (`src/config/database.ts`): Database connection and setup utilities
- **Models** (`src/models/`): Data access layer with business logic
- **Schema** (`prisma/schema.prisma`): Prisma schema definition
- **Migrations** (`migrations/`): Database migration files
- **Scripts** (`src/scripts/`): Utility scripts for setup and testing

## Database Schema

### Core Entities

1. **Users** - User accounts and subscription management
2. **Characters** - Generated character data and metadata
3. **Generations** - Generation request tracking and status
4. **Character Templates** - Predefined character templates

### Key Features

- **Subscription Management** - Free/Premium/Pro tiers with quota tracking
- **Generation Tracking** - Complete generation workflow from request to completion  
- **Public Gallery** - Characters can be marked public for community sharing
- **Tagging System** - Flexible tagging for character organization and search
- **Audit Trail** - Creation and modification timestamps on all entities

## Getting Started

### Prerequisites

- Node.js 18+
- PostgreSQL 15+
- Docker (optional)

### Quick Setup

```bash
# 1. Copy environment variables
cp .env.example .env

# 2. Start database (if using Docker)
docker-compose up -d postgres

# 3. Run complete database setup
npm run db:setup

# 4. Verify setup
npm run db:test
```

### Manual Setup

```bash
# Generate Prisma client
npm run db:generate

# Push schema to database
npm run db:push

# Seed initial data
npm run db:seed

# Test connection
npm run db:test
```

## Environment Variables

Required environment variables in `.env`:

```env
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/character_creation?schema=public"
DB_HOST=localhost
DB_PORT=5432
DB_NAME=character_creation
DB_USER=postgres
DB_PASSWORD=postgres
```

## Usage Examples

### Basic CRUD Operations

```typescript
import User from './models/User';
import Character from './models/Character';
import { SubscriptionTier, StyleType } from '@prisma/client';

// Create a user
const user = await User.create({
  email: 'user@example.com',
  name: 'John Doe',
  subscriptionTier: SubscriptionTier.FREE,
});

// Create a character
const character = await Character.create({
  user: { connect: { id: user.id } },
  name: 'My Character',
  prompt: 'A heroic warrior',
  styleType: StyleType.FANTASY,
  tags: ['warrior', 'hero'],
});

// Query characters by user
const userCharacters = await Character.findByUserId(user.id);
```

### Advanced Queries

```typescript
// Search public characters
const searchResults = await Character.findPublicCharacters({
  search: 'warrior',
  styleType: StyleType.FANTASY,
  tags: ['hero'],
  take: 10,
});

// Get character statistics
const stats = await Character.getCharacterStats(user.id);

// Check user quota
const quotaExceeded = await User.checkDailyQuotaExceeded(user.id);
```

## Database Management

### Development

```bash
# Open Prisma Studio
npm run db:studio

# Reset database
npx prisma db push --force-reset

# View database logs
docker-compose logs postgres
```

### Production

```bash
# Deploy migrations
npx prisma migrate deploy

# Generate client
npx prisma generate

# Backup database
pg_dump $DATABASE_URL > backup.sql
```

## Performance Considerations

### Indexes

Key indexes are created for:
- User lookups (email, auth0_id)
- Character queries (user_id, style_type, public status)
- Generation queue processing (status, created_at)
- Tag-based searches (GIN indexes on arrays)

### Connection Pooling

- Prisma Client: Built-in connection pooling
- Raw queries: PostgreSQL connection pool (max 20 connections)
- Health checks: Automatic connection validation

### Query Optimization

- Use `select` to limit returned fields
- Implement pagination with `skip`/`take`
- Use `include` judiciously to avoid N+1 queries
- Monitor query performance with Prisma query logs

## Testing

The database layer includes comprehensive tests:

```bash
# Run database tests
npm run db:test

# Test specific operations
npx ts-node src/scripts/test-db.ts
```

Test coverage includes:
- Connection reliability
- CRUD operations on all models  
- Complex queries and statistics
- Error handling and edge cases

## Security

### Data Protection

- All sensitive data is properly typed
- User passwords are handled by Auth0 (not stored locally)
- Database credentials are environment-based
- Connection strings use SSL in production

### Access Control

- Model-level validation using Prisma
- Business logic enforced in model classes
- User isolation through proper foreign keys
- Audit logging for sensitive operations

## Monitoring

### Health Checks

- Database connectivity monitoring
- Connection pool status
- Query performance tracking
- Error rate monitoring

### Logging

- Development: Query logging enabled
- Production: Error and warning logs only
- Custom logging for business operations
- Structured logging format

## Troubleshooting

### Common Issues

1. **Connection Failures**
   - Check DATABASE_URL format
   - Verify PostgreSQL is running
   - Check network connectivity

2. **Migration Errors**
   - Ensure database is accessible
   - Check for schema conflicts
   - Review migration files

3. **Performance Issues**
   - Review query patterns
   - Check index usage
   - Monitor connection pool

### Debug Mode

Enable detailed logging:
```env
NODE_ENV=development
LOG_LEVEL=debug
```

## Contributing

When making database changes:

1. Update Prisma schema first
2. Generate and test migrations
3. Update model classes as needed
4. Add/update tests
5. Update documentation
6. Performance test with realistic data

## Support

For database-related issues:
- Check the logs in `docker-compose logs postgres`
- Review Prisma documentation
- Check database connection settings
- Verify environment configuration