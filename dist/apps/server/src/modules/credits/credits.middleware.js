"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.checkCredits = checkCredits;
const credits_service_1 = require("./credits.service");
function checkCredits(apiEndpoint) {
    return async (req, res, next) => {
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
            const cost = await credits_service_1.creditService.getApiCost(apiEndpoint);
            if (cost === null || cost === 0) {
                return next();
            }
            const check = await credits_service_1.creditService.checkSufficientCredits(req.user.id, apiEndpoint);
            if (!check.sufficient) {
                return res.status(402).json({
                    success: false,
                    error: {
                        code: 'INSUFFICIENT_CREDITS',
                        message: `Insufficient credits. Required: ${check.required}, Available: ${check.balance}`,
                        required: check.required,
                        balance: check.balance
                    }
                });
            }
            req.creditCost = cost;
            const originalJson = res.json.bind(res);
            res.json = function (body) {
                if (!req.creditDeducted && body.success === true && req.creditCost) {
                    credits_service_1.creditService.deductCredits(req.user.id, req.creditCost, apiEndpoint, {
                        method: req.method,
                        path: req.path,
                        body: req.body
                    }).then(result => {
                        req.creditDeducted = true;
                        body.credits = {
                            deducted: req.creditCost,
                            newBalance: result.newBalance
                        };
                        originalJson(body);
                    }).catch(error => {
                        console.error('Error deducting credits:', error);
                        originalJson(body);
                    });
                }
                else {
                    originalJson(body);
                }
            };
            next();
        }
        catch (error) {
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
//# sourceMappingURL=credits.middleware.js.map