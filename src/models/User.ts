import { User, Prisma, SubscriptionTier } from '@prisma/client';
import { getPrismaClient } from '../config/database';
import { UserCreateData, UserUpdateData, ModelValidationResult, UserConstraints } from '../types/models';

export class UserModel {
  private prisma = getPrismaClient();

  async create(data: Prisma.UserCreateInput): Promise<User> {
    return this.prisma.user.create({
      data,
    });
  }

  async findById(id: string): Promise<User | null> {
    return this.prisma.user.findUnique({
      where: { id },
    });
  }

  async findByEmail(email: string): Promise<User | null> {
    return this.prisma.user.findUnique({
      where: { email },
    });
  }

  async findByAuth0Id(auth0Id: string): Promise<User | null> {
    return this.prisma.user.findUnique({
      where: { auth0Id },
    });
  }

  async update(id: string, data: Prisma.UserUpdateInput): Promise<User> {
    return this.prisma.user.update({
      where: { id },
      data,
    });
  }

  async delete(id: string): Promise<User> {
    return this.prisma.user.delete({
      where: { id },
    });
  }

  async updateSubscription(id: string, tier: SubscriptionTier): Promise<User> {
    const quotaLimits = {
      FREE: 3,
      PREMIUM: 50,
      PRO: 500,
    };

    return this.prisma.user.update({
      where: { id },
      data: {
        subscriptionTier: tier,
        dailyQuota: quotaLimits[tier],
      },
    });
  }

  async incrementDailyUsage(id: string): Promise<User> {
    return this.prisma.user.update({
      where: { id },
      data: {
        dailyUsed: { increment: 1 },
        totalGenerated: { increment: 1 },
      },
    });
  }

  async resetDailyUsage(id: string): Promise<User> {
    return this.prisma.user.update({
      where: { id },
      data: {
        dailyUsed: 0,
        lastResetDate: new Date(),
      },
    });
  }

  async checkDailyQuotaExceeded(id: string): Promise<boolean> {
    const user = await this.findById(id);
    if (!user) {
      throw new Error('User not found');
    }

    // Reset daily usage if it's a new day
    const now = new Date();
    const lastReset = new Date(user.lastResetDate);
    const isNewDay = now.toDateString() !== lastReset.toDateString();

    if (isNewDay) {
      await this.resetDailyUsage(id);
      return false;
    }

    return user.dailyUsed >= user.dailyQuota;
  }

  async getUserWithCharacters(id: string) {
    return this.prisma.user.findUnique({
      where: { id },
      include: {
        characters: {
          orderBy: { createdAt: 'desc' },
        },
        generations: {
          orderBy: { createdAt: 'desc' },
          take: 10,
        },
      },
    });
  }

  async getUsersWithActiveSubscriptions() {
    return this.prisma.user.findMany({
      where: {
        subscriptionTier: {
          not: SubscriptionTier.FREE,
        },
      },
      include: {
        _count: {
          select: {
            characters: true,
            generations: true,
          },
        },
      },
    });
  }

  // Enhanced validation and constraint methods
  private readonly constraints: UserConstraints = {
    email: {
      maxLength: 255,
      required: true,
      pattern: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
    },
    name: {
      maxLength: 100,
      required: false,
    },
    avatar: {
      maxLength: 500,
      required: false,
      pattern: /^https?:\/\/.+\.(jpg|jpeg|png|gif|webp)$/i,
    },
  };

