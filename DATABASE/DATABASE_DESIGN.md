# Character Creation Platform - Database Design Document

**Version:** 2.0 (Frontend-Aligned)
**Last Updated:** 2025-10-02

---

## 📚 Documentation Index

This database design is split into focused documents:

1. **[DATABASE_DESIGN.md](./DATABASE_DESIGN.md)** (this file) - Character generation system
2. **[AUTH_AND_CREDITS_SCHEMA.md](./AUTH_AND_CREDITS_SCHEMA.md)** - User auth & credit system
3. **[SCHEMA_ALIGNMENT_REPORT.md](./SCHEMA_ALIGNMENT_REPORT.md)** - What changed from original design

---

## Overview

This document outlines the **character generation system** schema for the AI-powered character creation platform. This design is aligned with the frontend implementation and focuses on what's currently in use.

## Design Principles

- **Simplicity First**: Only implement what's actively used by the frontend
- **Data Integrity**: Foreign key constraints and validation rules
- **Performance**: Strategic indexing for query optimization
- **Frontend Alignment**: Schema matches actual API and UI requirements
- **Extensibility**: Room for future features without over-engineering

## ⚠️ Important Notes

This design reflects **what is actually implemented**, not a wishlist of features. The schema has been simplified from the original design to match the current frontend implementation.

## Database Schema Design

> **Note:** User authentication and credit system schemas have been moved to [AUTH_AND_CREDITS_SCHEMA.md](./AUTH_AND_CREDITS_SCHEMA.md)

### Core Tables Overview

This document focuses on the **character generation system** - the core functionality of the platform:

1. **Characters** - Base character data with images
2. **Character Themes** - Theme-based organization
3. **Theme Variants** - Individual variation images
4. **Generations** - Generation history tracking
5. **Collections** - Project organization (future)

---

## 1. Character Generation System

#### Characters Table (Simplified & Aligned with Frontend)
```sql
CREATE TABLE characters (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,

  -- Basic Character Information (Frontend uses these)
  name TEXT,
  description TEXT,                     -- User's original input description
  prompt TEXT NOT NULL,                 -- AI-optimized prompt for generation

  -- Style (Frontend uses this)
  style_type TEXT DEFAULT 'realistic' CHECK (style_type IN (
    'realistic', 'anime', 'cartoon', 'fantasy', 'cyberpunk', 'vintage', 'minimalist'
  )),

  -- Images (Frontend uses these)
  s3_url TEXT,                          -- Legacy field, may contain S3 URL
  image_url TEXT,                       -- Direct image URL
  thumbnail_url TEXT,                   -- Thumbnail for gallery display
  reference_image_url TEXT,             -- Reference image if provided

  -- Metadata & Tags (Frontend uses these)
  metadata JSONB DEFAULT '{}',          -- Stores conversationId, gender, artStyle, etc.
  tags TEXT[] DEFAULT '{}',

  -- Character Attributes (Frontend displays these)
  age TEXT,
  gender TEXT,
  occupation TEXT,
  personality TEXT[],
  physical_traits JSONB,                -- Height, build, hair, eyes, etc.
  clothing TEXT,
  background TEXT,                      -- Character backstory

  -- Status Flags (Frontend uses these)
  is_public BOOLEAN DEFAULT false,
  is_favorite BOOLEAN DEFAULT false,
  is_in_library BOOLEAN DEFAULT false,
  generation_status TEXT DEFAULT 'pending' CHECK (generation_status IN (
    'pending', 'processing', 'completed', 'failed'
  )),

  -- Timestamps
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
);

-- Essential Indexes
CREATE INDEX idx_characters_user_id ON characters(user_id);
CREATE INDEX idx_characters_style_type ON characters(style_type);
CREATE INDEX idx_characters_generation_status ON characters(generation_status);
CREATE INDEX idx_characters_created_at ON characters(created_at DESC);
CREATE INDEX idx_characters_tags ON characters USING GIN(tags);
```

**Removed from original design:**
- ❌ `negative_prompt` - Not used by frontend
- ❌ `cfg_scale`, `steps`, `sampler` - Advanced parameters not exposed in UI
- ❌ `collection_id` - Collections feature not implemented yet
- ❌ Engagement metrics (views, likes, downloads) - Not implemented
- ❌ Versioning fields - Replaced by theme variants system

#### ✅ **NEW: Character Themes & Variants** (Required by Frontend!)

The frontend has a complete theme/variants system that was missing from the database:

```sql
CREATE TABLE character_themes (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  character_id TEXT NOT NULL REFERENCES characters(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,

  UNIQUE(character_id, name)
);

CREATE INDEX idx_character_themes_character_id ON character_themes(character_id);

CREATE TABLE theme_variants (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  theme_id TEXT NOT NULL REFERENCES character_themes(id) ON DELETE CASCADE,
  character_id TEXT NOT NULL REFERENCES characters(id) ON DELETE CASCADE,

  -- Variant Information
  prompt TEXT NOT NULL,                 -- The edit instruction used (e.g., "make them smile")
  image_url TEXT,
  thumbnail_url TEXT,
  metadata JSONB DEFAULT '{}',

  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
);

CREATE INDEX idx_theme_variants_theme_id ON theme_variants(theme_id);
CREATE INDEX idx_theme_variants_character_id ON theme_variants(character_id);
CREATE INDEX idx_theme_variants_created_at ON theme_variants(created_at DESC);
```

