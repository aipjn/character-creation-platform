/**
 * QueueWorker Tests
 */

import { QueueWorker } from '../queueWorker';
import { GenerationQueueService } from '../../services/generationQueue';
import { BatchProcessorService } from '../../services/batchProcessor';
import {
  GenerationJob,
  SingleGenerationJob,
  CharacterGenerationJob,
  GenerationResult
} from '../../types/generation';

// Mock dependencies
jest.mock('../../services/generationQueue');
jest.mock('../../services/batchProcessor');

// Mock timers for testing intervals
jest.useFakeTimers();

describe('QueueWorker', () => {
  let queueWorker: QueueWorker;
  let mockQueueService: jest.Mocked<GenerationQueueService>;
  let mockBatchProcessor: jest.Mocked<BatchProcessorService>;

  beforeEach(() => {
    jest.clearAllMocks();
    jest.clearAllTimers();

    // Create mock queue service
    mockQueueService = {
      initialize: jest.fn().mockResolvedValue(undefined),
      getNextJobs: jest.fn().mockResolvedValue([]),
      updateJob: jest.fn().mockResolvedValue(null),
      getMetrics: jest.fn().mockResolvedValue({
        pending: 0,
        processing: 0,
        completed: 0,
        failed: 0,
        averageWaitTimeMs: 0,
        averageProcessingTimeMs: 0,
        throughputPerHour: 0
      }),
      shutdown: jest.fn().mockResolvedValue(undefined),
      on: jest.fn(),
      emit: jest.fn()
    } as any;

    // Create mock batch processor
    mockBatchProcessor = {
      processJob: jest.fn(),
      shutdown: jest.fn().mockResolvedValue(undefined),
      on: jest.fn(),
      emit: jest.fn()
    } as any;

    // Create queue worker with mocked dependencies
    queueWorker = new QueueWorker(
      mockQueueService,
      mockBatchProcessor,
      {
        concurrency: 2,
        pollIntervalMs: 1000,
        maxRetries: 3,
        retryDelayMs: 5000,
        healthCheckIntervalMs: 10000,
        staleJobThresholdMs: 30000
      }
    );
  });

  afterEach(async () => {
    if (queueWorker) {
      await queueWorker.stop();
    }
    jest.clearAllTimers();
  });

  describe('start', () => {
    it('should start the worker successfully', async () => {
      await queueWorker.start();

      const status = queueWorker.getStatus();
      expect(status.isRunning).toBe(true);
      expect(mockQueueService.initialize).toHaveBeenCalled();
    });

    it('should not start if already running', async () => {
      const consoleSpy = jest.spyOn(console, 'warn').mockImplementation();

      await queueWorker.start();
      await queueWorker.start(); // Second start

      expect(consoleSpy).toHaveBeenCalledWith('Queue worker is already running');
      consoleSpy.mockRestore();
    });

    it('should handle initialization errors', async () => {
      const initError = new Error('Initialization failed');
      mockQueueService.initialize.mockRejectedValue(initError);

      await expect(queueWorker.start()).rejects.toThrow('Initialization failed');
    });
  });

  describe('stop', () => {
    it('should stop the worker gracefully', async () => {
      await queueWorker.start();
      await queueWorker.stop();

      const status = queueWorker.getStatus();
      expect(status.isRunning).toBe(false);
      expect(mockQueueService.shutdown).toHaveBeenCalled();
      expect(mockBatchProcessor.shutdown).toHaveBeenCalled();
    });

    it('should wait for active jobs to complete', async () => {
      await queueWorker.start();

      // Mock an active job
      const mockJob: SingleGenerationJob = {
        id: 'job_123',
        type: 'single',
        status: 'processing',
        priority: 'normal',
        createdAt: new Date(),
        updatedAt: new Date(),
        prompt: 'Test prompt'
      };

      mockQueueService.getNextJobs.mockResolvedValue([mockJob]);
      
      // Mock a long-running job
      mockBatchProcessor.processJob.mockImplementation(() => 
        new Promise(resolve => setTimeout(() => resolve({} as any), 5000))
      );

      // Start job processing
      jest.advanceTimersByTime(1000); // Trigger polling

      // Stop worker
      const stopPromise = queueWorker.stop();
      
      // Advance time to complete the job
      jest.advanceTimersByTime(5000);
      
      await stopPromise;

      expect(mockQueueService.shutdown).toHaveBeenCalled();
    });

    it('should force stop remaining jobs after timeout', async () => {
      await queueWorker.start();

      const mockJob: SingleGenerationJob = {
        id: 'job_123',
        type: 'single',
        status: 'processing',
        priority: 'normal',
        createdAt: new Date(),
        updatedAt: new Date(),
        prompt: 'Test prompt'
      };

      mockQueueService.getNextJobs.mockResolvedValue([mockJob]);
      
      // Mock a job that never completes
      mockBatchProcessor.processJob.mockImplementation(() => 
        new Promise(() => {}) // Never resolves
      );

      // Simulate polling and job start
      jest.advanceTimersByTime(1000);

      // Stop worker and simulate timeout
      const stopPromise = queueWorker.stop();
      
      // Advance time past shutdown timeout
      jest.advanceTimersByTime(35000);
      
      await stopPromise;

      const status = queueWorker.getStatus();
      expect(status.isRunning).toBe(false);
    });
  });

  describe('job processing', () => {
    beforeEach(async () => {
      await queueWorker.start();
    });

    it('should process jobs from the queue', async () => {
      const mockJob: SingleGenerationJob = {
        id: 'job_123',
        type: 'single',
        status: 'pending',
        priority: 'normal',
        createdAt: new Date(),
        updatedAt: new Date(),
        prompt: 'Test prompt'
      };

      const mockResult: GenerationResult = {
        id: 'result_123',
        imageUrl: 'https://example.com/image.png',
        metadata: {
          dimensions: { width: 1024, height: 1024 },
          format: 'png',
          fileSize: 1024000,
          generationTimeMs: 5000,
          seed: 123456,
          model: 'nanoBanana-v1',
          provider: 'NANOBANANA_API'
        },
        createdAt: new Date()
      };

      mockQueueService.getNextJobs.mockResolvedValue([mockJob]);
      mockBatchProcessor.processJob.mockResolvedValue(mockResult);

      // Trigger polling
      jest.advanceTimersByTime(1000);

      // Wait for job processing
      await new Promise(resolve => setTimeout(resolve, 100));

      expect(mockQueueService.updateJob).toHaveBeenCalledWith('job_123', { status: 'processing' });
      expect(mockBatchProcessor.processJob).toHaveBeenCalledWith(mockJob);
    });

    it('should respect concurrency limits', async () => {
      const jobs: SingleGenerationJob[] = Array.from({ length: 5 }, (_, i) => ({
        id: `job_${i}`,
        type: 'single',
        status: 'pending',
        priority: 'normal',
        createdAt: new Date(),
        updatedAt: new Date(),
        prompt: `Test prompt ${i}`
      }));

      mockQueueService.getNextJobs.mockResolvedValue(jobs);
      mockBatchProcessor.processJob.mockImplementation(() => 
        new Promise(resolve => setTimeout(() => resolve({} as any), 1000))
      );

      // Trigger polling
      jest.advanceTimersByTime(1000);

      // Check that only 2 jobs are processed (concurrency limit)
      expect(mockBatchProcessor.processJob).toHaveBeenCalledTimes(2);
    });

    it('should handle job processing errors', async () => {
      const mockJob: SingleGenerationJob = {
        id: 'job_123',
        type: 'single',
        status: 'pending',
        priority: 'normal',
        createdAt: new Date(),
        updatedAt: new Date(),
        prompt: 'Test prompt'
      };

      const processingError = new Error('Processing failed');
      processingError.name = 'NETWORK_ERROR';

      mockQueueService.getNextJobs.mockResolvedValue([mockJob]);
      mockBatchProcessor.processJob.mockRejectedValue(processingError);

      const events: any[] = [];
      queueWorker.on('jobFailed', (event) => events.push(event));

      // Trigger polling
      jest.advanceTimersByTime(1000);

      // Wait for job processing to complete
      await new Promise(resolve => setTimeout(resolve, 100));

      expect(mockQueueService.updateJob).toHaveBeenCalledWith('job_123', {
        status: 'pending', // Retryable error
        error: expect.objectContaining({
          code: 'NETWORK_ERROR',
          message: 'Processing failed',
          retryable: true,
          retryCount: 1
        })
      });
    });

    it('should permanently fail jobs after max retries', async () => {
      const mockJob: SingleGenerationJob = {
        id: 'job_123',
        type: 'single',
        status: 'pending',
        priority: 'normal',
        createdAt: new Date(),
        updatedAt: new Date(),
        prompt: 'Test prompt',
        error: {
          code: 'NETWORK_ERROR',
          message: 'Previous failure',
          retryable: true,
          retryCount: 3 // Already at max retries
        }
      };

      const processingError = new Error('Processing failed again');
      processingError.name = 'NETWORK_ERROR';

      mockQueueService.getNextJobs.mockResolvedValue([mockJob]);
      mockBatchProcessor.processJob.mockRejectedValue(processingError);

      const events: any[] = [];
      queueWorker.on('jobFailed', (event) => events.push(event));

      // Trigger polling
      jest.advanceTimersByTime(1000);

      // Wait for processing
      await new Promise(resolve => setTimeout(resolve, 100));

      expect(mockQueueService.updateJob).toHaveBeenCalledWith('job_123', {
        status: 'failed', // Permanently failed
        error: expect.objectContaining({
          retryable: false
        })
      });

      expect(events).toHaveLength(1);
      expect(events[0].jobId).toBe('job_123');
    });
  });

  describe('health monitoring', () => {
    beforeEach(async () => {
      await queueWorker.start();
    });

    it('should perform periodic health checks', async () => {
      mockQueueService.find = jest.fn().mockResolvedValue([]);

      // Trigger health check
      jest.advanceTimersByTime(10000);

      const status = queueWorker.getStatus();
      expect(status.health.status).toBe('healthy');
    });

    it('should detect stale jobs', async () => {
      const staleJob: SingleGenerationJob = {
        id: 'stale_job',
        type: 'single',
        status: 'processing',
        priority: 'normal',
        createdAt: new Date(Date.now() - 60000), // 1 minute ago
        updatedAt: new Date(Date.now() - 60000),
        prompt: 'Stale job'
      };

      // Simulate stale job in worker's active jobs
      mockQueueService.getNextJobs.mockResolvedValue([staleJob]);
      mockBatchProcessor.processJob.mockImplementation(() => 
        new Promise(() => {}) // Never resolves (simulates stale job)
      );

      // Start job processing
      jest.advanceTimersByTime(1000);

      // Wait for job to start
      await new Promise(resolve => setTimeout(resolve, 100));

      // Advance time to make job stale
      jest.advanceTimersByTime(35000); // Past stale threshold

      // Check that stale job is handled
      const status = queueWorker.getStatus();
      expect(status.health.status).not.toBe('healthy');
    });

    it('should calculate error rate correctly', async () => {
      // Process some jobs with mixed success/failure
      const jobs = [
        { id: 'job_1', success: true },
        { id: 'job_2', success: false },
        { id: 'job_3', success: true },
        { id: 'job_4', success: false },
        { id: 'job_5', success: false }
      ];

      for (const jobData of jobs) {
        const job: SingleGenerationJob = {
          id: jobData.id,
          type: 'single',
          status: 'pending',
          priority: 'normal',
          createdAt: new Date(),
          updatedAt: new Date(),
          prompt: `Test job ${jobData.id}`
        };

        mockQueueService.getNextJobs.mockResolvedValue([job]);
        
        if (jobData.success) {
          mockBatchProcessor.processJob.mockResolvedValue({} as any);
        } else {
          mockBatchProcessor.processJob.mockRejectedValue(new Error('Job failed'));
        }

        jest.advanceTimersByTime(1000);
        await new Promise(resolve => setTimeout(resolve, 100));
      }

      const status = queueWorker.getStatus();
      expect(status.metrics.processed).toBe(5);
      expect(status.metrics.successful).toBe(2);
      expect(status.metrics.failed).toBe(3);
      
      // Error rate should be 60% (3/5)
      expect(status.health.errorRate).toBe(60);
    });
  });

  describe('getStatus', () => {
    it('should return comprehensive worker status', async () => {
      await queueWorker.start();

      const status = queueWorker.getStatus();

      expect(status).toMatchObject({
        isRunning: true,
        activeJobs: 0,
        metrics: expect.objectContaining({
          processed: 0,
          successful: 0,
          failed: 0,
          retried: 0,
          averageProcessingTime: 0,
          uptime: expect.any(Number),
          currentLoad: 0
        }),
        health: expect.objectContaining({
          status: 'healthy',
          activeJobs: 0,
          queueSize: 0,
          errorRate: 0
        })
      });
    });

    it('should calculate current load correctly', async () => {
      await queueWorker.start();

      // Mock 2 concurrent jobs (concurrency is 2)
      const jobs: SingleGenerationJob[] = [
        {
          id: 'job_1',
          type: 'single',
          status: 'pending',
          priority: 'normal',
          createdAt: new Date(),
          updatedAt: new Date(),
          prompt: 'Job 1'
        },
        {
          id: 'job_2',
          type: 'single',
          status: 'pending',
          priority: 'normal',
          createdAt: new Date(),
          updatedAt: new Date(),
          prompt: 'Job 2'
        }
      ];

      mockQueueService.getNextJobs.mockResolvedValue(jobs);
      mockBatchProcessor.processJob.mockImplementation(() => 
        new Promise(resolve => setTimeout(() => resolve({} as any), 5000))
      );

      // Start job processing
      jest.advanceTimersByTime(1000);
      await new Promise(resolve => setTimeout(resolve, 100));

      const status = queueWorker.getStatus();
      expect(status.metrics.currentLoad).toBe(1.0); // 2/2 = 100%
    });
  });

  describe('event emission', () => {
    beforeEach(async () => {
      await queueWorker.start();
    });

    it('should emit jobStarted events', async () => {
      const mockJob: SingleGenerationJob = {
        id: 'job_123',
        type: 'single',
        status: 'pending',
        priority: 'normal',
        createdAt: new Date(),
        updatedAt: new Date(),
        prompt: 'Test prompt'
      };

      mockQueueService.getNextJobs.mockResolvedValue([mockJob]);
      mockBatchProcessor.processJob.mockResolvedValue({} as any);

      const events: any[] = [];
      queueWorker.on('jobStarted', (event) => events.push(event));

      jest.advanceTimersByTime(1000);
      await new Promise(resolve => setTimeout(resolve, 100));

      expect(events).toHaveLength(1);
      expect(events[0]).toMatchObject({
        jobId: 'job_123',
        job: mockJob,
        timestamp: expect.any(Date)
      });
    });

    it('should emit jobCompleted events', async () => {
      const mockJob: SingleGenerationJob = {
        id: 'job_123',
        type: 'single',
        status: 'pending',
        priority: 'normal',
        createdAt: new Date(),
        updatedAt: new Date(),
        prompt: 'Test prompt'
      };

      const mockResult: GenerationResult = {
        id: 'result_123',
        imageUrl: 'https://example.com/image.png',
        metadata: {
          dimensions: { width: 1024, height: 1024 },
          format: 'png',
          fileSize: 1024000,
          generationTimeMs: 5000,
          seed: 123456,
          model: 'nanoBanana-v1',
          provider: 'NANOBANANA_API'
        },
        createdAt: new Date()
      };

      mockQueueService.getNextJobs.mockResolvedValue([mockJob]);
      mockBatchProcessor.processJob.mockResolvedValue(mockResult);

      const events: any[] = [];
      queueWorker.on('jobCompleted', (event) => events.push(event));

      jest.advanceTimersByTime(1000);
      await new Promise(resolve => setTimeout(resolve, 100));

      expect(events).toHaveLength(1);
      expect(events[0]).toMatchObject({
        jobId: 'job_123',
        job: mockJob,
        result: mockResult,
        processingTimeMs: expect.any(Number),
        timestamp: expect.any(Date)
      });
    });

    it('should emit healthCheck events', async () => {
      const events: any[] = [];
      queueWorker.on('healthCheck', (event) => events.push(event));

      jest.advanceTimersByTime(10000); // Trigger health check

      expect(events).toHaveLength(1);
      expect(events[0]).toMatchObject({
        health: expect.any(Object),
        metrics: expect.any(Object),
        timestamp: expect.any(Date)
      });
    });
  });

  describe('error recovery', () => {
    beforeEach(async () => {
      await queueWorker.start();
    });

    it('should handle uncaught exceptions', async () => {
      const events: any[] = [];
      queueWorker.on('uncaughtError', (error) => events.push(error));

      // Simulate uncaught exception
      process.emit('uncaughtException', new Error('Uncaught error'));

      expect(events).toHaveLength(1);
      expect(events[0].message).toBe('Uncaught error');
    });

    it('should handle unhandled rejections', async () => {
      const events: any[] = [];
      queueWorker.on('unhandledRejection', (reason) => events.push(reason));

      // Simulate unhandled rejection
      process.emit('unhandledRejection', new Error('Unhandled rejection'));

      expect(events).toHaveLength(1);
    });

    it('should continue processing after errors', async () => {
      const failingJob: SingleGenerationJob = {
        id: 'failing_job',
        type: 'single',
        status: 'pending',
        priority: 'normal',
        createdAt: new Date(),
        updatedAt: new Date(),
        prompt: 'Failing job'
      };

      const successJob: SingleGenerationJob = {
        id: 'success_job',
        type: 'single',
        status: 'pending',
        priority: 'normal',
        createdAt: new Date(),
        updatedAt: new Date(),
        prompt: 'Success job'
      };

      let callCount = 0;
      mockQueueService.getNextJobs.mockImplementation(() => {
        callCount++;
        return Promise.resolve(callCount === 1 ? [failingJob] : [successJob]);
      });

      mockBatchProcessor.processJob.mockImplementation((job) => {
        if (job.id === 'failing_job') {
          return Promise.reject(new Error('Job failed'));
        }
        return Promise.resolve({} as any);
      });

      // First polling - failing job
      jest.advanceTimersByTime(1000);
      await new Promise(resolve => setTimeout(resolve, 100));

      // Second polling - success job
      jest.advanceTimersByTime(5000); // Retry delay
      await new Promise(resolve => setTimeout(resolve, 100));

      expect(mockBatchProcessor.processJob).toHaveBeenCalledTimes(2);
    });
  });
});