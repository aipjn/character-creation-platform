/**
 * Characters API Routes
 * RESTful endpoints for character management
 */

import express from 'express';
import { 
  ApiResponse, 
  ApiRequest, 
  Character,
  CreateCharacterRequest,
  UpdateCharacterRequest,
  PaginationParams,
  PaginatedResponse,
  SearchParams,
  API_CONSTANTS 
} from '../../types/api';
import { 
  CreateCharacterInput, 
  UpdateCharacterInput, 
  CharacterSchema 
} from '../../schemas/characterSchema';

const router = express.Router();

/**
 * GET /api/v1/characters
 * List characters with pagination, filtering, and search
 */
router.get('/', async (req: ApiRequest<any>, res: express.Response) => {
  try {
    const {
      page = API_CONSTANTS.DEFAULT_PAGINATION.PAGE,
      limit = API_CONSTANTS.DEFAULT_PAGINATION.LIMIT,
      sortBy = 'createdAt',
      sortOrder = 'desc',
      query,
      tags,
      userId,
      dateFrom,
      dateTo
    } = req.query as PaginationParams & SearchParams;

    // Validate pagination parameters
    const pageNum = Math.max(1, parseInt(page.toString()) || 1);
    const limitNum = Math.min(
      API_CONSTANTS.DEFAULT_PAGINATION.MAX_LIMIT,
      Math.max(1, parseInt(limit.toString()) || API_CONSTANTS.DEFAULT_PAGINATION.LIMIT)
    );

    // Validate sort parameters
    const validSortFields = ['createdAt', 'updatedAt', 'name'];
    const validSortOrders = ['asc', 'desc'];
    const sortByField = validSortFields.includes(sortBy?.toString()) ? sortBy.toString() : 'createdAt';
    const sortOrderValue = validSortOrders.includes(sortOrder?.toString()) ? sortOrder.toString() : 'desc';

    // TODO: Implement actual database query when Stream C/E completes database setup
    // For now, return mock data structure
    const mockCharacters: Character[] = [];
    const totalItems = 0;
    const totalPages = Math.ceil(totalItems / limitNum);

    const response: ApiResponse<PaginatedResponse<Character>> = {
      success: true,
      data: {
        items: mockCharacters,
        pagination: {
          currentPage: pageNum,
          totalPages,
          totalItems,
          itemsPerPage: limitNum,
          hasNextPage: pageNum < totalPages,
          hasPreviousPage: pageNum > 1
        }
      },
      meta: {
        timestamp: new Date().toISOString(),
        requestId: req.requestId,
        version: '1.0.0',
        path: req.path
      }
    };

    res.json(response);
  } catch (error) {
    const response: ApiResponse = {
      success: false,
      error: {
        code: API_CONSTANTS.ERROR_CODES.INTERNAL_ERROR,
        message: 'Failed to retrieve characters',
        statusCode: API_CONSTANTS.HTTP_STATUS.INTERNAL_SERVER_ERROR
      },
      meta: {
        timestamp: new Date().toISOString(),
        requestId: req.requestId,
        version: '1.0.0',
        path: req.path
      }
    };

    res.status(API_CONSTANTS.HTTP_STATUS.INTERNAL_SERVER_ERROR).json(response);
  }
});

/**
 * GET /api/v1/characters/:id
 * Get character by ID
 */
router.get('/:id', async (req: ApiRequest, res: express.Response) => {
  try {
    const { id } = req.params;

    if (!id || typeof id !== 'string' || id.trim().length === 0) {
      const response: ApiResponse = {
        success: false,
        error: {
          code: API_CONSTANTS.ERROR_CODES.VALIDATION_ERROR,
          message: 'Character ID is required',
          statusCode: API_CONSTANTS.HTTP_STATUS.BAD_REQUEST
        },
        meta: {
          timestamp: new Date().toISOString(),
          requestId: req.requestId,
          version: '1.0.0',
          path: req.path
        }
      };

      return res.status(API_CONSTANTS.HTTP_STATUS.BAD_REQUEST).json(response);
    }

    // TODO: Implement actual database query when Stream C/E completes database setup
    // For now, return not found
    const response: ApiResponse = {
      success: false,
      error: {
        code: API_CONSTANTS.ERROR_CODES.NOT_FOUND,
        message: 'Character not found',
        statusCode: API_CONSTANTS.HTTP_STATUS.NOT_FOUND
      },
      meta: {
        timestamp: new Date().toISOString(),
        requestId: req.requestId,
        version: '1.0.0',
        path: req.path
      }
    };

    res.status(API_CONSTANTS.HTTP_STATUS.NOT_FOUND).json(response);
  } catch (error) {
    const response: ApiResponse = {
      success: false,
      error: {
        code: API_CONSTANTS.ERROR_CODES.INTERNAL_ERROR,
        message: 'Failed to retrieve character',
        statusCode: API_CONSTANTS.HTTP_STATUS.INTERNAL_SERVER_ERROR
      },
      meta: {
        timestamp: new Date().toISOString(),
        requestId: req.requestId,
        version: '1.0.0',
        path: req.path
      }
    };

    res.status(API_CONSTANTS.HTTP_STATUS.INTERNAL_SERVER_ERROR).json(response);
  }
});

