/**
 * Credit Middleware
 * Checks and deducts credits for API calls
 */

import { Request, Response, NextFunction } from 'express';
import { creditService } from './credits.service';

// Extend Express Request type to include credit info
declare global {
  namespace Express {
    interface Request {
      creditCost?: number;
      creditDeducted?: boolean;
    }
  }
}

/**
 * Middleware to check and deduct credits for API calls
 * Usage: router.post('/endpoint', requireAuth, checkCredit('/endpoint'), handler)
 */
export function checkCredits(apiEndpoint: string) {
  return async (req: Request, res: Response, next: NextFunction): Promise<any> => {
    try {
      if (!req.user) {
        return res.status(401).json({
          success: false,
          error: {
            code: 'UNAUTHORIZED',
            message: 'Authentication required'
          }
        });
      }

      // Get API cost
      const cost = await creditService.getApiCost(apiEndpoint);

      // If no cost configured, allow the request
      if (cost === null || cost === 0) {
        return next();
      }

      // Check if user has sufficient credits
      const check = await creditService.checkSufficientCredits(req.user.id, apiEndpoint);

      if (!check.sufficient) {
        return res.status(402).json({  // 402 Payment Required
          success: false,
          error: {
            code: 'INSUFFICIENT_CREDITS',
            message: `Insufficient credits. Required: ${check.required}, Available: ${check.balance}`,
            required: check.required,
            balance: check.balance
          }
        });
      }

      // Store cost for later deduction
      req.creditCost = cost;

      // Intercept response to deduct credits on success
      const originalJson = res.json.bind(res);
      res.json = function (body: any) {
        // Only deduct if response is successful and credits haven't been deducted yet
        if (!req.creditDeducted && body.success === true && req.creditCost) {
          creditService.deductCredits(
            req.user!.id,
            req.creditCost,
            apiEndpoint,
            {
              method: req.method,
              path: req.path,
              body: req.body
            }
          ).then(result => {
            req.creditDeducted = true;
            // Update the response with new credit balance
            body.credits = {
              deducted: req.creditCost,
              newBalance: result.newBalance
            };
            originalJson(body);
          }).catch(error => {
            console.error('Error deducting credits:', error);
            originalJson(body);
          });
        } else {
          originalJson(body);
        }
      } as any;

      next();
    } catch (error) {
      console.error('Credit middleware error:', error);
      return res.status(500).json({
        success: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: 'Error checking credits'
        }
      });
    }
  };
}
