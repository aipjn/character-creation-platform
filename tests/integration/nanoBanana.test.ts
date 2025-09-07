/**
 * Comprehensive Integration Tests for nanoBanana API Workflow
 * Tests the complete end-to-end character generation workflow
 */

import { 
  CharacterWorkflowService,
  WorkflowConfig 
} from '../../src/services/characterWorkflow';
import { NanoBananaClient } from '../../src/services/nanoBananaClient';
import { GenerationQueueService } from '../../src/services/generationQueue';
import { BatchProcessorService } from '../../src/services/batchProcessor';
import { StatusTrackerService } from '../../src/services/statusTracker';
import { ErrorRecoveryService } from '../../src/services/errorRecovery';
import { GenerationJobModel } from '../../src/models/GenerationJob';
import { AuthTokenManager } from '../../src/utils/authTokenManager';
import {
  convertToCharacterSpecs,
  convertJobToApiResponse,
  validateCharacterGenerationRequest
} from '../../src/utils/dataConverter';
import { 
  CharacterGenerationJob,
  GenerationResult,
  isCharacterGenerationJob
} from '../../src/types/generation';
import { CharacterGenerationRequest } from '../../src/types/nanoBanana';

// Mock external dependencies
jest.mock('../../src/utils/authTokenManager');
jest.mock('../../src/models/GenerationJob');