/**
 * POST /api/v1/characters
 * Create new character
 */
router.post('/', async (req: ApiRequest<CreateCharacterRequest>, res: express.Response) => {
  try {
    // Map API request to internal schema format
    const createInput: CreateCharacterInput = {
      userId: req.user?.id || 'temp_user_id', // TODO: Get from auth middleware
      name: req.body.name,
      prompt: req.body.description, // Map description to prompt
      tags: req.body.tags,
      isPublic: true, // Default to public for now
      metadata: {
        apiVersion: '1.0.0',
        source: 'api_v1'
      }
    };

    // Sanitize input
    const sanitizedInput = CharacterSchema.sanitizeCreateInput(createInput);
    
    // Validate input
    const validation = CharacterSchema.validateCreateInput(sanitizedInput);
    
    if (!validation.isValid) {
      const response: ApiResponse = {
        success: false,
        error: {
          code: API_CONSTANTS.ERROR_CODES.VALIDATION_ERROR,
          message: 'Validation failed',
          details: validation.errors,
          statusCode: API_CONSTANTS.HTTP_STATUS.BAD_REQUEST
        },
        meta: {
          timestamp: new Date().toISOString(),
          requestId: req.requestId,
          version: '1.0.0',
          path: req.path
        }
      };

      return res.status(API_CONSTANTS.HTTP_STATUS.BAD_REQUEST).json(response);
    }

    // TODO: Implement actual character creation when Stream C/E completes database setup
    // For now, return created response with mock data
    const mockCharacter: Character = {
      id: `char_${Date.now()}`,
      name: sanitizedInput.name || 'Untitled Character',
      description: sanitizedInput.prompt,
      imageUrl: undefined,
      userId: sanitizedInput.userId,
      tags: sanitizedInput.tags || [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    const response: ApiResponse<Character> = {
      success: true,
      data: mockCharacter,
      meta: {
        timestamp: new Date().toISOString(),
        requestId: req.requestId,
        version: '1.0.0',
        path: req.path
      }
    };

    res.status(API_CONSTANTS.HTTP_STATUS.CREATED).json(response);
  } catch (error) {
    const response: ApiResponse = {
      success: false,
      error: {
        code: API_CONSTANTS.ERROR_CODES.INTERNAL_ERROR,
        message: 'Failed to create character',
        statusCode: API_CONSTANTS.HTTP_STATUS.INTERNAL_SERVER_ERROR
      },
      meta: {
        timestamp: new Date().toISOString(),
        requestId: req.requestId,
        version: '1.0.0',
        path: req.path
      }
    };

    res.status(API_CONSTANTS.HTTP_STATUS.INTERNAL_SERVER_ERROR).json(response);
  }
});

/**
 * PUT /api/v1/characters/:id
 * Update character by ID (full update)
 */
router.put('/:id', async (req: ApiRequest<UpdateCharacterRequest>, res: express.Response) => {
  try {
    const { id } = req.params;

    if (!id || typeof id !== 'string' || id.trim().length === 0) {
      const response: ApiResponse = {
        success: false,
        error: {
          code: API_CONSTANTS.ERROR_CODES.VALIDATION_ERROR,
          message: 'Character ID is required',
          statusCode: API_CONSTANTS.HTTP_STATUS.BAD_REQUEST
        },
        meta: {
          timestamp: new Date().toISOString(),
          requestId: req.requestId,
          version: '1.0.0',
          path: req.path
        }
      };

      return res.status(API_CONSTANTS.HTTP_STATUS.BAD_REQUEST).json(response);
    }

    // Map API request to internal schema format
    const updateInput: UpdateCharacterInput = {
      name: req.body.name,
      prompt: req.body.description, // Map description to prompt
      tags: req.body.tags
    };

    // Sanitize input
    const sanitizedInput = CharacterSchema.sanitizeUpdateInput(updateInput);
    
    // Validate input
    const validation = CharacterSchema.validateUpdateInput(sanitizedInput);
    
    if (!validation.isValid) {
      const response: ApiResponse = {
        success: false,
        error: {
          code: API_CONSTANTS.ERROR_CODES.VALIDATION_ERROR,
          message: 'Validation failed',
          details: validation.errors,
          statusCode: API_CONSTANTS.HTTP_STATUS.BAD_REQUEST
        },
        meta: {
          timestamp: new Date().toISOString(),
          requestId: req.requestId,
          version: '1.0.0',
          path: req.path
        }
      };

      return res.status(API_CONSTANTS.HTTP_STATUS.BAD_REQUEST).json(response);
    }

    // TODO: Implement actual character update when Stream C/E completes database setup
    // For now, return not found
    const response: ApiResponse = {
      success: false,
      error: {
        code: API_CONSTANTS.ERROR_CODES.NOT_FOUND,
        message: 'Character not found',
        statusCode: API_CONSTANTS.HTTP_STATUS.NOT_FOUND
      },
      meta: {
        timestamp: new Date().toISOString(),
        requestId: req.requestId,
        version: '1.0.0',
        path: req.path
      }
    };

    res.status(API_CONSTANTS.HTTP_STATUS.NOT_FOUND).json(response);
  } catch (error) {
    const response: ApiResponse = {
      success: false,
      error: {
        code: API_CONSTANTS.ERROR_CODES.INTERNAL_ERROR,
        message: 'Failed to update character',
        statusCode: API_CONSTANTS.HTTP_STATUS.INTERNAL_SERVER_ERROR
      },
      meta: {
        timestamp: new Date().toISOString(),
        requestId: req.requestId,
        version: '1.0.0',
        path: req.path
      }
    };

    res.status(API_CONSTANTS.HTTP_STATUS.INTERNAL_SERVER_ERROR).json(response);
  }
});

/**
 * PATCH /api/v1/characters/:id
 * Partially update character by ID
 */
router.patch('/:id', async (req: ApiRequest<Partial<UpdateCharacterRequest>>, res: express.Response) => {
  try {
    const { id } = req.params;

    if (!id || typeof id !== 'string' || id.trim().length === 0) {
      const response: ApiResponse = {
        success: false,
        error: {
          code: API_CONSTANTS.ERROR_CODES.VALIDATION_ERROR,
          message: 'Character ID is required',
          statusCode: API_CONSTANTS.HTTP_STATUS.BAD_REQUEST
        },
        meta: {
          timestamp: new Date().toISOString(),
          requestId: req.requestId,
          version: '1.0.0',
          path: req.path
        }
      };

      return res.status(API_CONSTANTS.HTTP_STATUS.BAD_REQUEST).json(response);
    }

    // Map API request to internal schema format
    const updateInput: UpdateCharacterInput = {};
    if (req.body.name !== undefined) {
      updateInput.name = req.body.name;
    }
    if (req.body.description !== undefined) {
      updateInput.prompt = req.body.description;
    }
    if (req.body.tags !== undefined) {
      updateInput.tags = req.body.tags;
    }

    // Sanitize input
    const sanitizedInput = CharacterSchema.sanitizeUpdateInput(updateInput);
    
    // Validate input
    const validation = CharacterSchema.validateUpdateInput(sanitizedInput);
    
    if (!validation.isValid) {
      const response: ApiResponse = {
        success: false,
        error: {
          code: API_CONSTANTS.ERROR_CODES.VALIDATION_ERROR,
          message: 'Validation failed',
          details: validation.errors,
          statusCode: API_CONSTANTS.HTTP_STATUS.BAD_REQUEST
        },
        meta: {
          timestamp: new Date().toISOString(),
          requestId: req.requestId,
          version: '1.0.0',
          path: req.path
        }
      };

      return res.status(API_CONSTANTS.HTTP_STATUS.BAD_REQUEST).json(response);
    }

    // TODO: Implement actual character update when Stream C/E completes database setup
    // For now, return not found
    const response: ApiResponse = {
      success: false,
      error: {
        code: API_CONSTANTS.ERROR_CODES.NOT_FOUND,
        message: 'Character not found',
        statusCode: API_CONSTANTS.HTTP_STATUS.NOT_FOUND
      },
      meta: {
        timestamp: new Date().toISOString(),
        requestId: req.requestId,
        version: '1.0.0',
        path: req.path
      }
    };

    res.status(API_CONSTANTS.HTTP_STATUS.NOT_FOUND).json(response);
  } catch (error) {
    const response: ApiResponse = {
      success: false,
      error: {
        code: API_CONSTANTS.ERROR_CODES.INTERNAL_ERROR,
        message: 'Failed to update character',
        statusCode: API_CONSTANTS.HTTP_STATUS.INTERNAL_SERVER_ERROR
      },
      meta: {
        timestamp: new Date().toISOString(),
        requestId: req.requestId,
        version: '1.0.0',
        path: req.path
      }
    };

    res.status(API_CONSTANTS.HTTP_STATUS.INTERNAL_SERVER_ERROR).json(response);
  }
});

/**
 * DELETE /api/v1/characters/:id
 * Delete character by ID
 */
router.delete('/:id', async (req: ApiRequest, res: express.Response) => {
  try {
    const { id } = req.params;

    if (!id || typeof id !== 'string' || id.trim().length === 0) {
      const response: ApiResponse = {
        success: false,
        error: {
          code: API_CONSTANTS.ERROR_CODES.VALIDATION_ERROR,
          message: 'Character ID is required',
          statusCode: API_CONSTANTS.HTTP_STATUS.BAD_REQUEST
        },
        meta: {
          timestamp: new Date().toISOString(),
          requestId: req.requestId,
          version: '1.0.0',
          path: req.path
        }
      };

      return res.status(API_CONSTANTS.HTTP_STATUS.BAD_REQUEST).json(response);
    }

    // TODO: Implement actual character deletion when Stream C/E completes database setup
    // For now, return not found
    const response: ApiResponse = {
      success: false,
      error: {
        code: API_CONSTANTS.ERROR_CODES.NOT_FOUND,
        message: 'Character not found',
        statusCode: API_CONSTANTS.HTTP_STATUS.NOT_FOUND
      },
      meta: {
        timestamp: new Date().toISOString(),
        requestId: req.requestId,
        version: '1.0.0',
        path: req.path
      }
    };

    res.status(API_CONSTANTS.HTTP_STATUS.NOT_FOUND).json(response);
  } catch (error) {
    const response: ApiResponse = {
      success: false,
      error: {
        code: API_CONSTANTS.ERROR_CODES.INTERNAL_ERROR,
        message: 'Failed to delete character',
        statusCode: API_CONSTANTS.HTTP_STATUS.INTERNAL_SERVER_ERROR
      },
      meta: {
        timestamp: new Date().toISOString(),
        requestId: req.requestId,
        version: '1.0.0',
        path: req.path
      }
    };

    res.status(API_CONSTANTS.HTTP_STATUS.INTERNAL_SERVER_ERROR).json(response);
  }
});

/**
 * POST /api/v1/characters/:id/generate
 * Trigger character image generation
 */
router.post('/:id/generate', async (req: ApiRequest, res: express.Response) => {
  try {
    const { id } = req.params;

    if (!id || typeof id !== 'string' || id.trim().length === 0) {
      const response: ApiResponse = {
        success: false,
        error: {
          code: API_CONSTANTS.ERROR_CODES.VALIDATION_ERROR,
          message: 'Character ID is required',
          statusCode: API_CONSTANTS.HTTP_STATUS.BAD_REQUEST
        },
        meta: {
          timestamp: new Date().toISOString(),
          requestId: req.requestId,
          version: '1.0.0',
          path: req.path
        }
      };

      return res.status(API_CONSTANTS.HTTP_STATUS.BAD_REQUEST).json(response);
    }

    // TODO: Implement actual generation trigger when generation service is ready
    // For now, return not found
    const response: ApiResponse = {
      success: false,
      error: {
        code: API_CONSTANTS.ERROR_CODES.NOT_FOUND,
        message: 'Character not found',
        statusCode: API_CONSTANTS.HTTP_STATUS.NOT_FOUND
      },
      meta: {
        timestamp: new Date().toISOString(),
        requestId: req.requestId,
        version: '1.0.0',
        path: req.path
      }
    };

    res.status(API_CONSTANTS.HTTP_STATUS.NOT_FOUND).json(response);
  } catch (error) {
    const response: ApiResponse = {
      success: false,
      error: {
        code: API_CONSTANTS.ERROR_CODES.INTERNAL_ERROR,
        message: 'Failed to trigger character generation',
        statusCode: API_CONSTANTS.HTTP_STATUS.INTERNAL_SERVER_ERROR
      },
      meta: {
        timestamp: new Date().toISOString(),
        requestId: req.requestId,
        version: '1.0.0',
        path: req.path
      }
    };

    res.status(API_CONSTANTS.HTTP_STATUS.INTERNAL_SERVER_ERROR).json(response);
  }
});

export default router;