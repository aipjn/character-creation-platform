# Database Documentation

**Project:** Character Creation Platform
**Last Updated:** 2025-10-02

---

## 📚 Documentation Structure

The database design is organized into focused documents for easy navigation:

### 1. [DATABASE_DESIGN.md](./DATABASE_DESIGN.md)
**Main Schema - Character Generation System**

Contains schema for:
- ✅ `characters` - Character data with images
- ✅ `character_themes` - Theme organization
- ✅ `theme_variants` - Variation images
- ✅ `generations` - Generation tracking
- ⚠️ `character_collections` - Future feature

**Read this if you need to:**
- Understand character data structure
- Implement themes/variants API
- Query character-related data

---

### 2. [AUTH_AND_CREDITS_SCHEMA.md](./AUTH_AND_CREDITS_SCHEMA.md)
**User Authentication & Credit System**

Contains schema for:
- ✅ `users` - User accounts & Auth0 integration
- ✅ Daily quota system (simplified credits)
- ⚠️ `user_profiles` - Extended profiles (optional)

**Read this if you need to:**
- Implement user authentication
- Manage daily quotas
- Understand subscription tiers

---

### 3. [SCHEMA_ALIGNMENT_REPORT.md](./SCHEMA_ALIGNMENT_REPORT.md)
**What Changed from Original Design**

Contains:
- 🔴 Critical issues found (missing themes tables!)
- ✅ What was added
- ❌ What was removed (over-engineering)
- 📊 Before/after comparison table

**Read this if you need to:**
- Understand why changes were made
- See original design vs current implementation
- Know what was simplified

---

## 🚀 Quick Start

### For New Developers

1. **Read this order:**
   - Start with [SCHEMA_ALIGNMENT_REPORT.md](./SCHEMA_ALIGNMENT_REPORT.md) - Understand the context
   - Then [DATABASE_DESIGN.md](./DATABASE_DESIGN.md) - Learn character system
   - Then [AUTH_AND_CREDITS_SCHEMA.md](./AUTH_AND_CREDITS_SCHEMA.md) - Learn auth system

2. **Apply migrations:**
   ```bash
   npx prisma migrate dev --name add_themes_and_variants
   npx prisma generate
   ```

3. **Test database:**
   ```bash
   npm run test:db
   ```

---

### For API Developers

**Character operations:**
```
POST   /api/v1/characters              - Create character
GET    /api/v1/characters              - List user's characters
GET    /api/v1/characters/:id          - Get character details
DELETE /api/v1/characters/:id          - Delete character
```

**Theme operations (NEW - need to implement):**
```
GET    /api/v1/characters/:id/themes   - List themes
POST   /api/v1/themes                  - Create theme
GET    /api/v1/themes/:id              - Get theme with variants
POST   /api/v1/themes/:id/variants     - Add variant
PATCH  /api/v1/themes/:id              - Rename theme
```

**User operations:**
```
GET    /api/v1/users/me                - Get current user
GET    /api/v1/users/quota             - Get quota status
```

---

## 📊 Schema Overview

### Core Tables (Active)

| Table | Status | Purpose |
|-------|--------|---------|
| `users` | ✅ Active | User accounts, auth, quotas |
| `characters` | ✅ Active | Character base data |
| `character_themes` | ✅ **NEW** | Theme organization |
| `theme_variants` | ✅ **NEW** | Variant images |
| `generations` | ✅ Active | Generation history |

### Future Tables (Schema exists, not used yet)

| Table | Status | Purpose |
|-------|--------|---------|
| `character_collections` | ⚠️ Ready | Project collections |
| `character_collection_items` | ⚠️ Ready | Collection membership |
| `scenes` | ⚠️ Ready | Scene compositions |
| `scene_characters` | ⚠️ Ready | Characters in scenes |

### Removed Tables (Over-engineered)

| Table | Status | Reason |
|-------|--------|--------|
| `generation_jobs` | ❌ Removed | Synchronous generation |
| `credit_transactions` | ❌ Removed | No transaction history yet |
| `api_credit_configs` | ❌ Removed | Simple quota only |
| `user_activity_logs` | ❌ Removed | No analytics yet |

---

## 🔧 Database Technology Stack

- **Database:** PostgreSQL 14+
- **ORM:** Prisma 5.x
- **Migration Tool:** Prisma Migrate
- **Schema Language:** Prisma Schema + SQL

---

## 🐛 Troubleshooting

### Common Issues

**Issue:** Migration fails with "relation already exists"
```bash
# Reset database (development only!)
npx prisma migrate reset

# Or skip existing migrations
npx prisma migrate resolve --applied <migration_name>
```

**Issue:** Prisma Client out of sync
```bash
# Regenerate Prisma Client
npx prisma generate

# Check schema is valid
npx prisma validate
```

**Issue:** Can't connect to database
```bash
# Check environment variable
echo $DATABASE_URL

# Test connection
npx prisma db pull
```

---

## 📖 Related Documentation

**Project Docs:**
- [API_DOCUMENTATION.md](../API_DOCUMENTATION.md) - API endpoints
- [AUTH0_SETUP.md](../AUTH0_SETUP.md) - Auth0 configuration
- [CLAUDE.md](../CLAUDE.md) - Development rules

**Prisma Docs:**
- Schema reference: https://pris.ly/d/prisma-schema
- Migration guide: https://pris.ly/d/migrate
- Query reference: https://pris.ly/d/prisma-client

---

## 🎯 Next Steps

### Critical (Block frontend features)
- [ ] Apply migrations for themes tables
- [ ] Implement themes API endpoints
- [ ] Test theme creation from frontend

### Important (Improve UX)
- [ ] Add database indexes for performance
- [ ] Implement quota reset cron job
- [ ] Add database backup strategy

### Future (Nice to have)
- [ ] Implement collections feature
- [ ] Add analytics tables
- [ ] Implement credit purchase system

---

## 📝 Change Log

### 2025-10-02 - v2.0 (Frontend-Aligned)
- ✅ Added `character_themes` table
- ✅ Added `theme_variants` table
- ✅ Added `description` field to characters
- ✅ Added `imageUrl` field to characters
- ✅ Simplified generation tracking
- ✅ Simplified credit system
- ✅ Split documentation into focused files
- ❌ Removed over-engineered features

### 2024-09-14 - v1.0 (Initial Design)
- Initial database schema
- Complex generation queue
- Complex credit system
- Analytics tables

---

**Maintained by:** Development Team
**Questions?** Check [SCHEMA_ALIGNMENT_REPORT.md](./SCHEMA_ALIGNMENT_REPORT.md) first
