/**
 * Generation Queue Service
 * Handles request queuing, prioritization, and job scheduling for generation system
 */

import { EventEmitter } from 'events';
import {
  GenerationJob,
  CharacterGenerationJob,
  BatchGenerationJob,
  SingleGenerationJob,
  JobStatus,
  JobPriority,
  JobType,
  QueueMetrics,
  QueueConfiguration,
  GenerationEvent,
  GenerationEventType,
  DEFAULT_GENERATION_CONFIG,
  isCharacterGenerationJob,
  isBatchGenerationJob,
  isSingleGenerationJob
} from '../types/generation';
import { GenerationJobModel, CreateJobData } from '../models/GenerationJob';
import { UserGenerationLimits } from '../types/generation';

export interface QueuedJobRequest {
  userId?: string;
  type: JobType;
  priority?: JobPriority;
  scheduledAt?: Date;
  data: any;
}

export interface QueueHealthStatus {
  isHealthy: boolean;
  queueSize: number;
  processingJobs: number;
  failedJobsLast24h: number;
  averageWaitTime: number;
  lastProcessedAt?: Date;
}

export class GenerationQueueService extends EventEmitter {
  private jobModel: GenerationJobModel;
  private config: QueueConfiguration;
  private isProcessing: boolean = false;
  private processingInterval?: NodeJS.Timer;
  private healthCheckInterval?: NodeJS.Timer;

  constructor(
    jobModel?: GenerationJobModel,
    config?: Partial<QueueConfiguration>
  ) {
    super();
    
    this.jobModel = jobModel || new GenerationJobModel();
    this.config = {
      ...DEFAULT_GENERATION_CONFIG.queue,
      ...config
    };

    this.startHealthCheckMonitoring();
  }

  /**
   * Add a job to the queue
   */
  async enqueue(request: QueuedJobRequest): Promise<string> {
    // Validate request
    await this.validateRequest(request);

    // Check queue capacity
    const metrics = await this.getMetrics();
    if (metrics.pending >= this.config.maxQueueSize) {
      throw new Error('Queue is full. Please try again later.');
    }

    // Create job data
    const jobData: CreateJobData = {
      userId: request.userId,
      type: request.type,
      priority: request.priority || 'normal',
      scheduledAt: request.scheduledAt,
      data: request.data
    };

    // Create the job
    const job = await this.jobModel.create(jobData);

    // Emit event
    this.emitEvent('job_created', job);

    // If scheduled for later, mark as queued; otherwise mark as pending for immediate processing
    if (request.scheduledAt && request.scheduledAt > new Date()) {
      await this.jobModel.update(job.id, { status: 'queued' });
      this.emitEvent('job_queued', job);
    } else {
      this.emitEvent('job_queued', job);
    }

    return job.id;
  }

  /**
   * Get job by ID
   */
  async getJob(jobId: string): Promise<GenerationJob | null> {
    return this.jobModel.findById(jobId);
  }

  /**
   * Get jobs for a user
   */
  async getUserJobs(
    userId: string,
    options: {
      status?: JobStatus | JobStatus[];
      limit?: number;
      offset?: number;
    } = {}
  ): Promise<GenerationJob[]> {
    return this.jobModel.find({
      userId,
      ...options
    });
  }

  /**
   * Cancel a job
   */
  async cancelJob(jobId: string, userId?: string): Promise<boolean> {
    const job = await this.jobModel.findById(jobId);
    
    if (!job) {
      throw new Error('Job not found');
    }

    if (userId && job.userId !== userId) {
      throw new Error('Unauthorized to cancel this job');
    }

    if (!['pending', 'queued'].includes(job.status)) {
      throw new Error('Job cannot be cancelled in its current state');
    }

    const updatedJob = await this.jobModel.update(jobId, {
      status: 'cancelled',
      completedAt: new Date()
    });

    if (updatedJob) {
      this.emitEvent('job_cancelled', updatedJob);
    }

    return !!updatedJob;
  }

  /**
   * Update job status and progress
   */
  async updateJob(
    jobId: string,
    updates: {
      status?: JobStatus;
      progress?: any;
      error?: any;
      results?: any[];
    }
  ): Promise<GenerationJob | null> {
    const updateData: any = {};

    if (updates.status) {
      updateData.status = updates.status;
      
      if (updates.status === 'completed') {
        updateData.completedAt = new Date();
      }
    }

    if (updates.progress) {
      updateData.progress = updates.progress;
    }

    if (updates.error) {
      updateData.error = updates.error;
    }

    if (updates.results) {
      updateData.results = updates.results;
    }

    const updatedJob = await this.jobModel.update(jobId, updateData);

    if (updatedJob) {
      // Emit appropriate event based on status
      switch (updates.status) {
        case 'processing':
          this.emitEvent('job_started', updatedJob);
          break;
        case 'completed':
          this.emitEvent('job_completed', updatedJob);
          break;
        case 'failed':
          this.emitEvent('job_failed', updatedJob);
          break;
      }

      if (updates.progress) {
        this.emitEvent('job_progress', updatedJob);
      }
    }

    return updatedJob;
  }

  /**
   * Get next jobs to process
   */
  async getNextJobs(limit: number = 4): Promise<GenerationJob[]> {
    // First, check for scheduled jobs that are ready
    const scheduledJobs = await this.jobModel.getScheduledJobs();
    
    // Mark scheduled jobs as pending
    for (const job of scheduledJobs) {
      await this.jobModel.update(job.id, { status: 'pending' });
    }

    // Get pending jobs by priority
    return this.jobModel.getNextPendingJobs(limit);
  }

