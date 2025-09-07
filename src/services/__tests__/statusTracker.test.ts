/**
 * Status Tracker Service Tests
 * Comprehensive tests for job status tracking, event handling, and system health monitoring
 */

import { EventEmitter } from 'events';
import { StatusTracker, createStatusTracker } from '../statusTracker';
import {
  GenerationJob,
  GenerationEvent,
  GenerationProgress,
  GenerationError,
  GenerationResult,
  CharacterGenerationJob,
  BatchGenerationJob,
  SingleGenerationJob
} from '../../types/generation';

// Mock dependencies
jest.mock('../../types/generation', () => ({
  ...jest.requireActual('../../types/generation'),
  isPendingJob: jest.fn((job: GenerationJob) => ['pending', 'queued', 'processing'].includes(job.status)),
  isCompletedJob: jest.fn((job: GenerationJob) => job.status === 'completed'),
  isFailedJob: jest.fn((job: GenerationJob) => job.status === 'failed'),
  isCharacterGenerationJob: jest.fn((job: GenerationJob) => job.type === 'character'),
  isBatchGenerationJob: jest.fn((job: GenerationJob) => job.type === 'batch'),
  isSingleGenerationJob: jest.fn((job: GenerationJob) => job.type === 'single')
}));

describe('StatusTracker', () => {
  let statusTracker: StatusTracker;
  let mockJob: CharacterGenerationJob;

  beforeEach(() => {
    statusTracker = createStatusTracker({
      updateIntervalMs: 100, // Fast updates for testing
      maxStatusHistory: 10,
      enableRealTimeUpdates: true,
      healthCheckIntervalMs: 1000,
      staleJobTimeoutMs: 5000
    });

    mockJob = {
      id: 'test-job-1',
      userId: 'user-123',
      type: 'character',
      status: 'pending',
      priority: 'normal',
      createdAt: new Date(),
      updatedAt: new Date(),
      characterId: 'char-456',
      characterSpecs: {
        name: 'Test Character',
        description: 'A test character for unit tests',
        appearance: {
          age: '25',
          gender: 'female',
          hair: 'brown',
          eyes: 'blue'
        }
      },
      generationParams: {
        quality: 'high',
        aspectRatio: '1:1',
        variations: 2
      }
    };
  });

  afterEach(() => {
    statusTracker.destroy();
  });

  describe('Job Tracking', () => {
    it('should track new generation jobs', () => {
      // Track the job
      statusTracker.trackJob(mockJob);

      // Verify job is tracked
      const trackedJob = statusTracker.getJobStatus(mockJob.id);
      expect(trackedJob).toEqual(mockJob);

      // Verify metrics are updated
      const metrics = statusTracker.getMetrics();
      expect(metrics.totalJobs).toBe(1);
      expect(metrics.activeJobs).toBe(1);
    });

    it('should update job status and emit events', (done) => {
      // Set up event listener
      statusTracker.once('job_started', (event: GenerationEvent) => {
        expect(event.type).toBe('job_started');
        expect(event.jobId).toBe(mockJob.id);
        done();
      });

      // Track job and update status
      statusTracker.trackJob(mockJob);
      statusTracker.updateJobStatus(mockJob.id, 'processing');
    });

    it('should maintain status history', () => {
      statusTracker.trackJob(mockJob);
      
      // Update status multiple times
      statusTracker.updateJobStatus(mockJob.id, 'queued');
      statusTracker.updateJobStatus(mockJob.id, 'processing');
      statusTracker.updateJobStatus(mockJob.id, 'completed');

      // Check history
      const history = statusTracker.getJobStatusHistory(mockJob.id);
      expect(history.length).toBeGreaterThan(0);
      expect(history[0].previousStatus).toBe('pending');
      expect(history[history.length - 1].newStatus).toBe('completed');
    });

    it('should handle job progress updates', () => {
      const progress: GenerationProgress = {
        percentage: 50,
        stage: 'generating',
        message: 'Generating character variations',
        estimatedTimeRemainingMs: 30000,
        startedAt: new Date()
      };

      statusTracker.trackJob(mockJob);
      statusTracker.updateJobStatus(mockJob.id, 'processing', progress);

      const updatedJob = statusTracker.getJobStatus(mockJob.id);
      expect(updatedJob?.progress).toEqual(progress);
    });

    it('should handle job errors', () => {
      const error: GenerationError = {
        code: 'API_ERROR',
        message: 'Test API error',
        retryable: true,
        retryCount: 1,
        lastRetryAt: new Date()
      };

      statusTracker.trackJob(mockJob);
      statusTracker.updateJobStatus(mockJob.id, 'failed', undefined, error);

      const updatedJob = statusTracker.getJobStatus(mockJob.id);
      expect(updatedJob?.error).toEqual(error);
      
      const metrics = statusTracker.getMetrics();
      expect(metrics.failedJobs).toBe(1);
    });

    it('should handle job completion with results', () => {
      const result: GenerationResult = {
        id: 'result-1',
        imageUrl: 'https://example.com/image.png',
        thumbnailUrl: 'https://example.com/thumb.png',
        metadata: {
          dimensions: { width: 512, height: 512 },
          format: 'png',
          fileSize: 1024000,
          generationTimeMs: 5000,
          seed: 12345,
          model: 'test-model',
          provider: 'test-provider'
        },
        createdAt: new Date()
      };

      statusTracker.trackJob(mockJob);
      statusTracker.updateJobStatus(mockJob.id, 'completed', undefined, undefined, result);

      const updatedJob = statusTracker.getJobStatus(mockJob.id) as CharacterGenerationJob;
      expect(updatedJob?.results).toContain(result);
      expect(updatedJob?.completedAt).toBeDefined();
      
      const metrics = statusTracker.getMetrics();
      expect(metrics.completedJobs).toBe(1);
    });
  });

  describe('User Job Filtering', () => {
    it('should return jobs for a specific user', () => {
      const userJob1 = { ...mockJob, id: 'user-job-1', userId: 'user-123' };
      const userJob2 = { ...mockJob, id: 'user-job-2', userId: 'user-123' };
      const otherUserJob = { ...mockJob, id: 'other-job', userId: 'user-456' };

      statusTracker.trackJob(userJob1);
      statusTracker.trackJob(userJob2);
      statusTracker.trackJob(otherUserJob);

      const user123Jobs = statusTracker.getUserJobs('user-123');
      expect(user123Jobs).toHaveLength(2);
      expect(user123Jobs.map(job => job.id)).toContain('user-job-1');
      expect(user123Jobs.map(job => job.id)).toContain('user-job-2');

      const user456Jobs = statusTracker.getUserJobs('user-456');
      expect(user456Jobs).toHaveLength(1);
      expect(user456Jobs[0].id).toBe('other-job');
    });

    it('should return active jobs', () => {
      const activeJob1 = { ...mockJob, id: 'active-1', status: 'processing' as const };
      const activeJob2 = { ...mockJob, id: 'active-2', status: 'queued' as const };
      const completedJob = { ...mockJob, id: 'completed', status: 'completed' as const };

      statusTracker.trackJob(activeJob1);
      statusTracker.trackJob(activeJob2);
      statusTracker.trackJob(completedJob);

      const activeJobs = statusTracker.getActiveJobs();
      expect(activeJobs).toHaveLength(2);
      expect(activeJobs.map(job => job.id)).toContain('active-1');
      expect(activeJobs.map(job => job.id)).toContain('active-2');
    });
  });

  describe('Subscriptions', () => {
    it('should allow subscriptions to job updates', (done) => {
      const callback = jest.fn((update) => {
        expect(update.jobId).toBe(mockJob.id);
        expect(update.newStatus).toBe('processing');
        done();
      });

      statusTracker.trackJob(mockJob);
      statusTracker.subscribe(mockJob.id, callback, ['job_started']);
      
      statusTracker.updateJobStatus(mockJob.id, 'processing');
    });

    it('should handle subscription cleanup', () => {
      const callback = jest.fn();
      
      statusTracker.trackJob(mockJob);
      statusTracker.subscribe(mockJob.id, callback);
      
      const unsubscribed = statusTracker.unsubscribe(mockJob.id);
      expect(unsubscribed).toBe(true);
      
      // Update should not trigger callback after unsubscribe
      statusTracker.updateJobStatus(mockJob.id, 'processing');
      expect(callback).not.toHaveBeenCalled();
    });

    it('should handle user-specific subscription cleanup', () => {
      const callback1 = jest.fn();
      const callback2 = jest.fn();
      
      statusTracker.trackJob(mockJob);
      statusTracker.subscribe(mockJob.id, callback1, ['job_progress'], 'user-123');
      statusTracker.subscribe(mockJob.id, callback2, ['job_progress'], 'user-456');
      
      // Unsubscribe user-123 only
      statusTracker.unsubscribe(mockJob.id, 'user-123');
      
      statusTracker.updateJobStatus(mockJob.id, 'processing');
      
      expect(callback1).not.toHaveBeenCalled();
      expect(callback2).toHaveBeenCalled();
    });
  });

  describe('Queue Metrics', () => {
    it('should calculate queue metrics correctly', () => {
      // Create jobs with different statuses
      const pendingJob = { ...mockJob, id: 'pending', status: 'pending' as const };
      const processingJob = { ...mockJob, id: 'processing', status: 'processing' as const };
      const completedJob = { ...mockJob, id: 'completed', status: 'completed' as const, completedAt: new Date() };
      const failedJob = { ...mockJob, id: 'failed', status: 'failed' as const };

      statusTracker.trackJob(pendingJob);
      statusTracker.trackJob(processingJob);
      statusTracker.trackJob(completedJob);
      statusTracker.trackJob(failedJob);

      const queueMetrics = statusTracker.getQueueMetrics();
      
      expect(queueMetrics.pending).toBe(1);
      expect(queueMetrics.processing).toBe(1);
      expect(queueMetrics.completed).toBe(1);
      expect(queueMetrics.failed).toBe(1);
      expect(queueMetrics.throughputPerHour).toBeGreaterThanOrEqual(0);
    });
  });

  describe('Health Checks', () => {
    it('should perform system health check', async () => {
      // Mock health check methods to avoid external dependencies
      jest.spyOn(statusTracker as any, 'checkNanoBananaApiHealth').mockResolvedValue({
        service: 'nanoBananaApi',
        status: 'healthy',
        lastCheckedAt: new Date(),
        responseTimeMs: 100
      });

      jest.spyOn(statusTracker as any, 'checkDatabaseHealth').mockResolvedValue({
        service: 'database',
        status: 'healthy',
        lastCheckedAt: new Date(),
        responseTimeMs: 50
      });

      jest.spyOn(statusTracker as any, 'checkStorageHealth').mockResolvedValue({
        service: 'storage',
        status: 'healthy',
        lastCheckedAt: new Date(),
        responseTimeMs: 75
      });

      jest.spyOn(statusTracker as any, 'checkCacheHealth').mockResolvedValue({
        service: 'cache',
        status: 'healthy',
        lastCheckedAt: new Date(),
        responseTimeMs: 25
      });

      jest.spyOn(statusTracker as any, 'checkQueueHealth').mockResolvedValue({
        service: 'queue',
        status: 'healthy',
        lastCheckedAt: new Date(),
        responseTimeMs: 30
      });

      const healthStatus = await statusTracker.performHealthCheck();
      
      expect(healthStatus.overall).toBe('healthy');
      expect(healthStatus.services.nanoBananaApi.status).toBe('healthy');
      expect(healthStatus.services.database.status).toBe('healthy');
      expect(healthStatus.services.storage.status).toBe('healthy');
      expect(healthStatus.services.cache.status).toBe('healthy');
      expect(healthStatus.services.queue.status).toBe('healthy');
    });

    it('should detect unhealthy services', async () => {
      // Mock one service as unhealthy
      jest.spyOn(statusTracker as any, 'checkNanoBananaApiHealth').mockResolvedValue({
        service: 'nanoBananaApi',
        status: 'unhealthy',
        lastCheckedAt: new Date(),
        responseTimeMs: 5000,
        error: 'Connection timeout'
      });

      // Mock other services as healthy
      ['checkDatabaseHealth', 'checkStorageHealth', 'checkCacheHealth', 'checkQueueHealth'].forEach(method => {
        jest.spyOn(statusTracker as any, method).mockResolvedValue({
          service: method.replace('check', '').replace('Health', '').toLowerCase(),
          status: 'healthy',
          lastCheckedAt: new Date(),
          responseTimeMs: 100
        });
      });

      const healthStatus = await statusTracker.performHealthCheck();
      
      expect(healthStatus.overall).toBe('unhealthy');
      expect(healthStatus.services.nanoBananaApi.status).toBe('unhealthy');
    });
  });

  describe('Cleanup', () => {
    it('should clean up old completed jobs', () => {
      // Create an old completed job
      const oldCompletedJob = {
        ...mockJob,
        id: 'old-completed',
        status: 'completed' as const,
        updatedAt: new Date(Date.now() - 100000) // 100 seconds ago
      };

      // Create a recent job
      const recentJob = {
        ...mockJob,
        id: 'recent',
        status: 'pending' as const,
        updatedAt: new Date()
      };

      statusTracker.trackJob(oldCompletedJob);
      statusTracker.trackJob(recentJob);

      // Clean up jobs older than 50 seconds
      const cleanedCount = statusTracker.cleanup(50000);
      
      expect(cleanedCount).toBe(1);
      expect(statusTracker.getJobStatus('old-completed')).toBeNull();
      expect(statusTracker.getJobStatus('recent')).toBeDefined();
    });

    it('should limit status history size', () => {
      statusTracker.trackJob(mockJob);
      
      // Generate more updates than max history
      for (let i = 0; i < 15; i++) {
        statusTracker.updateJobStatus(mockJob.id, i % 2 === 0 ? 'processing' : 'queued');
      }

      const history = statusTracker.getJobStatusHistory(mockJob.id);
      expect(history.length).toBeLessThanOrEqual(10); // maxStatusHistory from config
    });
  });

  describe('Batch Job Handling', () => {
    it('should handle batch generation jobs', () => {
      const batchJob: BatchGenerationJob = {
        id: 'batch-job-1',
        type: 'batch',
        status: 'pending',
        priority: 'normal',
        createdAt: new Date(),
        updatedAt: new Date(),
        batchId: 'batch-123',
        requests: [
          {
            id: 'single-1',
            type: 'single',
            status: 'pending',
            priority: 'normal',
            createdAt: new Date(),
            updatedAt: new Date(),
            prompt: 'Test prompt 1'
          },
          {
            id: 'single-2',
            type: 'single',
            status: 'pending',
            priority: 'normal',
            createdAt: new Date(),
            updatedAt: new Date(),
            prompt: 'Test prompt 2'
          }
        ],
        totalRequests: 2,
        completedRequests: 0,
        failedRequests: 0
      };

      statusTracker.trackJob(batchJob);
      
      const trackedJob = statusTracker.getJobStatus(batchJob.id) as BatchGenerationJob;
      expect(trackedJob.type).toBe('batch');
      expect(trackedJob.batchId).toBe('batch-123');
      expect(trackedJob.totalRequests).toBe(2);
    });
  });

  describe('Event Emission', () => {
    it('should emit appropriate events for status changes', (done) => {
      const events: string[] = [];
      
      statusTracker.on('job_created', () => events.push('job_created'));
      statusTracker.on('job_queued', () => events.push('job_queued'));
      statusTracker.on('job_started', () => events.push('job_started'));
      statusTracker.on('job_completed', () => {
        events.push('job_completed');
        
        // Verify event sequence
        expect(events).toContain('job_created');
        expect(events).toContain('job_queued');
        expect(events).toContain('job_started');
        expect(events).toContain('job_completed');
        done();
      });

      // Simulate job lifecycle
      statusTracker.trackJob(mockJob);
      statusTracker.updateJobStatus(mockJob.id, 'queued');
      statusTracker.updateJobStatus(mockJob.id, 'processing');
      statusTracker.updateJobStatus(mockJob.id, 'completed');
    });

    it('should emit stale job events', (done) => {
      statusTracker.on('job_stale', (event) => {
        expect(event.type).toBe('job_timeout');
        expect(event.jobId).toBe(mockJob.id);
        done();
      });

      // Create a job with old timestamp
      const staleJob = {
        ...mockJob,
        updatedAt: new Date(Date.now() - 10000) // 10 seconds ago, older than stale timeout
      };

      statusTracker.trackJob(staleJob);
      
      // Wait for periodic update to detect stale job
      setTimeout(() => {
        // Trigger periodic update manually for testing
        (statusTracker as any).performPeriodicUpdate();
      }, 150); // Wait longer than update interval
    });
  });

  describe('Error Handling', () => {
    it('should handle invalid job status updates gracefully', () => {
      // Try to update non-existent job
      const result = statusTracker.updateJobStatus('non-existent', 'completed');
      expect(result).toBe(false);
    });

    it('should handle subscription to non-existent jobs', () => {
      const callback = jest.fn();
      
      // Subscribe to non-existent job (should not throw)
      expect(() => {
        statusTracker.subscribe('non-existent', callback);
      }).not.toThrow();
    });
  });

  describe('Metrics Accuracy', () => {
    it('should maintain accurate job counts', () => {
      // Track multiple jobs
      statusTracker.trackJob({ ...mockJob, id: 'job-1' });
      statusTracker.trackJob({ ...mockJob, id: 'job-2' });
      statusTracker.trackJob({ ...mockJob, id: 'job-3' });

      let metrics = statusTracker.getMetrics();
      expect(metrics.totalJobs).toBe(3);
      expect(metrics.activeJobs).toBe(3);
      expect(metrics.completedJobs).toBe(0);

      // Complete one job
      statusTracker.updateJobStatus('job-1', 'completed');
      
      metrics = statusTracker.getMetrics();
      expect(metrics.totalJobs).toBe(3);
      expect(metrics.activeJobs).toBe(2);
      expect(metrics.completedJobs).toBe(1);

      // Fail one job
      statusTracker.updateJobStatus('job-2', 'failed');
      
      metrics = statusTracker.getMetrics();
      expect(metrics.activeJobs).toBe(1);
      expect(metrics.failedJobs).toBe(1);
    });

    it('should calculate average completion time', () => {
      const now = new Date();
      const job1 = {
        ...mockJob,
        id: 'job-1',
        createdAt: new Date(now.getTime() - 10000), // 10 seconds ago
        completedAt: new Date(now.getTime() - 5000)  // 5 seconds ago
      };

      statusTracker.trackJob(job1);
      statusTracker.updateJobStatus('job-1', 'completed');

      const metrics = statusTracker.getMetrics();
      expect(metrics.averageCompletionTimeMs).toBe(5000);
    });
  });
});

