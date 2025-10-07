"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const requireAuth_1 = require("../../middleware/requireAuth");
const credits_service_1 = require("./credits.service");
const router = express_1.default.Router();
router.get('/', requireAuth_1.requireAuth, async (req, res) => {
    try {
        const userId = req.user.id;
        const balance = await credits_service_1.creditService.getBalance(userId);
        return res.json({
            success: true,
            data: {
                balance,
                userId
            }
        });
    }
    catch (error) {
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
router.get('/transactions', requireAuth_1.requireAuth, async (req, res) => {
    try {
        const userId = req.user.id;
        const limit = parseInt(req.query.limit) || 50;
        const transactions = await credits_service_1.creditService.getTransactionHistory(userId, limit);
        return res.json({
            success: true,
            data: {
                transactions,
                count: transactions.length
            }
        });
    }
    catch (error) {
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
router.get('/costs', async (req, res) => {
    try {
        const costs = await credits_service_1.creditService.getAllApiCosts();
        return res.json({
            success: true,
            data: { costs }
        });
    }
    catch (error) {
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
exports.default = router;
//# sourceMappingURL=credits.routes.js.map