/**
 * Migration: Create User Profiles Extensions
 * This migration adds profile-specific extensions and preferences storage
 */

const createUserPreferencesTable = `
  CREATE TABLE IF NOT EXISTS user_preferences (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    theme TEXT DEFAULT 'light' CHECK (theme IN ('light', 'dark', 'auto')),
    notifications_email BOOLEAN DEFAULT TRUE,
    notifications_browser BOOLEAN DEFAULT TRUE,
    notifications_generation_complete BOOLEAN DEFAULT TRUE,
    notifications_daily_quota_warning BOOLEAN DEFAULT TRUE,
    privacy_profile_visible BOOLEAN DEFAULT TRUE,
    privacy_characters_default_public BOOLEAN DEFAULT FALSE,
    privacy_allow_data_collection BOOLEAN DEFAULT TRUE,
    generation_default_style TEXT DEFAULT 'REALISTIC' 
      CHECK (generation_default_style IN ('REALISTIC', 'CARTOON', 'ANIME', 'FANTASY', 'CYBERPUNK', 'VINTAGE', 'MINIMALIST')),
    generation_auto_save_thumbnails BOOLEAN DEFAULT TRUE,
    generation_batch_size INTEGER DEFAULT 1 CHECK (generation_batch_size BETWEEN 1 AND 10),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
    
    UNIQUE(user_id)
  );
`;

const createUserActivityLog = `
  CREATE TABLE IF NOT EXISTS user_activity_log (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    activity_type TEXT NOT NULL CHECK (activity_type IN (
      'login', 'logout', 'character_created', 'character_updated', 'character_deleted',
      'generation_started', 'generation_completed', 'subscription_updated',
      'profile_updated', 'preferences_updated', 'password_changed'
    )),
    activity_data JSONB,
    ip_address INET,
    user_agent TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
  );
`;

const createUserSessions = `
  CREATE TABLE IF NOT EXISTS user_sessions (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    auth0_session_id TEXT,
    access_token_hash TEXT,
    refresh_token_hash TEXT,
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
    last_accessed TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    ip_address INET,
    user_agent TEXT,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
  );
`;

const createUserMetadata = `
  -- Add metadata column to users table for flexible data storage
  ALTER TABLE users ADD COLUMN IF NOT EXISTS metadata JSONB DEFAULT '{}';
`;

const createIndexes = `
  -- User preferences indexes
  CREATE INDEX IF NOT EXISTS idx_user_preferences_user_id ON user_preferences(user_id);
  CREATE INDEX IF NOT EXISTS idx_user_preferences_theme ON user_preferences(theme);
  
  -- User activity log indexes
  CREATE INDEX IF NOT EXISTS idx_user_activity_log_user_id ON user_activity_log(user_id);
  CREATE INDEX IF NOT EXISTS idx_user_activity_log_activity_type ON user_activity_log(activity_type);
  CREATE INDEX IF NOT EXISTS idx_user_activity_log_created_at ON user_activity_log(created_at);
  CREATE INDEX IF NOT EXISTS idx_user_activity_log_user_activity ON user_activity_log(user_id, activity_type, created_at);
  
  -- User sessions indexes
  CREATE INDEX IF NOT EXISTS idx_user_sessions_user_id ON user_sessions(user_id);
  CREATE INDEX IF NOT EXISTS idx_user_sessions_auth0_session ON user_sessions(auth0_session_id);
  CREATE INDEX IF NOT EXISTS idx_user_sessions_expires_at ON user_sessions(expires_at);
  CREATE INDEX IF NOT EXISTS idx_user_sessions_active ON user_sessions(is_active, expires_at);
  
  -- Users metadata index
  CREATE INDEX IF NOT EXISTS idx_users_metadata ON users USING GIN(metadata);
`;

