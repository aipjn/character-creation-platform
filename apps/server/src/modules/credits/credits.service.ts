/**
 * Credit Service
 * 用户积分管理服务
 */

import { UserCredits, CreditTransaction, ApiCreditConfig, CreditCheckResult, CreditStatus } from '../../models/UserCredits';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export class CreditService {
  private static readonly DAILY_CREDITS = 100;
  private static readonly TIMEZONE = 'Asia/Shanghai';

  /**
   * 获取用户积分信息
   */
  static async getUserCredits(userId: string): Promise<UserCredits | null> {
    try {
      let userCredits = await prisma.userCredits.findUnique({
        where: { userId }
      });

      if (!userCredits) {
        // 首次使用，创建积分记录
        userCredits = await this.initializeUserCredits(userId);
      } else {
        // 检查是否需要重置每日积分
        userCredits = await this.checkAndResetDailyCredits(userCredits);
      }

      return userCredits;
    } catch (error) {
      console.error('Error getting user credits:', error);
      throw new Error('Failed to get user credits');
    }
  }

  /**
   * 初始化用户积分
   */
  private static async initializeUserCredits(userId: string): Promise<UserCredits> {
    const now = new Date();
    
    const userCredits = await prisma.userCredits.create({
      data: {
        userId,
        dailyCredits: this.DAILY_CREDITS,
        usedCredits: 0,
        remainingCredits: this.DAILY_CREDITS,
        lastResetDate: now,
        totalCreditsEarned: this.DAILY_CREDITS,
        totalCreditsSpent: 0,
        createdAt: now,
        updatedAt: now
      }
    });

    // 记录积分初始化事务
    await this.createTransaction(userId, 'system', this.DAILY_CREDITS, 'daily_reset', 'Initial daily credits');

    return userCredits;
  }

  /**
   * 检查并重置每日积分
   */
  private static async checkAndResetDailyCredits(userCredits: UserCredits): Promise<UserCredits> {
    const now = new Date();
    const lastReset = new Date(userCredits.lastResetDate);
    
    // 检查是否是新的一天（基于中国时区）
    const nowDate = new Date(now.toLocaleDateString('en-CA', { timeZone: this.TIMEZONE }));
    const lastResetDate = new Date(lastReset.toLocaleDateString('en-CA', { timeZone: this.TIMEZONE }));

    if (nowDate > lastResetDate) {
      // 重置每日积分
      const updatedCredits = await prisma.userCredits.update({
        where: { userId: userCredits.userId },
        data: {
          usedCredits: 0,
          remainingCredits: this.DAILY_CREDITS,
          lastResetDate: now,
          totalCreditsEarned: userCredits.totalCreditsEarned + this.DAILY_CREDITS,
          updatedAt: now
        }
      });

      // 记录重置事务
      await this.createTransaction(userCredits.userId, 'system', this.DAILY_CREDITS, 'daily_reset', 'Daily credits reset');

      return updatedCredits;
    }

    return userCredits;
  }

  /**
   * 检查用户是否有足够积分
   */
  static async checkCredits(userId: string, requiredCredits: number): Promise<CreditCheckResult> {
    try {
      const userCredits = await this.getUserCredits(userId);
      
      if (!userCredits) {
        return {
          status: CreditStatus.INSUFFICIENT,
          currentCredits: 0,
          requiredCredits,
          canProceed: false,
          message: 'User credits not found'
        };
      }

      const canProceed = userCredits.remainingCredits >= requiredCredits;

      return {
        status: canProceed ? CreditStatus.SUFFICIENT : CreditStatus.INSUFFICIENT,
        currentCredits: userCredits.remainingCredits,
        requiredCredits,
        canProceed,
        message: canProceed 
          ? 'Sufficient credits' 
          : `Insufficient credits. Required: ${requiredCredits}, Available: ${userCredits.remainingCredits}`
      };
    } catch (error) {
      console.error('Error checking credits:', error);
      throw new Error('Failed to check credits');
    }
  }

  /**
   * 消费积分
   */
  static async consumeCredits(
    userId: string, 
    apiEndpoint: string, 
    creditCost: number,
    requestData?: any
  ): Promise<CreditTransaction> {
    try {
      // 开始事务
      return await prisma.$transaction(async (tx) => {
        // 获取用户积分
        const userCredits = await this.getUserCredits(userId);
        
        if (!userCredits || userCredits.remainingCredits < creditCost) {
          throw new Error(`Insufficient credits. Required: ${creditCost}, Available: ${userCredits?.remainingCredits || 0}`);
        }

        // 更新用户积分
        await tx.userCredits.update({
          where: { userId },
          data: {
            usedCredits: userCredits.usedCredits + creditCost,
            remainingCredits: userCredits.remainingCredits - creditCost,
            totalCreditsSpent: userCredits.totalCreditsSpent + creditCost,
            updatedAt: new Date()
          }
        });

        // 创建消费记录
        const transaction = await tx.creditTransaction.create({
          data: {
            userId,
            apiEndpoint,
            creditCost,
            operationType: 'api_call',
            description: `API call to ${apiEndpoint}`,
            requestData: requestData ? JSON.stringify(requestData) : null,
            status: 'completed',
            createdAt: new Date(),
            completedAt: new Date()
          }
        });

        return transaction;
      });
    } catch (error) {
      console.error('Error consuming credits:', error);
      throw new Error(`Failed to consume credits: ${error.message}`);
    }
  }

  /**
   * 创建积分事务记录
   */
  private static async createTransaction(
    userId: string,
    apiEndpoint: string,
    creditAmount: number,
    operationType: CreditTransaction['operationType'],
    description?: string
  ): Promise<CreditTransaction> {
    return await prisma.creditTransaction.create({
      data: {
        userId,
        apiEndpoint,
        creditCost: creditAmount,
        operationType,
        description,
        status: 'completed',
        createdAt: new Date(),
        completedAt: new Date()
      }
    });
  }

  /**
   * 获取用户积分使用历史
   */
  static async getCreditHistory(
    userId: string, 
    limit: number = 50,
    offset: number = 0
  ): Promise<CreditTransaction[]> {
    try {
      return await prisma.creditTransaction.findMany({
        where: { userId },
        orderBy: { createdAt: 'desc' },
        take: limit,
        skip: offset
      });
    } catch (error) {
      console.error('Error getting credit history:', error);
      throw new Error('Failed to get credit history');
    }
  }

  /**
   * 管理员操作：给用户增加积分
   */
  static async grantCredits(
    userId: string, 
    credits: number, 
    description?: string
  ): Promise<CreditTransaction> {
    try {
      return await prisma.$transaction(async (tx) => {
        const userCredits = await this.getUserCredits(userId);
        
        if (!userCredits) {
          throw new Error('User credits not found');
        }

        // 更新用户积分
        await tx.userCredits.update({
          where: { userId },
          data: {
            remainingCredits: userCredits.remainingCredits + credits,
            totalCreditsEarned: userCredits.totalCreditsEarned + credits,
            updatedAt: new Date()
          }
        });

        // 创建授予记录
        const transaction = await tx.creditTransaction.create({
          data: {
            userId,
            apiEndpoint: 'admin',
            creditCost: credits,
            operationType: 'admin_grant',
            description: description || `Admin granted ${credits} credits`,
            status: 'completed',
            createdAt: new Date(),
            completedAt: new Date()
          }
        });

        return transaction;
      });
    } catch (error) {
      console.error('Error granting credits:', error);
      throw new Error('Failed to grant credits');
    }
  }

  /**
   * 获取API积分配置
   */
  static async getApiCreditConfig(endpoint: string, method: string): Promise<ApiCreditConfig | null> {
    try {
      return await prisma.apiCreditConfig.findFirst({
        where: {
          endpoint,
          method,
          isEnabled: true
        }
      });
    } catch (error) {
      console.error('Error getting API credit config:', error);
      return null;
    }
  }

  /**
   * 创建或更新API积分配置
   */
  static async upsertApiCreditConfig(config: Omit<ApiCreditConfig, 'id' | 'createdAt' | 'updatedAt'>): Promise<ApiCreditConfig> {
    try {
      const existing = await prisma.apiCreditConfig.findFirst({
        where: {
          endpoint: config.endpoint,
          method: config.method
        }
      });

      if (existing) {
        return await prisma.apiCreditConfig.update({
          where: { id: existing.id },
          data: {
            ...config,
            updatedAt: new Date()
          }
        });
      } else {
        return await prisma.apiCreditConfig.create({
          data: {
            ...config,
            createdAt: new Date(),
            updatedAt: new Date()
          }
        });
      }
    } catch (error) {
      console.error('Error upserting API credit config:', error);
      throw new Error('Failed to upsert API credit config');
    }
  }

  /**
   * 获取所有API积分配置
   */
  static async getAllApiCreditConfigs(): Promise<ApiCreditConfig[]> {
    try {
      return await prisma.apiCreditConfig.findMany({
        orderBy: { endpoint: 'asc' }
      });
    } catch (error) {
      console.error('Error getting all API credit configs:', error);
      throw new Error('Failed to get API credit configs');
    }
  }
}