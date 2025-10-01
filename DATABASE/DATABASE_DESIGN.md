# Character Creation Platform - Database Design Document

## Overview

This document outlines the complete database schema design for the AI-powered character creation platform, covering user management, image generation, and credit system.

## Design Principles

- **Data Integrity**: Foreign key constraints and validation rules
- **Performance**: Strategic indexing for query optimization
- **Scalability**: Partitioning and efficient data types
- **Auditability**: Complete transaction history and logging
- **Extensibility**: Flexible schema for future features

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

#### Characters Table
```sql
CREATE TABLE characters (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  
  -- Basic Character Information
  name TEXT NOT NULL,
  description TEXT,
  prompt TEXT NOT NULL,
  negative_prompt TEXT,
  
  -- Generation Parameters
  style_type TEXT NOT NULL CHECK (style_type IN (
    'anime', 'realistic', 'cartoon', 'fantasy', 'cyberpunk', 
    'steampunk', 'minimalist', 'comic', 'portrait', 'artistic'
  )),
  art_style TEXT,
  mood TEXT,
  color_palette TEXT[],
  
  -- Technical Parameters
  model_version TEXT DEFAULT 'v1.0',
  generation_seed INTEGER,
  cfg_scale DECIMAL(3,1) DEFAULT 7.5,
  steps INTEGER DEFAULT 20,
  sampler TEXT DEFAULT 'DPM++ 2M Karras',
  
  -- Images and Assets
  primary_image_url TEXT,
  thumbnail_url TEXT,
  additional_images JSONB DEFAULT '[]', -- Array of image URLs
  image_metadata JSONB DEFAULT '{}', -- Generation metadata, file sizes, etc.
  
  -- Status and Processing
  generation_status TEXT DEFAULT 'pending' CHECK (generation_status IN (
    'pending', 'processing', 'completed', 'failed', 'cancelled'
  )),
  processing_started_at TIMESTAMP WITH TIME ZONE,
  processing_completed_at TIMESTAMP WITH TIME ZONE,
  processing_time_seconds INTEGER,
  error_message TEXT,
  retry_count INTEGER DEFAULT 0,
  
  -- Organization and Sharing
  collection_id TEXT, -- Will reference collections table
  tags TEXT[] DEFAULT '{}',
  is_public BOOLEAN DEFAULT false,
  is_featured BOOLEAN DEFAULT false,
  allow_commercial_use BOOLEAN DEFAULT false,
  license_type TEXT DEFAULT 'standard' CHECK (license_type IN ('standard', 'commercial', 'creative_commons')),
  
  -- Engagement Metrics
  view_count INTEGER DEFAULT 0,
  like_count INTEGER DEFAULT 0,
  download_count INTEGER DEFAULT 0,
  share_count INTEGER DEFAULT 0,
  
  -- Versioning and Variants
  parent_character_id TEXT REFERENCES characters(id),
  version_number INTEGER DEFAULT 1,
  variant_type TEXT CHECK (variant_type IN ('original', 'style_transfer', 'pose_change', 'outfit_change', 'expression_change')),
  
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
  published_at TIMESTAMP WITH TIME ZONE
);

-- Indexes for characters table
CREATE INDEX idx_characters_user_id ON characters(user_id);
CREATE INDEX idx_characters_style_type ON characters(style_type);
CREATE INDEX idx_characters_generation_status ON characters(generation_status);
CREATE INDEX idx_characters_is_public ON characters(is_public) WHERE is_public = true;
CREATE INDEX idx_characters_is_featured ON characters(is_featured) WHERE is_featured = true;
CREATE INDEX idx_characters_created_at ON characters(created_at);
CREATE INDEX idx_characters_collection_id ON characters(collection_id);
CREATE INDEX idx_characters_parent_id ON characters(parent_character_id);
CREATE INDEX idx_characters_tags ON characters USING GIN(tags);
CREATE INDEX idx_characters_view_count ON characters(view_count) WHERE is_public = true;
```