const createUpdateTriggers = `
  -- Create trigger for user_preferences updated_at
  CREATE OR REPLACE FUNCTION update_user_preferences_updated_at()
  RETURNS TRIGGER AS $$
  BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
  END;
  $$ LANGUAGE plpgsql;

  CREATE TRIGGER user_preferences_updated_at_trigger
    BEFORE UPDATE ON user_preferences
    FOR EACH ROW
    EXECUTE FUNCTION update_user_preferences_updated_at();
    
  -- Create trigger to automatically create default preferences for new users
  CREATE OR REPLACE FUNCTION create_default_user_preferences()
  RETURNS TRIGGER AS $$
  BEGIN
    INSERT INTO user_preferences (user_id) VALUES (NEW.id);
    RETURN NEW;
  END;
  $$ LANGUAGE plpgsql;

  CREATE TRIGGER create_user_preferences_trigger
    AFTER INSERT ON users
    FOR EACH ROW
    EXECUTE FUNCTION create_default_user_preferences();
`;

const createCleanupFunctions = `
  -- Function to clean up expired sessions
  CREATE OR REPLACE FUNCTION cleanup_expired_sessions()
  RETURNS INTEGER AS $$
  DECLARE
    deleted_count INTEGER;
  BEGIN
    DELETE FROM user_sessions 
    WHERE expires_at < NOW() OR (last_accessed < NOW() - INTERVAL '30 days');
    
    GET DIAGNOSTICS deleted_count = ROW_COUNT;
    
    RETURN deleted_count;
  END;
  $$ LANGUAGE plpgsql;
  
  -- Function to cleanup old activity logs (keep only last 6 months)
  CREATE OR REPLACE FUNCTION cleanup_old_activity_logs()
  RETURNS INTEGER AS $$
  DECLARE
    deleted_count INTEGER;
  BEGIN
    DELETE FROM user_activity_log 
    WHERE created_at < NOW() - INTERVAL '6 months';
    
    GET DIAGNOSTICS deleted_count = ROW_COUNT;
    
    RETURN deleted_count;
  END;
  $$ LANGUAGE plpgsql;
`;

export const up = async (client) => {
  console.log('Creating user profile extensions...');
  
  try {
    // Add metadata column to existing users table
    await client.query(createUserMetadata);
    console.log('✓ Users metadata column added');
    
    // Create user preferences table
    await client.query(createUserPreferencesTable);
    console.log('✓ User preferences table created');
    
    // Create user activity log table
    await client.query(createUserActivityLog);
    console.log('✓ User activity log table created');
    
    // Create user sessions table
    await client.query(createUserSessions);
    console.log('✓ User sessions table created');
    
    // Create indexes
    await client.query(createIndexes);
    console.log('✓ Profile tables indexes created');
    
    // Create triggers
    await client.query(createUpdateTriggers);
    console.log('✓ Profile tables triggers created');
    
    // Create cleanup functions
    await client.query(createCleanupFunctions);
    console.log('✓ Cleanup functions created');
    
    console.log('User profiles migration completed successfully');
  } catch (error) {
    console.error('Error in user profiles migration:', error);
    throw error;
  }
};

export const down = async (client) => {
  console.log('Dropping user profile extensions...');
  
  try {
    // Drop triggers first
    await client.query('DROP TRIGGER IF EXISTS user_preferences_updated_at_trigger ON user_preferences');
    await client.query('DROP TRIGGER IF EXISTS create_user_preferences_trigger ON users');
    await client.query('DROP FUNCTION IF EXISTS update_user_preferences_updated_at()');
    await client.query('DROP FUNCTION IF EXISTS create_default_user_preferences()');
    
    // Drop cleanup functions
    await client.query('DROP FUNCTION IF EXISTS cleanup_expired_sessions()');
    await client.query('DROP FUNCTION IF EXISTS cleanup_old_activity_logs()');
    
    // Drop tables
    await client.query('DROP TABLE IF EXISTS user_sessions CASCADE');
    await client.query('DROP TABLE IF EXISTS user_activity_log CASCADE');
    await client.query('DROP TABLE IF EXISTS user_preferences CASCADE');
    
    // Remove metadata column from users table
    await client.query('ALTER TABLE users DROP COLUMN IF EXISTS metadata');
    
    console.log('✓ User profile extensions dropped');
  } catch (error) {
    console.error('Error dropping user profile extensions:', error);
    throw error;
  }
};

// Export metadata for migration tracking
export const metadata = {
  version: '002',
  name: 'create_user_profiles',
  description: 'Create user profile extensions with preferences, activity logging, and session management',
  timestamp: new Date().toISOString(),
  dependencies: ['001_create_users'],
  rollbackSupported: true,
};

export default {
  up,
  down,
  metadata,
};