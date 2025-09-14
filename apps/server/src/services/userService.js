import UserModel from '../models/User';
import UserProfileModel from '../models/UserProfile';
import UserCharacterRelationsModel from '../models/UserCharacterRelations';

/**
 * User Service - High-level service for user and profile management
 * Combines User, UserProfile, and UserCharacterRelations models to provide comprehensive user operations
 */
export class UserService {
  constructor() {
    this.userModel = UserModel;
    this.userProfileModel = UserProfileModel;
    this.userCharacterRelations = UserCharacterRelationsModel;
  }

  // ==================== Auth0 Integration ====================

  /**
   * Handle Auth0 login - create or update user profile
   */
  async handleAuth0Login(auth0User) {
    try {
      // Try to find existing user by Auth0 ID
      let user = await this.userModel.findByAuth0Id(auth0User.sub);
      
      if (user) {
        // User exists, sync with Auth0 data
        user = await this.userProfileModel.syncWithAuth0(user.id, auth0User);
      } else {
        // New user, create profile from Auth0 data
        user = await this.userProfileModel.createProfileFromAuth0(auth0User);
      }

      return {
        user,
        isNewUser: !user,
        profile: await this.userProfileModel.getProfile(user.id),
      };
    } catch (error) {
      console.error('Error handling Auth0 login:', error);
      throw new Error(`Authentication failed: ${error.message}`);
    }
  }

  /**
   * Get user by Auth0 ID
   */
  async getUserByAuth0Id(auth0Id) {
    const user = await this.userModel.findByAuth0Id(auth0Id);
    if (!user) {
      throw new Error('User not found');
    }
    return user;
  }

  /**
   * Link existing user with Auth0 account
   */
  async linkUserToAuth0(userId, auth0Id) {
    const existingAuth0User = await this.userModel.findByAuth0Id(auth0Id);
    if (existingAuth0User) {
      throw new Error('Auth0 account already linked to another user');
    }

    return this.userModel.update(userId, { auth0Id });
  }

  // ==================== User Management ====================

  /**
   * Create new user
   */
  async createUser(userData) {
    const validationResult = await this.userModel.validateUser(userData);
    if (!validationResult.isValid) {
      throw new Error(`User validation failed: ${validationResult.errors.join(', ')}`);
    }

    return this.userModel.create(userData);
  }

  /**
   * Get user by ID
   */
  async getUser(userId) {
    const user = await this.userModel.findById(userId);
    if (!user) {
      throw new Error('User not found');
    }
    return user;
  }

  /**
   * Get user by email
   */
  async getUserByEmail(email) {
    const user = await this.userModel.findByEmail(email);
    if (!user) {
      throw new Error('User not found');
    }
    return user;
  }

  /**
   * Update user
   */
  async updateUser(userId, updateData) {
    const validationResult = await this.userModel.validateUserUpdate(userId, updateData);
    if (!validationResult.isValid) {
      throw new Error(`User update validation failed: ${validationResult.errors.join(', ')}`);
    }

    return this.userModel.update(userId, updateData);
  }

  /**
   * Delete user and all associated data
   */
  async deleteUser(userId) {
    const user = await this.userModel.findById(userId);
    if (!user) {
      throw new Error('User not found');
    }

    // The database cascade will handle deleting associated characters, generations, etc.
    return this.userModel.delete(userId);
  }

  // ==================== Profile Management ====================

  /**
   * Get complete user profile
   */
  async getUserProfile(userId) {
    return this.userProfileModel.getProfile(userId);
  }

  /**
   * Update user profile
   */
  async updateUserProfile(userId, profileData) {
    return this.userProfileModel.updateProfile(userId, profileData);
  }

  /**
   * Get user preferences
   */
  async getUserPreferences(userId) {
    return this.userProfileModel.getPreferences(userId);
  }

  /**
   * Update user preferences
   */
  async updateUserPreferences(userId, preferences) {
    return this.userProfileModel.updatePreferences(userId, preferences);
  }

  /**
   * Get user activity summary
   */
  async getUserActivity(userId) {
    return this.userProfileModel.getActivitySummary(userId);
  }

