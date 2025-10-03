# User Authentication & Credit System Schema

**Last Updated:** 2025-10-02
**Status:** Simplified for MVP

---

## Overview

This document contains the database schema for:
1. **User Authentication** - Auth0 integration, user profiles
2. **Credit System** - Daily quota tracking (simplified)

These schemas are separated from the main character generation system for clarity.

---

## 1. User Authentication System

### Primary Users Table

```sql
CREATE TABLE users (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,

  -- Authentication (Auth0 Integration)
  email TEXT UNIQUE NOT NULL,
  auth0_id TEXT UNIQUE,
  username TEXT UNIQUE,
  display_name TEXT,
  avatar_url TEXT,

  -- Subscription and Limits
  subscription_tier TEXT DEFAULT 'FREE'
    CHECK (subscription_tier IN ('FREE', 'PREMIUM', 'PRO')),
  subscription_start_date TIMESTAMP WITH TIME ZONE,
  subscription_end_date TIMESTAMP WITH TIME ZONE,

  -- Daily Usage Tracking (Simplified Credit System)
  daily_quota INTEGER DEFAULT 3 NOT NULL,
  daily_used INTEGER DEFAULT 0 NOT NULL,
  total_generated INTEGER DEFAULT 0 NOT NULL,
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

### Prisma Schema Equivalent

```prisma
model User {
  id            String   @id @default(cuid())
  email         String   @unique
  auth0Id       String?  @unique @map("auth0_id")
  name          String?
  avatar        String?

  subscriptionTier SubscriptionTier @default(FREE) @map("subscription_tier")
  dailyQuota    Int      @default(3) @map("daily_quota")
  dailyUsed     Int      @default(0) @map("daily_used")
  totalGenerated Int     @default(0) @map("total_generated")
  lastResetDate DateTime @default(now()) @map("last_reset_date")

  createdAt     DateTime @default(now()) @map("created_at")
  updatedAt     DateTime @updatedAt @map("updated_at")

  // Relations
  characters    Character[]
  generations   Generation[]
  collections   CharacterCollection[]

  @@map("users")
}

enum SubscriptionTier {
  FREE
  PREMIUM
  PRO
}
```

---

### User Profiles Extended Table (Optional)

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

  -- Achievements and Badges (Not implemented yet)
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

**Status:** ⚠️ Extended profiles exist in schema but not actively used by frontend yet.

---

## 2. Credit System (Simplified)

### Current Implementation

The credit system is **simplified** and integrated directly into the `users` table:

```sql
-- Credit-related fields in users table:
daily_quota INTEGER DEFAULT 3,           -- Daily generation limit
daily_used INTEGER DEFAULT 0,            -- How many used today
total_generated INTEGER DEFAULT 0,       -- Lifetime count
last_reset_date TIMESTAMP,               -- When quota resets
```

### Frontend Display

```javascript
// From app.html
<div class="credits-display">
  <i class="fas fa-coins"></i>
  <span id="credits-count">0</span> Credits
