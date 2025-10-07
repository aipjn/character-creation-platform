"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const auth_service_1 = require("./auth.service");
const router = express_1.default.Router();
const authService = (0, auth_service_1.getAuthService)();
router.post('/login', async (req, res) => {
    try {
        const { email, password } = req.body;
        if (!email || !password) {
            return res.status(400).json({
                success: false,
                error: {
                    code: 'INVALID_INPUT',
                    message: 'Email and password are required',
                },
            });
        }
        const result = await authService.loginUser(email, password);
        if (!result.success) {
            return res.status(401).json({
                success: false,
                error: {
                    code: 'AUTHENTICATION_FAILED',
                    message: result.error || 'Invalid credentials',
                },
            });
        }
        return res.json({
            success: true,
            data: {
                user: result.user,
                token: result.accessToken,
            },
        });
    }
    catch (error) {
        console.error('[AUTH] Login error:', error);
        return res.status(500).json({
            success: false,
            error: {
                code: 'INTERNAL_ERROR',
                message: 'Login failed',
            },
        });
    }
});
router.post('/register', async (req, res) => {
    try {
        const { email, password, name } = req.body;
        if (!email || !password || !name) {
            return res.status(400).json({
                success: false,
                error: {
                    code: 'INVALID_INPUT',
                    message: 'Email, password, and name are required',
                },
            });
        }
        const result = await authService.registerUser({ email, password, name });
        if (!result.success) {
            return res.status(400).json({
                success: false,
                error: {
                    code: 'REGISTRATION_FAILED',
                    message: result.error || 'Registration failed',
                },
            });
        }
        return res.json({
            success: true,
            data: {
                user: result.user,
                message: 'Registration successful. Please verify your email.',
            },
        });
    }
    catch (error) {
        console.error('[AUTH] Registration error:', error);
        return res.status(500).json({
            success: false,
            error: {
                code: 'INTERNAL_ERROR',
                message: 'Registration failed',
            },
        });
    }
});
router.get('/me', async (req, res) => {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({
            success: false,
            error: {
                code: 'UNAUTHORIZED',
                message: 'No token provided',
            },
        });
    }
    try {
        const token = authHeader.substring(7);
        const user = await authService.verifyToken(token);
        if (!user) {
            return res.status(401).json({
                success: false,
                error: {
                    code: 'UNAUTHORIZED',
                    message: 'Invalid token',
                },
            });
        }
        return res.json({
            success: true,
            data: {
                user: {
                    id: user.id,
                    email: user.email,
                    name: user.name,
                    picture: user.picture,
                    emailVerified: user.emailVerified,
                },
            },
        });
    }
    catch (error) {
        console.error('[AUTH] Token verification failed:', error);
        return res.status(401).json({
            success: false,
            error: {
                code: 'UNAUTHORIZED',
                message: 'Invalid token',
            },
        });
    }
});
router.post('/logout', (req, res) => {
    return res.json({
        success: true,
        message: 'Logged out successfully',
    });
});
exports.default = router;
//# sourceMappingURL=auth.routes.js.map