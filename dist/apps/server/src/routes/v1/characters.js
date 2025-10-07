"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
const client_1 = require("@prisma/client");
const api_1 = require("../../types/api");
const geminiTextService_1 = __importDefault(require("../../services/geminiTextService"));
const nanoBananaClient_1 = require("../../services/nanoBananaClient");
const requireAuth_1 = require("../../middleware/requireAuth");
const credits_1 = require("../../modules/credits");
const router = express_1.default.Router();
const prisma = new client_1.PrismaClient();
let geminiService = null;
let nanoBananaClient = null;
try {
    geminiService = new geminiTextService_1.default();
}
catch (error) {
    console.warn('Gemini service not available:', error);
}
try {
    nanoBananaClient = (0, nanoBananaClient_1.getDefaultNanoBananaClient)();
    console.log('✅ nanoBanana service initialized');
}
catch (error) {
    console.warn('❌ nanoBanana service not available:', error);
}
router.get('/', requireAuth_1.requireAuth, async (req, res) => {
    try {
        const { page = api_1.API_CONSTANTS.DEFAULT_PAGINATION.PAGE, limit = api_1.API_CONSTANTS.DEFAULT_PAGINATION.LIMIT, } = req.query;
        const pageNum = Number(page);
        const limitNum = Number(limit);
        const skip = (pageNum - 1) * limitNum;
        const [dbCharacters, totalCount] = await Promise.all([
            prisma.character.findMany({
                where: { userId: req.user.id },
                skip,
                take: limitNum,
                orderBy: { createdAt: 'desc' },
                include: {
                    user: {
                        select: {
                            id: true,
                            email: true,
                            name: true
                        }
                    }
                }
            }),
            prisma.character.count({ where: { userId: req.user.id } })
        ]);
        const characters = dbCharacters.map(char => ({
            id: char.id,
            name: char.name || 'Unnamed Character',
            description: char.description || 'No description available',
            enhancedDescription: char.prompt,
            imageUrl: char.imageUrl || '',
            thumbnailUrl: char.thumbnailUrl || '',
            userId: char.userId,
            tags: [],
            createdAt: char.createdAt.toISOString(),
            updatedAt: char.updatedAt.toISOString(),
            metadata: {}
        }));
        const response = {
            success: true,
            data: {
                items: characters,
                pagination: {
                    currentPage: pageNum,
                    itemsPerPage: limitNum,
                    totalItems: totalCount,
                    totalPages: Math.ceil(totalCount / limitNum),
                    hasNextPage: skip + limitNum < totalCount,
                    hasPreviousPage: pageNum > 1
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
router.get('/:id', requireAuth_1.requireAuth, async (req, res) => {
    try {
        const { id } = req.params;
        if (!id) {
            const response = {
                success: false,
                error: {
                    code: api_1.API_CONSTANTS.ERROR_CODES.VALIDATION_ERROR,
                    message: 'Character ID is required',
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
        const dbCharacter = await prisma.character.findFirst({
            where: {
                id,
                userId: req.user.id
            },
            include: {
                user: {
                    select: {
                        id: true,
                        email: true,
                        name: true
                    }
                }
            }
        });
        if (!dbCharacter) {
            const response = {
                success: false,
                error: {
                    code: api_1.API_CONSTANTS.ERROR_CODES.NOT_FOUND,
                    message: 'Character not found',
                    statusCode: api_1.API_CONSTANTS.HTTP_STATUS.NOT_FOUND
                },
                meta: {
                    timestamp: new Date().toISOString(),
                    requestId: req.get('X-Request-ID') || 'unknown',
                    version: '1.0.0',
                    path: req.path
                }
            };
            return res.status(api_1.API_CONSTANTS.HTTP_STATUS.NOT_FOUND).json(response);
        }
        const character = {
            id: dbCharacter.id,
            name: dbCharacter.name || 'Unnamed Character',
            description: dbCharacter.description || 'No description available',
            enhancedDescription: dbCharacter.prompt,
            imageUrl: dbCharacter.imageUrl || '',
            thumbnailUrl: dbCharacter.thumbnailUrl || '',
            userId: dbCharacter.userId,
            tags: [],
            createdAt: dbCharacter.createdAt.toISOString(),
            updatedAt: dbCharacter.updatedAt.toISOString(),
            metadata: {}
        };
        const response = {
            success: true,
            data: character,
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
router.post('/', requireAuth_1.requireAuth, async (req, res) => {
    try {
        const characterData = req.body;
        if (!characterData.name || !characterData.description) {
            const response = {
                success: false,
                error: {
                    code: api_1.API_CONSTANTS.ERROR_CODES.VALIDATION_ERROR,
                    message: 'Name and description are required',
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
        const id = Date.now().toString();
        const saveBase64AsFile = (base64Data, outputPath) => {
            const matches = base64Data.match(/^data:image\/(\w+);base64,(.+)$/);
            if (!matches || !matches[2]) {
                throw new Error('Invalid base64 format');
            }
            const base64Content = matches[2];
            const buffer = Buffer.from(base64Content, 'base64');
            const dir = path_1.default.dirname(outputPath);
            if (!fs_1.default.existsSync(dir)) {
                fs_1.default.mkdirSync(dir, { recursive: true });
            }
            fs_1.default.writeFileSync(outputPath, buffer);
        };
        let imageUrl = '';
        let thumbnailUrl = '';
        if (characterData.imageUrl) {
            const imageFilename = `${id}.png`;
            const imagePath = path_1.default.join(process.cwd(), 'uploads', 'characters', imageFilename);
            saveBase64AsFile(characterData.imageUrl, imagePath);
            imageUrl = `/uploads/characters/${imageFilename}`;
        }
        if (characterData.thumbnailUrl) {
            const thumbnailFilename = `${id}_thumb.png`;
            const thumbnailPath = path_1.default.join(process.cwd(), 'uploads', 'characters', thumbnailFilename);
            saveBase64AsFile(characterData.thumbnailUrl, thumbnailPath);
            thumbnailUrl = `/uploads/characters/${thumbnailFilename}`;
        }
        const dbCharacter = await prisma.character.create({
            data: {
                id,
                userId: req.user.id,
                name: characterData.name,
                description: characterData.description,
                prompt: characterData.enhancedDescription || characterData.description,
                imageUrl,
                thumbnailUrl
            }
        });
        const newCharacter = {
            id: dbCharacter.id,
            name: dbCharacter.name || 'Unnamed Character',
            description: dbCharacter.description || 'No description available',
            enhancedDescription: dbCharacter.prompt,
            imageUrl: dbCharacter.imageUrl || '',
            thumbnailUrl: dbCharacter.thumbnailUrl || '',
            userId: dbCharacter.userId,
            tags: characterData.tags || [],
            createdAt: dbCharacter.createdAt.toISOString(),
            updatedAt: dbCharacter.updatedAt.toISOString(),
            metadata: characterData.metadata
        };
        const response = {
            success: true,
            data: newCharacter,
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
        console.error('Error creating character:', error);
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
router.put('/:id', requireAuth_1.requireAuth, async (req, res) => {
    try {
        const { id } = req.params;
        const updateData = req.body;
        if (!id) {
            const response = {
                success: false,
                error: {
                    code: api_1.API_CONSTANTS.ERROR_CODES.VALIDATION_ERROR,
                    message: 'Character ID is required',
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
        const existingCharacter = await prisma.character.findUnique({
            where: { id },
            select: { userId: true }
        });
        if (!existingCharacter) {
            const response = {
                success: false,
                error: {
                    code: api_1.API_CONSTANTS.ERROR_CODES.NOT_FOUND,
                    message: 'Character not found',
                    statusCode: api_1.API_CONSTANTS.HTTP_STATUS.NOT_FOUND
                },
                meta: {
                    timestamp: new Date().toISOString(),
                    requestId: req.get('X-Request-ID') || 'unknown',
                    version: '1.0.0',
                    path: req.path
                }
            };
            return res.status(api_1.API_CONSTANTS.HTTP_STATUS.NOT_FOUND).json(response);
        }
        if (existingCharacter.userId !== req.user.id) {
            const response = {
                success: false,
                error: {
                    code: api_1.API_CONSTANTS.ERROR_CODES.FORBIDDEN,
                    message: 'You do not have permission to update this character',
                    statusCode: api_1.API_CONSTANTS.HTTP_STATUS.FORBIDDEN
                },
                meta: {
                    timestamp: new Date().toISOString(),
                    requestId: req.get('X-Request-ID') || 'unknown',
                    version: '1.0.0',
                    path: req.path
                }
            };
            return res.status(api_1.API_CONSTANTS.HTTP_STATUS.FORBIDDEN).json(response);
        }
        const dbCharacter = await prisma.character.update({
            where: { id },
            data: {
                ...(updateData.name && { name: updateData.name }),
                ...(updateData.description && { description: updateData.description }),
                ...(updateData.enhancedDescription && { prompt: updateData.enhancedDescription })
            }
        });
        const updatedCharacter = {
            id: dbCharacter.id,
            name: dbCharacter.name || 'Unnamed Character',
            description: dbCharacter.description || 'No description available',
            enhancedDescription: dbCharacter.prompt,
            imageUrl: dbCharacter.imageUrl || '',
            thumbnailUrl: dbCharacter.thumbnailUrl || '',
            userId: dbCharacter.userId,
            tags: [],
            createdAt: dbCharacter.createdAt.toISOString(),
            updatedAt: dbCharacter.updatedAt.toISOString(),
            metadata: {}
        };
        const response = {
            success: true,
            data: updatedCharacter,
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
router.delete('/:id', requireAuth_1.requireAuth, async (req, res) => {
    try {
        const { id } = req.params;
        if (!id) {
            const response = {
                success: false,
                error: {
                    code: api_1.API_CONSTANTS.ERROR_CODES.VALIDATION_ERROR,
                    message: 'Character ID is required',
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
        const dbCharacter = await prisma.character.findUnique({
            where: { id }
        });
        if (!dbCharacter) {
            const response = {
                success: false,
                error: {
                    code: api_1.API_CONSTANTS.ERROR_CODES.NOT_FOUND,
                    message: 'Character not found',
                    statusCode: api_1.API_CONSTANTS.HTTP_STATUS.NOT_FOUND
                },
                meta: {
                    timestamp: new Date().toISOString(),
                    requestId: req.get('X-Request-ID') || 'unknown',
                    version: '1.0.0',
                    path: req.path
                }
            };
            return res.status(api_1.API_CONSTANTS.HTTP_STATUS.NOT_FOUND).json(response);
        }
        if (dbCharacter.userId !== req.user.id) {
            const response = {
                success: false,
                error: {
                    code: api_1.API_CONSTANTS.ERROR_CODES.FORBIDDEN,
                    message: 'You do not have permission to delete this character',
                    statusCode: api_1.API_CONSTANTS.HTTP_STATUS.FORBIDDEN
                },
                meta: {
                    timestamp: new Date().toISOString(),
                    requestId: req.get('X-Request-ID') || 'unknown',
                    version: '1.0.0',
                    path: req.path
                }
            };
            return res.status(api_1.API_CONSTANTS.HTTP_STATUS.FORBIDDEN).json(response);
        }
        if (dbCharacter.imageUrl) {
            const filename = dbCharacter.imageUrl.split('/').pop();
            if (filename) {
                const imagePath = path_1.default.join(process.cwd(), 'uploads', 'characters', filename);
                try {
                    fs_1.default.unlinkSync(imagePath);
                }
                catch { }
            }
        }
        if (dbCharacter.thumbnailUrl) {
            const filename = dbCharacter.thumbnailUrl.split('/').pop();
            if (filename) {
                const thumbPath = path_1.default.join(process.cwd(), 'uploads', 'characters', filename);
                try {
                    fs_1.default.unlinkSync(thumbPath);
                }
                catch { }
            }
        }
        await prisma.character.delete({
            where: { id }
        });
        const response = {
            success: true,
            data: { message: `Character ${id} deleted successfully` },
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
router.post('/optimize-prompt', requireAuth_1.requireAuth, (0, credits_1.checkCredits)('/characters/optimize-prompt'), async (req, res) => {
    try {
        if (!geminiService) {
            const response = {
                success: false,
                error: {
                    code: api_1.API_CONSTANTS.ERROR_CODES.SERVICE_UNAVAILABLE,
                    message: 'Prompt optimization service is not available',
                    statusCode: api_1.API_CONSTANTS.HTTP_STATUS.SERVICE_UNAVAILABLE
                },
                meta: {
                    timestamp: new Date().toISOString(),
                    requestId: req.get('X-Request-ID') || 'unknown',
                    version: '1.0.0',
                    path: req.path
                }
            };
            return res.status(api_1.API_CONSTANTS.HTTP_STATUS.SERVICE_UNAVAILABLE).json(response);
        }
        const { userDescription, style, gender, conversationHistory } = req.body;
        if (!userDescription || userDescription.trim().length === 0) {
            const response = {
                success: false,
                error: {
                    code: api_1.API_CONSTANTS.ERROR_CODES.VALIDATION_ERROR,
                    message: 'User description is required',
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
        const optimizationResult = await geminiService.optimizePrompt({
            userDescription,
            style,
            gender,
            conversationHistory
        });
        const response = {
            success: true,
            data: optimizationResult,
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
        console.error('Error optimizing prompt:', error);
        const response = {
            success: false,
            error: {
                code: api_1.API_CONSTANTS.ERROR_CODES.INTERNAL_ERROR,
                message: 'Failed to optimize prompt',
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
router.post('/generate-image', requireAuth_1.requireAuth, (0, credits_1.checkCredits)('/characters/generate-image'), async (req, res) => {
    try {
        const { prompt, style } = req.body;
        if (!prompt) {
            return res.status(400).json({
                success: false,
                error: {
                    code: 'VALIDATION_ERROR',
                    message: 'Prompt is required',
                    statusCode: 400
                }
            });
        }
        if (!nanoBananaClient) {
            return res.status(503).json({
                success: false,
                error: {
                    code: 'SERVICE_UNAVAILABLE',
                    message: 'Image generation service is not available',
                    statusCode: 503
                }
            });
        }
        const generationRequest = {
            type: 'text-to-image',
            prompt: prompt,
            quality: 'high',
            width: 1024,
            height: 1024,
            style: style || 'realistic'
        };
        console.log('🎨 Generating image with prompt:', prompt);
        const generationResult = await nanoBananaClient.generateImage(generationRequest);
        if (!generationResult || generationResult.status !== 'completed') {
            throw new Error(`Image generation failed: ${generationResult?.status || 'unknown status'}`);
        }
        const imageResult = {
            imageUrl: generationResult.result?.imageUrl,
            thumbnailUrl: generationResult.result?.thumbnailUrl,
            prompt: prompt,
            style: style || 'realistic',
            generationId: generationResult.id
        };
        return res.json({
            success: true,
            data: imageResult
        });
    }
    catch (error) {
        console.error('Error generating image:', error);
        return res.status(500).json({
            success: false,
            error: {
                code: 'INTERNAL_ERROR',
                message: `Failed to generate image: ${error instanceof Error ? error.message : 'Unknown error'}`,
                statusCode: 500
            }
        });
    }
});
router.post('/optimize-prompt-25flash', requireAuth_1.requireAuth, (0, credits_1.checkCredits)('/characters/optimize-prompt-25flash'), async (req, res) => {
    try {
        if (!geminiService) {
            const response = {
                success: false,
                error: {
                    code: api_1.API_CONSTANTS.ERROR_CODES.SERVICE_UNAVAILABLE,
                    message: 'Gemini 2.5 Flash service is not available',
                    statusCode: api_1.API_CONSTANTS.HTTP_STATUS.SERVICE_UNAVAILABLE
                },
                meta: {
                    timestamp: new Date().toISOString(),
                    requestId: req.get('X-Request-ID') || 'unknown',
                    version: '1.0.0',
                    path: req.path
                }
            };
            return res.status(api_1.API_CONSTANTS.HTTP_STATUS.SERVICE_UNAVAILABLE).json(response);
        }
        const { userDescription, style, gender, conversationHistory } = req.body;
        if (!userDescription || userDescription.trim().length === 0) {
            const response = {
                success: false,
                error: {
                    code: api_1.API_CONSTANTS.ERROR_CODES.VALIDATION_ERROR,
                    message: 'User description is required',
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
        const optimizationResult = await geminiService.optimizePromptWith25Flash({
            userDescription,
            style,
            gender,
            conversationHistory
        });
        const response = {
            success: true,
            data: {
                ...optimizationResult,
                model: 'gemini-2.5-flash'
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
        console.error('Error with Gemini 2.5 Flash:', error);
        const response = {
            success: false,
            error: {
                code: api_1.API_CONSTANTS.ERROR_CODES.INTERNAL_ERROR,
                message: 'Failed to optimize prompt with Gemini 2.5 Flash',
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
router.post('/edit-image', requireAuth_1.requireAuth, async (req, res) => {
    try {
        const { imageUrl, prompt, characterId } = req.body;
        if (!imageUrl || !prompt) {
            return res.status(400).json({
                success: false,
                error: {
                    code: 'VALIDATION_ERROR',
                    message: 'imageUrl and prompt are required',
                    statusCode: 400
                }
            });
        }
        if (!geminiService) {
            return res.status(503).json({
                success: false,
                error: {
                    code: 'SERVICE_UNAVAILABLE',
                    message: 'Gemini image editing service is not available',
                    statusCode: 503
                }
            });
        }
        console.log('🎨 Editing image with Gemini 2.5 Flash Image model');
        console.log('Image URL:', imageUrl);
        console.log('Edit prompt:', prompt);
        const result = await geminiService.editImageWithGemini({
            imageUrl,
            prompt,
            characterId
        });
        return res.json({
            success: true,
            data: result
        });
    }
    catch (error) {
        console.error('Error editing image with Gemini:', error);
        return res.status(500).json({
            success: false,
            error: {
                code: 'INTERNAL_ERROR',
                message: `Failed to edit image: ${error instanceof Error ? error.message : 'Unknown error'}`,
                statusCode: 500
            }
        });
    }
});
exports.default = router;
//# sourceMappingURL=characters.js.map