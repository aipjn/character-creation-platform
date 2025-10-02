# Character Creation Platform - Database Design Document

## Overview

This document outlines the **actual implemented** database schema for the AI-powered character creation platform. This design is aligned with the frontend implementation and focuses on what's currently in use.

## Design Principles

- **Simplicity First**: Only implement what's actively used by the frontend
- **Data Integrity**: Foreign key constraints and validation rules
- **Performance**: Strategic indexing for query optimization
- **Frontend Alignment**: Schema matches actual API and UI requirements
- **Extensibility**: Room for future features without over-engineering

## ⚠️ Important Notes

This design reflects **what is actually implemented**, not a wishlist of features. The schema has been simplified from the original design to match the current frontend implementation.

## Database Schema Design

### 1. User Information System

#### Primary Users Table
```sql
CREATE TABLE users (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  email TEXT UNIQUE NOT NULL,
  auth0_id TEXT UNIQUE,
  username TEXT UNIQUE,
  display_name TEXT,
  avatar_url TEXT,
  
  -- Subscription and Limits
  subscription_tier TEXT DEFAULT 'FREE' 
    CHECK (subscription_tier IN ('FREE', 'PREMIUM', 'PRO', 'ENTERPRISE')),
  subscription_start_date TIMESTAMP WITH TIME ZONE,
  subscription_end_date TIMESTAMP WITH TIME ZONE,
  
  -- Daily Usage Tracking
  daily_quota INTEGER DEFAULT 3 NOT NULL,
  daily_used INTEGER DEFAULT 0 NOT NULL,
  last_reset_date TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
  
  -- Profile Settings
  preferred_language TEXT DEFAULT 'en' CHECK (preferred_language IN ('en', 'zh', 'ja', 'ko')),
  timezone TEXT DEFAULT 'UTC',
  notification_settings JSONB DEFAULT '{"email": true, "push": false}',
  
  -- Privacy and Preferences
  profile_visibility TEXT DEFAULT 'private' 
    CHECK (profile_visibility IN ('public', 'friends', 'private')),
  allow_gallery_showcase BOOLEAN DEFAULT false,
  content_filter_level TEXT DEFAULT 'moderate'
    CHECK (content_filter_level IN ('strict', 'moderate', 'relaxed')),
  
  -- Statistics
  total_characters_created INTEGER DEFAULT 0 NOT NULL,
  total_images_generated INTEGER DEFAULT 0 NOT NULL,
  account_status TEXT DEFAULT 'active'
    CHECK (account_status IN ('active', 'suspended', 'banned', 'deleted')),
  
  -- Metadata
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
  last_login_at TIMESTAMP WITH TIME ZONE,
  email_verified_at TIMESTAMP WITH TIME ZONE,
  
  -- Constraints
  CONSTRAINT users_email_format 
    CHECK (email ~ '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$'),
  CONSTRAINT users_daily_quota_positive CHECK (daily_quota >= 0),
  CONSTRAINT users_daily_used_positive CHECK (daily_used >= 0),
  CONSTRAINT users_username_format CHECK (username ~ '^[a-zA-Z0-9_]{3,30}$')
);

-- Indexes for user table
CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_auth0_id ON users(auth0_id);
CREATE INDEX idx_users_username ON users(username);
CREATE INDEX idx_users_subscription_tier ON users(subscription_tier);
CREATE INDEX idx_users_last_login ON users(last_login_at);
CREATE INDEX idx_users_created_at ON users(created_at);
CREATE INDEX idx_users_account_status ON users(account_status);
```

#### User Profiles Extended Table
```sql
CREATE TABLE user_profiles (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  
  -- Personal Information
  first_name TEXT,
  last_name TEXT,
  bio TEXT,
  website_url TEXT,
  social_links JSONB DEFAULT '{}', -- {"twitter": "username", "instagram": "username"}
  
  -- Professional Information
  profession TEXT,
  company TEXT,
  industry TEXT,
  experience_level TEXT CHECK (experience_level IN ('beginner', 'intermediate', 'advanced', 'professional')),
  
  -- Content Creation Focus
  primary_use_case TEXT[], -- Array: ["gaming", "writing", "marketing", "education"]
  favorite_art_styles TEXT[], -- Array: ["anime", "realistic", "cartoon", "fantasy"]
  
  -- Achievements and Badges
  badges JSONB DEFAULT '[]', -- [{"type": "early_adopter", "earned_at": "2024-01-01"}]
  total_likes_received INTEGER DEFAULT 0,
  total_downloads INTEGER DEFAULT 0,
  featured_character_count INTEGER DEFAULT 0,
  
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
  
  UNIQUE(user_id)
);

CREATE INDEX idx_user_profiles_user_id ON user_profiles(user_id);
CREATE INDEX idx_user_profiles_profession ON user_profiles(profession);
CREATE INDEX idx_user_profiles_industry ON user_profiles(industry);
```

### 2. Image Generation System

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

### 3. Credit System (Simplified)

**Current Implementation:** Credits tracked directly in `users` table with daily quota system.

Frontend shows: `<span id="credits-count">0</span> Credits`

The credit system is **simplified** compared to original design:

#### Users Table (includes credit fields)
```sql
-- Credit-related fields in users table:
daily_quota INTEGER DEFAULT 3,           -- Daily generation limit
daily_used INTEGER DEFAULT 0,            -- How many used today
total_generated INTEGER DEFAULT 0,       -- Lifetime count
last_reset_date TIMESTAMP,               -- When quota resets
```

**Why simplified:**
- ✅ Frontend only shows daily quota, not complex credit balance
- ✅ No marketplace, gifting, or referral system implemented
- ✅ No reserved balance needed (synchronous generation)
- ❌ Future expansion may need separate `user_credits` table

#### ❌ Removed Complex Credit Tables

The following tables from the original design are **NOT implemented**:

- ❌ `credit_transactions` - No transaction history tracking yet
- ❌ `api_credit_configs` - No per-endpoint credit costs configured
- ❌ `credit_packages` - No credit purchase system implemented
- ❌ `user_credits` - Credits tracked in `users` table instead

**Rationale:**
- Frontend doesn't display transaction history
- No payment integration implemented
- No credit marketplace features
- Simpler is better for MVP

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
1. `users` - User accounts with daily quota
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