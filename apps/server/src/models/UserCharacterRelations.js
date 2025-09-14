/**
 * UserCharacterRelations - Enhanced user-character relationship validation and management
 * This model provides comprehensive validation and management for user-character associations
 */

import { getPrismaClient } from '../config/database';
import UserModel from './User';

export class UserCharacterRelationsModel {
  constructor() {
    this.prisma = getPrismaClient();
    this.userModel = UserModel;
  }

  // ==================== Ownership Validation ====================

  /**
   * Validate that a user owns a character
   */
  async validateCharacterOwnership(userId, characterId) {
    const character = await this.prisma.character.findFirst({
      where: {
        id: characterId,
        userId: userId,
      },
      select: {
        id: true,
        userId: true,
        name: true,
        isPublic: true,
        generationStatus: true,
        user: {
          select: {
            id: true,
            name: true,
            subscriptionTier: true,
          },
        },
      },
    });

    if (!character) {
      return {
        isValid: false,
        error: 'Character not found or does not belong to user',
        character: null,
      };
    }

    return {
      isValid: true,
      error: null,
      character,
    };
  }

  /**
   * Validate user can access character (owned or public)
   */
  async validateCharacterAccess(userId, characterId) {
    const character = await this.prisma.character.findFirst({
      where: {
        id: characterId,
        OR: [
          { userId: userId }, // User owns the character
          { isPublic: true },   // Character is public
        ],
      },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            subscriptionTier: true,
          },
        },
      },
    });

    if (!character) {
      return {
        hasAccess: false,
        reason: 'Character not found or is private',
        character: null,
        accessType: null,
      };
    }

    const accessType = character.userId === userId ? 'owner' : 'public';
    
    return {
      hasAccess: true,
      reason: null,
      character,
      accessType,
    };
  }

  /**
   * Bulk validate character ownership for multiple characters
   */
  async validateBulkCharacterOwnership(userId, characterIds) {
    if (!Array.isArray(characterIds) || characterIds.length === 0) {
      throw new Error('Character IDs array is required');
    }

    const characters = await this.prisma.character.findMany({
      where: {
        id: { in: characterIds },
        userId: userId,
      },
      select: {
        id: true,
        name: true,
        userId: true,
      },
    });

    const foundIds = new Set(characters.map(char => char.id));
    const notFound = characterIds.filter(id => !foundIds.has(id));

    return {
      validCharacters: characters,
      invalidCharacterIds: notFound,
      allValid: notFound.length === 0,
    };
  }

  // ==================== User-Character Statistics ====================

  /**
   * Get comprehensive user-character relationship statistics
   */
  async getUserCharacterStats(userId) {
    const user = await this.userModel.findById(userId);
    if (!user) {
      throw new Error('User not found');
    }

    // Get character counts by various criteria
    const [
      totalCharacters,
      publicCharacters,
      privateCharacters,
      completedCharacters,
      pendingCharacters,
      favoriteCharacters,
      libraryCharacters,
      charactersByStyle,
    ] = await Promise.all([
      this.prisma.character.count({ where: { userId } }),
      this.prisma.character.count({ where: { userId, isPublic: true } }),
      this.prisma.character.count({ where: { userId, isPublic: false } }),
      this.prisma.character.count({ where: { userId, generationStatus: 'COMPLETED' } }),
      this.prisma.character.count({ where: { userId, generationStatus: { not: 'COMPLETED' } } }),
      this.prisma.character.count({ where: { userId, isFavorite: true } }),
      this.prisma.character.count({ where: { userId, isInLibrary: true } }),
      this.getCharactersByStyleStats(userId),
    ]);

    // Get subscription limits
    const limits = this.getSubscriptionLimits(user.subscriptionTier);

    return {
      userId,
      counts: {
        total: totalCharacters,
        public: publicCharacters,
        private: privateCharacters,
        completed: completedCharacters,
        pending: pendingCharacters,
        favorites: favoriteCharacters,
        library: libraryCharacters,
      },
      byStyle: charactersByStyle,
      limits,
      permissions: {
        canCreateMore: totalCharacters < limits.maxCharacters,
        canMakePublic: publicCharacters < limits.maxPublicCharacters,
        charactersRemaining: Math.max(0, limits.maxCharacters - totalCharacters),
        publicSlotsRemaining: Math.max(0, limits.maxPublicCharacters - publicCharacters),
      },
      quotaStatus: {
        dailyUsed: user.dailyUsed,
        dailyLimit: user.dailyQuota,
        canCreateToday: user.dailyUsed < user.dailyQuota,
        generationsRemaining: Math.max(0, user.dailyQuota - user.dailyUsed),
      },
    };
  }

  /**
   * Get character statistics by style for a user
   */
  async getCharactersByStyleStats(userId) {
    const charactersByStyle = await this.prisma.character.groupBy({
      by: ['styleType'],
      where: { userId },
      _count: { styleType: true },
    });

    const styleStats = {};
    charactersByStyle.forEach(style => {
      styleStats[style.styleType] = style._count.styleType;
    });

    return styleStats;
  }

  // ==================== Permission Validation ====================

  /**
   * Check if user can create a new character
   */
  async canUserCreateCharacter(userId) {
    const user = await this.userModel.findById(userId);
    if (!user) {
      throw new Error('User not found');
    }

    // Check daily quota
    const quotaExceeded = await this.userModel.checkDailyQuotaExceeded(userId);
    if (quotaExceeded) {
      return {
        allowed: false,
        reason: 'Daily generation quota exceeded',
        type: 'quota',
      };
    }

    // Check character count limit
    const characterCount = await this.prisma.character.count({ where: { userId } });
    const limits = this.getSubscriptionLimits(user.subscriptionTier);

    if (characterCount >= limits.maxCharacters) {
      return {
        allowed: false,
        reason: `Character limit reached (${limits.maxCharacters} max for ${user.subscriptionTier} tier)`,
        type: 'limit',
      };
    }

    return {
      allowed: true,
      charactersRemaining: limits.maxCharacters - characterCount,
      quotaRemaining: user.dailyQuota - user.dailyUsed,
    };
  }

  /**
   * Check if user can make a character public
   */
  async canUserMakeCharacterPublic(userId, characterId) {
    const ownership = await this.validateCharacterOwnership(userId, characterId);
    if (!ownership.isValid) {
      return ownership;
    }

    const user = await this.userModel.findById(userId);
    const publicCharacterCount = await this.prisma.character.count({ 
      where: { userId, isPublic: true } 
    });
    
    const limits = this.getSubscriptionLimits(user.subscriptionTier);

    if (publicCharacterCount >= limits.maxPublicCharacters) {
      return {
        allowed: false,
        reason: `Public character limit reached (${limits.maxPublicCharacters} max for ${user.subscriptionTier} tier)`,
        type: 'public_limit',
      };
    }

    return {
      allowed: true,
      publicSlotsRemaining: limits.maxPublicCharacters - publicCharacterCount,
    };
  }

  /**
   * Check if user can delete a character
   */
  async canUserDeleteCharacter(userId, characterId) {
    const ownership = await this.validateCharacterOwnership(userId, characterId);
    if (!ownership.isValid) {
      return ownership;
    }

    // Check if character is being used in any collections
    const collectionUsage = await this.prisma.characterCollectionItem.count({
      where: { characterId },
    });

    return {
      allowed: true,
      character: ownership.character,
      warnings: collectionUsage > 0 ? [
        `This character is used in ${collectionUsage} collection(s). Deleting it will remove it from those collections.`
      ] : [],
    };
  }

  // ==================== Collection Relationships ====================

  /**
   * Validate user can access a collection
   */
  async validateCollectionAccess(userId, collectionId) {
    const collection = await this.prisma.characterCollection.findFirst({
      where: {
        id: collectionId,
        OR: [
          { userId: userId }, // User owns the collection
          { isPublic: true },   // Collection is public
        ],
      },
      include: {
        user: {
          select: {
            id: true,
            name: true,
          },
        },
        _count: {
          select: {
            items: true,
          },
        },
      },
    });

    if (!collection) {
      return {
        hasAccess: false,
        reason: 'Collection not found or is private',
        collection: null,
        accessType: null,
      };
    }

    const accessType = collection.userId === userId ? 'owner' : 'public';
    
    return {
      hasAccess: true,
      reason: null,
      collection,
      accessType,
    };
  }

  /**
   * Check if user can add character to collection
   */
  async canUserAddCharacterToCollection(userId, characterId, collectionId) {
    // Validate character ownership or public access
    const characterAccess = await this.validateCharacterAccess(userId, characterId);
    if (!characterAccess.hasAccess) {
      return {
        allowed: false,
        reason: characterAccess.reason,
        type: 'character_access',
      };
    }

    // Validate collection ownership
    const collectionOwnership = await this.validateCharacterOwnership(userId, collectionId);
    if (!collectionOwnership.isValid) {
      return {
        allowed: false,
        reason: 'You can only add characters to your own collections',
        type: 'collection_ownership',
      };
    }

    // Check if character is already in collection
    const existingItem = await this.prisma.characterCollectionItem.findFirst({
      where: {
        characterId,
        collectionId,
      },
    });

    if (existingItem) {
      return {
        allowed: false,
        reason: 'Character is already in this collection',
        type: 'duplicate',
      };
    }

    return { allowed: true };
  }

  // ==================== Utility Methods ====================

  /**
   * Get subscription tier limits
   */
  getSubscriptionLimits(tier) {
    const limits = {
      FREE: {
        maxCharacters: 10,
        maxPublicCharacters: 3,
        maxCollections: 3,
        maxCharactersPerCollection: 10,
      },
      PREMIUM: {
        maxCharacters: 100,
        maxPublicCharacters: 20,
        maxCollections: 20,
        maxCharactersPerCollection: 50,
      },
      PRO: {
        maxCharacters: 1000,
        maxPublicCharacters: 100,
        maxCollections: 100,
        maxCharactersPerCollection: 200,
      },
    };

    return limits[tier] || limits.FREE;
  }

  /**
   * Get user's character ownership summary
   */
  async getUserCharacterOwnershipSummary(userId) {
    const user = await this.userModel.findById(userId);
    if (!user) {
      throw new Error('User not found');
    }

    const stats = await this.getUserCharacterStats(userId);
    
    return {
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        subscriptionTier: user.subscriptionTier,
      },
      ownership: {
        totalCharacters: stats.counts.total,
        publicCharacters: stats.counts.public,
        privateCharacters: stats.counts.private,
        favoriteCharacters: stats.counts.favorites,
      },
      limits: stats.limits,
      permissions: stats.permissions,
      quotaStatus: stats.quotaStatus,
    };
  }

  /**
   * Health check for user-character relations
   */
  async healthCheck() {
    try {
      // Test basic functionality
      const userCount = await this.prisma.user.count();
      const characterCount = await this.prisma.character.count();
      const relationCount = await this.prisma.character.count({
        where: {
          userId: { not: null },
        },
      });

      return {
        status: 'healthy',
        stats: {
          totalUsers: userCount,
          totalCharacters: characterCount,
          validRelations: relationCount,
          orphanedCharacters: characterCount - relationCount,
        },
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

export default new UserCharacterRelationsModel();