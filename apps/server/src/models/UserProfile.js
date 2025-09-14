import { User, Prisma } from '@prisma/client';
import { getPrismaClient } from '../config/database';
import UserModel from './User';

/**
 * UserProfile model for managing user profile-specific operations
 * This provides a focused interface for profile management,
 * preferences, and user-specific settings
 */
export class UserProfileModel {
  constructor() {
    this.prisma = getPrismaClient();
    this.userModel = UserModel;
  }

  /**
   * Get user profile with additional preferences and settings
   */
  async getProfile(userId) {
    const user = await this.userModel.findById(userId);
    if (!user) {
      throw new Error('User not found');
    }

    return {
      id: user.id,
      email: user.email,
      auth0Id: user.auth0Id,
      name: user.name,
      avatar: user.avatar,
      subscriptionTier: user.subscriptionTier,
      preferences: this.extractPreferencesFromMetadata(user),
      stats: {
        dailyQuota: user.dailyQuota,
        dailyUsed: user.dailyUsed,
        totalGenerated: user.totalGenerated,
        lastResetDate: user.lastResetDate,
      },
      timestamps: {
        createdAt: user.createdAt,
        updatedAt: user.updatedAt,
      },
    };
  }

  /**
   * Update user profile information
   */
  async updateProfile(userId, profileData) {
    const validationResult = await this.validateProfileUpdate(userId, profileData);
    if (!validationResult.isValid) {
      throw new Error(`Profile validation failed: ${validationResult.errors.join(', ')}`);
    }

    const updateData = {
      name: profileData.name,
      avatar: profileData.avatar,
    };

    // Remove undefined values
    Object.keys(updateData).forEach(key => {
      if (updateData[key] === undefined) {
        delete updateData[key];
      }
    });

    return this.userModel.update(userId, updateData);
  }

  /**
   * Get user preferences
   * This could be extended to use a separate preferences table in the future
   */
  async getPreferences(userId) {
    const user = await this.userModel.findById(userId);
    if (!user) {
      throw new Error('User not found');
    }

    return this.extractPreferencesFromMetadata(user);
  }

  /**
   * Update user preferences
   */
  async updatePreferences(userId, preferences) {
    const user = await this.userModel.findById(userId);
    if (!user) {
      throw new Error('User not found');
    }

    const validPreferences = this.validatePreferences(preferences);
    
    // For now, we'll store preferences in user metadata
    // In a future version, this could be moved to a separate preferences table
    const currentMetadata = user.metadata || {};
    const updatedMetadata = {
      ...currentMetadata,
      preferences: {
        ...this.extractPreferencesFromMetadata(user),
        ...validPreferences,
      },
    };

    return this.userModel.update(userId, {
      metadata: updatedMetadata,
    });
  }

  /**
   * Get user activity summary
   */
  async getActivitySummary(userId) {
    const user = await this.userModel.getUserWithCharacters(userId);
    if (!user) {
      throw new Error('User not found');
    }

    const charactersCount = user.characters?.length || 0;
    const recentCharacters = user.characters?.slice(0, 5) || [];
    const recentGenerations = user.generations?.slice(0, 5) || [];

    return {
      userId: user.id,
      stats: {
        totalCharacters: charactersCount,
        totalGenerations: user.totalGenerated,
        dailyUsed: user.dailyUsed,
        dailyQuota: user.dailyQuota,
        subscriptionTier: user.subscriptionTier,
      },
      recentActivity: {
        characters: recentCharacters.map(char => ({
          id: char.id,
          name: char.name,
          createdAt: char.createdAt,
          generationStatus: char.generationStatus,
        })),
        generations: recentGenerations.map(gen => ({
          id: gen.id,
          status: gen.status,
          createdAt: gen.createdAt,
          completedAt: gen.completedAt,
        })),
      },
    };
  }

  /**
   * Delete user profile (cascading delete handled by database)
   */
  async deleteProfile(userId) {
    const user = await this.userModel.findById(userId);
    if (!user) {
      throw new Error('User not found');
    }

    return this.userModel.delete(userId);
  }

  /**
   * Check if user can perform specific actions based on subscription
   */
  async getUserPermissions(userId) {
    const user = await this.userModel.findById(userId);
    if (!user) {
      throw new Error('User not found');
    }

    const quotaCheck = await this.userModel.checkDailyQuotaExceeded(userId);

    return {
      canCreateCharacter: !quotaCheck,
      canCreateCollection: true,
      canSharePublicly: user.subscriptionTier !== 'FREE',
      canAccessPremiumStyles: user.subscriptionTier === 'PREMIUM' || user.subscriptionTier === 'PRO',
      canBatchGenerate: user.subscriptionTier === 'PRO',
      dailyQuotaStatus: {
        used: user.dailyUsed,
        limit: user.dailyQuota,
        exceeded: quotaCheck,
        resetDate: user.lastResetDate,
      },
    };
  }

  /**
   * Extract preferences from user metadata
   */
  extractPreferencesFromMetadata(user) {
    const defaultPreferences = {
      theme: 'light',
      notifications: {
        email: true,
        browser: true,
        generationComplete: true,
        dailyQuotaWarning: true,
      },
      privacy: {
        profileVisible: true,
        charactersDefaultPublic: false,
        allowDataCollection: true,
      },
      generation: {
        defaultStyle: 'REALISTIC',
        autoSaveThumbnails: true,
        batchSize: 1,
      },
    };

    if (!user.metadata || !user.metadata.preferences) {
      return defaultPreferences;
    }

    return {
      ...defaultPreferences,
      ...user.metadata.preferences,
    };
  }