**Why these tables are critical:**
- ✅ Frontend's edit page allows users to create themed variations
- ✅ Gallery displays themes with variant counts
- ✅ Users can organize variations by theme (e.g., "Winter Outfits", "Action Poses")
- ✅ These tables were **completely missing** from original design

#### Generation Jobs Table (Simplified)

Frontend generates synchronously, so we don't need complex queue management:

```sql
CREATE TABLE generations (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  character_id TEXT REFERENCES characters(id) ON DELETE SET NULL,

  -- Generation Info
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed', 'failed')),
  batch_size INTEGER DEFAULT 1,
  prompt TEXT NOT NULL,
  style_type TEXT DEFAULT 'realistic',

  -- Results
  error_message TEXT,
  completed_at TIMESTAMP WITH TIME ZONE,

  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
);

CREATE INDEX idx_generations_user_id ON generations(user_id);
CREATE INDEX idx_generations_character_id ON generations(character_id);
CREATE INDEX idx_generations_status ON generations(status);
```

**Removed from original design:**
- ❌ Complex queue priority system - Frontend doesn't need it
- ❌ Multiple generation providers - Single provider (Gemini)
- ❌ GPU/memory tracking - Not exposed to users
- ❌ Cost per job tracking - Tracked at user level instead

#### Collections Table (⚠️ Not Yet Implemented in Frontend)

```sql
-- Character Collections - FUTURE FEATURE
-- Frontend doesn't have this yet, but keeping schema for future implementation

CREATE TABLE character_collections (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  is_public BOOLEAN DEFAULT false,
  cover_image_url TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
);

CREATE TABLE character_collection_items (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  collection_id TEXT NOT NULL REFERENCES character_collections(id) ON DELETE CASCADE,
  character_id TEXT NOT NULL REFERENCES characters(id) ON DELETE CASCADE,
  added_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,

  UNIQUE(collection_id, character_id)
);

CREATE INDEX idx_character_collections_user_id ON character_collections(user_id);
CREATE INDEX idx_collection_items_character_id ON character_collection_items(character_id);
```

**Status:** ⚠️ Schema exists in Prisma but not actively used by frontend yet

## 2. User & Credit System

> **📄 See detailed documentation:** [AUTH_AND_CREDITS_SCHEMA.md](./AUTH_AND_CREDITS_SCHEMA.md)

**Quick Summary:**
- User authentication via Auth0
- Simple daily quota system (no complex credits)
- Tracked in `users` table: `daily_quota`, `daily_used`, `last_reset_date`
- Frontend shows: `<span id="credits-count">0</span> Credits`

**Subscription Tiers:**
- FREE: 3 generations/day
- PREMIUM: 20 generations/day
- PRO: 100 generations/day

## ❌ Removed: Supporting Tables

The following "nice-to-have" tables are **NOT implemented**:

### User Engagement and Analytics - ❌ Not Implemented
- No activity logging system in frontend
- No analytics dashboard
- Could be added later if needed

### Feedback and Ratings - ❌ Not Implemented
- No rating/review system in frontend
- No social features implemented yet
- Could be added when building community features

## Summary: What Changed from Original Design

### ✅ Added (Critical - Frontend depends on this!)
1. **`character_themes` table** - Organize character variations by theme
2. **`theme_variants` table** - Store individual variants within themes
3. **`description` field** in characters - Store user's original input
4. **`image_url` field** in characters - Direct image URLs (not just S3)

### ❌ Removed (Over-engineered for current needs)
1. **Generation queue system** - Frontend generates synchronously
2. **Complex credit system** - Simple daily quota in users table
3. **Collections** - Schema exists but not used in frontend yet
4. **Analytics tables** - Not implemented
5. **API cost configs** - Not needed
6. **Advanced generation params** - Not exposed in UI

### 📊 Actual Core Schema

**Tables actively used by frontend:**
1. `users` - User accounts with daily quota (see [AUTH_AND_CREDITS_SCHEMA.md](./AUTH_AND_CREDITS_SCHEMA.md))
2. `characters` - Character definitions with images
3. `character_themes` - Theme organization (**NEW!**)
4. `theme_variants` - Variant images (**NEW!**)
5. `generations` - Simple generation tracking

**Tables in schema but not used yet:**
- `character_collections` - Ready for future implementation
- `character_collection_items`
- `scenes` - Scene builder not implemented
- `scene_characters`
- `scene_generations`

## Migration Guide

### If starting fresh:
```bash
# Apply the updated Prisma schema
npx prisma migrate dev --name add_themes_and_variants

# Generate Prisma Client
npx prisma generate
```

### If you have existing data:
```bash
# Create migration for new tables
npx prisma migrate dev --name add_character_themes

# Manually add description and image_url fields if needed
```

## Performance Considerations

**Essential indexes (already in schema):**
- All foreign keys indexed
- `created_at DESC` for chronological queries
- GIN indexes on `tags` arrays
- User lookup indexes

**Not needed yet:**
- Partitioning (data volume is small)
- Read replicas (single user per session)
- Complex query optimization

## Next Steps

1. ✅ **Implement themes API** - Backend endpoints for themes/variants
2. ✅ **Test theme creation** - Verify frontend can save/load themes
3. ⚠️ **Consider collections** - If users request project organization
4. ⚠️ **Add analytics** - If product metrics are needed

---

**Last Updated:** 2025-10-02
**Schema Version:** Simplified v2.0 (aligned with frontend)