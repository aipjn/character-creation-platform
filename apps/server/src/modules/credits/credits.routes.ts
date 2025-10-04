/**
 * Credits API Routes
 * Provides endpoints for credit balance and transaction history
 */

import express from 'express';
import { requireAuth } from '../../middleware/requireAuth';
import { creditService } from './credits.service';

const router = express.Router();

/**
 * GET /api/v1/credits
 * Get user's current credit balance
 */
router.get('/', requireAuth, async (req: express.Request, res: express.Response) => {
  try {
    const userId = (req as any).user!.id;
    const balance = await creditService.getBalance(userId);

    return res.json({
      success: true,
      data: {
        balance,
        userId
      }
    });
  } catch (error) {
    console.error('Error fetching credit balance:', error);
    return res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Failed to fetch credit balance'
      }
    });
  }
});

/**
 * GET /api/v1/credits/transactions
 * Get user's transaction history
 */
router.get('/transactions', requireAuth, async (req: express.Request, res: express.Response) => {
  try {
    const userId = (req as any).user!.id;
    const limit = parseInt(req.query.limit as string) || 50;

    const transactions = await creditService.getTransactionHistory(userId, limit);

    return res.json({
      success: true,
      data: {
        transactions,
        count: transactions.length
      }
    });
  } catch (error) {
    console.error('Error fetching transaction history:', error);
    return res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Failed to fetch transaction history'
      }
    });
  }
});

/**
 * GET /api/v1/credits/costs
 * Get API cost configuration (no auth required for display purposes)
 */
router.get('/costs', async (req: express.Request, res: express.Response) => {
  try {
    const costs = await creditService.getAllApiCosts();

    return res.json({
      success: true,
      data: { costs }
    });
  } catch (error) {
    console.error('Error fetching API costs:', error);
    return res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Failed to fetch API costs'
      }
    });
  }
});

export default router;
