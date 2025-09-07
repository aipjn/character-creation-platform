/**
 * QueueManager Tests
 */

import { QueueManagerService } from '../queueManager';
import { GenerationQueueService } from '../../services/generationQueue';
import { BatchProcessorService } from '../../services/batchProcessor';
import { QueueWorker } from '../../workers/queueWorker';
import {
  GenerationJob,
  SingleGenerationJob,
  SystemHealthStatus,
  QueueMetrics
} from '../../types/generation';

// Mock dependencies
jest.mock('../../services/generationQueue');
jest.mock('../../services/batchProcessor');
jest.mock('../../workers/queueWorker');

// Mock timers
jest.useFakeTimers();

describe('QueueManagerService', () => {
  let queueManager: QueueManagerService;
  let mockQueueService: jest.Mocked<GenerationQueueService>;
  let mockBatchProcessor: jest.Mocked<BatchProcessorService>;
  let mockWorkerClass: jest.MockedClass<typeof QueueWorker>;

  beforeEach(() => {
    jest.clearAllMocks();
    jest.clearAllTimers();

    // Create mock queue service
    mockQueueService = {
      initialize: jest.fn().mockResolvedValue(undefined),
      enqueue: jest.fn().mockResolvedValue('job_123'),
      getJob: jest.fn().mockResolvedValue(null),
      cancelJob: jest.fn().mockResolvedValue(true),
      getUserJobs: jest.fn().mockResolvedValue([]),
      getMetrics: jest.fn().mockResolvedValue({
        pending: 10,
        processing: 2,
        completed: 50,
        failed: 3,
        averageWaitTimeMs: 5000,
        averageProcessingTimeMs: 30000,
        throughputPerHour: 25
      } as QueueMetrics),
      getHealthStatus: jest.fn().mockResolvedValue({
        isHealthy: true,
        queueSize: 10,
        processingJobs: 2,
        failedJobsLast24h: 3,
        averageWaitTime: 5000
      }),
      cleanup: jest.fn().mockResolvedValue(15),
      shutdown: jest.fn().mockResolvedValue(undefined),
      on: jest.fn(),
      emit: jest.fn()
    } as any;

    // Create mock batch processor
    mockBatchProcessor = {
      getActiveBatchCount: jest.fn().mockReturnValue(1),
      shutdown: jest.fn().mockResolvedValue(undefined),
      on: jest.fn(),
      emit: jest.fn()
    } as any;

    // Mock QueueWorker class
    mockWorkerClass = QueueWorker as jest.MockedClass<typeof QueueWorker>;
    const mockWorkerInstance = {
      start: jest.fn().mockResolvedValue(undefined),
      stop: jest.fn().mockResolvedValue(undefined),
      getStatus: jest.fn().mockReturnValue({
        isRunning: true,
        activeJobs: 1,
        metrics: {
          processed: 100,
          successful: 95,
          failed: 5,
          retried: 2,
          averageProcessingTime: 25000,
          uptime: 3600,
          currentLoad: 0.5,
          queueHealth: {
            pending: 10,
            processing: 2,
            stale: 0
          }
        },
        health: {
          status: 'healthy' as const,
          activeJobs: 1,
          queueSize: 10,
          errorRate: 5
        }
      }),
      on: jest.fn(),
      emit: jest.fn()
    };

    mockWorkerClass.mockImplementation(() => mockWorkerInstance as any);

    // Create queue manager
    queueManager = new QueueManagerService(
      {
        workers: { count: 2, concurrency: 4 },
        healthCheck: { intervalMs: 30000, enabled: true },
        cleanup: { enabled: true, intervalHours: 24, retentionDays: 7 },
        monitoring: {
          metricsIntervalMs: 60000,
          alertThresholds: {
            queueSize: 50,
            errorRate: 10,
            processingTime: 300000
          }
        }
      },
      mockQueueService,
      mockBatchProcessor
    );
  });

  afterEach(async () => {
    if (queueManager) {
      await queueManager.stop();
    }
    jest.clearAllTimers();
  });

  describe('start', () => {
    it('should start the queue management system', async () => {
      await queueManager.start();

      expect(mockQueueService.initialize).toHaveBeenCalled();
      expect(mockWorkerClass).toHaveBeenCalledTimes(2); // 2 workers
      
      // Check if workers were started
      const workerInstances = mockWorkerClass.mock.instances;
      workerInstances.forEach(worker => {
        expect(worker.start).toHaveBeenCalled();
      });
    });

    it('should not start if already started', async () => {
      const consoleSpy = jest.spyOn(console, 'warn').mockImplementation();

      await queueManager.start();
      await queueManager.start(); // Second start

      expect(consoleSpy).toHaveBeenCalledWith('Queue manager is already started');
      consoleSpy.mockRestore();
    });

    it('should handle initialization errors', async () => {
      const initError = new Error('Initialization failed');
      mockQueueService.initialize.mockRejectedValue(initError);

      await expect(queueManager.start()).rejects.toThrow('Initialization failed');
    });

    it('should start monitoring when enabled', async () => {
      await queueManager.start();

      // Health checks should be scheduled
      expect(setInterval).toHaveBeenCalledWith(
        expect.any(Function),
        30000 // healthCheck.intervalMs
      );

      // Cleanup should be scheduled
      expect(setInterval).toHaveBeenCalledWith(
        expect.any(Function),
        24 * 60 * 60 * 1000 // 24 hours in ms
      );

      // Metrics collection should be scheduled
      expect(setInterval).toHaveBeenCalledWith(
        expect.any(Function),
        60000 // metricsIntervalMs
      );
    });
  });

  describe('stop', () => {
    it('should stop the queue management system gracefully', async () => {
      await queueManager.start();
      await queueManager.stop();

      const workerInstances = mockWorkerClass.mock.instances;
      workerInstances.forEach(worker => {
        expect(worker.stop).toHaveBeenCalled();
      });

      expect(mockQueueService.shutdown).toHaveBeenCalled();
      expect(mockBatchProcessor.shutdown).toHaveBeenCalled();
    });
  });

  describe('getSystemMetrics', () => {
    beforeEach(async () => {
      await queueManager.start();
    });

    it('should return comprehensive system metrics', async () => {
      const metrics = await queueManager.getSystemMetrics();

      expect(metrics).toMatchObject({
        queue: expect.objectContaining({
          pending: 10,
          processing: 2,
          completed: 50,
          failed: 3
        }),
        workers: expect.arrayContaining([
          expect.objectContaining({
            processed: 100,
            successful: 95,
            failed: 5
          })
        ]),
        processing: expect.objectContaining({
          activeBatches: 1,
          totalProcessed: expect.any(Number),
          successRate: expect.any(Number),
          averageProcessingTime: expect.any(Number)
        }),
        health: expect.objectContaining({
          overall: expect.stringMatching(/healthy|degraded|unhealthy/),
          queue: expect.any(Object),
          workers: expect.any(Array)
        }),
        uptime: expect.any(Number),
        lastUpdated: expect.any(Date)
      });
    });

    it('should calculate success rate correctly', async () => {
      const metrics = await queueManager.getSystemMetrics();

      // With 2 workers each having processed 100 (95 successful, 5 failed)
      expect(metrics.processing.totalProcessed).toBe(200); // 100 * 2 workers
      expect(metrics.processing.successRate).toBe(95); // 190/200 * 100
    });

    it('should determine overall health correctly', async () => {
      // Test healthy state
      let metrics = await queueManager.getSystemMetrics();
      expect(metrics.health.overall).toBe('healthy');

      // Test unhealthy state - unhealthy queue
      mockQueueService.getHealthStatus.mockResolvedValue({
        isHealthy: false,
        queueSize: 10,
        processingJobs: 2,
        failedJobsLast24h: 20,
        averageWaitTime: 5000
      });

      metrics = await queueManager.getSystemMetrics();
      expect(metrics.health.overall).toBe('unhealthy');

      // Test degraded state - large queue
      mockQueueService.getHealthStatus.mockResolvedValue({
        isHealthy: true,
        queueSize: 60, // Above threshold of 50
        processingJobs: 2,
        failedJobsLast24h: 3,
        averageWaitTime: 5000
      });

      metrics = await queueManager.getSystemMetrics();
      expect(metrics.health.overall).toBe('degraded');
    });
  });

  describe('getSystemHealth', () => {
    beforeEach(async () => {
      await queueManager.start();
    });

    it('should return system health status', async () => {
      const health = await queueManager.getSystemHealth();

      expect(health).toMatchObject({
        overall: expect.stringMatching(/healthy|degraded|unhealthy/),
        services: expect.objectContaining({
          nanoBananaApi: expect.objectContaining({
            service: 'nanoBananaApi',
            status: 'healthy',
            lastCheckedAt: expect.any(Date)
          }),
          queue: expect.objectContaining({
            service: 'queue',
            status: expect.stringMatching(/healthy|degraded|unhealthy/),
            lastCheckedAt: expect.any(Date)
          })
        }),
        checkedAt: expect.any(Date)
      });
    });
  });

  describe('job management', () => {
    beforeEach(async () => {
      await queueManager.start();
    });

    it('should queue jobs', async () => {
      const request = {
        userId: 'user_123',
        type: 'single' as const,
        priority: 'normal' as const,
        data: { prompt: 'Test prompt' }
      };

      const jobId = await queueManager.queueJob(request);

      expect(jobId).toBe('job_123');
      expect(mockQueueService.enqueue).toHaveBeenCalledWith(request);
    });

    it('should get job status', async () => {
      const mockJob: SingleGenerationJob = {
        id: 'job_123',
        type: 'single',
        status: 'completed',
        priority: 'normal',
        createdAt: new Date(),
        updatedAt: new Date(),
        completedAt: new Date(),
        prompt: 'Test prompt'
      };

      mockQueueService.getJob.mockResolvedValue(mockJob);

      const job = await queueManager.getJobStatus('job_123');

      expect(job).toEqual(mockJob);
      expect(mockQueueService.getJob).toHaveBeenCalledWith('job_123');
    });

    it('should cancel jobs', async () => {
      const cancelled = await queueManager.cancelJob('job_123', 'user_123');

      expect(cancelled).toBe(true);
      expect(mockQueueService.cancelJob).toHaveBeenCalledWith('job_123', 'user_123');
    });

    it('should get user jobs', async () => {
      const mockJobs: GenerationJob[] = [
        {
          id: 'job_1',
          userId: 'user_123',
          type: 'single',
          status: 'completed',
          priority: 'normal',
          createdAt: new Date(),
          updatedAt: new Date(),
          prompt: 'Job 1'
        }
      ];

      mockQueueService.getUserJobs.mockResolvedValue(mockJobs);

      const jobs = await queueManager.getUserJobs('user_123', { limit: 10 });

      expect(jobs).toEqual(mockJobs);
      expect(mockQueueService.getUserJobs).toHaveBeenCalledWith('user_123', { limit: 10 });
    });
  });

  describe('worker scaling', () => {
    beforeEach(async () => {
      await queueManager.start();
    });

    it('should scale workers up', async () => {
      await queueManager.scaleWorkers(4); // Scale from 2 to 4

      expect(mockWorkerClass).toHaveBeenCalledTimes(4); // 2 initial + 2 new
      
      // New workers should be started
      const newWorkerInstances = mockWorkerClass.mock.instances.slice(2);
      newWorkerInstances.forEach(worker => {
        expect(worker.start).toHaveBeenCalled();
      });
    });

    it('should scale workers down', async () => {
      await queueManager.scaleWorkers(1); // Scale from 2 to 1

      const workerInstances = mockWorkerClass.mock.instances;
      expect(workerInstances[1].stop).toHaveBeenCalled();
    });

    it('should not change worker count if target equals current', async () => {
      const initialWorkerCount = mockWorkerClass.mock.instances.length;
      
      await queueManager.scaleWorkers(2); // Same as current

      expect(mockWorkerClass.mock.instances.length).toBe(initialWorkerCount);
    });
  });

  describe('processing control', () => {
    beforeEach(async () => {
      await queueManager.start();
    });

    it('should pause processing', async () => {
      await queueManager.pauseProcessing();

      const workerInstances = mockWorkerClass.mock.instances;
      workerInstances.forEach(worker => {
        expect(worker.stop).toHaveBeenCalled();
      });
    });

    it('should resume processing', async () => {
      await queueManager.resumeProcessing();

      const workerInstances = mockWorkerClass.mock.instances;
      workerInstances.forEach(worker => {
        expect(worker.start).toHaveBeenCalled();
      });
    });
  });

  describe('cleanup', () => {
    beforeEach(async () => {
      await queueManager.start();
    });

    it('should perform manual cleanup', async () => {
      const cleanedCount = await queueManager.cleanupJobs(30);

      expect(cleanedCount).toBe(15);
      expect(mockQueueService.cleanup).toHaveBeenCalledWith(30);
    });

    it('should perform scheduled cleanup', async () => {
      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();

      // Trigger scheduled cleanup
      jest.advanceTimersByTime(24 * 60 * 60 * 1000);

      expect(mockQueueService.cleanup).toHaveBeenCalledWith(7); // Default retention days
      expect(consoleSpy).toHaveBeenCalledWith('Cleanup completed: removed 15 old jobs');

      consoleSpy.mockRestore();
    });
  });

  describe('alert system', () => {
    beforeEach(async () => {
      await queueManager.start();
    });

    it('should emit alert for high queue size', async () => {
      mockQueueService.getMetrics.mockResolvedValue({
        pending: 60, // Above threshold of 50
        processing: 2,
        completed: 50,
        failed: 3,
        averageWaitTimeMs: 5000,
        averageProcessingTimeMs: 30000,
        throughputPerHour: 25
      });

      const alerts: any[] = [];
      queueManager.on('alert', (alert) => alerts.push(alert));

      // Trigger health check
      jest.advanceTimersByTime(30000);

      expect(alerts).toHaveLength(1);
      expect(alerts[0]).toMatchObject({
        level: 'warning',
        type: 'queue_full',
        message: expect.stringContaining('Queue size (60) exceeds threshold (50)'),
        timestamp: expect.any(Date)
      });
    });

    it('should emit alert for high error rate', async () => {
      // Mock high error rate scenario
      const mockWorkerInstance = mockWorkerClass.mock.instances[0];
      mockWorkerInstance.getStatus = jest.fn().mockReturnValue({
        metrics: {
          processed: 100,
          successful: 80, // 20% error rate (above threshold of 10%)
          failed: 20
        }
      });

      const alerts: any[] = [];
      queueManager.on('alert', (alert) => alerts.push(alert));

      jest.advanceTimersByTime(30000);

      expect(alerts.some(alert => alert.type === 'high_error_rate')).toBe(true);
    });

    it('should emit alert for slow processing', async () => {
      mockQueueService.getMetrics.mockResolvedValue({
        pending: 10,
        processing: 2,
        completed: 50,
        failed: 3,
        averageWaitTimeMs: 5000,
        averageProcessingTimeMs: 400000, // Above threshold of 300000ms
        throughputPerHour: 25
      });

      const alerts: any[] = [];
      queueManager.on('alert', (alert) => alerts.push(alert));

      jest.advanceTimersByTime(30000);

      expect(alerts.some(alert => alert.type === 'slow_processing')).toBe(true);
    });

    it('should track alert history', async () => {
      mockQueueService.getMetrics.mockResolvedValue({
        pending: 60, // Above threshold
        processing: 2,
        completed: 50,
        failed: 3,
        averageWaitTimeMs: 5000,
        averageProcessingTimeMs: 30000,
        throughputPerHour: 25
      });

      jest.advanceTimersByTime(30000); // Trigger health check

      const recentAlerts = queueManager.getRecentAlerts(24);
      expect(recentAlerts.length).toBeGreaterThan(0);
      expect(recentAlerts[0]).toMatchObject({
        level: 'warning',
        type: 'queue_full',
        message: expect.any(String),
        timestamp: expect.any(Date)
      });
    });
  });

  describe('event forwarding', () => {
    beforeEach(async () => {
      await queueManager.start();
    });

    it('should forward queue service events', async () => {
      const events: any[] = [];
      queueManager.on('queueEvent', (event) => events.push(event));

      // Simulate queue service event
      const mockEvent = {
        type: 'job_completed',
        jobId: 'job_123',
        timestamp: new Date(),
        data: {}
      };

      const queueServiceEmit = mockQueueService.on.mock.calls.find(
        call => call[0] === 'generationEvent'
      )?.[1];

      if (queueServiceEmit) {
        queueServiceEmit(mockEvent);
      }

      expect(events).toHaveLength(1);
      expect(events[0]).toEqual(mockEvent);
    });

    it('should forward batch processor events', async () => {
      const events: any[] = [];
      queueManager.on('batchCompleted', (event) => events.push(event));

      const mockBatchResult = {
        batchId: 'batch_123',
        totalRequests: 3,
        successCount: 3,
        failureCount: 0,
        results: [],
        errors: [],
        processingTimeMs: 5000
      };

      const batchProcessorEmit = mockBatchProcessor.on.mock.calls.find(
        call => call[0] === 'batchCompleted'
      )?.[1];

      if (batchProcessorEmit) {
        batchProcessorEmit(mockBatchResult);
      }

      expect(events).toHaveLength(1);
      expect(events[0]).toEqual(mockBatchResult);
    });

    it('should forward worker events', async () => {
      const startedEvents: any[] = [];
      const completedEvents: any[] = [];

      queueManager.on('jobStarted', (event) => startedEvents.push(event));
      queueManager.on('jobCompleted', (event) => completedEvents.push(event));

      const workerInstance = mockWorkerClass.mock.instances[0];
      
      const mockStartedEvent = { jobId: 'job_123', timestamp: new Date() };
      const mockCompletedEvent = { jobId: 'job_123', result: {}, timestamp: new Date() };

      // Find the event handlers registered for the worker
      const jobStartedHandler = workerInstance.on.mock.calls.find(
        call => call[0] === 'jobStarted'
      )?.[1];
      
      const jobCompletedHandler = workerInstance.on.mock.calls.find(
        call => call[0] === 'jobCompleted'
      )?.[1];

      if (jobStartedHandler) {
        jobStartedHandler(mockStartedEvent);
      }
      
      if (jobCompletedHandler) {
        jobCompletedHandler(mockCompletedEvent);
      }

      expect(startedEvents).toHaveLength(1);
      expect(completedEvents).toHaveLength(1);
    });
  });

  describe('metrics collection', () => {
    beforeEach(async () => {
      await queueManager.start();
    });

    it('should emit metrics updates periodically', async () => {
      const events: any[] = [];
      queueManager.on('metricsUpdated', (metrics) => events.push(metrics));

      jest.advanceTimersByTime(60000); // Trigger metrics collection

      expect(events).toHaveLength(1);
      expect(events[0]).toMatchObject({
        queue: expect.any(Object),
        workers: expect.any(Array),
        processing: expect.any(Object),
        health: expect.any(Object),
        uptime: expect.any(Number),
        lastUpdated: expect.any(Date)
      });
    });
  });
});