  /**
   * Get queue metrics
   */
  async getMetrics(): Promise<QueueMetrics> {
    return this.jobModel.getQueueMetrics();
  }

  /**
   * Get queue health status
   */
  async getHealthStatus(): Promise<QueueHealthStatus> {
    const metrics = await this.getMetrics();
    const processingJobs = await this.jobModel.find({
      status: 'processing',
      limit: 100
    });

    const staleJobs = await this.jobModel.getProcessingJobs(30); // 30 minutes

    return {
      isHealthy: staleJobs.length === 0 && metrics.failed < 10,
      queueSize: metrics.pending,
      processingJobs: metrics.processing,
      failedJobsLast24h: metrics.failed,
      averageWaitTime: metrics.averageWaitTimeMs,
      lastProcessedAt: processingJobs.length > 0 
        ? new Date(Math.max(...processingJobs.map(j => j.updatedAt.getTime())))
        : undefined
    };
  }

  /**
   * Process stale jobs (jobs stuck in processing state)
   */
  async processStaleJobs(): Promise<number> {
    const staleJobs = await this.jobModel.getProcessingJobs(30); // 30 minutes
    let processedCount = 0;

    for (const job of staleJobs) {
      try {
        await this.jobModel.update(job.id, {
          status: 'failed',
          error: {
            code: 'TIMEOUT',
            message: 'Job timed out after 30 minutes',
            retryable: true,
            retryCount: 0
          },
          completedAt: new Date()
        });

        this.emitEvent('job_timeout', job);
        processedCount++;
      } catch (error) {
        console.error(`Failed to mark stale job ${job.id} as failed:`, error);
      }
    }

    return processedCount;
  }

  /**
   * Cleanup completed jobs
   */
  async cleanup(daysOld: number = 7): Promise<number> {
    return this.jobModel.cleanupCompletedJobs(daysOld);
  }

  /**
   * Start processing jobs (for queue worker integration)
   */
  startProcessing(intervalMs: number = 5000): void {
    if (this.isProcessing) {
      return;
    }

    this.isProcessing = true;
    this.processingInterval = setInterval(async () => {
      try {
        await this.processStaleJobs();
      } catch (error) {
        console.error('Error processing stale jobs:', error);
      }
    }, intervalMs);
  }

  /**
   * Stop processing
   */
  stopProcessing(): void {
    if (this.processingInterval) {
      clearInterval(this.processingInterval);
      this.processingInterval = undefined;
    }
    this.isProcessing = false;
  }

  /**
   * Initialize the queue service
   */
  async initialize(): Promise<void> {
    try {
      // Initialize the database table
      await this.jobModel.initializeTable();
      
      // Start background processing
      this.startProcessing();
      
      console.log('Generation Queue Service initialized successfully');
    } catch (error) {
      console.error('Failed to initialize Generation Queue Service:', error);
      throw error;
    }
  }

  /**
   * Shutdown the queue service
   */
  async shutdown(): Promise<void> {
    this.stopProcessing();
    
    if (this.healthCheckInterval) {
      clearInterval(this.healthCheckInterval);
    }
    
    this.removeAllListeners();
  }

  /**
   * Validate job request
   */
  private async validateRequest(request: QueuedJobRequest): Promise<void> {
    if (!request.type) {
      throw new Error('Job type is required');
    }

    if (!['character', 'batch', 'single'].includes(request.type)) {
      throw new Error('Invalid job type');
    }

    if (!request.data) {
      throw new Error('Job data is required');
    }

    // Type-specific validation
    switch (request.type) {
      case 'character':
        if (!request.data.characterSpecs) {
          throw new Error('Character specifications are required');
        }
        break;
      
      case 'batch':
        if (!request.data.requests || !Array.isArray(request.data.requests)) {
          throw new Error('Batch requests array is required');
        }
        if (request.data.requests.length === 0) {
          throw new Error('Batch must contain at least one request');
        }
        if (request.data.requests.length > 4) {
          throw new Error('Batch cannot exceed 4 requests');
        }
        break;
      
      case 'single':
        if (!request.data.prompt) {
          throw new Error('Prompt is required for single generation');
        }
        break;
    }

    // User quota validation (if userId provided)
    if (request.userId) {
      await this.validateUserLimits(request.userId);
    }
  }

  /**
   * Validate user limits (simplified for now)
   */
  private async validateUserLimits(userId: string): Promise<void> {
    // Get user's active jobs
    const activeJobs = await this.jobModel.find({
      userId,
      status: ['pending', 'queued', 'processing'],
      limit: 100
    });

    // Basic concurrent job limit (would be more sophisticated in production)
    if (activeJobs.length >= 10) {
      throw new Error('User has too many active jobs');
    }
  }

  /**
   * Emit generation event
   */
  private emitEvent(type: GenerationEventType, job: GenerationJob): void {
    const event: GenerationEvent = {
      type,
      jobId: job.id,
      batchId: isBatchGenerationJob(job) ? job.batchId : undefined,
      userId: job.userId,
      timestamp: new Date(),
      data: { job }
    };

    this.emit('generationEvent', event);
    this.emit(type, event);
  }

  /**
   * Start health check monitoring
   */
  private startHealthCheckMonitoring(): void {
    this.healthCheckInterval = setInterval(async () => {
      try {
        const health = await this.getHealthStatus();
        
        if (!health.isHealthy) {
          console.warn('Queue health check failed:', health);
          this.emit('healthWarning', health);
        }
      } catch (error) {
        console.error('Health check failed:', error);
      }
    }, 60000); // Every minute
  }
}

export default new GenerationQueueService();