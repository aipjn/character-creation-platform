"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const auth_1 = require("../../modules/auth");
const credits_1 = require("../../modules/credits");
const users_1 = __importDefault(require("./users"));
const characters_1 = __importDefault(require("./characters"));
const themes_1 = __importDefault(require("./themes"));
const router = express_1.default.Router();
router.get('/', (req, res) => {
    const response = {
        success: true,
        data: {
            message: 'Character Creation Platform API v1.0',
            version: '1.0.0',
            documentation: '/api/v1/docs',
            endpoints: {
                auth: '/api/v1/auth',
                users: '/api/v1/users',
                characters: '/api/v1/characters',
                themes: '/api/v1/themes',
                credits: '/api/v1/credits',
                health: '/health'
            },
            status: 'operational',
            rateLimit: {
                window: '15 minutes',
                limit: 100,
                remaining: 100
            }
        },
        meta: {
            timestamp: new Date().toISOString(),
            requestId: `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
            version: '1.0.0',
            path: req.path
        }
    };
    res.json(response);
});
router.use('/auth', auth_1.authRoutes);
router.use('/credits', credits_1.creditsRouter);
router.use('/users', users_1.default);
router.use('/characters', characters_1.default);
router.use('/themes', themes_1.default);
router.use('*', (req, res) => {
    const response = {
        success: false,
        error: {
            code: 'NOT_FOUND',
            message: `Cannot ${req.method} ${req.originalUrl}`,
            statusCode: 404
        },
        meta: {
            timestamp: new Date().toISOString(),
            requestId: `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
            version: '1.0.0',
            path: req.path
        }
    };
    res.status(404).json(response);
});
exports.default = router;
//# sourceMappingURL=index.js.map