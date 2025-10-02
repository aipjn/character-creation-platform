/**
 * Characters API Routes - Simplified Version
 * RESTful endpoints for character management
 */

import express from 'express';
import fs from 'fs';
import path from 'path';
import { 
  ApiResponse, 
  Character,
  PaginatedResponse,
  API_CONSTANTS 
} from '../../types/api';
import GeminiTextService, { PromptOptimizationRequest, PromptOptimizationResponse } from '../../services/geminiTextService';
import { getDefaultNanoBananaClient, GenerationRequest } from '../../services/nanoBananaClient';

const router = express.Router();

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
router.get('/', async (req: express.Request, res: express.Response) => {
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

    // Read characters from uploads directory
    const uploadsPath = path.join(process.cwd(), 'uploads', 'characters');
    let characters: Character[] = [];

    try {
      if (fs.existsSync(uploadsPath)) {
        const files = fs.readdirSync(uploadsPath);
        const jsonFiles = files.filter(file => file.endsWith('.json'));
        
        characters = jsonFiles.map(file => {
          const filePath = path.join(uploadsPath, file);
          const fileData = fs.readFileSync(filePath, 'utf8');
          const characterData = JSON.parse(fileData);
          
          return {
            id: characterData.id || file.replace('.json', ''),
            name: characterData.name || 'Unnamed Character',
            description: characterData.prompt || 'No description available',
            imageUrl: characterData.s3Url || characterData.imageUrl || '',
            thumbnailUrl: characterData.thumbnailUrl || '',
            userId: 'demo-user',
            tags: characterData.styleType ? [characterData.styleType.toLowerCase()] : ['generated'],
            createdAt: characterData.createdAt || new Date().toISOString(),
            updatedAt: characterData.completedAt || characterData.createdAt || new Date().toISOString(),
            metadata: characterData.metadata
          };
        }).sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
      }
    } catch (error) {
      console.error('Error reading character files:', error);
      // Fall back to empty array if there's an error
    }

    // Apply pagination
    const pageNum = Number(page);
    const limitNum = Number(limit);
    const startIndex = (pageNum - 1) * limitNum;
    const endIndex = startIndex + limitNum;
    const paginatedCharacters = characters.slice(startIndex, endIndex);

    const response: ApiResponse<PaginatedResponse<Character>> = {
      success: true,
      data: {
        items: paginatedCharacters,
        pagination: {
          currentPage: pageNum,
          itemsPerPage: limitNum,
          totalItems: characters.length,
          totalPages: Math.ceil(characters.length / limitNum),
          hasNextPage: endIndex < characters.length,
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
router.get('/:id', async (req: express.Request, res: express.Response) => {
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

    // Read character from uploads directory
    const uploadsPath = path.join(process.cwd(), 'uploads', 'characters');
    const filePath = path.join(uploadsPath, `${id}.json`);

    if (!fs.existsSync(filePath)) {
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

    const fileData = fs.readFileSync(filePath, 'utf8');
    const characterData = JSON.parse(fileData);
    
    const character: Character = {
      id: characterData.id || id,
      name: characterData.name || 'Unnamed Character',
      description: characterData.description || characterData.prompt || 'No description available',
      enhancedDescription: characterData.enhancedDescription,
      imageUrl: characterData.imageUrl || characterData.s3Url || '',
      thumbnailUrl: characterData.thumbnailUrl || '',
      userId: characterData.userId || 'demo-user',
      tags: characterData.tags || (characterData.styleType ? [characterData.styleType.toLowerCase()] : ['generated']),
      createdAt: characterData.createdAt || new Date().toISOString(),
      updatedAt: characterData.updatedAt || characterData.completedAt || characterData.createdAt || new Date().toISOString(),
      metadata: characterData.metadata
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
router.post('/', async (req: express.Request, res: express.Response) => {
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
    const newCharacter: Character = {
      id,
      name: characterData.name,
      description: characterData.description,
      enhancedDescription: characterData.enhancedDescription,
      imageUrl: characterData.imageUrl || '',
      thumbnailUrl: characterData.thumbnailUrl || '',
      userId: characterData.userId || 'demo-user',
      tags: characterData.tags || [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      metadata: characterData.metadata
    };

    // Save to uploads directory
    const uploadsPath = path.join(process.cwd(), 'uploads', 'characters');
    
    // Ensure directory exists
    if (!fs.existsSync(uploadsPath)) {
      fs.mkdirSync(uploadsPath, { recursive: true });
    }

    const filePath = path.join(uploadsPath, `${id}.json`);
    fs.writeFileSync(filePath, JSON.stringify(newCharacter, null, 2));

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
router.put('/:id', async (req: express.Request, res: express.Response) => {
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

    // Read existing character
    const uploadsPath = path.join(process.cwd(), 'uploads', 'characters');
    const filePath = path.join(uploadsPath, `${id}.json`);

    if (!fs.existsSync(filePath)) {
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

    // Read existing data
    const existingData = JSON.parse(fs.readFileSync(filePath, 'utf8'));
    
    // Update with new data
    const updatedCharacter: Character = {
      ...existingData,
      ...updateData,
      id, // Keep original ID
      updatedAt: new Date().toISOString()
    };

    // Save updated character
    fs.writeFileSync(filePath, JSON.stringify(updatedCharacter, null, 2));

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
router.delete('/:id', async (req: express.Request, res: express.Response) => {
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

    // Delete character file
    const uploadsPath = path.join(process.cwd(), 'uploads', 'characters');
    const filePath = path.join(uploadsPath, `${id}.json`);

    if (!fs.existsSync(filePath)) {
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

    // Delete the file
    fs.unlinkSync(filePath);
    
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
 */
router.post('/optimize-prompt', async (req: express.Request, res: express.Response) => {
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
 */
router.post('/generate-image', async (req: express.Request, res: express.Response) => {
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
 * 
 * Network Requirements:
 * - Access to generativelanguage.googleapis.com
 * - If behind firewall/proxy, may need proxy configuration
 * - For China: may need VPN or proxy to access Google APIs
 */
router.post('/optimize-prompt-25flash', async (req: express.Request, res: express.Response) => {
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
 *
 * Request body:
 * - imageUrl: string (URL of the image to edit)
 * - prompt: string (description of desired changes)
 * - characterId: string (optional, ID of the character being edited)
 */
router.post('/edit-image', async (req: express.Request, res: express.Response) => {
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