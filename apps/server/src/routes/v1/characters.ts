/**
 * Characters API Routes - Simplified Version
 * RESTful endpoints for character management
 */

import express from 'express';
import fs from 'fs';
import path from 'path';
import { PrismaClient } from '@prisma/client';
import {
  ApiResponse,
  Character,
  PaginatedResponse,
  API_CONSTANTS
} from '../../types/api';
import GeminiTextService, { PromptOptimizationRequest, PromptOptimizationResponse } from '../../services/geminiTextService';
import { getDefaultNanoBananaClient, GenerationRequest } from '../../services/nanoBananaClient';
import { requireAuth } from '../../middleware/requireAuth';
import { checkCredits } from '../../modules/credits';
import jwt from 'jsonwebtoken';

const router = express.Router();
const prisma = new PrismaClient();

// Initialize services
let geminiService: GeminiTextService | null = null;
let nanoBananaClient: any = null;

try {
  geminiService = new GeminiTextService();
} catch (error) {
  console.warn('Gemini service not available:', error);
}

try {
  nanoBananaClient = getDefaultNanoBananaClient();
  console.log('✅ nanoBanana service initialized');
} catch (error) {
  console.warn('❌ nanoBanana service not available:', error);
}

/**
 * GET /api/v1/characters
 * List characters with pagination and filtering
 */
