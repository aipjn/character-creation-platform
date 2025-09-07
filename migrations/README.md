# Database Migrations

This directory contains database migration files for the Character Creation Platform.

## Migration Strategy

We use Prisma for schema management and migrations. Prisma automatically generates migrations based on schema changes.

## Development Workflow

1. **Make schema changes** in `prisma/schema.prisma`
2. **Generate migration**: `npm run db:migrate`
3. **Apply to database**: Migrations are automatically applied when generated
4. **Update Prisma client**: `npm run db:generate`

## Production Deployment

1. **Generate migrations** in development/staging
2. **Commit migration files** to version control
3. **Apply migrations** in production: `npx prisma migrate deploy`

## Manual Migration Files

For complex database operations that require custom SQL, you can create manual migration files here following this naming convention:

```
YYYY-MM-DD_HHMMSS_description.sql
```

Example: `2024-01-15_143000_add_user_indexes.sql`

## Common Migration Operations

### Adding Indexes
```sql
-- Add index for faster user lookups
CREATE INDEX CONCURRENTLY idx_users_email ON users(email);
CREATE INDEX CONCURRENTLY idx_characters_user_id ON characters(user_id);
CREATE INDEX CONCURRENTLY idx_characters_style_type ON characters(style_type);
```

### Adding Constraints
```sql
-- Add check constraint for daily quota
ALTER TABLE users ADD CONSTRAINT chk_daily_quota_positive CHECK (daily_quota > 0);
```

### Data Migration
```sql
-- Migrate existing data when adding new columns
UPDATE characters SET generation_status = 'COMPLETED' WHERE generation_status IS NULL;
```

## Rollback Strategy

Prisma migrations can be rolled back using:
```bash
npx prisma migrate reset  # Resets entire database (development only)
```

For production rollbacks, maintain manual rollback scripts for each migration.

## Best Practices

1. **Always test migrations** on a copy of production data
2. **Use transactions** for multiple related operations
3. **Create indexes concurrently** to avoid locking
4. **Plan for downtime** during major schema changes
5. **Backup before migrations** in production