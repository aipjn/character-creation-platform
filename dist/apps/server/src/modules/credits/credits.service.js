"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.creditService = exports.CreditService = void 0;
const client_1 = require("@prisma/client");
const prisma = new client_1.PrismaClient();
class CreditService {
    async getBalance(userId) {
        const user = await prisma.user.findUnique({
            where: { id: userId },
            select: { credits: true }
        });
        return user?.credits ?? 0;
    }
    async getApiCost(apiEndpoint) {
        const config = await prisma.apiCostConfig.findUnique({
            where: { apiEndpoint, enabled: true }
        });
        return config?.cost ?? null;
    }
    async checkSufficientCredits(userId, apiEndpoint) {
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
    async deductCredits(userId, amount, apiEndpoint, metadata) {
        try {
            const result = await prisma.$transaction(async (tx) => {
                const user = await tx.user.findUnique({
                    where: { id: userId },
                    select: { credits: true }
                });
                if (!user || user.credits < amount) {
                    throw new Error('Insufficient credits');
                }
                const updatedUser = await tx.user.update({
                    where: { id: userId },
                    data: { credits: { decrement: amount } }
                });
                await tx.creditTransaction.create({
                    data: {
                        userId,
                        amount: -amount,
                        balance: updatedUser.credits,
                        type: client_1.TransactionType.USAGE,
                        apiEndpoint,
                        description: `API call: ${apiEndpoint}`,
                        metadata
                    }
                });
                return { success: true, newBalance: updatedUser.credits };
            });
            return result;
        }
        catch (error) {
            console.error('Error deducting credits:', error);
            throw error;
        }
    }
    async addCredits(userId, amount, type, description, metadata) {
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
        }
        catch (error) {
            console.error('Error adding credits:', error);
            throw error;
        }
    }
    async getTransactionHistory(userId, limit = 50) {
        return prisma.creditTransaction.findMany({
            where: { userId },
            orderBy: { createdAt: 'desc' },
            take: limit
        });
    }
    async ensureApiCost(apiEndpoint, cost, description) {
        return prisma.apiCostConfig.upsert({
            where: { apiEndpoint },
            update: { cost, description },
            create: { apiEndpoint, cost, description }
        });
    }
    async getAllApiCosts() {
        const configs = await prisma.apiCostConfig.findMany({
            where: { enabled: true },
            select: { apiEndpoint: true, cost: true }
        });
        const costs = {};
        configs.forEach(config => {
            costs[config.apiEndpoint] = config.cost;
        });
        return costs;
    }
}
exports.CreditService = CreditService;
exports.creditService = new CreditService();
//# sourceMappingURL=credits.service.js.map