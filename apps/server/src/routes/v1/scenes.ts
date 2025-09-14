/**
 * Scenes API Routes
 * Handles scene creation, character placement, and scene generation
 */

import express from 'express';
import { ApiRequest, ApiResponse } from '../../types/api';
import { CreateSceneData, UpdateSceneData, AddCharacterToSceneData } from '../../types/collections';
import SceneModel from '../../models/Scene';
import { authenticateUser } from '../../middleware/auth';
import { validateRequest } from '../../middleware/validation';
import { z } from 'zod';

const router = express.Router();

// Validation schemas
const createSceneSchema = z.object({
  body: z.object({
    name: z.string().min(1).max(100),
    description: z.string().optional(),
    environment: z.string().optional(),
    setting: z.string().optional(),
    mood: z.string().optional(),
    lighting: z.string().optional(),
    isPublic: z.boolean().optional(),
  }),
});

const updateSceneSchema = z.object({
  body: z.object({
    name: z.string().min(1).max(100).optional(),
    description: z.string().optional(),
    environment: z.string().optional(),
    setting: z.string().optional(),
    mood: z.string().optional(),
    lighting: z.string().optional(),
    isPublic: z.boolean().optional(),
  }),
  params: z.object({
    id: z.string().cuid(),
  }),
});

const addCharacterToSceneSchema = z.object({
  body: z.object({
    characterId: z.string().cuid(),
    pose: z.string().optional(),
    expression: z.string().optional(),
    action: z.string().optional(),
    position: z.object({
      x: z.number(),
      y: z.number(),
      scale: z.number().optional(),
      rotation: z.number().optional(),
    }).optional(),
  }),
  params: z.object({
    id: z.string().cuid(),
  }),
});

/**
 * GET /api/v1/scenes
 * Get user's scenes with optional filters
 */
