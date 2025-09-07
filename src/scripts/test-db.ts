#!/usr/bin/env ts-node

import { connectWithRetry, checkDatabaseConnection, getPrismaClient } from '../config/database';
import User from '../models/User';
import Character from '../models/Character';
import Generation from '../models/Generation';
import { SubscriptionTier, StyleType, GenerationStatus } from '@prisma/client';

async function testDatabaseConnection() {
  console.log('🔍 Testing database connection...');
  
  try {
    // Test basic connection
    console.log('📡 Connecting to database...');
    await connectWithRetry(3, 2000);
    console.log('✅ Database connection successful!');

    // Test health check
    const isHealthy = await checkDatabaseConnection();
    console.log(`🏥 Database health check: ${isHealthy ? '✅ Healthy' : '❌ Unhealthy'}`);

    if (!isHealthy) {
      throw new Error('Database health check failed');
    }

    return true;
  } catch (error) {
    console.error('❌ Database connection failed:', error);
    return false;
  }
}

async function testCRUDOperations() {
  console.log('\n🧪 Testing CRUD operations...');
  
  try {
    const prisma = getPrismaClient();
    console.log('Prisma client initialized');

    // Test User operations
    console.log('👤 Testing User operations...');
    
    // Create a test user
    const testUser = await User.create({
      email: `test-${Date.now()}@example.com`,
      name: 'Test User',
      subscriptionTier: SubscriptionTier.FREE,
    });
    console.log('✅ User created:', testUser.id);

    // Update user
    const updatedUser = await User.update(testUser.id, {
      name: 'Updated Test User',
    });
    console.log('✅ User updated:', updatedUser.name);

    // Test Character operations
    console.log('🎭 Testing Character operations...');
    
    // Create a test character
    const testCharacter = await Character.create({
      user: { connect: { id: testUser.id } },
      name: 'Test Character',
      prompt: 'A test character for database verification',
      styleType: StyleType.REALISTIC,
      tags: ['test', 'database'],
    });
    console.log('✅ Character created:', testCharacter.id);

    // Test Generation operations
    console.log('⚙️ Testing Generation operations...');
    
    // Create a test generation
    const testGeneration = await Generation.create({
      user: { connect: { id: testUser.id } },
      character: { connect: { id: testCharacter.id } },
      prompt: testCharacter.prompt,
      styleType: testCharacter.styleType,
      status: GenerationStatus.PENDING,
    });
    console.log('✅ Generation created:', testGeneration.id);

    // Test query operations
    console.log('🔍 Testing query operations...');
    
    const userWithCharacters = await User.getUserWithCharacters(testUser.id);
    console.log('✅ User with characters query:', {
      user: userWithCharacters?.name,
      characterCount: userWithCharacters?.characters.length,
      generationCount: userWithCharacters?.generations.length,
    });

    const userCharacters = await Character.findByUserId(testUser.id);
    console.log('✅ User characters query:', userCharacters.length);

    const userGenerations = await Generation.findByUserId(testUser.id);
    console.log('✅ User generations query:', userGenerations.length);

    // Test stats operations
    console.log('📊 Testing stats operations...');
    
    const charStats = await Character.getCharacterStats(testUser.id);
    console.log('✅ Character stats:', charStats);

    const genStats = await Generation.getGenerationStats(testUser.id);
    console.log('✅ Generation stats:', genStats);

    // Cleanup test data
    console.log('🧹 Cleaning up test data...');
    await Generation.delete(testGeneration.id);
    await Character.delete(testCharacter.id);
    await User.delete(testUser.id);
    console.log('✅ Test data cleaned up');

    return true;
  } catch (error) {
    console.error('❌ CRUD operations test failed:', error);
    return false;
  }
}

async function testAdvancedQueries() {
  console.log('\n🔬 Testing advanced queries...');
  
  try {
    // Test popular tags query
    const popularTags = await Character.getPopularTags(5);
    console.log('✅ Popular tags query:', popularTags);

    // Test public characters query
    const publicChars = await Character.findPublicCharacters({ take: 3 });
    console.log('✅ Public characters query:', publicChars.length);

    // Test pending generations query
    const pendingGens = await Generation.getPendingGenerations();
    console.log('✅ Pending generations query:', pendingGens.length);

    // Test users with active subscriptions
    const activeUsers = await User.getUsersWithActiveSubscriptions();
    console.log('✅ Active subscription users query:', activeUsers.length);

    return true;
  } catch (error) {
    console.error('❌ Advanced queries test failed:', error);
    return false;
  }
}

async function runAllTests() {
  console.log('🚀 Starting comprehensive database tests...\n');

  const connectionTest = await testDatabaseConnection();
  if (!connectionTest) {
    console.log('❌ Connection test failed. Skipping other tests.');
    process.exit(1);
  }

  const crudTest = await testCRUDOperations();
  const advancedTest = await testAdvancedQueries();

  console.log('\n📋 Test Results Summary:');
  console.log(`Connection Test: ${connectionTest ? '✅ PASS' : '❌ FAIL'}`);
  console.log(`CRUD Operations Test: ${crudTest ? '✅ PASS' : '❌ FAIL'}`);
  console.log(`Advanced Queries Test: ${advancedTest ? '✅ PASS' : '❌ FAIL'}`);

  if (connectionTest && crudTest && advancedTest) {
    console.log('\n🎉 All database tests passed! Database layer is ready.');
    process.exit(0);
  } else {
    console.log('\n💥 Some tests failed. Please check the database configuration.');
    process.exit(1);
  }
}

// Run the tests if this script is executed directly
if (require.main === module) {
  runAllTests().catch((error) => {
    console.error('🚨 Fatal error during tests:', error);
    process.exit(1);
  });
}

export { testDatabaseConnection, testCRUDOperations, testAdvancedQueries };