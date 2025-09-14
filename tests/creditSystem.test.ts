/**
 * Credit System Tests
 * 积分系统测试
 */

import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import { CreditService } from '../src/services/creditService';
import { CreditStatus } from '../src/models/UserCredits';

// Mock Prisma client
const mockPrisma = {
  userCredits: {
    findUnique: jest.fn(),
    create: jest.fn(),
    update: jest.fn()
  },
  creditTransaction: {
    create: jest.fn(),
    findMany: jest.fn()
  },
  apiCreditConfig: {
    findFirst: jest.fn(),
    findMany: jest.fn(),
    create: jest.fn(),
    update: jest.fn()
  },
  $transaction: jest.fn()
};

// Mock the PrismaClient
jest.mock('@prisma/client', () => ({
  PrismaClient: jest.fn(() => mockPrisma)
}));

describe('Credit System', () => {
  const mockUserId = 'test-user-123';
  const mockUserCredits = {
    id: 'credit-123',
    userId: mockUserId,
    dailyCredits: 100,
    usedCredits: 20,
    remainingCredits: 80,
    lastResetDate: new Date(),
    totalCreditsEarned: 100,
    totalCreditsSpent: 20,
    createdAt: new Date(),
    updatedAt: new Date()
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('getUserCredits', () => {
    it('should return existing user credits', async () => {
      mockPrisma.userCredits.findUnique.mockResolvedValue(mockUserCredits);

      const result = await CreditService.getUserCredits(mockUserId);

      expect(result).toEqual(mockUserCredits);
      expect(mockPrisma.userCredits.findUnique).toHaveBeenCalledWith({
        where: { userId: mockUserId }
      });
    });

    it('should initialize new user credits if not exists', async () => {
      mockPrisma.userCredits.findUnique.mockResolvedValue(null);
      mockPrisma.userCredits.create.mockResolvedValue(mockUserCredits);
      mockPrisma.creditTransaction.create.mockResolvedValue({});

      const result = await CreditService.getUserCredits(mockUserId);

      expect(mockPrisma.userCredits.create).toHaveBeenCalled();
      expect(mockPrisma.creditTransaction.create).toHaveBeenCalled();
      expect(result).toEqual(mockUserCredits);
    });

    it('should reset daily credits if new day', async () => {
      const yesterdayCredits = {
        ...mockUserCredits,
        lastResetDate: new Date(Date.now() - 24 * 60 * 60 * 1000), // 昨天
        usedCredits: 50,
        remainingCredits: 50
      };
      
      const resetCredits = {
        ...mockUserCredits,
        usedCredits: 0,
        remainingCredits: 100,
        lastResetDate: new Date()
      };

      mockPrisma.userCredits.findUnique.mockResolvedValue(yesterdayCredits);
      mockPrisma.userCredits.update.mockResolvedValue(resetCredits);
      mockPrisma.creditTransaction.create.mockResolvedValue({});

      const result = await CreditService.getUserCredits(mockUserId);

      expect(mockPrisma.userCredits.update).toHaveBeenCalledWith({
        where: { userId: mockUserId },
        data: expect.objectContaining({
          usedCredits: 0,
          remainingCredits: 100
        })
      });
      expect(result.remainingCredits).toBe(100);
    });
  });

  describe('checkCredits', () => {
    it('should return sufficient status when user has enough credits', async () => {
      mockPrisma.userCredits.findUnique.mockResolvedValue(mockUserCredits);

      const result = await CreditService.checkCredits(mockUserId, 50);

      expect(result).toEqual({
        status: CreditStatus.SUFFICIENT,
        currentCredits: 80,
        requiredCredits: 50,
        canProceed: true,
        message: 'Sufficient credits'
      });
    });

    it('should return insufficient status when user lacks credits', async () => {
      mockPrisma.userCredits.findUnique.mockResolvedValue(mockUserCredits);

      const result = await CreditService.checkCredits(mockUserId, 100);

      expect(result).toEqual({
        status: CreditStatus.INSUFFICIENT,
        currentCredits: 80,
        requiredCredits: 100,
        canProceed: false,
        message: 'Insufficient credits. Required: 100, Available: 80'
      });
    });
  });

  describe('consumeCredits', () => {
    it('should successfully consume credits', async () => {
      const mockTransaction = {
        id: 'trans-123',
        userId: mockUserId,
        apiEndpoint: '/api/test',
        creditCost: 10,
        operationType: 'api_call',
        status: 'completed'
      };

      mockPrisma.$transaction.mockImplementation(async (callback) => {
        return await callback({
          userCredits: {
            update: jest.fn().mockResolvedValue({}),
            findUnique: jest.fn().mockResolvedValue(mockUserCredits)
          },
          creditTransaction: {
            create: jest.fn().mockResolvedValue(mockTransaction)
          }
        });
      });

      // Mock getUserCredits for the consume operation
      jest.spyOn(CreditService, 'getUserCredits').mockResolvedValue(mockUserCredits);

      const result = await CreditService.consumeCredits(mockUserId, '/api/test', 10);

      expect(result).toEqual(mockTransaction);
    });

    it('should fail when insufficient credits', async () => {
      const insufficientCredits = {
        ...mockUserCredits,
        remainingCredits: 5
      };

      jest.spyOn(CreditService, 'getUserCredits').mockResolvedValue(insufficientCredits);

      await expect(
        CreditService.consumeCredits(mockUserId, '/api/test', 10)
      ).rejects.toThrow('Insufficient credits. Required: 10, Available: 5');
    });
  });

  describe('grantCredits', () => {
    it('should successfully grant credits to user', async () => {
      const mockTransaction = {
        id: 'grant-123',
        userId: mockUserId,
        apiEndpoint: 'admin',
        creditCost: 50,
        operationType: 'admin_grant',
        status: 'completed'
      };

      mockPrisma.$transaction.mockImplementation(async (callback) => {
        return await callback({
          userCredits: {
            update: jest.fn().mockResolvedValue({})
          },
          creditTransaction: {
            create: jest.fn().mockResolvedValue(mockTransaction)
          }
        });
      });

      jest.spyOn(CreditService, 'getUserCredits').mockResolvedValue(mockUserCredits);

      const result = await CreditService.grantCredits(mockUserId, 50, 'Admin bonus');

      expect(result).toEqual(mockTransaction);
    });
  });

  describe('getApiCreditConfig', () => {
    it('should return API credit configuration', async () => {
      const mockConfig = {
        id: 'config-123',
        endpoint: '/api/test',
        method: 'POST',
        creditCost: 10,
        description: 'Test API',
        isEnabled: true,
        createdAt: new Date(),
        updatedAt: new Date()
      };

      mockPrisma.apiCreditConfig.findFirst.mockResolvedValue(mockConfig);

      const result = await CreditService.getApiCreditConfig('/api/test', 'POST');

      expect(result).toEqual(mockConfig);
      expect(mockPrisma.apiCreditConfig.findFirst).toHaveBeenCalledWith({
        where: {
          endpoint: '/api/test',
          method: 'POST',
          isEnabled: true
        }
      });
    });

    it('should return null if configuration not found', async () => {
      mockPrisma.apiCreditConfig.findFirst.mockResolvedValue(null);

      const result = await CreditService.getApiCreditConfig('/api/nonexistent', 'GET');

      expect(result).toBeNull();
    });
  });

  describe('upsertApiCreditConfig', () => {
    it('should create new configuration if not exists', async () => {
      const newConfig = {
        endpoint: '/api/new',
        method: 'POST',
        creditCost: 15,
        description: 'New API',
        isEnabled: true
      };

      const createdConfig = {
        id: 'new-config-123',
        ...newConfig,
        createdAt: new Date(),
        updatedAt: new Date()
      };

      mockPrisma.apiCreditConfig.findFirst.mockResolvedValue(null);
      mockPrisma.apiCreditConfig.create.mockResolvedValue(createdConfig);

      const result = await CreditService.upsertApiCreditConfig(newConfig);

      expect(result).toEqual(createdConfig);
      expect(mockPrisma.apiCreditConfig.create).toHaveBeenCalledWith({
        data: expect.objectContaining(newConfig)
      });
    });

    it('should update existing configuration', async () => {
      const existingConfig = {
        id: 'existing-123',
        endpoint: '/api/existing',
        method: 'POST',
        creditCost: 10,
        description: 'Existing API',
        isEnabled: true,
        createdAt: new Date(),
        updatedAt: new Date()
      };

      const updateData = {
        endpoint: '/api/existing',
        method: 'POST',
        creditCost: 20,
        description: 'Updated API',
        isEnabled: false
      };

      const updatedConfig = {
        ...existingConfig,
        ...updateData,
        updatedAt: new Date()
      };

      mockPrisma.apiCreditConfig.findFirst.mockResolvedValue(existingConfig);
      mockPrisma.apiCreditConfig.update.mockResolvedValue(updatedConfig);

      const result = await CreditService.upsertApiCreditConfig(updateData);

      expect(result).toEqual(updatedConfig);
      expect(mockPrisma.apiCreditConfig.update).toHaveBeenCalledWith({
        where: { id: existingConfig.id },
        data: expect.objectContaining(updateData)
      });
    });
  });

  describe('getCreditHistory', () => {
    it('should return user credit transaction history', async () => {
      const mockHistory = [
        {
          id: 'trans-1',
          userId: mockUserId,
          apiEndpoint: '/api/test1',
          creditCost: 10,
          operationType: 'api_call',
          createdAt: new Date()
        },
        {
          id: 'trans-2',
          userId: mockUserId,
          apiEndpoint: '/api/test2',
          creditCost: 5,
          operationType: 'api_call',
          createdAt: new Date()
        }
      ];

      mockPrisma.creditTransaction.findMany.mockResolvedValue(mockHistory);

      const result = await CreditService.getCreditHistory(mockUserId, 10, 0);

      expect(result).toEqual(mockHistory);
      expect(mockPrisma.creditTransaction.findMany).toHaveBeenCalledWith({
        where: { userId: mockUserId },
        orderBy: { createdAt: 'desc' },
        take: 10,
        skip: 0
      });
    });
  });
});