  /**
   * Validate preferences object
   */
  validatePreferences(preferences) {
    const validThemes = ['light', 'dark', 'auto'];
    const validStyles = ['REALISTIC', 'CARTOON', 'ANIME', 'FANTASY', 'CYBERPUNK', 'VINTAGE', 'MINIMALIST'];

    const validated = {};

    if (preferences.theme && validThemes.includes(preferences.theme)) {
      validated.theme = preferences.theme;
    }

    if (preferences.notifications && typeof preferences.notifications === 'object') {
      validated.notifications = {};
      ['email', 'browser', 'generationComplete', 'dailyQuotaWarning'].forEach(key => {
        if (typeof preferences.notifications[key] === 'boolean') {
          validated.notifications[key] = preferences.notifications[key];
        }
      });
    }

    if (preferences.privacy && typeof preferences.privacy === 'object') {
      validated.privacy = {};
      ['profileVisible', 'charactersDefaultPublic', 'allowDataCollection'].forEach(key => {
        if (typeof preferences.privacy[key] === 'boolean') {
          validated.privacy[key] = preferences.privacy[key];
        }
      });
    }

    if (preferences.generation && typeof preferences.generation === 'object') {
      validated.generation = {};
      if (preferences.generation.defaultStyle && validStyles.includes(preferences.generation.defaultStyle)) {
        validated.generation.defaultStyle = preferences.generation.defaultStyle;
      }
      if (typeof preferences.generation.autoSaveThumbnails === 'boolean') {
        validated.generation.autoSaveThumbnails = preferences.generation.autoSaveThumbnails;
      }
      if (typeof preferences.generation.batchSize === 'number' && 
          preferences.generation.batchSize >= 1 && 
          preferences.generation.batchSize <= 10) {
        validated.generation.batchSize = preferences.generation.batchSize;
      }
    }

    return validated;
  }

  /**
   * Validate profile update data
   */
  async validateProfileUpdate(userId, profileData) {
    const errors = [];

    // Check if user exists
    const user = await this.userModel.findById(userId);
    if (!user) {
      errors.push('User not found');
      return { isValid: false, errors };
    }

    // Name validation
    if (profileData.name !== undefined) {
      if (profileData.name && typeof profileData.name !== 'string') {
        errors.push('Name must be a string');
      } else if (profileData.name && profileData.name.length > 100) {
        errors.push('Name must be 100 characters or less');
      }
    }

    // Avatar validation
    if (profileData.avatar !== undefined) {
      if (profileData.avatar && typeof profileData.avatar !== 'string') {
        errors.push('Avatar must be a URL string');
      } else if (profileData.avatar && profileData.avatar.length > 500) {
        errors.push('Avatar URL must be 500 characters or less');
      } else if (profileData.avatar && !/^https?:\/\/.+\.(jpg|jpeg|png|gif|webp)$/i.test(profileData.avatar)) {
        errors.push('Avatar must be a valid image URL');
      }
    }

    return {
      isValid: errors.length === 0,
      errors,
    };
  }

  /**
   * Create user profile from Auth0 data
   */
  async createProfileFromAuth0(auth0User) {
    const userData = {
      email: auth0User.email,
      auth0Id: auth0User.sub,
      name: auth0User.name || auth0User.nickname,
      avatar: auth0User.picture,
    };

    // Validate the data
    const validationResult = await this.userModel.validateUser(userData);
    if (!validationResult.isValid) {
      throw new Error(`User validation failed: ${validationResult.errors.join(', ')}`);
    }

    // Check if user already exists
    const existingUser = await this.userModel.findByAuth0Id(auth0User.sub);
    if (existingUser) {
      return existingUser;
    }

    // Create new user with default preferences
    const newUser = await this.userModel.create({
      ...userData,
      metadata: {
        preferences: this.extractPreferencesFromMetadata({}),
        createdFromAuth0: true,
        auth0Profile: {
          provider: auth0User.sub.split('|')[0],
          lastLogin: new Date(),
        },
      },
    });

    return newUser;
  }

  /**
   * Sync user profile with Auth0 data
   */
  async syncWithAuth0(userId, auth0User) {
    const user = await this.userModel.findById(userId);
    if (!user) {
      throw new Error('User not found');
    }

    const updateData = {};
    let hasChanges = false;

    // Update name if different
    if (auth0User.name && auth0User.name !== user.name) {
      updateData.name = auth0User.name;
      hasChanges = true;
    }

    // Update avatar if different
    if (auth0User.picture && auth0User.picture !== user.avatar) {
      updateData.avatar = auth0User.picture;
      hasChanges = true;
    }

    // Update metadata with last login
    const currentMetadata = user.metadata || {};
    updateData.metadata = {
      ...currentMetadata,
      auth0Profile: {
        ...currentMetadata.auth0Profile,
        lastLogin: new Date(),
        provider: auth0User.sub.split('|')[0],
      },
    };
    hasChanges = true;

    if (hasChanges) {
      return this.userModel.update(userId, updateData);
    }

    return user;
  }
}

export default new UserProfileModel();