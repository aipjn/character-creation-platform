-- Initial performance indexes for the Character Creation Platform
-- Run after the initial schema is created

-- User table indexes
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_users_auth0_id ON users(auth0_id);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_users_subscription_tier ON users(subscription_tier);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_users_created_at ON users(created_at);

-- Character table indexes  
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_characters_user_id ON characters(user_id);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_characters_style_type ON characters(style_type);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_characters_generation_status ON characters(generation_status);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_characters_is_public ON characters(is_public);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_characters_created_at ON characters(created_at);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_characters_tags ON characters USING GIN(tags);

-- Composite indexes for common queries
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_characters_public_completed ON characters(is_public, generation_status) 
  WHERE is_public = true AND generation_status = 'COMPLETED';
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_characters_user_style ON characters(user_id, style_type);

-- Generation table indexes
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_generations_user_id ON generations(user_id);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_generations_character_id ON generations(character_id);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_generations_status ON generations(status);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_generations_nano_banana_request_id ON generations(nano_banana_request_id);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_generations_created_at ON generations(created_at);

-- Composite indexes for queue processing
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_generations_pending_queue ON generations(status, created_at) 
  WHERE status = 'PENDING';
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_generations_processing_stale ON generations(status, updated_at) 
  WHERE status = 'PROCESSING';

-- Character template indexes
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_character_templates_style_type ON character_templates(style_type);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_character_templates_is_active ON character_templates(is_active);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_character_templates_usage_count ON character_templates(usage_count);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_character_templates_tags ON character_templates USING GIN(tags);