describe('nanoBanana API Integration Tests', () => {
  let workflowService: CharacterWorkflowService;
  let nanoBananaClient: NanoBananaClient;
  let queueService: GenerationQueueService;
  let batchProcessor: BatchProcessorService;
  let statusTracker: StatusTrackerService;
  let errorRecovery: ErrorRecoveryService;
  let jobModel: GenerationJobModel;
  let authManager: AuthTokenManager;

  // Test data
  const mockCharacterSpecs: CharacterGenerationRequest['characterSpecs'] = {
    name: 'Test Hero',
    description: 'A brave warrior with golden armor and a mysterious past',
    traits: ['brave', 'mysterious', 'noble'],
    appearance: {
      age: 'young adult',
      gender: 'male',
      build: 'athletic',
      hair: 'golden',
      eyes: 'blue',
      skin: 'fair',
      clothing: 'golden armor',
      accessories: ['sword', 'shield']
    },
    personality: ['brave', 'loyal', 'determined'],
    background: 'Former knight seeking redemption'
  };

  const mockGenerationParams = {
    variations: 2,
    quality: 'high' as const,
    aspectRatio: '1:1' as const,
    outputFormat: 'png' as const,
    style: 'realistic' as const
  };

  beforeAll(async () => {
    // Setup test environment
    process.env.NODE_ENV = 'test';
    
    // Mock auth manager
    authManager = new AuthTokenManager({
      apiKey: 'test-api-key',
      autoRefresh: false
    });
    (authManager.getAuthHeader as jest.Mock) = jest.fn().mockResolvedValue({
      'Authorization': 'Bearer test-token'
    });

    // Mock job model
    jobModel = new GenerationJobModel();
    (jobModel.create as jest.Mock) = jest.fn().mockImplementation(async (data) => ({
      id: data.id,
      ...data,
      createdAt: new Date(),
      updatedAt: new Date()
    }));
    (jobModel.update as jest.Mock) = jest.fn().mockResolvedValue(true);
    (jobModel.findById as jest.Mock) = jest.fn().mockImplementation(async (id) => {
      const baseJob = {
        id,
        type: 'character',
        status: 'pending',
        priority: 'normal',
        userId: 'test-user',
        createdAt: new Date(),
        updatedAt: new Date()
      };
      return isCharacterGenerationJob(baseJob) ? baseJob : null;
    });
  });

  beforeEach(async () => {
    // Create fresh instances for each test
    nanoBananaClient = new NanoBananaClient(authManager);
    queueService = new GenerationQueueService();
    batchProcessor = new BatchProcessorService();
    statusTracker = new StatusTrackerService();
    errorRecovery = new ErrorRecoveryService();

    // Create workflow service with test configuration
    const testConfig: WorkflowConfig = {
      enableAutoRetry: true,
      maxRetryAttempts: 2,
      retryDelayMs: 100, // Fast retries for tests
      timeoutMs: 10000, // 10 second timeout for tests
      enableStatusTracking: true,
      enableErrorRecovery: true,
      enableBatchOptimization: true
    };

    workflowService = new CharacterWorkflowService(
      testConfig,
      nanoBananaClient,
      {
        queueService,
        batchProcessor,
        statusTracker,
        errorRecovery,
        jobModel
      }
    );

    // Reset all mocks
    jest.clearAllMocks();
  });

  afterEach(async () => {
    // Cleanup after each test
    await workflowService.shutdown();
  });

  describe('End-to-End Character Generation Workflow', () => {
    it('should successfully complete a full character generation workflow', async () => {
      // Mock successful nanoBanana API response
      const mockNanoBananaResponse = {
        batchId: 'test-batch-id',
        status: 'completed' as const,
        totalRequests: 2,
        completedRequests: 2,
        failedRequests: 0,
        results: [
          {
            id: 'result-1',
            status: 'completed' as const,
            result: {
              imageUrl: 'https://example.com/image1.png',
              thumbnailUrl: 'https://example.com/thumb1.png',
              metadata: {
                dimensions: { width: 1024, height: 1024 },
                format: 'png' as const,
                fileSize: 2048000,
                generationTimeMs: 5000,
                seed: 12345,
                model: 'nanoBanana-v1',
                provider: 'nanoBanana'
              }
            },
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
            completedAt: new Date().toISOString()
          },
          {
            id: 'result-2',
            status: 'completed' as const,
            result: {
              imageUrl: 'https://example.com/image2.png',
              thumbnailUrl: 'https://example.com/thumb2.png',
              metadata: {
                dimensions: { width: 1024, height: 1024 },
                format: 'png' as const,
                fileSize: 2048000,
                generationTimeMs: 5000,
                seed: 12346,
                model: 'nanoBanana-v1',
                provider: 'nanoBanana'
              }
            },
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
            completedAt: new Date().toISOString()
          }
        ],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };

      // Mock nanoBanana client
      jest.spyOn(nanoBananaClient, 'generateCharacter')
        .mockResolvedValue(mockNanoBananaResponse);

      // Mock queue service
      jest.spyOn(queueService, 'enqueue')
        .mockResolvedValue('test-queue-id');
      jest.spyOn(queueService, 'getQueueSize')
        .mockReturnValue(0);

      // Mock status tracker
      jest.spyOn(statusTracker, 'startTracking')
        .mockResolvedValue(undefined);
      jest.spyOn(statusTracker, 'updateProgress')
        .mockResolvedValue(undefined);
      jest.spyOn(statusTracker, 'completeTracking')
        .mockResolvedValue(undefined);

      // Start the workflow
      const jobId = await workflowService.startCharacterGeneration(
        mockCharacterSpecs,
        'test-user',
        mockGenerationParams
      );

      expect(jobId).toMatch(/^job_\d+_[a-z0-9]{9}$/);

      // Wait a bit for async processing
      await new Promise(resolve => setTimeout(resolve, 500));

      // Verify job was created in database
      expect(jobModel.create).toHaveBeenCalledWith(
        expect.objectContaining({
          id: jobId,
          userId: 'test-user',
          type: 'character',
          status: 'pending',
          priority: 'normal'
        })
      );

      // Verify queue was called
      expect(queueService.enqueue).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: 'test-user',
          type: 'character',
          priority: 'normal'
        })
      );

      // Verify status tracking was started
      expect(statusTracker.startTracking).toHaveBeenCalledWith(
        jobId,
        expect.objectContaining({
          type: 'character_generation'
        })
      );

      // Get final job status
      const { job } = await workflowService.getJobStatus(jobId);
      expect(job).toBeDefined();
      expect(job!.status).toBe('completed');
      expect(job!.results).toHaveLength(2);
    }, 15000);

    it('should handle nanoBanana API errors with retry logic', async () => {
      // Mock failing then succeeding nanoBanana API response
      let callCount = 0;
      jest.spyOn(nanoBananaClient, 'generateCharacter')
        .mockImplementation(async () => {
          callCount++;
          if (callCount === 1) {
            throw {
              code: 'RATE_LIMIT_EXCEEDED',
              message: 'Rate limit exceeded',
              retryable: true
            };
          }
          return {
            batchId: 'retry-batch-id',
            status: 'completed' as const,
            totalRequests: 1,
            completedRequests: 1,
            failedRequests: 0,
            results: [{
              id: 'retry-result',
              status: 'completed' as const,
              result: {
                imageUrl: 'https://example.com/retry-image.png',
                metadata: {
                  dimensions: { width: 512, height: 512 },
                  format: 'png' as const,
                  fileSize: 1024000,
                  generationTimeMs: 3000,
                  seed: 54321,
                  model: 'nanoBanana-v1',
                  provider: 'nanoBanana'
                }
              },
              createdAt: new Date().toISOString(),
              updatedAt: new Date().toISOString()
            }],
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
          };
        });

      // Mock other dependencies
      jest.spyOn(queueService, 'enqueue').mockResolvedValue('retry-queue-id');
      jest.spyOn(statusTracker, 'startTracking').mockResolvedValue(undefined);
      jest.spyOn(statusTracker, 'updateProgress').mockResolvedValue(undefined);
      jest.spyOn(errorRecovery, 'handleError').mockResolvedValue(undefined);

      // Start the workflow
      const jobId = await workflowService.startCharacterGeneration(
        mockCharacterSpecs,
        'test-user'
      );

      // Wait for processing including retry
      await new Promise(resolve => setTimeout(resolve, 1000));

      // Verify error recovery was called
      expect(errorRecovery.handleError).toHaveBeenCalledWith(
        expect.objectContaining({
          code: 'RATE_LIMIT_EXCEEDED'
        }),
        expect.objectContaining({
          jobId,
          retryCount: 1,
          context: 'character_generation'
        })
      );

      // Verify eventual success
      const { job } = await workflowService.getJobStatus(jobId);
      expect(job).toBeDefined();
      expect(job!.error?.retryCount).toBe(1);
      
      // Should eventually complete after retry
      expect(nanoBananaClient.generateCharacter).toHaveBeenCalledTimes(2);
    }, 15000);

    it('should handle permanent failures after max retries', async () => {
      // Mock consistently failing nanoBanana API
      jest.spyOn(nanoBananaClient, 'generateCharacter')
        .mockRejectedValue({
          code: 'GENERATION_FAILED',
          message: 'Generation permanently failed',
          retryable: true
        });

      jest.spyOn(queueService, 'enqueue').mockResolvedValue('fail-queue-id');
      jest.spyOn(statusTracker, 'startTracking').mockResolvedValue(undefined);
      jest.spyOn(statusTracker, 'failTracking').mockResolvedValue(undefined);

      // Start the workflow
      const jobId = await workflowService.startCharacterGeneration(
        mockCharacterSpecs,
        'test-user'
      );

      // Wait for processing and retries
      await new Promise(resolve => setTimeout(resolve, 2000));

      // Verify failure tracking was called
      expect(statusTracker.failTracking).toHaveBeenCalledWith(
        jobId,
        expect.objectContaining({
          error: expect.objectContaining({
            code: 'GENERATION_FAILED'
          })
        })
      );

      // Verify final failure state
      const { job } = await workflowService.getJobStatus(jobId);
      expect(job).toBeDefined();
      expect(job!.status).toBe('failed');
      expect(job!.error).toBeDefined();
      expect(job!.error!.retryCount).toBeGreaterThan(1);
    }, 15000);
  });

  describe('Data Format Conversion', () => {
    it('should correctly convert character specs between formats', () => {
      const converted = convertToCharacterSpecs(mockCharacterSpecs);
      
      expect(converted.name).toBe(mockCharacterSpecs.name);
      expect(converted.description).toBe(mockCharacterSpecs.description);
      expect(converted.traits).toEqual(mockCharacterSpecs.traits);
      expect(converted.appearance).toEqual(mockCharacterSpecs.appearance);
      expect(converted.personality).toEqual(mockCharacterSpecs.personality);
      expect(converted.background).toBe(mockCharacterSpecs.background);
    });

    it('should validate character generation requests', () => {
      const validRequest: CharacterGenerationRequest = {
        characterId: 'test-char-id',
        characterSpecs: mockCharacterSpecs,
        generationParams: mockGenerationParams
      };

      const validation = validateCharacterGenerationRequest(validRequest);
      expect(validation.isValid).toBe(true);
      expect(validation.errors).toHaveLength(0);
    });

    it('should reject invalid character generation requests', () => {
      const invalidRequest: CharacterGenerationRequest = {
        characterId: '',
        characterSpecs: {
          name: 'A'.repeat(150), // Too long
          description: '', // Empty
          traits: Array(25).fill('trait'), // Too many traits
        },
        generationParams: {
          variations: 5, // Too many variations
          quality: 'invalid' as any,
          aspectRatio: 'invalid' as any
        }
      };

      const validation = validateCharacterGenerationRequest(invalidRequest);
      expect(validation.isValid).toBe(false);
      expect(validation.errors.length).toBeGreaterThan(0);
      expect(validation.errors.some(e => e.includes('characterId'))).toBe(true);
      expect(validation.errors.some(e => e.includes('description'))).toBe(true);
      expect(validation.errors.some(e => e.includes('variations'))).toBe(true);
    });
  });

  describe('Workflow Status and Metrics', () => {
    it('should track workflow metrics correctly', async () => {
      // Mock successful generation
      jest.spyOn(nanoBananaClient, 'generateCharacter')
        .mockResolvedValue({
          batchId: 'metrics-batch',
          status: 'completed' as const,
          totalRequests: 1,
          completedRequests: 1,
          failedRequests: 0,
          results: [{
            id: 'metrics-result',
            status: 'completed' as const,
            result: {
              imageUrl: 'https://example.com/metrics.png',
              metadata: {
                dimensions: { width: 512, height: 512 },
                format: 'png' as const,
                fileSize: 512000,
                generationTimeMs: 2000,
                seed: 11111,
                model: 'nanoBanana-v1',
                provider: 'nanoBanana'
              }
            },
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
          }],
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        });

      jest.spyOn(queueService, 'enqueue').mockResolvedValue('metrics-queue');
      jest.spyOn(queueService, 'getQueueSize').mockReturnValue(2);

      // Start multiple jobs
      const jobId1 = await workflowService.startCharacterGeneration(mockCharacterSpecs, 'user1');
      const jobId2 = await workflowService.startCharacterGeneration(mockCharacterSpecs, 'user2');

      // Wait for processing
      await new Promise(resolve => setTimeout(resolve, 1000));

      const status = workflowService.getWorkflowStatus();
      
      expect(status.metrics.totalJobs).toBeGreaterThanOrEqual(2);
      expect(status.queueSize).toBe(2);
      expect(status.lastUpdate).toBeInstanceOf(Date);
      expect(status.isHealthy).toBeDefined();
    });

    it('should handle job cancellation', async () => {
      jest.spyOn(queueService, 'enqueue').mockResolvedValue('cancel-queue');
      jest.spyOn(statusTracker, 'startTracking').mockResolvedValue(undefined);
      jest.spyOn(statusTracker, 'stopTracking').mockResolvedValue(undefined);

      const jobId = await workflowService.startCharacterGeneration(mockCharacterSpecs);
      
      const cancelled = await workflowService.cancelJob(jobId);
      expect(cancelled).toBe(true);

      expect(statusTracker.stopTracking).toHaveBeenCalledWith(jobId);

      const { job } = await workflowService.getJobStatus(jobId);
      expect(job!.status).toBe('cancelled');
    });
  });

  describe('Error Scenarios', () => {
    it('should handle database connection failures', async () => {
      (jobModel.create as jest.Mock).mockRejectedValue(new Error('Database connection failed'));

      await expect(
        workflowService.startCharacterGeneration(mockCharacterSpecs)
      ).rejects.toThrow('Database connection failed');
    });

    it('should handle missing dependencies gracefully', async () => {
      // Create workflow service without some dependencies
      const minimalWorkflow = new CharacterWorkflowService(
        { enableStatusTracking: false, enableErrorRecovery: false }
      );

      // Should still work with core functionality
      jest.spyOn(minimalWorkflow['nanoBananaClient'], 'generateCharacter')
        .mockResolvedValue({
          batchId: 'minimal-batch',
          status: 'completed' as const,
          totalRequests: 1,
          completedRequests: 1,
          failedRequests: 0,
          results: [],
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        });

      const jobId = await minimalWorkflow.startCharacterGeneration(mockCharacterSpecs);
      expect(jobId).toMatch(/^job_\d+_[a-z0-9]{9}$/);

      await minimalWorkflow.shutdown();
    });

    it('should handle concurrent job processing', async () => {
      // Mock slow API responses
      jest.spyOn(nanoBananaClient, 'generateCharacter')
        .mockImplementation(() => new Promise(resolve => 
          setTimeout(() => resolve({
            batchId: 'concurrent-batch',
            status: 'completed' as const,
            totalRequests: 1,
            completedRequests: 1,
            failedRequests: 0,
            results: [],
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
          }), 2000)
        ));

      jest.spyOn(queueService, 'enqueue').mockResolvedValue('concurrent-queue');

      // Start multiple concurrent jobs
      const promises = Array(5).fill(null).map((_, i) => 
        workflowService.startCharacterGeneration(
          { ...mockCharacterSpecs, name: `Concurrent Hero ${i}` },
          `user${i}`
        )
      );

      const jobIds = await Promise.all(promises);
      
      expect(jobIds).toHaveLength(5);
      expect(new Set(jobIds).size).toBe(5); // All unique job IDs
      
      // Wait for all jobs to complete
      await new Promise(resolve => setTimeout(resolve, 3000));
      
      const statuses = await Promise.all(
        jobIds.map(id => workflowService.getJobStatus(id))
      );
      
      statuses.forEach(({ job }) => {
        expect(job).toBeDefined();
        expect(['completed', 'processing', 'pending']).toContain(job!.status);
      });
    }, 20000);
  });

  describe('API Response Format Validation', () => {
    it('should convert jobs to proper API response format', async () => {
      const mockJob: CharacterGenerationJob = {
        id: 'api-test-job',
        userId: 'api-user',
        type: 'character',
        status: 'completed',
        priority: 'normal',
        characterId: 'api-char',
        characterSpecs: mockCharacterSpecs,
        generationParams: mockGenerationParams,
        results: [{
          id: 'api-result',
          imageUrl: 'https://example.com/api-image.png',
          metadata: {
            dimensions: { width: 1024, height: 1024 },
            format: 'png' as const,
            fileSize: 2048000,
            generationTimeMs: 5000,
            seed: 12345,
            model: 'nanoBanana-v1',
            provider: 'nanoBanana'
          },
          createdAt: new Date()
        }],
        createdAt: new Date(),
        updatedAt: new Date(),
        completedAt: new Date()
      };

      const apiResponse = convertJobToApiResponse(mockJob);
      
      expect(apiResponse).toMatchObject({
        id: 'api-test-job',
        type: 'character',
        status: 'completed',
        character: {
          id: 'api-char',
          name: 'Test Hero',
          specs: expect.objectContaining({
            name: 'Test Hero',
            description: expect.any(String)
          })
        },
        results: expect.arrayContaining([
          expect.objectContaining({
            id: 'api-result',
            imageUrl: 'https://example.com/api-image.png',
            metadata: expect.objectContaining({
              dimensions: { width: 1024, height: 1024 },
              format: 'png'
            })
          })
        ])
      });
    });
  });
});