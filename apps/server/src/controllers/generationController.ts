/**
 * Generation Controller
 * HTTP API controller for character generation workflow
 */

import { Request, Response, NextFunction } from 'express';
import { body, param, query, validationResult } from 'express-validator';
import { 
  CharacterWorkflowService, 
  getDefaultCharacterWorkflowService,
  WorkflowStatus 
} from '../services/characterWorkflow';
import { 
  convertJobToApiResponse,
  convertJobToCharacter,
  validateCharacterGenerationRequest,
  ApiJobResponse
} from '../utils/dataConverter';
import { CharacterGenerationRequest } from '../types/nanoBanana';
import { isCharacterGenerationJob } from '../types/generation';

export interface GenerationControllerDependencies {
  workflowService?: CharacterWorkflowService;
}

export class GenerationController {
  private workflowService: CharacterWorkflowService;
  
  constructor(dependencies?: GenerationControllerDependencies) {
    this.workflowService = dependencies?.workflowService || getDefaultCharacterWorkflowService();
    
    // Bind methods to preserve 'this' context
    this.createCharacterGeneration = this.createCharacterGeneration.bind(this);
    this.getGenerationStatus = this.getGenerationStatus.bind(this);
    this.cancelGeneration = this.cancelGeneration.bind(this);
    this.getWorkflowStatus = this.getWorkflowStatus.bind(this);
    this.getGenerationHistory = this.getGenerationHistory.bind(this);
  }
  
