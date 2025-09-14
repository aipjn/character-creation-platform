/**
 * Character Collections API Routes
 * Handles collection creation, management, and character organization
 */

import express from 'express';
import { ApiRequest, ApiResponse, ApiResponseHandler } from '../../types/api';
import { CreateCollectionData, UpdateCollectionData } from '../../types/collections';
import CharacterCollectionModel from '../../models/CharacterCollection';
import { authenticateUser } from '../../middleware/auth';
import { validateRequest } from '../../middleware/validation';
import { z } from 'zod';

const router = express.Router();

// Validation schemas
const createCollectionSchema = z.object({
  body: z.object({
    name: z.string().min(1).max(100),
    description: z.string().optional(),
    isPublic: z.boolean().optional(),
    coverImageUrl: z.string().url().optional(),
  }),
});

const updateCollectionSchema = z.object({
  body: z.object({
    name: z.string().min(1).max(100).optional(),
    description: z.string().optional(),
    isPublic: z.boolean().optional(),
    coverImageUrl: z.string().url().optional(),
  }),
  params: z.object({
    id: z.string().cuid(),
  }),
});

const addCharacterSchema = z.object({
  body: z.object({
    characterId: z.string().cuid(),
  }),
  params: z.object({
    id: z.string().cuid(),
  }),
});

/**
 * GET /api/v1/collections
 * Get user's collections with optional filters
 */
router.get('/', authenticateUser, async (req: ApiRequest, res: express.Response) => {
  try {
    const { skip, take, isPublic } = req.query as {
      skip?: string;
      take?: string;
      isPublic?: string;
    };

    const collections = await CharacterCollectionModel.findByUserId(req.user!.id, {
      skip: skip ? parseInt(skip) : undefined,
      take: take ? parseInt(take) : undefined,
      isPublic: isPublic ? isPublic === 'true' : undefined,
    });

    const response: ApiResponse = {
      success: true,
      data: collections,
      meta: {
        timestamp: new Date().toISOString(),
        requestId: req.requestId,
        version: '1.0.0',
        path: req.path,
      },
    };

    res.json(response);
  } catch (error) {
    const response: ApiResponse = {
      success: false,
      error: {
        code: 'COLLECTION_FETCH_ERROR',
        message: 'Failed to fetch collections',
        statusCode: 500,
      },
      meta: {
        timestamp: new Date().toISOString(),
        requestId: req.requestId,
        version: '1.0.0',
        path: req.path,
      },
    };

    res.status(500).json(response);
  }
});

/**
 * POST /api/v1/collections
 * Create a new character collection
 */
router.post('/', 
  authenticateUser,
  validateRequest(createCollectionSchema),
  async (req: ApiRequest, res: express.Response) => {
    try {
      const data: CreateCollectionData = req.body;
      
      const collection = await CharacterCollectionModel.create(req.user!.id, data);

      const response: ApiResponse = {
        success: true,
        data: collection,
        meta: {
          timestamp: new Date().toISOString(),
          requestId: req.requestId,
          version: '1.0.0',
          path: req.path,
        },
      };

      res.status(201).json(response);
    } catch (error) {
      const response: ApiResponse = {
        success: false,
        error: {
          code: 'COLLECTION_CREATE_ERROR',
          message: 'Failed to create collection',
          statusCode: 500,
        },
        meta: {
          timestamp: new Date().toISOString(),
          requestId: req.requestId,
          version: '1.0.0',
          path: req.path,
        },
      };

      res.status(500).json(response);
    }
  }
);

/**
 * GET /api/v1/collections/:id
 * Get a specific collection by ID
 */