#### Generation Jobs Table
```sql
CREATE TABLE generation_jobs (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  character_id TEXT REFERENCES characters(id) ON DELETE SET NULL,
  
  -- Job Configuration
  job_type TEXT NOT NULL CHECK (job_type IN (
    'character_generation', 'style_transfer', 'upscale', 'variation', 'background_removal'
  )),
  input_parameters JSONB NOT NULL,
  generation_provider TEXT DEFAULT 'primary' CHECK (generation_provider IN ('primary', 'secondary', 'fallback')),
  
  -- Processing Status
  status TEXT DEFAULT 'queued' CHECK (status IN (
    'queued', 'processing', 'completed', 'failed', 'cancelled', 'timeout'
  )),
  priority INTEGER DEFAULT 5 CHECK (priority BETWEEN 1 AND 10),
  
  -- Timing Information
  queued_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
  started_at TIMESTAMP WITH TIME ZONE,
  completed_at TIMESTAMP WITH TIME ZONE,
  timeout_at TIMESTAMP WITH TIME ZONE,
  
  -- Results and Metadata
  output_urls JSONB DEFAULT '[]',
  processing_metadata JSONB DEFAULT '{}',
  error_details JSONB,
  
  -- Resource Usage
  gpu_time_seconds INTEGER,
  memory_used_mb INTEGER,
  cost_credits INTEGER,
  
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
);

-- Indexes for generation jobs
CREATE INDEX idx_generation_jobs_user_id ON generation_jobs(user_id);
CREATE INDEX idx_generation_jobs_character_id ON generation_jobs(character_id);
CREATE INDEX idx_generation_jobs_status ON generation_jobs(status);
CREATE INDEX idx_generation_jobs_job_type ON generation_jobs(job_type);
CREATE INDEX idx_generation_jobs_queued_at ON generation_jobs(queued_at);
CREATE INDEX idx_generation_jobs_priority_status ON generation_jobs(priority, status) WHERE status IN ('queued', 'processing');
```

#### Collections Table
```sql
CREATE TABLE collections (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  
  -- Collection Information
  name TEXT NOT NULL,
  description TEXT,
  cover_image_url TEXT,
  
  -- Organization
  tags TEXT[] DEFAULT '{}',
  category TEXT,
  theme TEXT,
  
  -- Sharing and Visibility
  is_public BOOLEAN DEFAULT false,
  allow_collaboration BOOLEAN DEFAULT false,
  collaboration_settings JSONB DEFAULT '{}',
  
  -- Statistics
  character_count INTEGER DEFAULT 0,
  total_views INTEGER DEFAULT 0,
  total_likes INTEGER DEFAULT 0,
  
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
);

-- Link table for character-collection relationships
CREATE TABLE collection_characters (
  collection_id TEXT NOT NULL REFERENCES collections(id) ON DELETE CASCADE,
  character_id TEXT NOT NULL REFERENCES characters(id) ON DELETE CASCADE,
  added_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
  display_order INTEGER,
  
  PRIMARY KEY (collection_id, character_id)
);

CREATE INDEX idx_collections_user_id ON collections(user_id);
CREATE INDEX idx_collections_is_public ON collections(is_public) WHERE is_public = true;
CREATE INDEX idx_collection_characters_character_id ON collection_characters(character_id);
```

### 3. Credit System

#### User Credits Table
```sql
CREATE TABLE user_credits (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  
  -- Current Balance
  current_balance INTEGER NOT NULL DEFAULT 0,
  reserved_balance INTEGER NOT NULL DEFAULT 0, -- Credits reserved for ongoing jobs
  
  -- Daily Allowance (for subscription plans)
  daily_allowance INTEGER NOT NULL DEFAULT 0,
  daily_used INTEGER NOT NULL DEFAULT 0,
  daily_reset_date DATE NOT NULL DEFAULT CURRENT_DATE,
  
  -- Lifetime Statistics
  total_earned INTEGER NOT NULL DEFAULT 0,
  total_spent INTEGER NOT NULL DEFAULT 0,
  total_purchased INTEGER NOT NULL DEFAULT 0,
  total_gifted_received INTEGER NOT NULL DEFAULT 0,
  total_gifted_sent INTEGER NOT NULL DEFAULT 0,
  
  -- Bonus and Rewards
  referral_bonus INTEGER NOT NULL DEFAULT 0,
  achievement_bonus INTEGER NOT NULL DEFAULT 0,
  daily_login_streak INTEGER NOT NULL DEFAULT 0,
  last_daily_bonus_date DATE,
  
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
  
  UNIQUE(user_id),
  
  -- Constraints
  CONSTRAINT user_credits_balance_positive CHECK (current_balance >= 0),
  CONSTRAINT user_credits_reserved_positive CHECK (reserved_balance >= 0),
  CONSTRAINT user_credits_daily_allowance_positive CHECK (daily_allowance >= 0),
  CONSTRAINT user_credits_daily_used_positive CHECK (daily_used >= 0)
);

CREATE INDEX idx_user_credits_user_id ON user_credits(user_id);
CREATE INDEX idx_user_credits_daily_reset ON user_credits(daily_reset_date);
```

