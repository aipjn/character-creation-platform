/**
 * Credits Management API Routes
 * 积分管理API路由
 */

import { Router, Request, Response } from 'express';
import { CreditService } from '../../services/creditService';
import { requireAuth } from '../../middleware/auth';
import { requireAdminForCredits, checkCreditStatus } from '../../middleware/creditCheck';

const router = Router();

/**
 * GET /api/v1/credits/status
 * 获取当前用户积分状态
 */
router.get('/status', requireAuth(), async (req: Request, res: Response) => {
  try {
    const userId = req.user!.id;
    const userCredits = await CreditService.getUserCredits(userId);

    if (!userCredits) {
      return res.status(404).json({
        success: false,
        error: 'User credits not found'
      });
    }

    res.json({
      success: true,
      data: {
        dailyCredits: userCredits.dailyCredits,
        usedCredits: userCredits.usedCredits,
        remainingCredits: userCredits.remainingCredits,
        lastResetDate: userCredits.lastResetDate,
        totalCreditsEarned: userCredits.totalCreditsEarned,
        totalCreditsSpent: userCredits.totalCreditsSpent
      }
    });
  } catch (error) {
    console.error('Get credit status error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get credit status'
    });
  }
});

/**
 * GET /api/v1/credits/history
 * 获取用户积分使用历史
 */
router.get('/history', requireAuth(), async (req: Request, res: Response) => {
  try {
    const userId = req.user!.id;
    const limit = parseInt(req.query.limit as string) || 20;
    const offset = parseInt(req.query.offset as string) || 0;

    const history = await CreditService.getCreditHistory(userId, limit, offset);

    res.json({
      success: true,
      data: {
        transactions: history,
        pagination: {
          limit,
          offset,
          total: history.length
        }
      }
    });
  } catch (error) {
    console.error('Get credit history error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get credit history'
    });
  }
});

/**
 * POST /api/v1/credits/check
 * 检查指定积分是否足够（不扣除）
 */
router.post('/check', requireAuth(), async (req: Request, res: Response) => {
  try {
    const userId = req.user!.id;
    const { credits } = req.body;

    if (!credits || credits <= 0) {
      return res.status(400).json({
        success: false,
        error: 'Invalid credit amount'
      });
    }

    const checkResult = await CreditService.checkCredits(userId, credits);

    res.json({
      success: true,
      data: checkResult
    });
  } catch (error) {
    console.error('Check credits error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to check credits'
    });
  }
});

// === 管理员API ===

/**
 * GET /api/v1/credits/config
 * 获取所有API积分配置（管理员）
 */
router.get('/config', requireAuth(), requireAdminForCredits(), async (req: Request, res: Response) => {
  try {
    const configs = await CreditService.getAllApiCreditConfigs();

    res.json({
      success: true,
      data: configs
    });
  } catch (error) {
    console.error('Get API credit configs error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get API credit configurations'
    });
  }
});

/**
 * POST /api/v1/credits/config
 * 创建或更新API积分配置（管理员）
 */
router.post('/config', requireAuth(), requireAdminForCredits(), async (req: Request, res: Response) => {
  try {
    const { endpoint, method, creditCost, description, isEnabled } = req.body;

    // 验证请求参数
    if (!endpoint || !method || creditCost == null) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields: endpoint, method, creditCost'
      });
    }

    if (creditCost < 0) {
      return res.status(400).json({
        success: false,
        error: 'Credit cost cannot be negative'
      });
    }

    const config = await CreditService.upsertApiCreditConfig({
      endpoint,
      method: method.toUpperCase(),
      creditCost,
      description,
      isEnabled: isEnabled !== false // 默认启用
    });

    res.json({
      success: true,
      data: config
    });
  } catch (error) {
    console.error('Upsert API credit config error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to save API credit configuration'
    });
  }
});

/**
 * POST /api/v1/credits/grant
 * 给用户授予积分（管理员）
 */
router.post('/grant', requireAuth(), requireAdminForCredits(), async (req: Request, res: Response) => {
  try {
    const { userId, credits, description } = req.body;

    if (!userId || !credits || credits <= 0) {
      return res.status(400).json({
        success: false,
        error: 'Invalid userId or credit amount'
      });
    }

    const transaction = await CreditService.grantCredits(userId, credits, description);

    res.json({
      success: true,
      data: transaction,
      message: `Successfully granted ${credits} credits to user ${userId}`
    });
  } catch (error) {
    console.error('Grant credits error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to grant credits'
    });
  }
});

/**
 * GET /api/v1/credits/user/:userId/status
 * 获取指定用户的积分状态（管理员）
 */
router.get('/user/:userId/status', requireAuth(), requireAdminForCredits(), async (req: Request, res: Response) => {
  try {
    const { userId } = req.params;
    
    const userCredits = await CreditService.getUserCredits(userId);

    if (!userCredits) {
      return res.status(404).json({
        success: false,
        error: 'User credits not found'
      });
    }

    res.json({
      success: true,
      data: userCredits
    });
  } catch (error) {
    console.error('Get user credit status error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get user credit status'
    });
  }
});

/**
 * GET /api/v1/credits/user/:userId/history
 * 获取指定用户的积分历史（管理员）
 */
router.get('/user/:userId/history', requireAuth(), requireAdminForCredits(), async (req: Request, res: Response) => {
  try {
    const { userId } = req.params;
    const limit = parseInt(req.query.limit as string) || 50;
    const offset = parseInt(req.query.offset as string) || 0;

    const history = await CreditService.getCreditHistory(userId, limit, offset);

    res.json({
      success: true,
      data: {
        userId,
        transactions: history,
        pagination: {
          limit,
          offset,
          total: history.length
        }
      }
    });
  } catch (error) {
    console.error('Get user credit history error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get user credit history'
    });
  }
});

export default router;