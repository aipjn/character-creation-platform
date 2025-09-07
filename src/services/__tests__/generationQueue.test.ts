/**
 * GenerationQueue Service Tests
 */

import { GenerationQueueService } from '../generationQueue';
import { GenerationJobModel } from '../../models/GenerationJob';
import {
  GenerationJob,
  CharacterGenerationJob,
  BatchGenerationJob,
  SingleGenerationJob,
  JobStatus,
  JobPriority
} from '../../types/generation';

// Mock the GenerationJobModel
jest.mock('../../models/GenerationJob');

describe('GenerationQueueService', () => {
  let queueService: GenerationQueueService;
  let mockJobModel: jest.Mocked<GenerationJobModel>;

  beforeEach(() => {
    // Clear all mocks before each test
    jest.clearAllMocks();
    
    // Create mock job model
    mockJobModel = {
      create: jest.fn(),
      findById: jest.fn(),
      find: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
      getNextPendingJobs: jest.fn(),
      getScheduledJobs: jest.fn(),
      getProcessingJobs: jest.fn(),
      getQueueMetrics: jest.fn(),
      cleanupCompletedJobs: jest.fn(),
      initializeTable: jest.fn()
    } as any;

    // Create queue service with mocked dependencies
    queueService = new GenerationQueueService(mockJobModel);
  });

  afterEach(async () => {
    await queueService.shutdown();
  });

  describe('enqueue', () => {
    it('should enqueue a character generation job', async () => {
      const mockJob: CharacterGenerationJob = {
        id: 'job_123',
        userId: 'user_123',
        type: 'character',
        status: 'pending',
        priority: 'normal',
        createdAt: new Date(),
        updatedAt: new Date(),
        characterId: 'char_123',
        characterSpecs: {
          description: 'A brave warrior',
          appearance: {
            age: 'young adult',
            gender: 'male',
            hair: 'brown',
            eyes: 'blue'
          }
        }
      };

      mockJobModel.create.mockResolvedValue(mockJob);
      mockJobModel.update.mockResolvedValue({ ...mockJob, status: 'queued' });

      // Mock metrics to allow enqueueing
      mockJobModel.getQueueMetrics.mockResolvedValue({
        pending: 5,
        processing: 2,
        completed: 10,
        failed: 1,
        averageWaitTimeMs: 5000,
        averageProcessingTimeMs: 30000,
        throughputPerHour: 20
      });

      const request = {
        userId: 'user_123',
        type: 'character' as const,
        priority: 'normal' as JobPriority,
        data: {
          characterId: 'char_123',
          characterSpecs: {
            description: 'A brave warrior',
            appearance: {
              age: 'young adult',
              gender: 'male',
              hair: 'brown',
              eyes: 'blue'
            }
          }
        }
      };

      const jobId = await queueService.enqueue(request);

      expect(jobId).toBe('job_123');
      expect(mockJobModel.create).toHaveBeenCalledWith({
        userId: 'user_123',
        type: 'character',
        priority: 'normal',
        data: request.data,
        scheduledAt: undefined
      });
    });

    it('should enqueue a batch generation job with up to 4 requests', async () => {
      const mockJob: BatchGenerationJob = {
        id: 'batch_123',
        userId: 'user_123',
        type: 'batch',
        status: 'pending',
        priority: 'high',
        createdAt: new Date(),
        updatedAt: new Date(),
        batchId: 'batch_123',
        requests: [],
        totalRequests: 3,
        completedRequests: 0,
        failedRequests: 0
      };

      mockJobModel.create.mockResolvedValue(mockJob);
      mockJobModel.getQueueMetrics.mockResolvedValue({
        pending: 5,
        processing: 2,
        completed: 10,
        failed: 1,
        averageWaitTimeMs: 5000,
        averageProcessingTimeMs: 30000,
        throughputPerHour: 20
      });

      const requests = Array.from({ length: 3 }, (_, i) => ({
        id: `single_${i}`,
        type: 'single' as const,
        prompt: `Test prompt ${i}`,
        status: 'pending' as JobStatus,
        priority: 'normal' as JobPriority,
        createdAt: new Date(),
        updatedAt: new Date()
      }));

      const request = {
        userId: 'user_123',
        type: 'batch' as const,
        priority: 'high' as JobPriority,
        data: {
          batchId: 'batch_123',
          requests,
          totalRequests: 3
        }
      };

      const jobId = await queueService.enqueue(request);

      expect(jobId).toBe('batch_123');
      expect(mockJobModel.create).toHaveBeenCalledWith({
        userId: 'user_123',
        type: 'batch',
        priority: 'high',
        data: request.data,
        scheduledAt: undefined
      });
    });

    it('should reject batch with more than 4 requests', async () => {
      mockJobModel.getQueueMetrics.mockResolvedValue({
        pending: 5,
        processing: 2,
        completed: 10,
        failed: 1,
        averageWaitTimeMs: 5000,
        averageProcessingTimeMs: 30000,
        throughputPerHour: 20
      });

      const requests = Array.from({ length: 5 }, (_, i) => ({
        id: `single_${i}`,
        type: 'single' as const,
        prompt: `Test prompt ${i}`
      }));

      const request = {
        userId: 'user_123',
        type: 'batch' as const,
        data: {
          batchId: 'batch_123',
          requests,
          totalRequests: 5
        }
      };

      await expect(queueService.enqueue(request))
        .rejects
        .toThrow('Batch cannot exceed 4 requests');
    });

    it('should reject when queue is full', async () => {
      mockJobModel.getQueueMetrics.mockResolvedValue({
        pending: 100, // Max queue size from DEFAULT_GENERATION_CONFIG
        processing: 2,
        completed: 10,
        failed: 1,
        averageWaitTimeMs: 5000,
        averageProcessingTimeMs: 30000,
        throughputPerHour: 20
      });

      const request = {
        userId: 'user_123',
        type: 'single' as const,
        data: {
          prompt: 'Test prompt'
        }
      };

      await expect(queueService.enqueue(request))
        .rejects
        .toThrow('Queue is full. Please try again later.');
    });

    it('should schedule job for future execution', async () => {
      const futureDate = new Date(Date.now() + 60000); // 1 minute from now
      const mockJob: SingleGenerationJob = {
        id: 'job_123',
        userId: 'user_123',
        type: 'single',
        status: 'pending',
        priority: 'normal',
        createdAt: new Date(),
        updatedAt: new Date(),
        prompt: 'Test prompt'
      };

      mockJobModel.create.mockResolvedValue(mockJob);
      mockJobModel.update.mockResolvedValue({ ...mockJob, status: 'queued', scheduledAt: futureDate });
      mockJobModel.getQueueMetrics.mockResolvedValue({
        pending: 5,
        processing: 2,
        completed: 10,
        failed: 1,
        averageWaitTimeMs: 5000,
        averageProcessingTimeMs: 30000,
        throughputPerHour: 20
      });

      const request = {
        userId: 'user_123',
        type: 'single' as const,
        scheduledAt: futureDate,
        data: {
          prompt: 'Test prompt'
        }
      };

      const jobId = await queueService.enqueue(request);

      expect(jobId).toBe('job_123');
      expect(mockJobModel.update).toHaveBeenCalledWith('job_123', { status: 'queued' });
    });
  });

  describe('getJob', () => {
    it('should retrieve job by ID', async () => {
      const mockJob: SingleGenerationJob = {
        id: 'job_123',
        userId: 'user_123',
        type: 'single',
        status: 'completed',
        priority: 'normal',
        createdAt: new Date(),
        updatedAt: new Date(),
        completedAt: new Date(),
        prompt: 'Test prompt',
        result: {
          id: 'result_123',
          imageUrl: 'https://example.com/image.png',
          metadata: {
            dimensions: { width: 1024, height: 1024 },
            format: 'png',
            fileSize: 1024000,
            generationTimeMs: 30000,
            seed: 123456,
            model: 'nanoBanana-v1',
            provider: 'NANOBANANA_API'
          },
          createdAt: new Date()
        }
      };

      mockJobModel.findById.mockResolvedValue(mockJob);

      const job = await queueService.getJob('job_123');

      expect(job).toEqual(mockJob);
      expect(mockJobModel.findById).toHaveBeenCalledWith('job_123');
    });

    it('should return null for non-existent job', async () => {
      mockJobModel.findById.mockResolvedValue(null);

      const job = await queueService.getJob('nonexistent');

      expect(job).toBeNull();
      expect(mockJobModel.findById).toHaveBeenCalledWith('nonexistent');
    });
  });

  describe('cancelJob', () => {
    it('should cancel a pending job', async () => {
      const mockJob: SingleGenerationJob = {
        id: 'job_123',
        userId: 'user_123',
        type: 'single',
        status: 'pending',
        priority: 'normal',
        createdAt: new Date(),
        updatedAt: new Date(),
        prompt: 'Test prompt'
      };

      const cancelledJob = { ...mockJob, status: 'cancelled' as JobStatus, completedAt: new Date() };

      mockJobModel.findById.mockResolvedValue(mockJob);
      mockJobModel.update.mockResolvedValue(cancelledJob);

      const result = await queueService.cancelJob('job_123', 'user_123');

      expect(result).toBe(true);
      expect(mockJobModel.update).toHaveBeenCalledWith('job_123', {
        status: 'cancelled',
        completedAt: expect.any(Date)
      });
    });

    it('should reject cancellation of processing job', async () => {
      const mockJob: SingleGenerationJob = {
        id: 'job_123',
        userId: 'user_123',
        type: 'single',
        status: 'processing',
        priority: 'normal',
        createdAt: new Date(),
        updatedAt: new Date(),
        prompt: 'Test prompt'
      };

      mockJobModel.findById.mockResolvedValue(mockJob);

      await expect(queueService.cancelJob('job_123', 'user_123'))
        .rejects
        .toThrow('Job cannot be cancelled in its current state');
    });

    it('should reject unauthorized cancellation', async () => {
      const mockJob: SingleGenerationJob = {
        id: 'job_123',
        userId: 'user_123',
        type: 'single',
        status: 'pending',
        priority: 'normal',
        createdAt: new Date(),
        updatedAt: new Date(),
        prompt: 'Test prompt'
      };

      mockJobModel.findById.mockResolvedValue(mockJob);

      await expect(queueService.cancelJob('job_123', 'different_user'))
        .rejects
        .toThrow('Unauthorized to cancel this job');
    });
  });

  describe('updateJob', () => {
    it('should update job status and progress', async () => {
      const mockJob: SingleGenerationJob = {
        id: 'job_123',
        userId: 'user_123',
        type: 'single',
        status: 'processing',
        priority: 'normal',
        createdAt: new Date(),
        updatedAt: new Date(),
        prompt: 'Test prompt',
        progress: {
          percentage: 50,
          stage: 'generating',
          message: 'Generating image...'
        }
      };

      mockJobModel.update.mockResolvedValue(mockJob);

      const updates = {
        status: 'processing' as JobStatus,
        progress: {
          percentage: 50,
          stage: 'generating' as const,
          message: 'Generating image...'
        }
      };

      const updatedJob = await queueService.updateJob('job_123', updates);

      expect(updatedJob).toEqual(mockJob);
      expect(mockJobModel.update).toHaveBeenCalledWith('job_123', {
        status: 'processing',
        progress: updates.progress
      });
    });

    it('should set completedAt when status is completed', async () => {
      const mockJob: SingleGenerationJob = {
        id: 'job_123',
        userId: 'user_123',
        type: 'single',
        status: 'completed',
        priority: 'normal',
        createdAt: new Date(),
        updatedAt: new Date(),
        completedAt: new Date(),
        prompt: 'Test prompt'
      };

      mockJobModel.update.mockResolvedValue(mockJob);

      const updates = {
        status: 'completed' as JobStatus,
        results: [
          {
            id: 'result_123',
            imageUrl: 'https://example.com/image.png',
            metadata: {
              dimensions: { width: 1024, height: 1024 },
              format: 'png' as const,
              fileSize: 1024000,
              generationTimeMs: 30000,
              seed: 123456,
              model: 'nanoBanana-v1',
              provider: 'NANOBANANA_API'
            },
            createdAt: new Date()
          }
        ]
      };

      await queueService.updateJob('job_123', updates);

      expect(mockJobModel.update).toHaveBeenCalledWith('job_123', {
        status: 'completed',
        results: updates.results,
        completedAt: expect.any(Date)
      });
    });
  });

  describe('getNextJobs', () => {
    it('should return next pending jobs by priority', async () => {
      const mockJobs: GenerationJob[] = [
        {
          id: 'job_1',
          type: 'single',
          status: 'pending',
          priority: 'urgent',
          createdAt: new Date(),
          updatedAt: new Date(),
          prompt: 'Urgent job'
        },
        {
          id: 'job_2',
          type: 'character',
          status: 'pending',
          priority: 'high',
          createdAt: new Date(),
          updatedAt: new Date(),
          characterId: 'char_1',
          characterSpecs: { description: 'High priority character' }
        }
      ];

      mockJobModel.getScheduledJobs.mockResolvedValue([]);
      mockJobModel.getNextPendingJobs.mockResolvedValue(mockJobs);

      const jobs = await queueService.getNextJobs(4);

      expect(jobs).toEqual(mockJobs);
      expect(mockJobModel.getNextPendingJobs).toHaveBeenCalledWith(4);
    });

    it('should process scheduled jobs first', async () => {
      const scheduledJob: GenerationJob = {
        id: 'scheduled_1',
        type: 'single',
        status: 'queued',
        priority: 'normal',
        createdAt: new Date(),
        updatedAt: new Date(),
        scheduledAt: new Date(Date.now() - 1000), // 1 second ago
        prompt: 'Scheduled job'
      };

      const pendingJob: GenerationJob = {
        id: 'pending_1',
        type: 'single',
        status: 'pending',
        priority: 'normal',
        createdAt: new Date(),
        updatedAt: new Date(),
        prompt: 'Pending job'
      };

      mockJobModel.getScheduledJobs.mockResolvedValue([scheduledJob]);
      mockJobModel.update.mockResolvedValue({ ...scheduledJob, status: 'pending' });
      mockJobModel.getNextPendingJobs.mockResolvedValue([pendingJob]);

      const jobs = await queueService.getNextJobs(2);

      expect(mockJobModel.update).toHaveBeenCalledWith('scheduled_1', { status: 'pending' });
      expect(jobs).toEqual([pendingJob]);
    });
  });

  describe('getMetrics', () => {
    it('should return queue metrics', async () => {
      const mockMetrics = {
        pending: 10,
        processing: 3,
        completed: 45,
        failed: 5,
        averageWaitTimeMs: 5000,
        averageProcessingTimeMs: 30000,
        throughputPerHour: 20
      };

      mockJobModel.getQueueMetrics.mockResolvedValue(mockMetrics);

      const metrics = await queueService.getMetrics();

      expect(metrics).toEqual(mockMetrics);
      expect(mockJobModel.getQueueMetrics).toHaveBeenCalled();
    });
  });

  describe('processStaleJobs', () => {
    it('should mark stale jobs as failed', async () => {
      const staleJob: GenerationJob = {
        id: 'stale_1',
        type: 'single',
        status: 'processing',
        priority: 'normal',
        createdAt: new Date(Date.now() - 40 * 60 * 1000), // 40 minutes ago
        updatedAt: new Date(Date.now() - 35 * 60 * 1000), // 35 minutes ago
        prompt: 'Stale job'
      };

      mockJobModel.getProcessingJobs.mockResolvedValue([staleJob]);
      mockJobModel.update.mockResolvedValue({ ...staleJob, status: 'failed' });

      const processedCount = await queueService.processStaleJobs();

      expect(processedCount).toBe(1);
      expect(mockJobModel.update).toHaveBeenCalledWith('stale_1', {
        status: 'failed',
        error: {
          code: 'TIMEOUT',
          message: 'Job timed out after 30 minutes',
          retryable: true,
          retryCount: 0
        },
        completedAt: expect.any(Date)
      });
    });
  });

  describe('cleanup', () => {
    it('should cleanup completed jobs', async () => {
      mockJobModel.cleanupCompletedJobs.mockResolvedValue(15);

      const cleanedCount = await queueService.cleanup(7);

      expect(cleanedCount).toBe(15);
      expect(mockJobModel.cleanupCompletedJobs).toHaveBeenCalledWith(7);
    });
  });

  describe('getUserJobs', () => {
    it('should return user jobs with filters', async () => {
      const userJobs: GenerationJob[] = [
        {
          id: 'job_1',
          userId: 'user_123',
          type: 'single',
          status: 'completed',
          priority: 'normal',
          createdAt: new Date(),
          updatedAt: new Date(),
          completedAt: new Date(),
          prompt: 'User job 1'
        },
        {
          id: 'job_2',
          userId: 'user_123',
          type: 'character',
          status: 'failed',
          priority: 'high',
          createdAt: new Date(),
          updatedAt: new Date(),
          characterId: 'char_1',
          characterSpecs: { description: 'Failed character' },
          error: {
            code: 'API_ERROR',
            message: 'API request failed',
            retryable: false
          }
        }
      ];

      mockJobModel.find.mockResolvedValue(userJobs);

      const options = {
        status: ['completed', 'failed'] as JobStatus[],
        limit: 10,
        offset: 0
      };

      const jobs = await queueService.getUserJobs('user_123', options);

      expect(jobs).toEqual(userJobs);
      expect(mockJobModel.find).toHaveBeenCalledWith({
        userId: 'user_123',
        ...options
      });
    });
  });

  describe('event emission', () => {
    it('should emit events for job lifecycle', async () => {
      const mockJob: SingleGenerationJob = {
        id: 'job_123',
        userId: 'user_123',
        type: 'single',
        status: 'pending',
        priority: 'normal',
        createdAt: new Date(),
        updatedAt: new Date(),
        prompt: 'Test prompt'
      };

      mockJobModel.create.mockResolvedValue(mockJob);
      mockJobModel.getQueueMetrics.mockResolvedValue({
        pending: 5,
        processing: 2,
        completed: 10,
        failed: 1,
        averageWaitTimeMs: 5000,
        averageProcessingTimeMs: 30000,
        throughputPerHour: 20
      });

      const events: any[] = [];
      queueService.on('generationEvent', (event) => events.push(event));

      const request = {
        userId: 'user_123',
        type: 'single' as const,
        data: { prompt: 'Test prompt' }
      };

      await queueService.enqueue(request);

      expect(events).toHaveLength(2); // job_created and job_queued
      expect(events[0].type).toBe('job_created');
      expect(events[1].type).toBe('job_queued');
    });
  });
});