  /**
   * Get user permissions based on subscription
   */
  async getUserPermissions(userId) {
    return this.userProfileModel.getUserPermissions(userId);
  }

  // ==================== Subscription Management ====================

  /**
   * Update user subscription tier
   */
  async updateSubscription(userId, tier) {
    const validTiers = ['FREE', 'PREMIUM', 'PRO'];
    if (!validTiers.includes(tier)) {
      throw new Error('Invalid subscription tier');
    }

    return this.userModel.updateSubscription(userId, tier);
  }

  /**
   * Check if user can create character (quota check)
   */
  async canUserCreateCharacter(userId) {
    return this.userModel.canUserCreateCharacter(userId);
  }

  /**
   * Increment user's daily usage
   */
  async incrementUserUsage(userId) {
    return this.userModel.incrementDailyUsage(userId);
  }

  /**
   * Reset user's daily usage
   */
  async resetUserDailyUsage(userId) {
    return this.userModel.resetDailyUsage(userId);
  }

  // ==================== User-Character Relationships ====================

  /**
   * Get user with their characters
   */
  async getUserWithCharacters(userId) {
    const userWithChars = await this.userModel.getUserWithCharacters(userId);
    if (!userWithChars) {
      throw new Error('User not found');
    }
    return userWithChars;
  }

  /**
   * Validate user can access character
   */
  async validateUserCharacterAccess(userId, characterId) {
    const user = await this.userModel.getUserWithCharacters(userId);
    if (!user) {
      throw new Error('User not found');
    }

    const character = user.characters.find(char => char.id === characterId);
    if (!character) {
      throw new Error('Character not found or does not belong to user');
    }

    return { user, character };
  }

  /**
   * Get user's character count and limits
   */
  async getUserCharacterStats(userId) {
    const user = await this.userModel.getUserWithCharacters(userId);
    if (!user) {
      throw new Error('User not found');
    }

    const characterCount = user.characters?.length || 0;
    
    // Define limits based on subscription tier
    const limits = {
      FREE: { maxCharacters: 10, maxPublicCharacters: 3 },
      PREMIUM: { maxCharacters: 100, maxPublicCharacters: 20 },
      PRO: { maxCharacters: 1000, maxPublicCharacters: 100 },
    };

    const userLimits = limits[user.subscriptionTier] || limits.FREE;
    const publicCharacterCount = user.characters?.filter(char => char.isPublic).length || 0;

    return {
      totalCharacters: characterCount,
      publicCharacters: publicCharacterCount,
      limits: userLimits,
      canCreateMore: characterCount < userLimits.maxCharacters,
      canMakePublic: publicCharacterCount < userLimits.maxPublicCharacters,
    };
  }

  // ==================== Enhanced Relationship Validation ====================

  /**
   * Validate character ownership
   */
  async validateCharacterOwnership(userId, characterId) {
    return this.userCharacterRelations.validateCharacterOwnership(userId, characterId);
  }

  /**
   * Validate character access (owned or public)
   */
  async validateCharacterAccess(userId, characterId) {
    return this.userCharacterRelations.validateCharacterAccess(userId, characterId);
  }

  /**
   * Bulk validate character ownership
   */
  async validateBulkCharacterOwnership(userId, characterIds) {
    return this.userCharacterRelations.validateBulkCharacterOwnership(userId, characterIds);
  }

  /**
   * Get comprehensive user-character statistics
   */
  async getDetailedCharacterStats(userId) {
    return this.userCharacterRelations.getUserCharacterStats(userId);
  }

  /**
   * Enhanced can create character check
   */
  async canUserCreateCharacterAdvanced(userId) {
    return this.userCharacterRelations.canUserCreateCharacter(userId);
  }

  /**
   * Check if user can make character public
   */
  async canUserMakeCharacterPublic(userId, characterId) {
    return this.userCharacterRelations.canUserMakeCharacterPublic(userId, characterId);
  }

  /**
   * Check if user can delete character
   */
  async canUserDeleteCharacter(userId, characterId) {
    return this.userCharacterRelations.canUserDeleteCharacter(userId, characterId);
  }

