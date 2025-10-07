"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.requireAuth = requireAuth;
exports.optionalAuth = optionalAuth;
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const client_1 = require("@prisma/client");
const api_1 = require("../types/api");
const prisma = new client_1.PrismaClient();
async function requireAuth(req, res, next) {
    try {
        const authHeader = req.headers.authorization;
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            res.status(api_1.API_CONSTANTS.HTTP_STATUS.UNAUTHORIZED).json({
                success: false,
                error: {
                    code: api_1.API_CONSTANTS.ERROR_CODES.UNAUTHORIZED,
                    message: 'Authentication required',
                    statusCode: api_1.API_CONSTANTS.HTTP_STATUS.UNAUTHORIZED
                }
            });
            return;
        }
        const token = authHeader.substring(7);
        const payload = jsonwebtoken_1.default.decode(token);
        if (!payload?.sub) {
            res.status(api_1.API_CONSTANTS.HTTP_STATUS.UNAUTHORIZED).json({
                success: false,
                error: {
                    code: api_1.API_CONSTANTS.ERROR_CODES.UNAUTHORIZED,
                    message: 'Invalid token',
                    statusCode: api_1.API_CONSTANTS.HTTP_STATUS.UNAUTHORIZED
                }
            });
            return;
        }
        const dbUser = await prisma.user.findUnique({
            where: { auth0Id: payload.sub },
            select: {
                id: true,
                auth0Id: true,
                email: true,
                name: true
            }
        });
        if (!dbUser) {
            res.status(api_1.API_CONSTANTS.HTTP_STATUS.UNAUTHORIZED).json({
                success: false,
                error: {
                    code: api_1.API_CONSTANTS.ERROR_CODES.UNAUTHORIZED,
                    message: 'User not found',
                    statusCode: api_1.API_CONSTANTS.HTTP_STATUS.UNAUTHORIZED
                }
            });
            return;
        }
        req.user = dbUser;
        next();
    }
    catch (error) {
        console.error('Auth middleware error:', error);
        res.status(api_1.API_CONSTANTS.HTTP_STATUS.UNAUTHORIZED).json({
            success: false,
            error: {
                code: api_1.API_CONSTANTS.ERROR_CODES.UNAUTHORIZED,
                message: 'Authentication failed',
                statusCode: api_1.API_CONSTANTS.HTTP_STATUS.UNAUTHORIZED
            }
        });
    }
}
async function optionalAuth(req, res, next) {
    try {
        const authHeader = req.headers.authorization;
        if (authHeader && authHeader.startsWith('Bearer ')) {
            const token = authHeader.substring(7);
            const payload = jsonwebtoken_1.default.decode(token);
            if (payload?.sub) {
                const dbUser = await prisma.user.findUnique({
                    where: { auth0Id: payload.sub },
                    select: {
                        id: true,
                        auth0Id: true,
                        email: true,
                        name: true
                    }
                });
                if (dbUser) {
                    req.user = dbUser;
                }
            }
        }
        next();
    }
    catch (error) {
        console.error('Optional auth error:', error);
        next();
    }
}
//# sourceMappingURL=requireAuth.js.map