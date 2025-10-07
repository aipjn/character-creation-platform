"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const api_1 = require("../../types/api");
const router = express_1.default.Router();
router.get('/', async (req, res) => {
    try {
        const { page = api_1.API_CONSTANTS.DEFAULT_PAGINATION.PAGE, limit = api_1.API_CONSTANTS.DEFAULT_PAGINATION.LIMIT, } = req.query;
        const mockUsers = [
            {
                id: '1',
                auth0Id: 'auth0|mock1',
                email: 'test@example.com',
                name: 'Test User'
            }
        ];
        const response = {
            success: true,
            data: {
                items: mockUsers,
                pagination: {
                    currentPage: Number(page),
                    itemsPerPage: Number(limit),
                    totalItems: mockUsers.length,
                    totalPages: Math.ceil(mockUsers.length / Number(limit)),
                    hasNextPage: false,
                    hasPreviousPage: false
                }
            },
            meta: {
                timestamp: new Date().toISOString(),
                requestId: req.get('X-Request-ID') || 'unknown',
                version: '1.0.0',
                path: req.path
            }
        };
        return res.json(response);
    }
    catch (error) {
        const response = {
            success: false,
            error: {
                code: api_1.API_CONSTANTS.ERROR_CODES.INTERNAL_ERROR,
                message: 'Internal server error',
                statusCode: api_1.API_CONSTANTS.HTTP_STATUS.INTERNAL_SERVER_ERROR
            },
            meta: {
                timestamp: new Date().toISOString(),
                requestId: req.get('X-Request-ID') || 'unknown',
                version: '1.0.0',
                path: req.path
            }
        };
        return res.status(api_1.API_CONSTANTS.HTTP_STATUS.INTERNAL_SERVER_ERROR).json(response);
    }
});
router.get('/:id', async (req, res) => {
    try {
        const { id } = req.params;
        if (!id || typeof id !== 'string' || id.trim().length === 0) {
            const response = {
                success: false,
                error: {
                    code: api_1.API_CONSTANTS.ERROR_CODES.VALIDATION_ERROR,
                    message: 'User ID is required',
                    statusCode: api_1.API_CONSTANTS.HTTP_STATUS.BAD_REQUEST
                },
                meta: {
                    timestamp: new Date().toISOString(),
                    requestId: req.get('X-Request-ID') || 'unknown',
                    version: '1.0.0',
                    path: req.path
                }
            };
            return res.status(api_1.API_CONSTANTS.HTTP_STATUS.BAD_REQUEST).json(response);
        }
        const mockUser = {
            id,
            auth0Id: `auth0|${id}`,
            email: `user${id}@example.com`,
            name: `User ${id}`
        };
        const response = {
            success: true,
            data: mockUser,
            meta: {
                timestamp: new Date().toISOString(),
                requestId: req.get('X-Request-ID') || 'unknown',
                version: '1.0.0',
                path: req.path
            }
        };
        return res.json(response);
    }
    catch (error) {
        const response = {
            success: false,
            error: {
                code: api_1.API_CONSTANTS.ERROR_CODES.INTERNAL_ERROR,
                message: 'Internal server error',
                statusCode: api_1.API_CONSTANTS.HTTP_STATUS.INTERNAL_SERVER_ERROR
            },
            meta: {
                timestamp: new Date().toISOString(),
                requestId: req.get('X-Request-ID') || 'unknown',
                version: '1.0.0',
                path: req.path
            }
        };
        return res.status(api_1.API_CONSTANTS.HTTP_STATUS.INTERNAL_SERVER_ERROR).json(response);
    }
});
router.post('/', async (req, res) => {
    try {
        const userData = req.body;
        const newUser = {
            id: Date.now().toString(),
            auth0Id: userData.auth0Id || `auth0|${Date.now()}`,
            email: userData.email || 'new@example.com',
            name: userData.name || null
        };
        const response = {
            success: true,
            data: newUser,
            meta: {
                timestamp: new Date().toISOString(),
                requestId: req.get('X-Request-ID') || 'unknown',
                version: '1.0.0',
                path: req.path
            }
        };
        return res.status(api_1.API_CONSTANTS.HTTP_STATUS.CREATED).json(response);
    }
    catch (error) {
        const response = {
            success: false,
            error: {
                code: api_1.API_CONSTANTS.ERROR_CODES.INTERNAL_ERROR,
                message: 'Internal server error',
                statusCode: api_1.API_CONSTANTS.HTTP_STATUS.INTERNAL_SERVER_ERROR
            },
            meta: {
                timestamp: new Date().toISOString(),
                requestId: req.get('X-Request-ID') || 'unknown',
                version: '1.0.0',
                path: req.path
            }
        };
        return res.status(api_1.API_CONSTANTS.HTTP_STATUS.INTERNAL_SERVER_ERROR).json(response);
    }
});
exports.default = router;
//# sourceMappingURL=users.js.map