router.get('/:id', authenticateUser, async (req: ApiRequest, res: express.Response) => {
  try {
    const { id } = req.params;

    // Check access permissions
    const accessCheck = await CharacterCollectionModel.canUserAccessCollection(req.user!.id, id);
    if (!accessCheck.allowed) {
      const response: ApiResponse = {
        success: false,
        error: {
          code: 'ACCESS_DENIED',
          message: accessCheck.reason || 'Access denied',
          statusCode: 403,
        },
        meta: {
          timestamp: new Date().toISOString(),
          requestId: req.requestId,
          version: '1.0.0',
          path: req.path,
        },
      };

      return res.status(403).json(response);
    }

    const collection = await CharacterCollectionModel.findById(id);
    if (!collection) {
      const response: ApiResponse = {
        success: false,
        error: {
          code: 'COLLECTION_NOT_FOUND',
          message: 'Collection not found',
          statusCode: 404,
        },
        meta: {
          timestamp: new Date().toISOString(),
          requestId: req.requestId,
          version: '1.0.0',
          path: req.path,
        },
      };

      return res.status(404).json(response);
    }

    const response: ApiResponse = {
      success: true,
      data: collection,
      meta: {
        timestamp: new Date().toISOString(),
        requestId: req.requestId,
        version: '1.0.0',
        path: req.path,
      },
    };

    res.json(response);
  } catch (error) {
    const response: ApiResponse = {
      success: false,
      error: {
        code: 'COLLECTION_FETCH_ERROR',
        message: 'Failed to fetch collection',
        statusCode: 500,
      },
      meta: {
        timestamp: new Date().toISOString(),
        requestId: req.requestId,
        version: '1.0.0',
        path: req.path,
      },
    };

    res.status(500).json(response);
  }
});

/**
 * PUT /api/v1/collections/:id
 * Update a collection
 */
router.put('/:id',
  authenticateUser,
  validateRequest(updateCollectionSchema),
  async (req: ApiRequest, res: express.Response) => {
    try {
      const { id } = req.params;
      const data: UpdateCollectionData = req.body;

      // Check edit permissions
      const editCheck = await CharacterCollectionModel.canUserEditCollection(req.user!.id, id);
      if (!editCheck.allowed) {
        const response: ApiResponse = {
          success: false,
          error: {
            code: 'EDIT_DENIED',
            message: editCheck.reason || 'Edit access denied',
            statusCode: 403,
          },
          meta: {
            timestamp: new Date().toISOString(),
            requestId: req.requestId,
            version: '1.0.0',
            path: req.path,
          },
        };

        return res.status(403).json(response);
      }

      const collection = await CharacterCollectionModel.update(id, data);

      const response: ApiResponse = {
        success: true,
        data: collection,
        meta: {
          timestamp: new Date().toISOString(),
          requestId: req.requestId,
          version: '1.0.0',
          path: req.path,
        },
      };

      res.json(response);
    } catch (error) {
      const response: ApiResponse = {
        success: false,
        error: {
          code: 'COLLECTION_UPDATE_ERROR',
          message: 'Failed to update collection',
          statusCode: 500,
        },
        meta: {
          timestamp: new Date().toISOString(),
          requestId: req.requestId,
          version: '1.0.0',
          path: req.path,
        },
      };

      res.status(500).json(response);
    }
  }
);

/**
 * DELETE /api/v1/collections/:id
 * Delete a collection
 */
router.delete('/:id', authenticateUser, async (req: ApiRequest, res: express.Response) => {
  try {
    const { id } = req.params;

    // Check edit permissions
    const editCheck = await CharacterCollectionModel.canUserEditCollection(req.user!.id, id);
    if (!editCheck.allowed) {
      const response: ApiResponse = {
        success: false,
        error: {
          code: 'DELETE_DENIED',
          message: editCheck.reason || 'Delete access denied',
          statusCode: 403,
        },
        meta: {
          timestamp: new Date().toISOString(),
          requestId: req.requestId,
          version: '1.0.0',
          path: req.path,
        },
      };

      return res.status(403).json(response);
    }

    await CharacterCollectionModel.delete(id);

    const response: ApiResponse = {
      success: true,
      data: { message: 'Collection deleted successfully' },
      meta: {
        timestamp: new Date().toISOString(),
        requestId: req.requestId,
        version: '1.0.0',
        path: req.path,
      },
    };

    res.json(response);
  } catch (error) {
    const response: ApiResponse = {
      success: false,
      error: {
        code: 'COLLECTION_DELETE_ERROR',
        message: 'Failed to delete collection',
        statusCode: 500,
      },
      meta: {
        timestamp: new Date().toISOString(),
        requestId: req.requestId,
        version: '1.0.0',
        path: req.path,
      },
    };

    res.status(500).json(response);
  }
});

/**
 * POST /api/v1/collections/:id/characters
 * Add a character to a collection
 */
