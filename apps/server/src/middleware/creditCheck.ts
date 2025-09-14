/**
 * Credit Check Middleware
 * 积分检查中间件 - 在API调用前检查和扣除积分
 */

import { Request, Response, NextFunction } from 'express';
import { CreditService } from '../services/creditService';

// 扩展Request接口，添加用户和积分信息
declare global {
  namespace Express {
    interface Request {
      user?: {
        id: string;
        email?: string;
        [key: string]: any;
      };
      creditCost?: number;
      creditTransaction?: any;
    }
  }
}

/**
 * 积分检查中间件
 * 使用方式：
 * 1. 自动检查：requireCredits() - 根据数据库配置自动检查
 * 2. 固定积分：requireCredits(10) - 固定消耗10积分
 */
export function requireCredits(fixedCost?: number) {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      // 检查用户是否已认证
      if (!req.user || !req.user.id) {
        return res.status(401).json({
          success: false,
          error: 'Authentication required',
          code: 'AUTH_REQUIRED'
        });
      }

      const userId = req.user.id;
      const endpoint = req.path;
      const method = req.method.toUpperCase();

      let creditCost = fixedCost;

      // 如果没有指定固定积分，从数据库获取配置
      if (!creditCost) {
        const config = await CreditService.getApiCreditConfig(endpoint, method);
        
        if (!config) {
          // 如果没有配置，默认不需要积分
          return next();
        }

        if (!config.isEnabled) {
          // 配置已禁用，跳过积分检查
          return next();
        }

        creditCost = config.creditCost;
      }

      // 检查积分是否足够
      const checkResult = await CreditService.checkCredits(userId, creditCost);
      
      if (!checkResult.canProceed) {
        return res.status(402).json({
          success: false,
          error: checkResult.message,
          code: 'INSUFFICIENT_CREDITS',
          data: {
            currentCredits: checkResult.currentCredits,
            requiredCredits: checkResult.requiredCredits
          }
        });
      }

      // 预先扣除积分
      try {
        const transaction = await CreditService.consumeCredits(
          userId,
          endpoint,
          creditCost,
          {
            method,
            headers: req.headers,
            query: req.query,
            body: req.body
          }
        );

        // 将积分信息附加到请求对象，供后续使用
        req.creditCost = creditCost;
        req.creditTransaction = transaction;

        next();
      } catch (consumeError) {
        return res.status(402).json({
          success: false,
          error: 'Failed to consume credits',
          code: 'CREDIT_CONSUME_ERROR',
          details: consumeError.message
        });
      }

    } catch (error) {
      console.error('Credit check middleware error:', error);
      
      // 积分检查失败，但不阻止API调用（可根据需要调整）
      return res.status(500).json({
        success: false,
        error: 'Credit system temporarily unavailable',
        code: 'CREDIT_SYSTEM_ERROR'
      });
    }
  };
}

/**
 * 积分退款中间件 - 在API调用失败时退还积分
 * 应该在错误处理中使用
 */
export function refundCreditsOnError() {
  return async (err: any, req: Request, res: Response, next: NextFunction) => {
    try {
      // 如果有积分事务且API调用失败，尝试退款
      if (req.creditTransaction && req.user) {
        const userId = req.user.id;
        const creditCost = req.creditCost;

        if (creditCost && creditCost > 0) {
          await CreditService.grantCredits(
            userId,
            creditCost,
            `Refund for failed API call: ${req.path}`
          );

          console.log(`Refunded ${creditCost} credits to user ${userId} for failed API call`);
        }
      }
    } catch (refundError) {
      console.error('Credit refund error:', refundError);
      // 不阻止错误处理流程
    }

    next(err);
  };
}

/**
 * 积分状态检查中间件 - 仅检查不扣除
 * 用于显示用户积分状态
 */
export function checkCreditStatus() {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      if (!req.user || !req.user.id) {
        return next();
      }

      const userId = req.user.id;
      const userCredits = await CreditService.getUserCredits(userId);

      // 将积分信息附加到请求对象
      req.user.credits = userCredits;

      next();
    } catch (error) {
      console.error('Credit status check error:', error);
      // 不阻止请求，只是无法获取积分状态
      next();
    }
  };
}

/**
 * 管理员权限检查中间件
 * 检查用户是否有管理积分配置的权限
 */
export function requireAdminForCredits() {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        error: 'Authentication required',
        code: 'AUTH_REQUIRED'
      });
    }

    // 检查管理员权限（根据你的权限系统调整）
    const isAdmin = req.user.role === 'admin' || req.user.isAdmin;
    
    if (!isAdmin) {
      return res.status(403).json({
        success: false,
        error: 'Admin privileges required',
        code: 'ADMIN_REQUIRED'
      });
    }

    next();
  };
}