  async validateUser(data: Partial<UserCreateData>): Promise<ModelValidationResult> {
    const errors: string[] = [];

    // Email validation
    if (!data.email || data.email.trim().length === 0) {
      errors.push('Email is required');
    } else {
      if (data.email.length > this.constraints.email.maxLength) {
        errors.push(`Email must be ${this.constraints.email.maxLength} characters or less`);
      }
      if (!this.constraints.email.pattern.test(data.email)) {
        errors.push('Email must be a valid email address');
      }
    }

    // Name validation
    if (data.name !== undefined) {
      if (data.name && data.name.length > this.constraints.name.maxLength) {
        errors.push(`Name must be ${this.constraints.name.maxLength} characters or less`);
      }
    }

    // Avatar validation
    if (data.avatar) {
      if (data.avatar.length > this.constraints.avatar.maxLength) {
        errors.push(`Avatar URL must be ${this.constraints.avatar.maxLength} characters or less`);
      }
      if (!this.constraints.avatar.pattern.test(data.avatar)) {
        errors.push('Avatar must be a valid image URL');
      }
    }

    // Check if email already exists (for create operations)
    if (data.email) {
      const existingUser = await this.findByEmail(data.email);
      if (existingUser) {
        errors.push('Email already exists');
      }
    }

    return {
      isValid: errors.length === 0,
      errors,
    };
  }

  async validateUserUpdate(id: string, data: Partial<UserUpdateData>): Promise<ModelValidationResult> {
    const errors: string[] = [];

    // Check if user exists
    const existingUser = await this.findById(id);
    if (!existingUser) {
      errors.push('User not found');
      return { isValid: false, errors };
    }

    // Name validation
    if (data.name !== undefined) {
      if (data.name && data.name.length > this.constraints.name.maxLength) {
        errors.push(`Name must be ${this.constraints.name.maxLength} characters or less`);
      }
    }

    // Avatar validation
    if (data.avatar) {
      if (data.avatar.length > this.constraints.avatar.maxLength) {
        errors.push(`Avatar URL must be ${this.constraints.avatar.maxLength} characters or less`);
      }
      if (!this.constraints.avatar.pattern.test(data.avatar)) {
        errors.push('Avatar must be a valid image URL');
      }
    }

    return {
      isValid: errors.length === 0,
      errors,
    };
  }

  async canUserCreateCharacter(id: string): Promise<{ allowed: boolean; reason?: string }> {
    const user = await this.findById(id);
    if (!user) {
      return { allowed: false, reason: 'User not found' };
    }

    const quotaExceeded = await this.checkDailyQuotaExceeded(id);
    if (quotaExceeded) {
      return { allowed: false, reason: 'Daily generation quota exceeded' };
    }

    return { allowed: true };
  }

  async getUserStats(): Promise<{
    totalUsers: number;
    activeUsers: number;
    bySubscriptionTier: Record<string, number>;
    totalCharactersCreated: number;
  }> {
    const users = await this.prisma.user.findMany({
      select: {
        subscriptionTier: true,
        totalGenerated: true,
        lastResetDate: true,
      },
    });

    const bySubscriptionTier: Record<string, number> = {};
    let totalCharactersCreated = 0;
    let activeUsers = 0;

    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    users.forEach(user => {
      bySubscriptionTier[user.subscriptionTier] = (bySubscriptionTier[user.subscriptionTier] || 0) + 1;
      totalCharactersCreated += user.totalGenerated;
      
      if (user.lastResetDate > thirtyDaysAgo) {
        activeUsers++;
      }
    });

    return {
      totalUsers: users.length,
      activeUsers,
      bySubscriptionTier,
      totalCharactersCreated,
    };
  }

  async findUsersNeedingReset(): Promise<User[]> {
    const oneDayAgo = new Date();
    oneDayAgo.setDate(oneDayAgo.getDate() - 1);

    return this.prisma.user.findMany({
      where: {
        lastResetDate: {
          lt: oneDayAgo,
        },
        dailyUsed: {
          gt: 0,
        },
      },
    });
  }

  async bulkResetDailyUsage(userIds: string[]): Promise<number> {
    const result = await this.prisma.user.updateMany({
      where: {
        id: {
          in: userIds,
        },
      },
      data: {
        dailyUsed: 0,
        lastResetDate: new Date(),
      },
    });

    return result.count;
  }
}

export default new UserModel();