describe('StatusTracker Factory', () => {
  it('should create status tracker with custom config', () => {
    const customConfig = {
      updateIntervalMs: 2000,
      maxStatusHistory: 50,
      enableRealTimeUpdates: false
    };

    const tracker = createStatusTracker(customConfig);
    expect(tracker).toBeInstanceOf(StatusTracker);
    
    // Verify config is applied (would need to expose config for full verification)
    expect(tracker).toBeDefined();
    
    tracker.destroy();
  });

  it('should create status tracker with default config', () => {
    const tracker = createStatusTracker();
    expect(tracker).toBeInstanceOf(StatusTracker);
    tracker.destroy();
  });
});

describe('StatusTracker Integration', () => {
  it('should handle rapid status updates without race conditions', async () => {
    const tracker = createStatusTracker();
    tracker.trackJob(mockJob);

    // Rapid fire status updates
    const updates = [
      'queued' as const,
      'processing' as const,
      'completed' as const
    ];

    const promises = updates.map((status, index) => 
      new Promise<void>(resolve => {
        setTimeout(() => {
          tracker.updateJobStatus(mockJob.id, status);
          resolve();
        }, index * 10);
      })
    );

    await Promise.all(promises);

    const finalJob = tracker.getJobStatus(mockJob.id);
    expect(finalJob?.status).toBe('completed');

    const history = tracker.getJobStatusHistory(mockJob.id);
    expect(history.length).toBeGreaterThan(0);

    tracker.destroy();
  });

  it('should maintain performance with many concurrent jobs', () => {
    const tracker = createStatusTracker();
    const startTime = Date.now();

    // Track 1000 jobs
    for (let i = 0; i < 1000; i++) {
      tracker.trackJob({
        ...mockJob,
        id: `job-${i}`,
        userId: `user-${i % 100}` // 100 different users
      });
    }

    const trackingTime = Date.now() - startTime;
    expect(trackingTime).toBeLessThan(1000); // Should complete in under 1 second

    const metrics = tracker.getMetrics();
    expect(metrics.totalJobs).toBe(1000);

    tracker.destroy();
  });
});