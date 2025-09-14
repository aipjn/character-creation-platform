/**
 * Migration: Create Credit System Tables
 * 创建积分系统相关表
 */

const { v4: uuidv4 } = require('uuid');

async function up(db) {
  console.log('Creating credit system tables...');

  // 1. 创建用户积分表
  await db.query(`
    CREATE TABLE IF NOT EXISTS user_credits (
      id VARCHAR(36) PRIMARY KEY,
      user_id VARCHAR(36) NOT NULL,
      daily_credits INTEGER NOT NULL DEFAULT 100,
      used_credits INTEGER NOT NULL DEFAULT 0,
      remaining_credits INTEGER NOT NULL DEFAULT 100,
      last_reset_date DATETIME NOT NULL,
      total_credits_earned INTEGER NOT NULL DEFAULT 0,
      total_credits_spent INTEGER NOT NULL DEFAULT 0,
      created_at DATETIME NOT NULL,
      updated_at DATETIME NOT NULL,
      
      INDEX idx_user_credits_user_id (user_id),
      INDEX idx_user_credits_last_reset (last_reset_date),
      UNIQUE KEY unique_user_credits (user_id)
    );
  `);

  // 2. 创建积分交易记录表
  await db.query(`
    CREATE TABLE IF NOT EXISTS credit_transactions (
      id VARCHAR(36) PRIMARY KEY,
      user_id VARCHAR(36) NOT NULL,
      api_endpoint VARCHAR(255) NOT NULL,
      credit_cost INTEGER NOT NULL,
      operation_type ENUM('api_call', 'admin_grant', 'daily_reset', 'refund') NOT NULL,
      description TEXT,
      request_data JSON,
      status ENUM('pending', 'completed', 'failed') NOT NULL DEFAULT 'pending',
      created_at DATETIME NOT NULL,
      completed_at DATETIME,
      
      INDEX idx_credit_transactions_user_id (user_id),
      INDEX idx_credit_transactions_created_at (created_at),
      INDEX idx_credit_transactions_api_endpoint (api_endpoint),
      INDEX idx_credit_transactions_operation_type (operation_type),
      INDEX idx_credit_transactions_status (status)
    );
  `);

  // 3. 创建API积分配置表
  await db.query(`
    CREATE TABLE IF NOT EXISTS api_credit_configs (
      id VARCHAR(36) PRIMARY KEY,
      endpoint VARCHAR(255) NOT NULL,
      method ENUM('GET', 'POST', 'PUT', 'DELETE', 'PATCH') NOT NULL,
      credit_cost INTEGER NOT NULL DEFAULT 0,
      description TEXT,
      is_enabled BOOLEAN NOT NULL DEFAULT TRUE,
      created_at DATETIME NOT NULL,
      updated_at DATETIME NOT NULL,
      
      UNIQUE KEY unique_api_endpoint_method (endpoint, method),
      INDEX idx_api_credit_configs_endpoint (endpoint),
      INDEX idx_api_credit_configs_enabled (is_enabled)
    );
  `);

  // 4. 插入默认API积分配置
  const defaultConfigs = [
    {
      id: uuidv4(),
      endpoint: '/api/v1/generate-character',
      method: 'POST',
      credit_cost: 10,
      description: '生成角色',
      is_enabled: true
    },
    {
      id: uuidv4(),
      endpoint: '/api/v1/generate-image',
      method: 'POST',
      credit_cost: 15,
      description: '生成图像',
      is_enabled: true
    },
    {
      id: uuidv4(),
      endpoint: '/api/v1/characters',
      method: 'POST',
      credit_cost: 5,
      description: '创建角色',
      is_enabled: true
    },
    {
      id: uuidv4(),
      endpoint: '/api/v1/characters/:id/enhance',
      method: 'POST',
      credit_cost: 8,
      description: '增强角色',
      is_enabled: true
    },
    {
      id: uuidv4(),
      endpoint: '/api/v1/collections',
      method: 'POST',
      credit_cost: 3,
      description: '创建集合',
      is_enabled: true
    }
  ];

  const now = new Date().toISOString().slice(0, 19).replace('T', ' ');
  
  for (const config of defaultConfigs) {
    await db.query(`
      INSERT INTO api_credit_configs 
      (id, endpoint, method, credit_cost, description, is_enabled, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      config.id,
      config.endpoint,
      config.method,
      config.credit_cost,
      config.description,
      config.is_enabled,
      now,
      now
    ]);
  }

  console.log('Credit system tables created successfully!');
  console.log(`Inserted ${defaultConfigs.length} default API credit configurations.`);
}

async function down(db) {
  console.log('Dropping credit system tables...');

  // 按依赖关系逆序删除表
  await db.query('DROP TABLE IF EXISTS credit_transactions');
  await db.query('DROP TABLE IF EXISTS api_credit_configs');
  await db.query('DROP TABLE IF EXISTS user_credits');

  console.log('Credit system tables dropped successfully!');
}

module.exports = { up, down };