/**
 * Credit Service
 * Manages user credits, API costs, and transactions
 */

import { PrismaClient, TransactionType } from '@prisma/client';

const prisma = new PrismaClient();

export class CreditService {
  /**
   * Get user's current credit balance
   */
  async getBalance(userId: string): Promise<number> {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { credits: true }
    });
    return user?.credits ?? 0;
  }

  /**
   * Get API cost configuration for an endpoint
   */
  async getApiCost(apiEndpoint: string): Promise<number | null> {
    const config = await prisma.apiCostConfig.findUnique({
      where: { apiEndpoint, enabled: true }
    });
    return config?.cost ?? null;
  }

  /**
   * Check if user has sufficient credits for an API call
   */
  async checkSufficientCredits(userId: string, apiEndpoint: string): Promise<{
    sufficient: boolean;
    balance: number;
    required: number;
  }> {
    const [balance, cost] = await Promise.all([
      this.getBalance(userId),
      this.getApiCost(apiEndpoint)
    ]);

    const required = cost ?? 0;
    return {
      sufficient: balance >= required,
      balance,
      required
    };
  }

  /**
   * Deduct credits from user account
   */
  async deductCredits(
    userId: string,
    amount: number,
    apiEndpoint: string,
    metadata?: any
  ): Promise<{ success: boolean; newBalance: number }> {
    try {
      const result = await prisma.$transaction(async (tx) => {
        // Get current balance
        const user = await tx.user.findUnique({
          where: { id: userId },
          select: { credits: true }
        });

        if (!user || user.credits < amount) {
          throw new Error('Insufficient credits');
        }

        // Update user credits
        const updatedUser = await tx.user.update({
          where: { id: userId },
          data: { credits: { decrement: amount } }
        });

        // Record transaction
        await tx.creditTransaction.create({
          data: {
            userId,
            amount: -amount,
            balance: updatedUser.credits,
            type: TransactionType.USAGE,
            apiEndpoint,
            description: `API call: ${apiEndpoint}`,
            metadata
          }
        });

        return { success: true, newBalance: updatedUser.credits };
      });

      return result;
    } catch (error) {
      console.error('Error deducting credits:', error);
      throw error;
    }
  }

  /**
   * Add credits to user account
   */
  async addCredits(
    userId: string,
    amount: number,
    type: TransactionType,
    description?: string,
    metadata?: any
  ): Promise<{ success: boolean; newBalance: number }> {
    try {
      const result = await prisma.$transaction(async (tx) => {
        const updatedUser = await tx.user.update({
          where: { id: userId },
          data: { credits: { increment: amount } }
        });

        await tx.creditTransaction.create({
          data: {
            userId,
            amount,
            balance: updatedUser.credits,
            type,
            description: description || `Credits added: ${type}`,
            metadata
          }
        });

        return { success: true, newBalance: updatedUser.credits };
      });

      return result;
    } catch (error) {
      console.error('Error adding credits:', error);
      throw error;
    }
  }

  /**
   * Get user's transaction history
   */
  async getTransactionHistory(userId: string, limit: number = 50) {
    return prisma.creditTransaction.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take: limit
    });
  }

  /**
   * Get or create API cost configuration
   */
  async ensureApiCost(apiEndpoint: string, cost: number, description?: string) {
    return prisma.apiCostConfig.upsert({
      where: { apiEndpoint },
      update: { cost, description },
      create: { apiEndpoint, cost, description }
    });
  }

  /**
   * Get all API cost configurations
   */
  async getAllApiCosts(): Promise<Record<string, number>> {
    const configs = await prisma.apiCostConfig.findMany({
      where: { enabled: true },
      select: { apiEndpoint: true, cost: true }
    });

    // Convert to { endpoint: cost } format
    const costs: Record<string, number> = {};
    configs.forEach(config => {
      costs[config.apiEndpoint] = config.cost;
    });

    return costs;
  }
}

export const creditService = new CreditService();