router.get('/', authenticateUser, async (req: ApiRequest, res: express.Response) => {
  try {
    const { skip, take, isPublic } = req.query as {
      skip?: string;
      take?: string;
      isPublic?: string;
    };

    const scenes = await SceneModel.findByUserId(req.user!.id, {
      skip: skip ? parseInt(skip) : undefined,
      take: take ? parseInt(take) : undefined,
      isPublic: isPublic ? isPublic === 'true' : undefined,
    });

    const response: ApiResponse = {
      success: true,
      data: scenes,
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
        code: 'SCENE_FETCH_ERROR',
        message: 'Failed to fetch scenes',
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
 * POST /api/v1/scenes
 * Create a new scene
 */
router.post('/', 
  authenticateUser,
  validateRequest(createSceneSchema),
  async (req: ApiRequest, res: express.Response) => {
    try {
      const data: CreateSceneData = req.body;
      
      const scene = await SceneModel.create(req.user!.id, data);

      const response: ApiResponse = {
        success: true,
        data: scene,
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
          code: 'SCENE_CREATE_ERROR',
          message: 'Failed to create scene',
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
 * GET /api/v1/scenes/:id
 * Get a specific scene by ID
 */
router.get('/:id', authenticateUser, async (req: ApiRequest, res: express.Response) => {
  try {
    const { id } = req.params;

    // Check access permissions
    const accessCheck = await SceneModel.canUserAccessScene(req.user!.id, id);
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

    const scene = await SceneModel.findById(id);
    if (!scene) {
      const response: ApiResponse = {
        success: false,
        error: {
          code: 'SCENE_NOT_FOUND',
          message: 'Scene not found',
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
      data: scene,
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
        code: 'SCENE_FETCH_ERROR',
        message: 'Failed to fetch scene',
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
 * PUT /api/v1/scenes/:id
 * Update a scene
 */
router.put('/:id',
  authenticateUser,
  validateRequest(updateSceneSchema),
  async (req: ApiRequest, res: express.Response) => {
    try {
      const { id } = req.params;
      const data: UpdateSceneData = req.body;

      // Check edit permissions
      const editCheck = await SceneModel.canUserEditScene(req.user!.id, id);
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

      const scene = await SceneModel.update(id, data);

      const response: ApiResponse = {
        success: true,
        data: scene,
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
          code: 'SCENE_UPDATE_ERROR',
          message: 'Failed to update scene',
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
 * DELETE /api/v1/scenes/:id
 * Delete a scene
 */
router.delete('/:id', authenticateUser, async (req: ApiRequest, res: express.Response) => {
  try {
    const { id } = req.params;

    // Check edit permissions
    const editCheck = await SceneModel.canUserEditScene(req.user!.id, id);
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

    await SceneModel.delete(id);

    const response: ApiResponse = {
      success: true,
      data: { message: 'Scene deleted successfully' },
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
        code: 'SCENE_DELETE_ERROR',
        message: 'Failed to delete scene',
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
 * POST /api/v1/scenes/:id/characters
 * Add a character to a scene
 */
router.post('/:id/characters',
  authenticateUser,
  validateRequest(addCharacterToSceneSchema),
  async (req: ApiRequest, res: express.Response) => {
    try {
      const { id } = req.params;
      const data: AddCharacterToSceneData = req.body;

      // Check edit permissions
      const editCheck = await SceneModel.canUserEditScene(req.user!.id, id);
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

      // Check if character is already in scene
      const isInScene = await SceneModel.isCharacterInScene(id, data.characterId);
      if (isInScene) {
        const response: ApiResponse = {
          success: false,
          error: {
            code: 'CHARACTER_ALREADY_IN_SCENE',
            message: 'Character is already in this scene',
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

      const sceneCharacter = await SceneModel.addCharacter(id, data);

      const response: ApiResponse = {
        success: true,
        data: sceneCharacter,
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
          message: 'Failed to add character to scene',
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
 * PUT /api/v1/scenes/:id/characters/:characterId
 * Update a character's properties in a scene
 */
router.put('/:id/characters/:characterId', 
  authenticateUser,
  async (req: ApiRequest, res: express.Response) => {
    try {
      const { id, characterId } = req.params;
      const data = req.body;

      // Check edit permissions
      const editCheck = await SceneModel.canUserEditScene(req.user!.id, id);
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

      const sceneCharacter = await SceneModel.updateCharacterInScene(id, characterId, data);

      const response: ApiResponse = {
        success: true,
        data: sceneCharacter,
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
          code: 'CHARACTER_UPDATE_ERROR',
          message: 'Failed to update character in scene',
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
 * DELETE /api/v1/scenes/:id/characters/:characterId
 * Remove a character from a scene
 */
router.delete('/:id/characters/:characterId', 
  authenticateUser, 
  async (req: ApiRequest, res: express.Response) => {
    try {
      const { id, characterId } = req.params;

      // Check edit permissions
      const editCheck = await SceneModel.canUserEditScene(req.user!.id, id);
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

      await SceneModel.removeCharacter(id, characterId);

      const response: ApiResponse = {
        success: true,
        data: { message: 'Character removed from scene' },
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
          message: 'Failed to remove character from scene',
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
 * POST /api/v1/scenes/:id/generate
 * Generate a scene image
 */
router.post('/:id/generate',
  authenticateUser,
  async (req: ApiRequest, res: express.Response) => {
    try {
      const { id } = req.params;
      const { prompt } = req.body;

      // Check edit permissions
      const editCheck = await SceneModel.canUserEditScene(req.user!.id, id);
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

      const generation = await SceneModel.createGeneration(req.user!.id, id, prompt);

      const response: ApiResponse = {
        success: true,
        data: generation,
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
          code: 'SCENE_GENERATION_ERROR',
          message: 'Failed to start scene generation',
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
 * GET /api/v1/scenes/public
 * Get public scenes
 */
router.get('/public', async (req: ApiRequest, res: express.Response) => {
  try {
    const { skip, take, search, environment, mood } = req.query as {
      skip?: string;
      take?: string;
      search?: string;
      environment?: string;
      mood?: string;
    };

    const scenes = await SceneModel.findPublicScenes({
      skip: skip ? parseInt(skip) : undefined,
      take: take ? parseInt(take) : undefined,
      search,
      environment,
      mood,
    });

    const response: ApiResponse = {
      success: true,
      data: scenes,
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
        code: 'PUBLIC_SCENES_FETCH_ERROR',
        message: 'Failed to fetch public scenes',
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