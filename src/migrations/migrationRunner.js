/**
 * Migration Runner - Utility for running database migrations
 * This provides an alternative to Prisma migrations for manual database setup
 */

import { getPrismaClient } from '../config/database';
import fs from 'fs/promises';
import path from 'path';

export class MigrationRunner {
  constructor() {
    this.prisma = getPrismaClient();
    this.migrationsPath = '/Users/h0270/Documents/code/character-creator/src/migrations';
  }

  /**
   * Create migrations tracking table
   */
  async createMigrationsTable() {
    const createMigrationsTable = `
      CREATE TABLE IF NOT EXISTS _migrations (
        id SERIAL PRIMARY KEY,
        version TEXT UNIQUE NOT NULL,
        name TEXT NOT NULL,
        description TEXT,
        applied_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
        rolled_back_at TIMESTAMP WITH TIME ZONE,
        is_rolled_back BOOLEAN DEFAULT FALSE
      );
      
      CREATE INDEX IF NOT EXISTS idx_migrations_version ON _migrations(version);
      CREATE INDEX IF NOT EXISTS idx_migrations_applied_at ON _migrations(applied_at);
    `;

    await this.prisma.$executeRawUnsafe(createMigrationsTable);
  }

  /**
   * Get list of available migration files
   */
  async getAvailableMigrations() {
    try {
      const files = await fs.readdir(this.migrationsPath);
      const migrationFiles = files.filter(file => 
        file.endsWith('.js') && file.match(/^\d{3}_[a-z_]+\.js$/) && file !== 'migrationRunner.js'
      );
      
      return migrationFiles.sort();
    } catch (error) {
      console.error('Error reading migrations directory:', error);
      return [];
    }
  }

  /**
   * Get applied migrations from database
   */
  async getAppliedMigrations() {
    try {
      const migrations = await this.prisma.$queryRaw`
        SELECT version, name, description, applied_at, is_rolled_back
        FROM _migrations 
        WHERE is_rolled_back = FALSE
        ORDER BY version
      `;
      
      return migrations;
    } catch (error) {
      // Table might not exist yet
      return [];
    }
  }

  /**
   * Run a specific migration
   */
  async runMigration(migrationFile) {
    const migrationPath = path.join(this.migrationsPath, migrationFile);
    
    try {
      console.log(`Running migration: ${migrationFile}`);
      
      // Dynamically import the migration
      const migration = await import(migrationPath);
      
      // Begin transaction
      await this.prisma.$transaction(async (client) => {
        // Run the migration
        await migration.up(client);
        
        // Record the migration
        await client.$executeRaw`
          INSERT INTO _migrations (version, name, description)
          VALUES (${migration.metadata.version}, ${migration.metadata.name}, ${migration.metadata.description})
        `;
      });
      
      console.log(`✓ Migration ${migrationFile} completed successfully`);
    } catch (error) {
      console.error(`✗ Error running migration ${migrationFile}:`, error);
      throw error;
    }
  }

  /**
   * Rollback a specific migration
   */
  async rollbackMigration(version) {
    try {
      // Find the migration record
      const migrationRecord = await this.prisma.$queryRaw`
        SELECT * FROM _migrations 
        WHERE version = ${version} AND is_rolled_back = FALSE
      `;

      if (!migrationRecord.length) {
        throw new Error(`Migration ${version} not found or already rolled back`);
      }

      // Find the migration file
      const availableMigrations = await this.getAvailableMigrations();
      const migrationFile = availableMigrations.find(file => file.startsWith(version));
      
      if (!migrationFile) {
        throw new Error(`Migration file for version ${version} not found`);
      }

      console.log(`Rolling back migration: ${migrationFile}`);
      
      const migrationPath = path.join(this.migrationsPath, migrationFile);
      const migration = await import(migrationPath);
      
      if (!migration.down) {
        throw new Error(`Migration ${version} does not support rollback`);
      }

      // Begin transaction
      await this.prisma.$transaction(async (client) => {
        // Run the rollback
        await migration.down(client);
        
        // Mark as rolled back
        await client.$executeRaw`
          UPDATE _migrations 
          SET is_rolled_back = TRUE, rolled_back_at = NOW()
          WHERE version = ${version}
        `;
      });
      
      console.log(`✓ Migration ${version} rolled back successfully`);
    } catch (error) {
      console.error(`✗ Error rolling back migration ${version}:`, error);
      throw error;
    }
  }

  /**
   * Run all pending migrations
   */
  async runPendingMigrations() {
    console.log('Checking for pending migrations...');
    
    // Ensure migrations table exists
    await this.createMigrationsTable();
    
    const availableMigrations = await this.getAvailableMigrations();
    const appliedMigrations = await this.getAppliedMigrations();
    
    const appliedVersions = new Set(appliedMigrations.map(m => m.version));
    const pendingMigrations = availableMigrations.filter(file => {
      const version = file.split('_')[0];
      return !appliedVersions.has(version);
    });

    if (pendingMigrations.length === 0) {
      console.log('✓ No pending migrations');
      return;
    }

    console.log(`Found ${pendingMigrations.length} pending migrations`);
    
    for (const migrationFile of pendingMigrations) {
      await this.runMigration(migrationFile);
    }
    
    console.log(`✓ All ${pendingMigrations.length} migrations completed successfully`);
  }

  /**
   * Get migration status
   */
  async getStatus() {
    await this.createMigrationsTable();
    
    const availableMigrations = await this.getAvailableMigrations();
    const appliedMigrations = await this.getAppliedMigrations();
    
    const status = {
      totalMigrations: availableMigrations.length,
      appliedMigrations: appliedMigrations.length,
      pendingMigrations: [],
      appliedList: appliedMigrations.map(m => ({
        version: m.version,
        name: m.name,
        appliedAt: m.applied_at,
      })),
    };

    const appliedVersions = new Set(appliedMigrations.map(m => m.version));
    
    availableMigrations.forEach(file => {
      const version = file.split('_')[0];
      if (!appliedVersions.has(version)) {
        status.pendingMigrations.push({
          file,
          version,
          name: file.replace(/^\d{3}_/, '').replace(/\.js$/, ''),
        });
      }
    });

    return status;
  }

  /**
   * Reset all migrations (danger!)
   */
  async resetAll() {
    console.warn('WARNING: This will drop all migration tracking and reset the database!');
    
    try {
      // Get all applied migrations in reverse order
      const appliedMigrations = await this.getAppliedMigrations();
      const reversedMigrations = [...appliedMigrations].reverse();
      
      // Rollback all migrations
      for (const migration of reversedMigrations) {
        await this.rollbackMigration(migration.version);
      }
      
      // Drop migrations table
      await this.prisma.$executeRaw`DROP TABLE IF EXISTS _migrations`;
      
      console.log('✓ All migrations reset successfully');
    } catch (error) {
      console.error('✗ Error resetting migrations:', error);
      throw error;
    }
  }

  /**
   * Health check for migration system
   */
  async healthCheck() {
    try {
      await this.createMigrationsTable();
      const status = await this.getStatus();
      
      return {
        status: 'healthy',
        migrationsTable: 'exists',
        ...status,
        timestamp: new Date(),
      };
    } catch (error) {
      return {
        status: 'unhealthy',
        error: error.message,
        timestamp: new Date(),
      };
    }
  }
}

export default new MigrationRunner();