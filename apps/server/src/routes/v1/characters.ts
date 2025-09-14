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

const router = express.Router();

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

    // TODO: Implement actual character fetching logic
    const mockCharacter: Character = {
      id,
      name: `Character ${id}`,
      description: `Test character with ID ${id}`,
      imageUrl: `https://example.com/character${id}.jpg`,
      userId: 'user1',
      tags: ['test', 'character'],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    const response: ApiResponse<Character> = {
      success: true,
      data: mockCharacter,
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
    // TODO: Add validation and actual character creation logic
    const characterData = req.body;
    
    const newCharacter: Character = {
      id: Date.now().toString(),
      name: characterData.name || 'New Character',
      description: characterData.description || 'A newly created character',
      imageUrl: characterData.imageUrl || '',
      userId: characterData.userId || 'anonymous',
      tags: characterData.tags || [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
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

    // TODO: Implement actual character update logic
    const updatedCharacter: Character = {
      id,
      name: updateData.name || `Updated Character ${id}`,
      description: updateData.description || 'An updated character',
      imageUrl: updateData.imageUrl || '',
      userId: updateData.userId || 'user1',
      tags: updateData.tags || [],
      createdAt: new Date(Date.now() - 86400000).toISOString(), // Yesterday
      updatedAt: new Date().toISOString()
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

    // TODO: Implement actual character deletion logic
    
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

export default router;