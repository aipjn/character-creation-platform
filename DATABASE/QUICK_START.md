# Database Quick Start Guide

**Status:** ✅ **Database initialized and ready**

---

## 🚀 Quick Commands

### Check Database Status
```bash
# Test connection
node test-db-connection.js

# Browse database visually
npx prisma studio
# Opens at http://localhost:5555
```

### Query Database
```bash
# Connect to database
psql postgresql://h0270@localhost:5432/character_creator_dev

# List all tables
\dt

# View table structure
\d characters
\d character_themes
\d theme_variants

# Count records
SELECT 'users' as table, COUNT(*) FROM users
UNION ALL SELECT 'characters', COUNT(*) FROM characters
UNION ALL SELECT 'themes', COUNT(*) FROM character_themes
UNION ALL SELECT 'variants', COUNT(*) FROM theme_variants;

# Exit
\q
```

---

## 📊 Current Database State

### Tables Created (12)
- ✅ users
- ✅ characters
- ✅ character_themes (**NEW**)
- ✅ theme_variants (**NEW**)
- ✅ generations
- ✅ character_collections
- ✅ character_collection_items
- ✅ character_templates
- ✅ scenes
- ✅ scene_characters
- ✅ scene_generations
- ✅ _prisma_migrations

### Test Data
```
User:      test@example.com (Test User)
Character: Hero Knight
Theme:     Battle Poses
Variant:   Knight swinging sword in action pose
```

---

## 🔧 Common Operations

### Create New Migration
```bash
# After modifying prisma/schema.prisma
npx prisma migrate dev --name your_migration_name
npx prisma generate
```

### Reset Database (Dev only!)
```bash
npx prisma migrate reset
```

### Seed Database
```bash
npx prisma db seed
```

---

## 🐛 Troubleshooting

### Can't connect to database
```bash
# Check PostgreSQL is running
psql postgres -c "SELECT version();"

# Check .env has correct DATABASE_URL
cat .env | grep DATABASE_URL
```

### Migration fails
```bash
# Check existing migrations
npx prisma migrate status

# Resolve failed migration
npx prisma migrate resolve --applied <migration_name>

# Or reset and re-run (dev only!)
npx prisma migrate reset
```

### Prisma Client out of sync
```bash
npx prisma generate
```

---

## 📚 Documentation

- [INITIALIZATION_SUCCESS.md](./INITIALIZATION_SUCCESS.md) - Full setup report
- [DATABASE_DESIGN.md](./DATABASE_DESIGN.md) - Schema documentation
- [AUTH_AND_CREDITS_SCHEMA.md](./AUTH_AND_CREDITS_SCHEMA.md) - User & credits
- [README.md](./README.md) - Complete index

---

## ✅ What's Working

- [x] Database created and connected
- [x] All tables initialized
- [x] Prisma Client generated
- [x] Test data created
- [x] Relationships verified
- [x] Queries working
- [ ] **Next: Implement themes API**

---

**Quick test:** `node test-db-connection.js`
