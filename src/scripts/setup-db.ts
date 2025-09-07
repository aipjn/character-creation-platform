#!/usr/bin/env ts-node

import { exec } from 'child_process';
import { promisify } from 'util';
import * as fs from 'fs/promises';
import * as path from 'path';
import { connectWithRetry } from '../config/database';

const execAsync = promisify(exec);

async function checkEnvironment() {
  console.log('🔍 Checking environment setup...');

  // Check if .env file exists
  const envPath = path.join(process.cwd(), '.env');
  try {
    await fs.access(envPath);
    console.log('✅ .env file found');
  } catch {
    console.log('⚠️  .env file not found, copying from .env.example');
    try {
      const examplePath = path.join(process.cwd(), '.env.example');
      const envContent = await fs.readFile(examplePath, 'utf-8');
      await fs.writeFile(envPath, envContent);
      console.log('✅ .env file created from .env.example');
    } catch (error) {
      console.error('❌ Failed to create .env file:', error);
      return false;
    }
  }

  // Check DATABASE_URL
  if (!process.env.DATABASE_URL) {
    console.log('⚠️  DATABASE_URL not found in environment variables');
    console.log('Please set DATABASE_URL in your .env file');
    return false;
  }

  console.log('✅ Environment setup complete');
  return true;
}

async function setupDatabase() {
  console.log('🏗️  Setting up database...');

  try {
    // Generate Prisma client
    console.log('📦 Generating Prisma client...');
    await execAsync('npx prisma generate');
    console.log('✅ Prisma client generated');

    // Push database schema (for development)
    console.log('🗄️  Pushing database schema...');
    await execAsync('npx prisma db push');
    console.log('✅ Database schema pushed');

    return true;
  } catch (error) {
    console.error('❌ Database setup failed:', error);
    return false;
  }
}

async function seedDatabase() {
  console.log('🌱 Seeding database...');

  try {
    await execAsync('npx ts-node prisma/seed.ts');
    console.log('✅ Database seeded successfully');
    return true;
  } catch (error) {
    console.error('❌ Database seeding failed:', error);
    return false;
  }
}

async function verifySetup() {
  console.log('✅ Verifying database setup...');

  try {
    // Test connection
    await connectWithRetry(3, 2000);
    console.log('✅ Database connection verified');

    // Run test script
    await execAsync('npx ts-node src/scripts/test-db.ts');
    console.log('✅ Database tests passed');
    
    return true;
  } catch (error) {
    console.error('❌ Database verification failed:', error);
    return false;
  }
}

async function checkDockerServices() {
  console.log('🐳 Checking Docker services...');

  try {
    const { stdout } = await execAsync('docker-compose ps');
    if (stdout.includes('postgres') && stdout.includes('Up')) {
      console.log('✅ PostgreSQL container is running');
      return true;
    } else {
      console.log('⚠️  PostgreSQL container not running');
      console.log('Starting Docker services...');
      await execAsync('docker-compose up -d postgres');
      console.log('✅ PostgreSQL container started');
      
      // Wait a moment for the database to be ready
      console.log('⏳ Waiting for database to be ready...');
      await new Promise(resolve => setTimeout(resolve, 5000));
      return true;
    }
  } catch (error) {
    console.log('ℹ️  Docker not available or not configured, assuming external database');
    return true;
  }
}

async function fullSetup() {
  console.log('🚀 Starting full database setup...\n');

  const steps = [
    { name: 'Environment Check', fn: checkEnvironment },
    { name: 'Docker Services', fn: checkDockerServices },
    { name: 'Database Setup', fn: setupDatabase },
    { name: 'Database Seeding', fn: seedDatabase },
    { name: 'Setup Verification', fn: verifySetup },
  ];

  for (const step of steps) {
    console.log(`\n📋 ${step.name}:`);
    const success = await step.fn();
    
    if (!success) {
      console.log(`\n💥 Setup failed at: ${step.name}`);
      console.log('\nPlease fix the issues above and run the setup again.');
      process.exit(1);
    }
  }

  console.log('\n🎉 Database setup completed successfully!');
  console.log('\nYour database is ready for the Character Creation Platform.');
  console.log('\nNext steps:');
  console.log('- Run `npm run dev` to start the development server');
  console.log('- Run `npm run db:studio` to open Prisma Studio');
  console.log('- Run `npm run test` to run the test suite');
}

// Parse command line arguments
const command = process.argv[2];

async function main() {
  switch (command) {
    case 'env':
      await checkEnvironment();
      break;
    case 'docker':
      await checkDockerServices();
      break;
    case 'db':
      await setupDatabase();
      break;
    case 'seed':
      await seedDatabase();
      break;
    case 'verify':
      await verifySetup();
      break;
    default:
      await fullSetup();
  }
}

if (require.main === module) {
  main().catch((error) => {
    console.error('🚨 Setup script failed:', error);
    process.exit(1);
  });
}