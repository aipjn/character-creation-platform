import { getDatabaseConnection } from '../database/connection';
import { SubscriptionTier } from '@prisma/client';

interface SeedOptions {
  verbose?: boolean;
}

const DEVELOPMENT_USERS = [
  {
    email: 'admin@character-creator.dev',
    name: 'Admin User',
    subscriptionTier: SubscriptionTier.PRO,
    dailyQuota: 50,
  },
  {
    email: 'premium@character-creator.dev', 
    name: 'Premium Tester',
    subscriptionTier: SubscriptionTier.PREMIUM,
    dailyQuota: 15,
  },
  {
    email: 'free@character-creator.dev',
    name: 'Free User',
    subscriptionTier: SubscriptionTier.FREE,
    dailyQuota: 3,
  },
  {
    email: 'test1@character-creator.dev',
    name: 'Test User One',
    subscriptionTier: SubscriptionTier.FREE,
    dailyQuota: 3,
  },
  {
    email: 'test2@character-creator.dev',
    name: 'Test User Two', 
    subscriptionTier: SubscriptionTier.PREMIUM,
    dailyQuota: 15,
  },
];

/**
 * Seed development users into the database
 */
export async function seedDevelopmentUsers(options: SeedOptions = {}): Promise<number> {
  const { verbose = false } = options;
  
  try {
    const dbConnection = getDatabaseConnection();
    const prisma = dbConnection.getPrismaClient();
    
    if (verbose) {
      console.log('   👥 Creating development users...');
    }
    
    // Use transaction to ensure all users are created together
    await dbConnection.transaction(async (tx) => {
      for (const user of DEVELOPMENT_USERS) {
        await tx.user.create({
          data: user,
        });
        
        if (verbose) {
          console.log(`      ✅ ${user.name} (${user.email}) - ${user.subscriptionTier}`);
        }
      }
    });
    
    return DEVELOPMENT_USERS.length;
    
  } catch (error) {
    console.error('Failed to seed development users:', error);
    throw error;
  }
}

/**
 * Get all development user data for reference
 */
export function getDevelopmentUserData() {
  return DEVELOPMENT_USERS;
}