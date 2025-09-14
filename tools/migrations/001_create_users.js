/**
 * Migration: Create Users Table
 * This migration creates the main users table with Auth0 integration support
 */

const createUsersTable = `
  CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    email TEXT UNIQUE NOT NULL,
    auth0_id TEXT UNIQUE,
    name TEXT,
    avatar TEXT,
    subscription_tier TEXT DEFAULT 'FREE' CHECK (subscription_tier IN ('FREE', 'PREMIUM', 'PRO')),
    daily_quota INTEGER DEFAULT 3 NOT NULL,
    daily_used INTEGER DEFAULT 0 NOT NULL,
    total_generated INTEGER DEFAULT 0 NOT NULL,
    last_reset_date TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
  );
`;

const createUsersIndexes = `
  -- Create indexes for optimal query performance
  CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
  CREATE INDEX IF NOT EXISTS idx_users_auth0_id ON users(auth0_id);
  CREATE INDEX IF NOT EXISTS idx_users_subscription_tier ON users(subscription_tier);
  CREATE INDEX IF NOT EXISTS idx_users_created_at ON users(created_at);
  CREATE INDEX IF NOT EXISTS idx_users_daily_quota_usage ON users(daily_used, daily_quota);
`;

const createUsersConstraints = `
  -- Add constraints for data integrity
  ALTER TABLE users ADD CONSTRAINT users_email_format 
    CHECK (email ~ '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\\.[A-Za-z]{2,}$');
  
  ALTER TABLE users ADD CONSTRAINT users_daily_quota_positive 
    CHECK (daily_quota >= 0);
  
  ALTER TABLE users ADD CONSTRAINT users_daily_used_positive 
    CHECK (daily_used >= 0);
  
  ALTER TABLE users ADD CONSTRAINT users_total_generated_positive 
    CHECK (total_generated >= 0);
  
  ALTER TABLE users ADD CONSTRAINT users_avatar_url_format 
    CHECK (avatar IS NULL OR avatar ~ '^https?://.*\\.(jpg|jpeg|png|gif|webp)$');
`;

const createUpdateTrigger = `
  -- Create trigger to automatically update updated_at timestamp
  CREATE OR REPLACE FUNCTION update_users_updated_at()
  RETURNS TRIGGER AS $$
  BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
  END;
  $$ LANGUAGE plpgsql;

  CREATE TRIGGER users_updated_at_trigger
    BEFORE UPDATE ON users
    FOR EACH ROW
    EXECUTE FUNCTION update_users_updated_at();
`;

export const up = async (client) => {
  console.log('Creating users table...');
  
  try {
    // Create the users table
    await client.query(createUsersTable);
    console.log('✓ Users table created');
    
    // Create indexes
    await client.query(createUsersIndexes);
    console.log('✓ Users table indexes created');
    
    // Add constraints
    await client.query(createUsersConstraints);
    console.log('✓ Users table constraints added');
    
    // Create update trigger
    await client.query(createUpdateTrigger);
    console.log('✓ Users table update trigger created');
    
    console.log('Users table migration completed successfully');
  } catch (error) {
    console.error('Error in users table migration:', error);
    throw error;
  }
};

export const down = async (client) => {
  console.log('Dropping users table...');
  
  try {
    // Drop trigger first
    await client.query('DROP TRIGGER IF EXISTS users_updated_at_trigger ON users');
    await client.query('DROP FUNCTION IF EXISTS update_users_updated_at()');
    
    // Drop table (this will also drop indexes and constraints)
    await client.query('DROP TABLE IF EXISTS users CASCADE');
    
    console.log('✓ Users table dropped');
  } catch (error) {
    console.error('Error dropping users table:', error);
    throw error;
  }
};

// Export metadata for migration tracking
export const metadata = {
  version: '001',
  name: 'create_users',
  description: 'Create users table with Auth0 integration support',
  timestamp: new Date().toISOString(),
  dependencies: [],
  rollbackSupported: true,
};

export default {
  up,
  down,
  metadata,
};