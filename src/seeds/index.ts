import { getDatabaseConnection } from '../database/connection';
import { seedCharacterTemplates } from './characterTemplates';
import { seedDevelopmentUsers } from './developmentUsers';
import { seedSampleCharacters } from './sampleCharacters';

interface SeedOptions {
  environment: 'development' | 'production' | 'test';
  force?: boolean; // Skip existing data checks
  verbose?: boolean; // Detailed logging
}

/**
 * Main seeding function that orchestrates all seed operations
 */
export async function seedDatabase(options: SeedOptions = { environment: 'development' }): Promise<void> {
  const { environment, force = false, verbose = false } = options;
  
  console.log(`🌱 Starting database seeding for ${environment} environment...`);
  
  try {
    const dbConnection = getDatabaseConnection();
    const prisma = dbConnection.getPrismaClient();
    
    // Test database connection first
    const isConnected = await dbConnection.testConnection();
    if (!isConnected) {
      throw new Error('Database connection failed. Cannot proceed with seeding.');
    }

    // Check if seeding should run based on existing data
    if (!force) {
      const existingUsers = await prisma.user.count();
      const existingTemplates = await prisma.characterTemplate.count();
      
      if (existingUsers > 0 || existingTemplates > 0) {
        console.log('📊 Database already contains data. Use --force to overwrite.');
        console.log(`   Users: ${existingUsers}, Templates: ${existingTemplates}`);
        return;
      }
    }

    console.log('🧹 Clearing existing seed data (if any)...');
    
    // Clear data in correct order to avoid foreign key constraints
    if (force) {
      await prisma.generation.deleteMany({});
      await prisma.character.deleteMany({});
      await prisma.characterTemplate.deleteMany({});
      if (environment === 'development' || environment === 'test') {
        await prisma.user.deleteMany({});
      }
      
      if (verbose) {
        console.log('   ✅ Cleared existing data');
      }
    }

    // Seed character templates (always needed)
    console.log('🎨 Seeding character templates...');
    const templateCount = await seedCharacterTemplates({ verbose });
    console.log(`   ✅ Created ${templateCount} character templates`);

    // Seed development/test data
    if (environment === 'development' || environment === 'test') {
      console.log('👥 Seeding development users...');
      const userCount = await seedDevelopmentUsers({ verbose });
      console.log(`   ✅ Created ${userCount} development users`);

      console.log('🎭 Seeding sample characters...');
      const characterCount = await seedSampleCharacters({ verbose });
      console.log(`   ✅ Created ${characterCount} sample characters`);
    }

    console.log('✨ Database seeding completed successfully!');
    
    // Display summary
    const stats = await getDatabaseStats(prisma);
    console.log('\n📈 Database Summary:');
    console.log(`   Users: ${stats.users}`);
    console.log(`   Character Templates: ${stats.templates}`);
    console.log(`   Characters: ${stats.characters}`);
    console.log(`   Generations: ${stats.generations}`);
    
  } catch (error) {
    console.error('❌ Database seeding failed:', error);
    throw error;
  }
}

/**
 * Clear all seed data from database
 */
export async function clearSeedData(options: { environment: string; verbose?: boolean } = { environment: 'development' }): Promise<void> {
  const { environment, verbose = false } = options;
  
  if (environment === 'production') {
    throw new Error('Cannot clear seed data in production environment');
  }
  
  console.log(`🧹 Clearing seed data for ${environment} environment...`);
  
  try {
    const dbConnection = getDatabaseConnection();
    const prisma = dbConnection.getPrismaClient();
    
    // Clear in correct order to avoid foreign key constraints
    await prisma.generation.deleteMany({});
    if (verbose) console.log('   ✅ Cleared generations');
    
    await prisma.character.deleteMany({});
    if (verbose) console.log('   ✅ Cleared characters');
    
    await prisma.characterTemplate.deleteMany({});
    if (verbose) console.log('   ✅ Cleared character templates');
    
    if (environment === 'development' || environment === 'test') {
      await prisma.user.deleteMany({});
      if (verbose) console.log('   ✅ Cleared users');
    }
    
    console.log('✨ Seed data cleared successfully!');
    
  } catch (error) {
    console.error('❌ Failed to clear seed data:', error);
    throw error;
  }
}

/**
 * Get database statistics
 */
async function getDatabaseStats(prisma: any) {
  const [users, templates, characters, generations] = await Promise.all([
    prisma.user.count(),
    prisma.characterTemplate.count(), 
    prisma.character.count(),
    prisma.generation.count(),
  ]);
  
  return { users, templates, characters, generations };
}

/**
 * CLI entry point for seeding
 */
export async function runSeeds(): Promise<void> {
  const args = process.argv.slice(2);
  const environment = (args.find(arg => arg.startsWith('--env='))?.split('=')[1] || 
                      process.env.NODE_ENV || 
                      'development') as 'development' | 'production' | 'test';
  
  const force = args.includes('--force');
  const verbose = args.includes('--verbose');
  const clear = args.includes('--clear');

  try {
    if (clear) {
      await clearSeedData({ environment, verbose });
    } else {
      await seedDatabase({ environment, force, verbose });
    }
    process.exit(0);
  } catch (error) {
    console.error('Seeding failed:', error);
    process.exit(1);
  }
}

// Run seeds if this file is executed directly
if (require.main === module) {
  runSeeds();
}