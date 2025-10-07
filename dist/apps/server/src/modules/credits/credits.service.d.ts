import { TransactionType } from '@prisma/client';
export declare class CreditService {
    getBalance(userId: string): Promise<number>;
    getApiCost(apiEndpoint: string): Promise<number | null>;
    checkSufficientCredits(userId: string, apiEndpoint: string): Promise<{
        sufficient: boolean;
        balance: number;
        required: number;
    }>;
    deductCredits(userId: string, amount: number, apiEndpoint: string, metadata?: any): Promise<{
        success: boolean;
        newBalance: number;
    }>;
    addCredits(userId: string, amount: number, type: TransactionType, description?: string, metadata?: any): Promise<{
        success: boolean;
        newBalance: number;
    }>;
    getTransactionHistory(userId: string, limit?: number): Promise<{
        id: string;
        metadata: import("@prisma/client/runtime/library").JsonValue | null;
        createdAt: Date;
        apiEndpoint: string | null;
        description: string | null;
        balance: number;
        userId: string;
        amount: number;
        type: import(".prisma/client").$Enums.TransactionType;
    }[]>;
    ensureApiCost(apiEndpoint: string, cost: number, description?: string): Promise<{
        id: string;
        createdAt: Date;
        updatedAt: Date;
        apiEndpoint: string;
        cost: number;
        description: string | null;
        enabled: boolean;
    }>;
    getAllApiCosts(): Promise<Record<string, number>>;
}
export declare const creditService: CreditService;
//# sourceMappingURL=credits.service.d.ts.map