router.get('/', requireAuth, async (req: express.Request, res: express.Response) => {
  try {
    const {
      page = API_CONSTANTS.DEFAULT_PAGINATION.PAGE,
      limit = API_CONSTANTS.DEFAULT_PAGINATION.LIMIT,
      // query = '',
      // tags = '',
      // userId = '',
      // dateFrom = '',
      // dateTo = '',
      // sortBy = 'createdAt',
      // sortOrder = 'desc'
    } = req.query;

    // Read characters from database - only for current user
    const pageNum = Number(page);
    const limitNum = Number(limit);
    const skip = (pageNum - 1) * limitNum;

    const [dbCharacters, totalCount] = await Promise.all([
      prisma.character.findMany({
        where: { userId: req.user!.id },
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
      prisma.character.count({ where: { userId: req.user!.id } })
    ]);

    // Map database characters to API format
    const characters: Character[] = dbCharacters.map(char => ({
      id: char.id,
      name: char.name || 'Unnamed Character',
      description: char.description || 'No description available',
      enhancedDescription: char.prompt,
      imageUrl: char.imageUrl || '',
      thumbnailUrl: char.thumbnailUrl || '',
      userId: char.userId,
      tags: [], // TODO: add tags support
      createdAt: char.createdAt.toISOString(),
      updatedAt: char.updatedAt.toISOString(),
      metadata: {}
    }));

    const response: ApiResponse<PaginatedResponse<Character>> = {
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
  } catch (error) {
    const response: ApiResponse = {
      success: false,
      error: {
        code: API_CONSTANTS.ERROR_CODES.INTERNAL_ERROR,
        message: 'Internal server error',
        statusCode: API_CONSTANTS.HTTP_STATUS.INTERNAL_SERVER_ERROR
      },
      meta: {
        timestamp: new Date().toISOString(),
        requestId: req.get('X-Request-ID') || 'unknown',
        version: '1.0.0',
        path: req.path
      }
    };

    return res.status(API_CONSTANTS.HTTP_STATUS.INTERNAL_SERVER_ERROR).json(response);
  }
});

/**
 * GET /api/v1/characters/:id
 * Get character by ID
 */
router.get('/:id', requireAuth, async (req: express.Request, res: express.Response) => {
  try {
    const { id } = req.params;

    if (!id) {
      const response: ApiResponse = {
        success: false,
        error: {
          code: API_CONSTANTS.ERROR_CODES.VALIDATION_ERROR,
          message: 'Character ID is required',
          statusCode: API_CONSTANTS.HTTP_STATUS.BAD_REQUEST
        },
        meta: {
          timestamp: new Date().toISOString(),
          requestId: req.get('X-Request-ID') || 'unknown',
          version: '1.0.0',
          path: req.path
        }
      };

      return res.status(API_CONSTANTS.HTTP_STATUS.BAD_REQUEST).json(response);
    }

    // Read character from database - only if owned by current user
    const dbCharacter = await prisma.character.findFirst({
      where: {
        id,
        userId: req.user!.id
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
      const response: ApiResponse = {
        success: false,
        error: {
          code: API_CONSTANTS.ERROR_CODES.NOT_FOUND,
          message: 'Character not found',
          statusCode: API_CONSTANTS.HTTP_STATUS.NOT_FOUND
        },
        meta: {
          timestamp: new Date().toISOString(),
          requestId: req.get('X-Request-ID') || 'unknown',
          version: '1.0.0',
          path: req.path
        }
      };

      return res.status(API_CONSTANTS.HTTP_STATUS.NOT_FOUND).json(response);
    }

    const character: Character = {
      id: dbCharacter.id,
      name: dbCharacter.name || 'Unnamed Character',
      description: dbCharacter.description || 'No description available',
      enhancedDescription: dbCharacter.prompt,
      imageUrl: dbCharacter.imageUrl || '',
      thumbnailUrl: dbCharacter.thumbnailUrl || '',
      userId: dbCharacter.userId,
      tags: [], // TODO: add tags support
      createdAt: dbCharacter.createdAt.toISOString(),
      updatedAt: dbCharacter.updatedAt.toISOString(),
      metadata: {}
    };

    const response: ApiResponse<Character> = {
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
  } catch (error) {
    const response: ApiResponse = {
      success: false,
      error: {
        code: API_CONSTANTS.ERROR_CODES.INTERNAL_ERROR,
        message: 'Internal server error',
        statusCode: API_CONSTANTS.HTTP_STATUS.INTERNAL_SERVER_ERROR
      },
      meta: {
        timestamp: new Date().toISOString(),
        requestId: req.get('X-Request-ID') || 'unknown',
        version: '1.0.0',
        path: req.path
      }
    };

    return res.status(API_CONSTANTS.HTTP_STATUS.INTERNAL_SERVER_ERROR).json(response);
  }
});

/**
 * POST /api/v1/characters
 * Create new character
 */
router.post('/', requireAuth, async (req: express.Request, res: express.Response) => {
  try {
    const characterData = req.body;

    // Validate required fields
    if (!characterData.name || !characterData.description) {
      const response: ApiResponse = {
        success: false,
        error: {
          code: API_CONSTANTS.ERROR_CODES.VALIDATION_ERROR,
          message: 'Name and description are required',
          statusCode: API_CONSTANTS.HTTP_STATUS.BAD_REQUEST
        },
        meta: {
          timestamp: new Date().toISOString(),
          requestId: req.get('X-Request-ID') || 'unknown',
          version: '1.0.0',
          path: req.path
        }
      };

      return res.status(API_CONSTANTS.HTTP_STATUS.BAD_REQUEST).json(response);
    }

    const id = Date.now().toString();

    // Helper function to save base64 as file
    const saveBase64AsFile = (base64Data: string, outputPath: string): void => {
      const matches = base64Data.match(/^data:image\/(\w+);base64,(.+)$/);
      if (!matches || !matches[2]) {
        throw new Error('Invalid base64 format');
      }
      const base64Content: string = matches[2];
      const buffer = Buffer.from(base64Content, 'base64');
      const dir = path.dirname(outputPath);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
      fs.writeFileSync(outputPath, buffer);
    };

    // Save images as files
    let imageUrl = '';
    let thumbnailUrl = '';

    if (characterData.imageUrl) {
      const imageFilename = `${id}.png`;
      const imagePath = path.join(process.cwd(), 'uploads', 'characters', imageFilename);
      saveBase64AsFile(characterData.imageUrl, imagePath);
      imageUrl = `/uploads/characters/${imageFilename}`;
    }

    if (characterData.thumbnailUrl) {
      const thumbnailFilename = `${id}_thumb.png`;
      const thumbnailPath = path.join(process.cwd(), 'uploads', 'characters', thumbnailFilename);
      saveBase64AsFile(characterData.thumbnailUrl, thumbnailPath);
      thumbnailUrl = `/uploads/characters/${thumbnailFilename}`;
    }

    // Save to database
    const dbCharacter = await prisma.character.create({
      data: {
        id,
        userId: req.user!.id,  // Use user from middleware
        name: characterData.name,
        description: characterData.description,
        prompt: characterData.enhancedDescription || characterData.description,
        imageUrl,
        thumbnailUrl
      }
    });

    // Map to API format
    const newCharacter: Character = {
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

    const response: ApiResponse<Character> = {
      success: true,
      data: newCharacter,
      meta: {
        timestamp: new Date().toISOString(),
        requestId: req.get('X-Request-ID') || 'unknown',
        version: '1.0.0',
        path: req.path
      }
    };

    return res.status(API_CONSTANTS.HTTP_STATUS.CREATED).json(response);
  } catch (error) {
    console.error('Error creating character:', error);
    const response: ApiResponse = {
      success: false,
      error: {
        code: API_CONSTANTS.ERROR_CODES.INTERNAL_ERROR,
        message: 'Internal server error',
        statusCode: API_CONSTANTS.HTTP_STATUS.INTERNAL_SERVER_ERROR
      },
      meta: {
        timestamp: new Date().toISOString(),
        requestId: req.get('X-Request-ID') || 'unknown',
        version: '1.0.0',
        path: req.path
      }
    };

    return res.status(API_CONSTANTS.HTTP_STATUS.INTERNAL_SERVER_ERROR).json(response);
  }
});

/**
 * PUT /api/v1/characters/:id
 * Update character by ID
 */
router.put('/:id', requireAuth, async (req: express.Request, res: express.Response) => {
  try {
    const { id } = req.params;
    const updateData = req.body;

    if (!id) {
      const response: ApiResponse = {
        success: false,
        error: {
          code: API_CONSTANTS.ERROR_CODES.VALIDATION_ERROR,
          message: 'Character ID is required',
          statusCode: API_CONSTANTS.HTTP_STATUS.BAD_REQUEST
        },
        meta: {
          timestamp: new Date().toISOString(),
          requestId: req.get('X-Request-ID') || 'unknown',
          version: '1.0.0',
          path: req.path
        }
      };

      return res.status(API_CONSTANTS.HTTP_STATUS.BAD_REQUEST).json(response);
    }

    // First check ownership
    const existingCharacter = await prisma.character.findUnique({
      where: { id },
      select: { userId: true }
    });

    if (!existingCharacter) {
      const response: ApiResponse = {
        success: false,
        error: {
          code: API_CONSTANTS.ERROR_CODES.NOT_FOUND,
          message: 'Character not found',
          statusCode: API_CONSTANTS.HTTP_STATUS.NOT_FOUND
        },
        meta: {
          timestamp: new Date().toISOString(),
          requestId: req.get('X-Request-ID') || 'unknown',
          version: '1.0.0',
          path: req.path
        }
      };

      return res.status(API_CONSTANTS.HTTP_STATUS.NOT_FOUND).json(response);
    }

    if (existingCharacter.userId !== req.user!.id) {
      const response: ApiResponse = {
        success: false,
        error: {
          code: API_CONSTANTS.ERROR_CODES.FORBIDDEN,
          message: 'You do not have permission to update this character',
          statusCode: API_CONSTANTS.HTTP_STATUS.FORBIDDEN
        },
        meta: {
          timestamp: new Date().toISOString(),
          requestId: req.get('X-Request-ID') || 'unknown',
          version: '1.0.0',
          path: req.path
        }
      };

      return res.status(API_CONSTANTS.HTTP_STATUS.FORBIDDEN).json(response);
    }

    // Update character in database
    const dbCharacter = await prisma.character.update({
      where: { id },
      data: {
        ...(updateData.name && { name: updateData.name }),
        ...(updateData.description && { description: updateData.description }),
        ...(updateData.enhancedDescription && { prompt: updateData.enhancedDescription })
      }
    });

    const updatedCharacter: Character = {
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

    const response: ApiResponse<Character> = {
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
  } catch (error) {
    const response: ApiResponse = {
      success: false,
      error: {
        code: API_CONSTANTS.ERROR_CODES.INTERNAL_ERROR,
        message: 'Internal server error',
        statusCode: API_CONSTANTS.HTTP_STATUS.INTERNAL_SERVER_ERROR
      },
      meta: {
        timestamp: new Date().toISOString(),
        requestId: req.get('X-Request-ID') || 'unknown',
        version: '1.0.0',
        path: req.path
      }
    };

    return res.status(API_CONSTANTS.HTTP_STATUS.INTERNAL_SERVER_ERROR).json(response);
  }
});

/**
 * DELETE /api/v1/characters/:id
 * Delete character by ID
 */
router.delete('/:id', requireAuth, async (req: express.Request, res: express.Response) => {
  try {
    const { id } = req.params;

    if (!id) {
      const response: ApiResponse = {
        success: false,
        error: {
          code: API_CONSTANTS.ERROR_CODES.VALIDATION_ERROR,
          message: 'Character ID is required',
          statusCode: API_CONSTANTS.HTTP_STATUS.BAD_REQUEST
        },
        meta: {
          timestamp: new Date().toISOString(),
          requestId: req.get('X-Request-ID') || 'unknown',
          version: '1.0.0',
          path: req.path
        }
      };

      return res.status(API_CONSTANTS.HTTP_STATUS.BAD_REQUEST).json(response);
    }

    // Get character to delete its images and verify ownership
    const dbCharacter = await prisma.character.findUnique({
      where: { id }
    });

    if (!dbCharacter) {
      const response: ApiResponse = {
        success: false,
        error: {
          code: API_CONSTANTS.ERROR_CODES.NOT_FOUND,
          message: 'Character not found',
          statusCode: API_CONSTANTS.HTTP_STATUS.NOT_FOUND
        },
        meta: {
          timestamp: new Date().toISOString(),
          requestId: req.get('X-Request-ID') || 'unknown',
          version: '1.0.0',
          path: req.path
        }
      };

      return res.status(API_CONSTANTS.HTTP_STATUS.NOT_FOUND).json(response);
    }

    // Verify ownership
    if (dbCharacter.userId !== req.user!.id) {
      const response: ApiResponse = {
        success: false,
        error: {
          code: API_CONSTANTS.ERROR_CODES.FORBIDDEN,
          message: 'You do not have permission to delete this character',
          statusCode: API_CONSTANTS.HTTP_STATUS.FORBIDDEN
        },
        meta: {
          timestamp: new Date().toISOString(),
          requestId: req.get('X-Request-ID') || 'unknown',
          version: '1.0.0',
          path: req.path
        }
      };

      return res.status(API_CONSTANTS.HTTP_STATUS.FORBIDDEN).json(response);
    }

    // Delete character image files
    if (dbCharacter.imageUrl) {
      // Extract filename from /api/v1/images/characters/xxx.png
      const filename = dbCharacter.imageUrl.split('/').pop();
      if (filename) {
        const imagePath = path.join(process.cwd(), 'uploads', 'characters', filename);
        try { fs.unlinkSync(imagePath); } catch {}
      }
    }
    if (dbCharacter.thumbnailUrl) {
      const filename = dbCharacter.thumbnailUrl.split('/').pop();
      if (filename) {
        const thumbPath = path.join(process.cwd(), 'uploads', 'characters', filename);
        try { fs.unlinkSync(thumbPath); } catch {}
      }
    }

    // Delete character from database (cascades to themes and variants)
    await prisma.character.delete({
      where: { id }
    });
    
    const response: ApiResponse = {
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
  } catch (error) {
    const response: ApiResponse = {
      success: false,
      error: {
        code: API_CONSTANTS.ERROR_CODES.INTERNAL_ERROR,
        message: 'Internal server error',
        statusCode: API_CONSTANTS.HTTP_STATUS.INTERNAL_SERVER_ERROR
      },
      meta: {
        timestamp: new Date().toISOString(),
        requestId: req.get('X-Request-ID') || 'unknown',
        version: '1.0.0',
        path: req.path
      }
    };

    return res.status(API_CONSTANTS.HTTP_STATUS.INTERNAL_SERVER_ERROR).json(response);
  }
});

/**
 * POST /api/v1/characters/optimize-prompt
 * Optimize user description into detailed prompt using Gemini
 * Requires authentication to prevent API abuse
 */
router.post('/optimize-prompt', requireAuth, checkCredits('/characters/optimize-prompt'), async (req: express.Request, res: express.Response) => {
  try {
    if (!geminiService) {
      const response: ApiResponse = {
        success: false,
        error: {
          code: API_CONSTANTS.ERROR_CODES.SERVICE_UNAVAILABLE,
          message: 'Prompt optimization service is not available',
          statusCode: API_CONSTANTS.HTTP_STATUS.SERVICE_UNAVAILABLE
        },
        meta: {
          timestamp: new Date().toISOString(),
          requestId: req.get('X-Request-ID') || 'unknown',
          version: '1.0.0',
          path: req.path
        }
      };

      return res.status(API_CONSTANTS.HTTP_STATUS.SERVICE_UNAVAILABLE).json(response);
    }

    const { userDescription, style, gender, conversationHistory }: PromptOptimizationRequest = req.body;

    if (!userDescription || userDescription.trim().length === 0) {
      const response: ApiResponse = {
        success: false,
        error: {
          code: API_CONSTANTS.ERROR_CODES.VALIDATION_ERROR,
          message: 'User description is required',
          statusCode: API_CONSTANTS.HTTP_STATUS.BAD_REQUEST
        },
        meta: {
          timestamp: new Date().toISOString(),
          requestId: req.get('X-Request-ID') || 'unknown',
          version: '1.0.0',
          path: req.path
        }
      };

      return res.status(API_CONSTANTS.HTTP_STATUS.BAD_REQUEST).json(response);
    }

    const optimizationResult = await geminiService.optimizePrompt({
      userDescription,
      style,
      gender,
      conversationHistory
    });

    const response: ApiResponse<PromptOptimizationResponse> = {
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
  } catch (error) {
    console.error('Error optimizing prompt:', error);
    
    const response: ApiResponse = {
      success: false,
      error: {
        code: API_CONSTANTS.ERROR_CODES.INTERNAL_ERROR,
        message: 'Failed to optimize prompt',
        statusCode: API_CONSTANTS.HTTP_STATUS.INTERNAL_SERVER_ERROR
      },
      meta: {
        timestamp: new Date().toISOString(),
        requestId: req.get('X-Request-ID') || 'unknown',
        version: '1.0.0',
        path: req.path
      }
    };

    return res.status(API_CONSTANTS.HTTP_STATUS.INTERNAL_SERVER_ERROR).json(response);
  }
});


/**
 * POST /api/v1/characters/generate-image
 * Generate character image using AI
 * Requires authentication to prevent API abuse
 */
router.post('/generate-image', requireAuth, checkCredits('/characters/generate-image'), async (req: express.Request, res: express.Response) => {
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

    // Check if nanoBanana service is available
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

    // Prepare generation request
    const generationRequest: GenerationRequest = {
      type: 'text-to-image',
      prompt: prompt,
      quality: 'high',
      width: 1024,
      height: 1024,
      style: style || 'realistic'
    };

    // Generate image using nanoBanana service
    console.log('🎨 Generating image with prompt:', prompt);
    const generationResult = await nanoBananaClient.generateImage(generationRequest);
    
    if (!generationResult || generationResult.status !== 'completed') {
      throw new Error(`Image generation failed: ${generationResult?.status || 'unknown status'}`);
    }

    // Return the image URLs
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

  } catch (error) {
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

/**
 * POST /api/v1/characters/optimize-prompt-25flash
 * Test Gemini 2.5 Flash model for prompt optimization
 * Requires authentication to prevent API abuse
 *
 * Network Requirements:
 * - Access to generativelanguage.googleapis.com
 * - If behind firewall/proxy, may need proxy configuration
 * - For China: may need VPN or proxy to access Google APIs
 */
router.post('/optimize-prompt-25flash', requireAuth, checkCredits('/characters/optimize-prompt-25flash'), async (req: express.Request, res: express.Response) => {
  try {
    if (!geminiService) {
      const response: ApiResponse = {
        success: false,
        error: {
          code: API_CONSTANTS.ERROR_CODES.SERVICE_UNAVAILABLE,
          message: 'Gemini 2.5 Flash service is not available',
          statusCode: API_CONSTANTS.HTTP_STATUS.SERVICE_UNAVAILABLE
        },
        meta: {
          timestamp: new Date().toISOString(),
          requestId: req.get('X-Request-ID') || 'unknown',
          version: '1.0.0',
          path: req.path
        }
      };

      return res.status(API_CONSTANTS.HTTP_STATUS.SERVICE_UNAVAILABLE).json(response);
    }

    const { userDescription, style, gender, conversationHistory }: any = req.body;

    if (!userDescription || userDescription.trim().length === 0) {
      const response: ApiResponse = {
        success: false,
        error: {
          code: API_CONSTANTS.ERROR_CODES.VALIDATION_ERROR,
          message: 'User description is required',
          statusCode: API_CONSTANTS.HTTP_STATUS.BAD_REQUEST
        },
        meta: {
          timestamp: new Date().toISOString(),
          requestId: req.get('X-Request-ID') || 'unknown',
          version: '1.0.0',
          path: req.path
        }
      };

      return res.status(API_CONSTANTS.HTTP_STATUS.BAD_REQUEST).json(response);
    }

    // Test Gemini 2.5 Flash model
    const optimizationResult = await (geminiService as any).optimizePromptWith25Flash({
      userDescription,
      style,
      gender,
      conversationHistory
    });

    const response: ApiResponse = {
      success: true,
      data: {
        ...optimizationResult,
        model: 'gemini-2.5-flash' // Indicate which model was used
      },
      meta: {
        timestamp: new Date().toISOString(),
        requestId: req.get('X-Request-ID') || 'unknown',
        version: '1.0.0',
        path: req.path
      }
    };

    return res.json(response);
  } catch (error) {
    console.error('Error with Gemini 2.5 Flash:', error);
    
    const response: ApiResponse = {
      success: false,
      error: {
        code: API_CONSTANTS.ERROR_CODES.INTERNAL_ERROR,
        message: 'Failed to optimize prompt with Gemini 2.5 Flash',
        statusCode: API_CONSTANTS.HTTP_STATUS.INTERNAL_SERVER_ERROR
      },
      meta: {
        timestamp: new Date().toISOString(),
        requestId: req.get('X-Request-ID') || 'unknown',
        version: '1.0.0',
        path: req.path
      }
    };

    return res.status(API_CONSTANTS.HTTP_STATUS.INTERNAL_SERVER_ERROR).json(response);
  }
});

/**
 * POST /api/v1/characters/edit-image
 * Edit character image using Gemini 2.5 Flash Image model
 * Requires authentication to prevent API abuse
 *
 * Request body:
 * - imageUrl: string (URL of the image to edit)
 * - prompt: string (description of desired changes)
 * - characterId: string (optional, ID of the character being edited)
 */
router.post('/edit-image', requireAuth, async (req: express.Request, res: express.Response) => {
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

    // Check if Gemini service is available
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

    // Call Gemini service to edit the image
    const result = await (geminiService as any).editImageWithGemini({
      imageUrl,
      prompt,
      characterId
    });

    return res.json({
      success: true,
      data: result
    });

  } catch (error) {
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

export default router;