</div>
```

### How It Works

1. **Daily Reset Logic:**
   ```javascript
   if (currentDate > last_reset_date) {
     daily_used = 0
     last_reset_date = currentDate
   }
   ```

2. **Usage Check:**
   ```javascript
   if (daily_used >= daily_quota) {
     return "Daily limit reached"
   }
   ```

3. **Increment on Generation:**
   ```javascript
   daily_used++
   total_generated++
   ```

### Subscription Tiers

| Tier | Daily Quota | Price |
|------|-------------|-------|
| FREE | 3 | $0/month |
| PREMIUM | 20 | $9.99/month |
| PRO | 100 | $29.99/month |

---

## ❌ Removed: Complex Credit Tables

The following tables from the original design are **NOT implemented** because they're over-engineered for current needs:

### 1. User Credits Table - ❌ Removed
```sql
-- NOT IMPLEMENTED - Credits tracked in users table instead
CREATE TABLE user_credits (
  id TEXT PRIMARY KEY,
  user_id TEXT REFERENCES users(id),
  current_balance INTEGER,
  reserved_balance INTEGER,
  ...
);
```

**Why removed:**
- Frontend only shows daily quota, not credit balance
- No marketplace or credit purchase system
- No reserved balance needed (synchronous generation)

### 2. Credit Transactions Table - ❌ Removed
```sql
-- NOT IMPLEMENTED - No transaction history yet
CREATE TABLE credit_transactions (
  id TEXT PRIMARY KEY,
  user_id TEXT REFERENCES users(id),
  transaction_type TEXT,
  amount INTEGER,
  ...
);
```

**Why removed:**
- No transaction history display in frontend
- No audit requirements yet
- Can be added later if needed

### 3. API Credit Configs Table - ❌ Removed
```sql
-- NOT IMPLEMENTED - No per-endpoint cost tracking
CREATE TABLE api_credit_configs (
  id TEXT PRIMARY KEY,
  endpoint_pattern TEXT,
  base_cost INTEGER,
  ...
);
```

**Why removed:**
- All generation operations cost 1 quota
- No complex pricing rules
- Not needed for MVP

### 4. Credit Packages Table - ❌ Removed
```sql
-- NOT IMPLEMENTED - No credit purchase system
CREATE TABLE credit_packages (
  id TEXT PRIMARY KEY,
  name TEXT,
  credit_amount INTEGER,
  price_usd DECIMAL,
  ...
);
```

**Why removed:**
- No payment integration implemented
- No credit marketplace
- Subscription-based only (daily quota)

---

## Authentication Flow

### 1. Auth0 Integration

```javascript
// Login flow
1. User clicks "Login" → Redirect to Auth0
2. Auth0 authenticates → Returns JWT token
3. Backend validates JWT → Creates/updates user record
4. Returns session token to frontend
```

### 2. User Creation

```sql
-- When new user signs up via Auth0
INSERT INTO users (
  email,
  auth0_id,
  username,
  subscription_tier,
  daily_quota,
  daily_used,
  last_reset_date
) VALUES (
  'user@example.com',
  'auth0|123456789',
  'username',
  'FREE',
  3,
  0,
  NOW()
);
```

### 3. Session Management

- JWT tokens stored in frontend localStorage
- Token validation on every API request
- Automatic token refresh before expiration
- Logout clears local tokens (Auth0 session remains)

---

## API Endpoints

### Authentication

```
POST   /api/v1/auth/login          - Auth0 callback handler
POST   /api/v1/auth/logout         - Clear session
GET    /api/v1/auth/me             - Get current user
PATCH  /api/v1/auth/profile        - Update profile
```

### Credit System

```
GET    /api/v1/users/quota         - Get daily quota status
POST   /api/v1/users/reset-quota   - Admin: reset user quota
```

---

## Migration Guide

### Creating Users Table

```bash
# Using Prisma
npx prisma migrate dev --name create_users_table

# Direct SQL (if not using Prisma)
psql $DATABASE_URL < migrations/001_create_users.sql
```

### Adding Auth0 Integration

```bash
# 1. Set environment variables
AUTH0_DOMAIN=your-domain.auth0.com
AUTH0_CLIENT_ID=your-client-id
AUTH0_CLIENT_SECRET=your-client-secret

# 2. Update Auth0 application settings
# - Allowed Callback URLs: http://localhost:3000/api/v1/auth/callback
# - Allowed Logout URLs: http://localhost:3000
```

---

## Security Considerations

### Data Protection

1. **Password Security:**
   - Never store passwords (Auth0 handles this)
   - JWT tokens expire after 24 hours
   - Refresh tokens rotated on use

2. **PII Encryption:**
   - Email addresses indexed but not encrypted (needed for login)
   - Consider encrypting `bio`, `social_links` if sensitive

3. **Rate Limiting:**
   - Daily quota prevents abuse
   - Additional rate limiting at API gateway level

### Auth0 Configuration

```javascript
// Required Auth0 Rules
function dailyQuotaCheck(user, context, callback) {
  // Check if user exists in database
  // Verify daily quota not exceeded
  // Allow/deny authentication
}
```

---

## Future Enhancements

### Potential Additions (Not in MVP)

1. **Credit Purchase System:**
   - Add `credit_packages` table
   - Integrate Stripe/PayPal
   - Transaction history tracking

2. **Referral System:**
   - Track referral codes
   - Bonus credits for referrals
   - Analytics dashboard

3. **Advanced Analytics:**
   - `user_activity_logs` table
   - Login/generation patterns
   - Usage optimization insights

4. **Team Accounts:**
   - Organization-level users
   - Shared credit pools
   - Role-based access control

---

## Troubleshooting

### Common Issues

**Issue:** User quota not resetting
```sql
-- Check last reset date
SELECT id, email, daily_used, daily_quota, last_reset_date
FROM users
WHERE email = 'user@example.com';

-- Manual reset (admin only)
UPDATE users
SET daily_used = 0, last_reset_date = NOW()
WHERE id = 'user-id';
```

**Issue:** Auth0 authentication fails
```bash
# Check environment variables
echo $AUTH0_DOMAIN
echo $AUTH0_CLIENT_ID

# Verify Auth0 application settings
# - Callbacks match your domain
# - API scopes include 'openid profile email'
```

---

## Related Documentation

- Main schema: [DATABASE_DESIGN.md](./DATABASE_DESIGN.md)
- API documentation: [../API_DOCUMENTATION.md](../API_DOCUMENTATION.md)
- Auth0 setup: [../AUTH0_SETUP.md](../AUTH0_SETUP.md)

---

**Last Updated:** 2025-10-02
**Schema Version:** v2.0 (Simplified)