#### Credit Transactions Table
```sql
CREATE TABLE credit_transactions (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  
  -- Transaction Details
  transaction_type TEXT NOT NULL CHECK (transaction_type IN (
    'purchase', 'usage', 'refund', 'gift_sent', 'gift_received',
    'daily_allowance', 'bonus', 'referral', 'achievement', 'admin_adjustment'
  )),
  amount INTEGER NOT NULL, -- Can be negative for usage/spending
  balance_after INTEGER NOT NULL,
  
  -- Related Entities
  related_entity_type TEXT CHECK (related_entity_type IN (
    'generation_job', 'purchase_order', 'gift_transfer', 'achievement', 'referral'
  )),
  related_entity_id TEXT,
  
  -- Transaction Context
  description TEXT NOT NULL,
  metadata JSONB DEFAULT '{}',
  
  -- Processing Information
  status TEXT DEFAULT 'completed' CHECK (status IN ('pending', 'completed', 'failed', 'cancelled')),
  processed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  -- API and Cost Tracking
  api_endpoint TEXT,
  operation_details JSONB,
  cost_calculation JSONB, -- How the cost was calculated
  
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
);

-- Indexes for credit transactions
CREATE INDEX idx_credit_transactions_user_id ON credit_transactions(user_id);
CREATE INDEX idx_credit_transactions_type ON credit_transactions(transaction_type);
CREATE INDEX idx_credit_transactions_created_at ON credit_transactions(created_at);
CREATE INDEX idx_credit_transactions_status ON credit_transactions(status);
CREATE INDEX idx_credit_transactions_related_entity ON credit_transactions(related_entity_type, related_entity_id);
CREATE INDEX idx_credit_transactions_api_endpoint ON credit_transactions(api_endpoint);

-- Partition by month for better performance
-- ALTER TABLE credit_transactions PARTITION BY RANGE (EXTRACT(EPOCH FROM created_at));
```

#### API Credit Configuration Table
```sql
CREATE TABLE api_credit_configs (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  
  -- API Endpoint Configuration
  endpoint_pattern TEXT NOT NULL, -- Supports patterns like '/api/v1/characters/:id/generate'
  http_method TEXT NOT NULL CHECK (http_method IN ('GET', 'POST', 'PUT', 'PATCH', 'DELETE')),
  
  -- Cost Configuration
  base_cost INTEGER NOT NULL DEFAULT 0,
  cost_formula JSONB, -- For complex cost calculations based on parameters
  
  -- User Tier Modifiers
  tier_multipliers JSONB DEFAULT '{
    "FREE": 1.0,
    "PREMIUM": 0.8,
    "PRO": 0.6,
    "ENTERPRISE": 0.4
  }',
  
  -- Usage Rules
  daily_limit INTEGER, -- Per-user daily limit for this endpoint
  rate_limit_per_minute INTEGER,
  requires_subscription BOOLEAN DEFAULT false,
  minimum_tier TEXT CHECK (minimum_tier IN ('FREE', 'PREMIUM', 'PRO', 'ENTERPRISE')),
  
  -- Configuration
  is_enabled BOOLEAN DEFAULT true,
  description TEXT,
  category TEXT, -- 'generation', 'management', 'social', etc.
  
  -- Metadata
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
  
  UNIQUE(endpoint_pattern, http_method)
);

CREATE INDEX idx_api_credit_configs_endpoint ON api_credit_configs(endpoint_pattern);
CREATE INDEX idx_api_credit_configs_enabled ON api_credit_configs(is_enabled) WHERE is_enabled = true;
CREATE INDEX idx_api_credit_configs_category ON api_credit_configs(category);
```