router.post('/:id/characters',
  authenticateUser,
  validateRequest(addCharacterSchema),
  async (req: ApiRequest, res: express.Response) => {
    try {
      const { id } = req.params;
      const { characterId } = req.body;

      // Check edit permissions
      const editCheck = await CharacterCollectionModel.canUserEditCollection(req.user!.id, id);
      if (!editCheck.allowed) {
        const response: ApiResponse = {
          success: false,
          error: {
            code: 'EDIT_DENIED',
            message: editCheck.reason || 'Edit access denied',
            statusCode: 403,
          },
          meta: {
            timestamp: new Date().toISOString(),
            requestId: req.requestId,
            version: '1.0.0',
            path: req.path,
          },
        };

        return res.status(403).json(response);
      }

      // Check if character is already in collection
      const isInCollection = await CharacterCollectionModel.isCharacterInCollection(id, characterId);
      if (isInCollection) {
        const response: ApiResponse = {
          success: false,
          error: {
            code: 'CHARACTER_ALREADY_IN_COLLECTION',
            message: 'Character is already in this collection',
            statusCode: 409,
          },
          meta: {
            timestamp: new Date().toISOString(),
            requestId: req.requestId,
            version: '1.0.0',
            path: req.path,
          },
        };

        return res.status(409).json(response);
      }

      const item = await CharacterCollectionModel.addCharacter(id, characterId);

      const response: ApiResponse = {
        success: true,
        data: item,
        meta: {
          timestamp: new Date().toISOString(),
          requestId: req.requestId,
          version: '1.0.0',
          path: req.path,
        },
      };

      res.status(201).json(response);
    } catch (error) {
      const response: ApiResponse = {
        success: false,
        error: {
          code: 'CHARACTER_ADD_ERROR',
          message: 'Failed to add character to collection',
          statusCode: 500,
        },
        meta: {
          timestamp: new Date().toISOString(),
          requestId: req.requestId,
          version: '1.0.0',
          path: req.path,
        },
      };

      res.status(500).json(response);
    }
  }
);

/**
 * DELETE /api/v1/collections/:id/characters/:characterId
 * Remove a character from a collection
 */
router.delete('/:id/characters/:characterId', 
  authenticateUser, 
  async (req: ApiRequest, res: express.Response) => {
    try {
      const { id, characterId } = req.params;

      // Check edit permissions
      const editCheck = await CharacterCollectionModel.canUserEditCollection(req.user!.id, id);
      if (!editCheck.allowed) {
        const response: ApiResponse = {
          success: false,
          error: {
            code: 'EDIT_DENIED',
            message: editCheck.reason || 'Edit access denied',
            statusCode: 403,
          },
          meta: {
            timestamp: new Date().toISOString(),
            requestId: req.requestId,
            version: '1.0.0',
            path: req.path,
          },
        };

        return res.status(403).json(response);
      }

      await CharacterCollectionModel.removeCharacter(id, characterId);

      const response: ApiResponse = {
        success: true,
        data: { message: 'Character removed from collection' },
        meta: {
          timestamp: new Date().toISOString(),
          requestId: req.requestId,
          version: '1.0.0',
          path: req.path,
        },
      };

      res.json(response);
    } catch (error) {
      const response: ApiResponse = {
        success: false,
        error: {
          code: 'CHARACTER_REMOVE_ERROR',
          message: 'Failed to remove character from collection',
          statusCode: 500,
        },
        meta: {
          timestamp: new Date().toISOString(),
          requestId: req.requestId,
          version: '1.0.0',
          path: req.path,
        },
      };

      res.status(500).json(response);
    }
  }
);

/**
 * GET /api/v1/collections/public
 * Get public collections
 */
router.get('/public', async (req: ApiRequest, res: express.Response) => {
  try {
    const { skip, take, search } = req.query as {
      skip?: string;
      take?: string;
      search?: string;
    };

    const collections = await CharacterCollectionModel.findPublicCollections({
      skip: skip ? parseInt(skip) : undefined,
      take: take ? parseInt(take) : undefined,
      search,
    });

    const response: ApiResponse = {
      success: true,
      data: collections,
      meta: {
        timestamp: new Date().toISOString(),
        requestId: req.requestId,
        version: '1.0.0',
        path: req.path,
      },
    };

    res.json(response);
  } catch (error) {
    const response: ApiResponse = {
      success: false,
      error: {
        code: 'PUBLIC_COLLECTIONS_FETCH_ERROR',
        message: 'Failed to fetch public collections',
        statusCode: 500,
      },
      meta: {
        timestamp: new Date().toISOString(),
        requestId: req.requestId,
        version: '1.0.0',
        path: req.path,
      },
    };

    res.status(500).json(response);
  }
});

export default router;