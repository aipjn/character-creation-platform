/**
 * User Credits Model
 * 用户积分管理模型
 */

export interface UserCredits {
  id: string;
  userId: string;
  dailyCredits: number;        // 每日总积分（默认100）
  usedCredits: number;         // 今日已使用积分
  remainingCredits: number;    // 今日剩余积分
  lastResetDate: Date;         // 上次重置日期
  totalCreditsEarned: number;  // 历史总获得积分
  totalCreditsSpent: number;   // 历史总消费积分
  createdAt: Date;
  updatedAt: Date;
}

export interface CreditTransaction {
  id: string;
  userId: string;
  apiEndpoint: string;         // API端点路径
  creditCost: number;          // 消耗积分数
  operationType: 'api_call' | 'admin_grant' | 'daily_reset' | 'refund';
  description?: string;        // 操作描述
  requestData?: any;           // 请求数据（可选）
  status: 'pending' | 'completed' | 'failed';
  createdAt: Date;
  completedAt?: Date;
}

export interface ApiCreditConfig {
  id: string;
  endpoint: string;            // API端点路径（如：/api/v1/generate-character）
  method: 'GET' | 'POST' | 'PUT' | 'DELETE';
  creditCost: number;          // 消耗积分
  description?: string;        // 描述
  isEnabled: boolean;          // 是否启用积分检查
  createdAt: Date;
  updatedAt: Date;
}

// 用户积分状态枚举
export enum CreditStatus {
  SUFFICIENT = 'sufficient',
  INSUFFICIENT = 'insufficient',
  EXPIRED = 'expired'
}

// 积分检查结果
export interface CreditCheckResult {
  status: CreditStatus;
  currentCredits: number;
  requiredCredits: number;
  canProceed: boolean;
  message?: string;
}