#### Credit Packages Table (for purchases)
```sql
CREATE TABLE credit_packages (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  
  -- Package Details
  name TEXT NOT NULL,
  description TEXT,
  credit_amount INTEGER NOT NULL,
  bonus_credits INTEGER DEFAULT 0,
  
  -- Pricing
  price_usd DECIMAL(10,2) NOT NULL,
  price_currency TEXT DEFAULT 'USD',
  discount_percentage INTEGER DEFAULT 0,
  
  -- Availability
  is_available BOOLEAN DEFAULT true,
  target_tiers TEXT[] DEFAULT '{"FREE", "PREMIUM", "PRO", "ENTERPRISE"}',
  promotion_start_date TIMESTAMP WITH TIME ZONE,
  promotion_end_date TIMESTAMP WITH TIME ZONE,
  
  -- Package Type
  package_type TEXT DEFAULT 'one_time' CHECK (package_type IN ('one_time', 'subscription_bonus', 'promotional')),
  
  -- Display
  display_order INTEGER DEFAULT 0,
  highlight_color TEXT,
  badge_text TEXT, -- "BEST VALUE", "POPULAR", etc.
  
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
);

CREATE INDEX idx_credit_packages_available ON credit_packages(is_available) WHERE is_available = true;
CREATE INDEX idx_credit_packages_promotion ON credit_packages(promotion_start_date, promotion_end_date);
```

## Supporting Tables

### User Engagement and Analytics
```sql
CREATE TABLE user_activity_logs (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  user_id TEXT REFERENCES users(id) ON DELETE SET NULL,
  
  -- Activity Details
  activity_type TEXT NOT NULL, -- 'login', 'character_created', 'image_generated', etc.
  entity_type TEXT, -- 'character', 'collection', 'user'
  entity_id TEXT,
  
  -- Context
  session_id TEXT,
  ip_address INET,
  user_agent TEXT,
  referrer TEXT,
  
  -- Metadata
  metadata JSONB DEFAULT '{}',
  
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
);

-- Partition by month for performance
CREATE INDEX idx_user_activity_logs_user_id ON user_activity_logs(user_id, created_at);
CREATE INDEX idx_user_activity_logs_type ON user_activity_logs(activity_type, created_at);
```

### Feedback and Ratings
```sql
CREATE TABLE character_ratings (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  character_id TEXT NOT NULL REFERENCES characters(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  
  rating INTEGER NOT NULL CHECK (rating BETWEEN 1 AND 5),
  review_text TEXT,
  
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
  
  UNIQUE(character_id, user_id)
);

CREATE INDEX idx_character_ratings_character_id ON character_ratings(character_id);
CREATE INDEX idx_character_ratings_rating ON character_ratings(rating);
```

## Data Migration Strategy

### From Existing Schema
1. **User Migration**: Extend existing users table with new columns
2. **Character Migration**: Add new fields to existing characters table
3. **Credit System**: Migrate from existing credit tables with data preservation

### Migration Scripts
- Create new tables with proper constraints
- Migrate existing data with default values
- Update application code to use new schema
- Add indexes for performance optimization

## Performance Considerations

### Indexing Strategy
- **Primary indexes**: All foreign keys and frequently queried columns
- **Composite indexes**: Multi-column queries (user_id + status, created_at + type)
- **Partial indexes**: Conditional indexes for specific query patterns
- **GIN indexes**: For JSONB and array columns

### Partitioning
- **Credit transactions**: Partition by month for time-series data
- **Activity logs**: Partition by month with automatic cleanup
- **Large tables**: Consider horizontal partitioning for scalability

### Query Optimization
- Use covering indexes for read-heavy queries
- Implement read replicas for analytics queries
- Cache frequently accessed data (user credits, configurations)

## Security and Compliance

### Data Protection
- **PII Encryption**: Encrypt sensitive user data at rest
- **Access Control**: Row-level security for user data
- **Audit Trail**: Complete transaction history for financial data
- **Data Retention**: Automatic cleanup of old activity logs

### Compliance Features
- **GDPR Support**: User data export and deletion capabilities
- **Financial Compliance**: Complete audit trail for credit transactions
- **Content Moderation**: Flagging and review system for generated content

## Future Enhancements

### Planned Features
1. **Multi-tenant Support**: Organization-level user management
2. **Advanced Analytics**: User behavior tracking and insights
3. **API Usage Analytics**: Detailed usage patterns and optimization
4. **Content Marketplace**: User-to-user character trading system
5. **Advanced Collaboration**: Team workspaces and shared collections

This database design provides a robust, scalable foundation for the character creation platform while maintaining data integrity and supporting future growth.