  /**
   * POST /api/generations/character
   * Start a new character generation
   */
  public async createCharacterGeneration(
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      // Validate request
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        res.status(400).json({
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Invalid request data',
            details: errors.array()
          }
        });
        return;
      }
      
      const { characterSpecs, generationParams } = req.body as {
        characterSpecs: CharacterGenerationRequest['characterSpecs'];
        generationParams?: CharacterGenerationRequest['generationParams'];
      };
      
      const userId = req.user?.id; // Assuming user is attached to request by auth middleware
      
      // Validate character generation request
      const characterRequest: CharacterGenerationRequest = {
        characterId: `char_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        characterSpecs,
        generationParams
      };
      
      const validation = validateCharacterGenerationRequest(characterRequest);
      if (!validation.isValid) {
        res.status(400).json({
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Invalid character generation request',
            details: validation.errors
          },
          warnings: validation.warnings
        });
        return;
      }
      
      // Start generation workflow
      const jobId = await this.workflowService.startCharacterGeneration(
        characterSpecs,
        userId,
        generationParams
      );
      
      // Get initial job status
      const { job, progress } = await this.workflowService.getJobStatus(jobId);
      
      if (!job || !isCharacterGenerationJob(job)) {
        res.status(500).json({
          error: {
            code: 'JOB_CREATION_FAILED',
            message: 'Failed to create generation job'
          }
        });
        return;
      }
      
      const response = convertJobToApiResponse(job, progress);
      
      res.status(201).json({
        success: true,
        data: response,
        warnings: validation.warnings
      });
      
    } catch (error) {
      console.error('Character generation creation failed:', error);
      next(error);
    }
  }
  
  /**
   * GET /api/generations/:jobId
   * Get status of a specific generation job
   */
  public async getGenerationStatus(
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const { jobId } = req.params;
      const includeCharacter = req.query.includeCharacter === 'true';
      
      const { job, progress, timeline } = await this.workflowService.getJobStatus(jobId);
      
      if (!job) {
        res.status(404).json({
          error: {
            code: 'JOB_NOT_FOUND',
            message: `Generation job ${jobId} not found`
          }
        });
        return;
      }
      
      if (!isCharacterGenerationJob(job)) {
        res.status(400).json({
          error: {
            code: 'INVALID_JOB_TYPE',
            message: 'Job is not a character generation job'
          }
        });
        return;
      }
      
      // Check if user has access to this job (if authentication is enabled)
      const userId = req.user?.id;
      if (userId && job.userId && job.userId !== userId) {
        res.status(403).json({
          error: {
            code: 'ACCESS_DENIED',
            message: 'You do not have access to this generation job'
          }
        });
        return;
      }
      
      const apiResponse = convertJobToApiResponse(job, progress);
      
      const responseData: any = {
        success: true,
        data: apiResponse
      };
      
      // Include character format if requested
      if (includeCharacter && job.status === 'completed') {
        responseData.character = convertJobToCharacter(job);
      }
      
      // Include timeline if available
      if (timeline) {
        responseData.timeline = timeline;
      }
      
      res.json(responseData);
      
    } catch (error) {
      console.error('Failed to get generation status:', error);
      next(error);
    }
  }
  
  /**
   * DELETE /api/generations/:jobId
   * Cancel a generation job
   */
  public async cancelGeneration(
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const { jobId } = req.params;
      
      // Get job to check ownership
      const { job } = await this.workflowService.getJobStatus(jobId);
      
      if (!job) {
        res.status(404).json({
          error: {
            code: 'JOB_NOT_FOUND',
            message: `Generation job ${jobId} not found`
          }
        });
        return;
      }
      
      // Check if user has access to cancel this job
      const userId = req.user?.id;
      if (userId && job.userId && job.userId !== userId) {
        res.status(403).json({
          error: {
            code: 'ACCESS_DENIED',
            message: 'You do not have access to cancel this generation job'
          }
        });
        return;
      }
      
      // Check if job can be cancelled
      if (['completed', 'failed', 'cancelled'].includes(job.status)) {
        res.status(400).json({
          error: {
            code: 'CANNOT_CANCEL',
            message: `Cannot cancel job in ${job.status} status`
          }
        });
        return;
      }
      
      const cancelled = await this.workflowService.cancelJob(jobId);
      
      if (cancelled) {
        res.json({
          success: true,
          message: `Generation job ${jobId} has been cancelled`
        });
      } else {
        res.status(500).json({
          error: {
            code: 'CANCELLATION_FAILED',
            message: 'Failed to cancel generation job'
          }
        });
      }
      
    } catch (error) {
      console.error('Failed to cancel generation:', error);
      next(error);
    }
  }
  
  /**
   * GET /api/generations/workflow/status
   * Get overall workflow status and metrics
   */
  public async getWorkflowStatus(
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const status = this.workflowService.getWorkflowStatus();
      
      res.json({
        success: true,
        data: status
      });
      
    } catch (error) {
      console.error('Failed to get workflow status:', error);
      next(error);
    }
  }
  
  /**
   * GET /api/generations/history
   * Get generation history for a user (admin endpoint)
   */
  public async getGenerationHistory(
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      // This would typically require admin permissions
      // For now, just return a placeholder response
      
      const page = parseInt(req.query.page as string) || 1;
      const limit = Math.min(parseInt(req.query.limit as string) || 20, 100);
      const userId = req.query.userId as string;
      const status = req.query.status as string;
      
      // TODO: Implement actual history retrieval from database
      // This would involve:
      // 1. Query the GenerationJobModel with filters
      // 2. Apply pagination
      // 3. Convert jobs to API format
      
      res.json({
        success: true,
        data: {
          jobs: [], // Placeholder
          pagination: {
            page,
            limit,
            total: 0,
            pages: 0
          },
          filters: {
            userId,
            status
          }
        },
        message: 'History endpoint not yet implemented'
      });
      
    } catch (error) {
      console.error('Failed to get generation history:', error);
      next(error);
    }
  }
}

/**
 * Validation middleware for character generation requests
 */
export const validateCharacterGenerationRequest = [
  body('characterSpecs').isObject().withMessage('characterSpecs must be an object'),
  body('characterSpecs.description')
    .isString()
    .isLength({ min: 1, max: 2000 })
    .withMessage('description must be a string between 1 and 2000 characters'),
  body('characterSpecs.name')
    .optional()
    .isString()
    .isLength({ max: 100 })
    .withMessage('name must be a string with max 100 characters'),
  body('characterSpecs.traits')
    .optional()
    .isArray({ max: 20 })
    .withMessage('traits must be an array with max 20 items'),
  body('characterSpecs.personality')
    .optional()
    .isArray({ max: 10 })
    .withMessage('personality must be an array with max 10 items'),
  body('generationParams.variations')
    .optional()
    .isInt({ min: 1, max: 4 })
    .withMessage('variations must be an integer between 1 and 4'),
  body('generationParams.quality')
    .optional()
    .isIn(['low', 'medium', 'high', 'ultra'])
    .withMessage('quality must be one of: low, medium, high, ultra'),
  body('generationParams.aspectRatio')
    .optional()
    .isIn(['1:1', '16:9', '9:16', '4:3', '3:4', '2:1', '1:2'])
    .withMessage('aspectRatio must be one of: 1:1, 16:9, 9:16, 4:3, 3:4, 2:1, 1:2')
];

/**
 * Validation middleware for job ID parameter
 */
export const validateJobId = [
  param('jobId')
    .isString()
    .matches(/^job_\d+_[a-z0-9]{9}$/)
    .withMessage('Invalid job ID format')
];

/**
 * Validation middleware for pagination queries
 */
export const validatePaginationQuery = [
  query('page')
    .optional()
    .isInt({ min: 1 })
    .withMessage('page must be a positive integer'),
  query('limit')
    .optional()
    .isInt({ min: 1, max: 100 })
    .withMessage('limit must be an integer between 1 and 100')
];

/**
 * Error handling middleware for generation controller
 */
export function generationErrorHandler(
  error: any,
  req: Request,
  res: Response,
  next: NextFunction
): void {
  console.error('Generation Controller Error:', error);
  
  // Handle specific error types
  if (error.code === 'WORKFLOW_START_FAILED') {
    res.status(500).json({
      error: {
        code: error.code,
        message: 'Failed to start generation workflow',
        details: error.originalError?.message
      }
    });
    return;
  }
  
  if (error.code === 'STATUS_RETRIEVAL_FAILED') {
    res.status(500).json({
      error: {
        code: error.code,
        message: 'Failed to retrieve job status',
        details: error.originalError?.message
      }
    });
    return;
  }
  
  if (error.code === 'VALIDATION_ERROR') {
    res.status(400).json({
      error: {
        code: error.code,
        message: error.message,
        details: error.details
      }
    });
    return;
  }
  
  // Default error response
  res.status(500).json({
    error: {
      code: 'INTERNAL_SERVER_ERROR',
      message: 'An unexpected error occurred',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    }
  });
}

// Export a factory function for easy instantiation
export const createGenerationController = (
  dependencies?: GenerationControllerDependencies
): GenerationController => {
  return new GenerationController(dependencies);
};

export default GenerationController;