  /**
   * Validate collection access
   */
  async validateCollectionAccess(userId, collectionId) {
    return this.userCharacterRelations.validateCollectionAccess(userId, collectionId);
  }

  /**
   * Check if user can add character to collection
   */
  async canUserAddCharacterToCollection(userId, characterId, collectionId) {
    return this.userCharacterRelations.canUserAddCharacterToCollection(userId, characterId, collectionId);
  }

  /**
   * Get user character ownership summary
   */
  async getUserCharacterOwnershipSummary(userId) {
    return this.userCharacterRelations.getUserCharacterOwnershipSummary(userId);
  }

  // ==================== Admin Operations ====================

  /**
   * Get user statistics (admin)
   */
  async getUserStats() {
    return this.userModel.getUserStats();
  }

  /**
   * Get users with active subscriptions (admin)
   */
  async getActiveSubscribers() {
    return this.userModel.getUsersWithActiveSubscriptions();
  }

  /**
   * Find users needing daily quota reset (admin)
   */
  async getUsersNeedingReset() {
    return this.userModel.findUsersNeedingReset();
  }

  /**
   * Bulk reset daily usage for users (admin)
   */
  async bulkResetDailyUsage(userIds) {
    if (!Array.isArray(userIds) || userIds.length === 0) {
      throw new Error('User IDs array is required');
    }

    return this.userModel.bulkResetDailyUsage(userIds);
  }

  // ==================== User Search and Discovery ====================

  /**
   * Search users by name or email (admin)
   */
  async searchUsers(query, options = {}) {
    const { skip = 0, take = 20 } = options;

    if (!query || query.trim().length < 2) {
      throw new Error('Search query must be at least 2 characters');
    }

    const users = await this.userModel.prisma.user.findMany({
      where: {
        OR: [
          { name: { contains: query.trim(), mode: 'insensitive' } },
          { email: { contains: query.trim(), mode: 'insensitive' } },
        ],
      },
      select: {
        id: true,
        name: true,
        email: true,
        avatar: true,
        subscriptionTier: true,
        totalGenerated: true,
        createdAt: true,
        _count: {
          select: {
            characters: true,
          },
        },
      },
      skip,
      take,
      orderBy: { createdAt: 'desc' },
    });

    return users;
  }

  // ==================== Utilities ====================

  /**
   * Validate user exists and return basic info
   */
  async validateUser(userId) {
    const user = await this.userModel.findById(userId);
    if (!user) {
      throw new Error('User not found');
    }

    return {
      id: user.id,
      email: user.email,
      name: user.name,
      subscriptionTier: user.subscriptionTier,
      isValid: true,
    };
  }

  /**
   * Check if email is already in use
   */
  async isEmailTaken(email) {
    try {
      const user = await this.userModel.findByEmail(email);
      return !!user;
    } catch (error) {
      return false;
    }
  }

  /**
   * Generate user summary for display
   */
  async getUserSummary(userId) {
    const profile = await this.userProfileModel.getProfile(userId);
    const permissions = await this.userProfileModel.getUserPermissions(userId);
    const stats = await this.getUserCharacterStats(userId);

    return {
      profile: {
        id: profile.id,
        name: profile.name,
        email: profile.email,
        avatar: profile.avatar,
        subscriptionTier: profile.subscriptionTier,
      },
      stats: {
        characters: stats.totalCharacters,
        publicCharacters: stats.publicCharacters,
        totalGenerated: profile.stats.totalGenerated,
        dailyUsed: profile.stats.dailyUsed,
        dailyQuota: profile.stats.dailyQuota,
      },
      permissions: permissions,
      preferences: profile.preferences,
    };
  }

  /**
   * Health check for user service
   */
  async healthCheck() {
    try {
      // Test database connection by counting users
      const count = await this.userModel.prisma.user.count();
      
      // Test relationships health
      const relationshipsHealth = await this.userCharacterRelations.healthCheck();
      
      return {
        status: 'healthy',
        userCount: count,
        relationships: relationshipsHealth,
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

export default new UserService();