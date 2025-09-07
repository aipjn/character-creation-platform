import { UserModel } from '../../../src/models/User';
import { getPrismaClient } from '../../../src/config/database';
import { SubscriptionTier } from '@prisma/client';

// Mock Prisma client
jest.mock('../../../src/config/database');

const mockPrisma = {
  user: {
    create: jest.fn(),
    findUnique: jest.fn(),
    findMany: jest.fn(),
    update: jest.fn(),
    updateMany: jest.fn(),
    delete: jest.fn(),
  },
};

(getPrismaClient as jest.Mock).mockReturnValue(mockPrisma);

describe('UserModel', () => {
  let userModel: UserModel;

  beforeEach(() => {
    jest.clearAllMocks();
    userModel = new UserModel();
  });

  describe('create', () => {
    it('should create a user successfully', async () => {
      const userData = {
        email: 'test@example.com',
        name: 'Test User',
      };
      const mockUser = { id: '1', ...userData };

      mockPrisma.user.create.mockResolvedValue(mockUser);

      const result = await userModel.create(userData);

      expect(mockPrisma.user.create).toHaveBeenCalledWith({ data: userData });
      expect(result).toEqual(mockUser);
    });
  });

  describe('findById', () => {
    it('should find user by id', async () => {
      const userId = '1';
      const mockUser = { id: userId, email: 'test@example.com' };

      mockPrisma.user.findUnique.mockResolvedValue(mockUser);

      const result = await userModel.findById(userId);

      expect(mockPrisma.user.findUnique).toHaveBeenCalledWith({
        where: { id: userId },
      });
      expect(result).toEqual(mockUser);
    });

    it('should return null if user not found', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(null);

      const result = await userModel.findById('nonexistent');

      expect(result).toBeNull();
    });
  });

  describe('findByEmail', () => {
    it('should find user by email', async () => {
      const email = 'test@example.com';
      const mockUser = { id: '1', email };

      mockPrisma.user.findUnique.mockResolvedValue(mockUser);

      const result = await userModel.findByEmail(email);

      expect(mockPrisma.user.findUnique).toHaveBeenCalledWith({
        where: { email },
      });
      expect(result).toEqual(mockUser);
    });
  });

  describe('updateSubscription', () => {
    it('should update user subscription with correct quota', async () => {
      const userId = '1';
      const tier = SubscriptionTier.PREMIUM;
      const mockUser = { id: userId, subscriptionTier: tier, dailyQuota: 50 };

      mockPrisma.user.update.mockResolvedValue(mockUser);

      const result = await userModel.updateSubscription(userId, tier);

      expect(mockPrisma.user.update).toHaveBeenCalledWith({
        where: { id: userId },
        data: {
          subscriptionTier: tier,
          dailyQuota: 50,
        },
      });
      expect(result).toEqual(mockUser);
    });

    it('should set correct quota for PRO tier', async () => {
      const userId = '1';
      const tier = SubscriptionTier.PRO;

      await userModel.updateSubscription(userId, tier);

      expect(mockPrisma.user.update).toHaveBeenCalledWith({
        where: { id: userId },
        data: {
          subscriptionTier: tier,
          dailyQuota: 500,
        },
      });
    });
  });

  describe('checkDailyQuotaExceeded', () => {
    it('should return false if quota not exceeded', async () => {
      const userId = '1';
      const mockUser = {
        id: userId,
        dailyUsed: 2,
        dailyQuota: 5,
        lastResetDate: new Date(),
      };

      mockPrisma.user.findUnique.mockResolvedValue(mockUser);

      const result = await userModel.checkDailyQuotaExceeded(userId);

      expect(result).toBe(false);
    });

    it('should return true if quota exceeded', async () => {
      const userId = '1';
      const mockUser = {
        id: userId,
        dailyUsed: 5,
        dailyQuota: 5,
        lastResetDate: new Date(),
      };

      mockPrisma.user.findUnique.mockResolvedValue(mockUser);

      const result = await userModel.checkDailyQuotaExceeded(userId);

      expect(result).toBe(true);
    });

    it('should reset usage for new day and return false', async () => {
      const userId = '1';
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      
      const mockUser = {
        id: userId,
        dailyUsed: 10,
        dailyQuota: 5,
        lastResetDate: yesterday,
      };

      mockPrisma.user.findUnique.mockResolvedValue(mockUser);
      mockPrisma.user.update.mockResolvedValue({ ...mockUser, dailyUsed: 0 });

      const result = await userModel.checkDailyQuotaExceeded(userId);

      expect(mockPrisma.user.update).toHaveBeenCalledWith({
        where: { id: userId },
        data: {
          dailyUsed: 0,
          lastResetDate: expect.any(Date),
        },
      });
      expect(result).toBe(false);
    });

    it('should throw error if user not found', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(null);

      await expect(userModel.checkDailyQuotaExceeded('nonexistent')).rejects.toThrow('User not found');
    });
  });

  describe('validateUser', () => {
    it('should validate correct user data', async () => {
      const userData = {
        email: 'test@example.com',
        name: 'Test User',
      };

      mockPrisma.user.findUnique.mockResolvedValue(null); // Email not taken

      const result = await userModel.validateUser(userData);

      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should return error for missing email', async () => {
      const userData = {
        name: 'Test User',
      };

      const result = await userModel.validateUser(userData as any);

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Email is required');
    });

    it('should return error for invalid email format', async () => {
      const userData = {
        email: 'invalid-email',
        name: 'Test User',
      };

      const result = await userModel.validateUser(userData);

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Email must be a valid email address');
    });

    it('should return error for too long name', async () => {
      const userData = {
        email: 'test@example.com',
        name: 'a'.repeat(101), // Too long
      };

      const result = await userModel.validateUser(userData);

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Name must be 100 characters or less');
    });

    it('should return error for invalid avatar URL', async () => {
      const userData = {
        email: 'test@example.com',
        avatar: 'not-a-valid-url',
      };

      const result = await userModel.validateUser(userData);

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Avatar must be a valid image URL');
    });

    it('should return error if email already exists', async () => {
      const userData = {
        email: 'existing@example.com',
        name: 'Test User',
      };

      mockPrisma.user.findUnique.mockResolvedValue({ id: '1', email: userData.email });

      const result = await userModel.validateUser(userData);

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Email already exists');
    });
  });

  describe('canUserCreateCharacter', () => {
    it('should allow character creation if quota not exceeded', async () => {
      const userId = '1';
      const mockUser = {
        id: userId,
        dailyUsed: 2,
        dailyQuota: 5,
        lastResetDate: new Date(),
      };

      mockPrisma.user.findUnique.mockResolvedValue(mockUser);

      const result = await userModel.canUserCreateCharacter(userId);

      expect(result.allowed).toBe(true);
      expect(result.reason).toBeUndefined();
    });

    it('should deny character creation if quota exceeded', async () => {
      const userId = '1';
      const mockUser = {
        id: userId,
        dailyUsed: 5,
        dailyQuota: 5,
        lastResetDate: new Date(),
      };

      mockPrisma.user.findUnique.mockResolvedValue(mockUser);

      const result = await userModel.canUserCreateCharacter(userId);

      expect(result.allowed).toBe(false);
      expect(result.reason).toBe('Daily generation quota exceeded');
    });

    it('should deny character creation if user not found', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(null);

      const result = await userModel.canUserCreateCharacter('nonexistent');

      expect(result.allowed).toBe(false);
      expect(result.reason).toBe('User not found');
    });
  });

  describe('getUserStats', () => {
    it('should return correct user statistics', async () => {
      const mockUsers = [
        {
          subscriptionTier: SubscriptionTier.FREE,
          totalGenerated: 5,
          lastResetDate: new Date(),
        },
        {
          subscriptionTier: SubscriptionTier.PREMIUM,
          totalGenerated: 10,
          lastResetDate: new Date(Date.now() - 31 * 24 * 60 * 60 * 1000), // 31 days ago
        },
        {
          subscriptionTier: SubscriptionTier.PRO,
          totalGenerated: 15,
          lastResetDate: new Date(),
        },
      ];

      mockPrisma.user.findMany.mockResolvedValue(mockUsers);

      const result = await userModel.getUserStats();

      expect(result.totalUsers).toBe(3);
      expect(result.activeUsers).toBe(2); // Only 2 active within 30 days
      expect(result.bySubscriptionTier).toEqual({
        FREE: 1,
        PREMIUM: 1,
        PRO: 1,
      });
      expect(result.totalCharactersCreated).toBe(30);
    });
  });

  describe('bulkResetDailyUsage', () => {
    it('should reset daily usage for multiple users', async () => {
      const userIds = ['1', '2', '3'];
      mockPrisma.user.updateMany.mockResolvedValue({ count: 3 });

      const result = await userModel.bulkResetDailyUsage(userIds);

      expect(mockPrisma.user.updateMany).toHaveBeenCalledWith({
        where: {
          id: {
            in: userIds,
          },
        },
        data: {
          dailyUsed: 0,
          lastResetDate: expect.any(Date),
        },
      });
      expect(result).toBe(3);
    });
  });
});