/**
 * Queue Worker
 * Background worker for processing generation jobs from the queue
 */

import { EventEmitter } from 'events';
import {
  GenerationJob,
  GenerationEvent,
  QueueMetrics,
  DEFAULT_GENERATION_CONFIG
} from '../types/generation';
import { GenerationQueueService } from '../services/generationQueue';
import { BatchProcessorService } from '../services/batchProcessor';

export interface WorkerConfig {
  concurrency?: number;
  pollIntervalMs?: number;
  maxRetries?: number;
  retryDelayMs?: number;
  healthCheckIntervalMs?: number;
  staleJobThresholdMs?: number;
}

export interface WorkerMetrics {
  processed: number;
  successful: number;
  failed: number;
  retried: number;
  averageProcessingTime: number;
  uptime: number;
  lastProcessedAt?: Date;
  currentLoad: number;
  queueHealth: {
    pending: number;
    processing: number;
    stale: number;
  };
}

export interface WorkerHealth {
  status: 'healthy' | 'degraded' | 'unhealthy';
  activeJobs: number;
  queueSize: number;
  errorRate: number;
  lastError?: string;
  lastErrorAt?: Date;
}

export class QueueWorker extends EventEmitter {
  private queueService: GenerationQueueService;
  private batchProcessor: BatchProcessorService;
  private config: Required<WorkerConfig>;
  private isRunning: boolean = false;
  private isShuttingDown: boolean = false;
  private activeJobs: Map<string, { job: GenerationJob; startedAt: Date }> = new Map();
  private pollTimer?: NodeJS.Timer;
  private healthCheckTimer?: NodeJS.Timer;
  private startTime: Date = new Date();
  private metrics: WorkerMetrics;
  private lastError?: { message: string; timestamp: Date };

  constructor(
    queueService?: GenerationQueueService,
    batchProcessor?: BatchProcessorService,
    config?: WorkerConfig
  ) {
    super();
    
    this.queueService = queueService || new GenerationQueueService();
    this.batchProcessor = batchProcessor || new BatchProcessorService();
    this.config = {
      concurrency: 4,
      pollIntervalMs: 5000,
      maxRetries: 3,
      retryDelayMs: 10000,
      healthCheckIntervalMs: 30000,
      staleJobThresholdMs: 300000, // 5 minutes
      ...config
    };

    this.metrics = {
      processed: 0,
      successful: 0,
      failed: 0,
      retried: 0,
      averageProcessingTime: 0,
      uptime: 0,
      currentLoad: 0,
      queueHealth: {
        pending: 0,
        processing: 0,
        stale: 0
      }
    };

    this.setupEventListeners();
  }

  /**
   * Start the queue worker
   */
  async start(): Promise<void> {
    if (this.isRunning) {
      console.warn('Queue worker is already running');
      return;
    }

    console.log('Starting queue worker...');
    this.isRunning = true;
    this.isShuttingDown = false;
    this.startTime = new Date();

    // Initialize services
    try {
      await this.queueService.initialize();
      console.log('Queue service initialized');
    } catch (error) {
      console.error('Failed to initialize queue service:', error);
      throw error;
    }

    // Start polling for jobs
    this.startPolling();

    // Start health checks
    this.startHealthChecks();

    this.emit('workerStarted', { timestamp: new Date() });
    console.log(`Queue worker started with concurrency: ${this.config.concurrency}`);
  }

  /**
   * Stop the queue worker
   */
  async stop(): Promise<void> {
    if (!this.isRunning) {
      console.warn('Queue worker is not running');
      return;
    }

    console.log('Stopping queue worker...');
    this.isShuttingDown = true;

    // Stop polling
    if (this.pollTimer) {
      clearTimeout(this.pollTimer);
      this.pollTimer = undefined;
    }

    // Stop health checks
    if (this.healthCheckTimer) {
      clearInterval(this.healthCheckTimer);
      this.healthCheckTimer = undefined;
    }

    // Wait for active jobs to complete (with timeout)
    const shutdownTimeout = 30000; // 30 seconds
    const shutdownStart = Date.now();

    while (this.activeJobs.size > 0 && (Date.now() - shutdownStart) < shutdownTimeout) {
      console.log(`Waiting for ${this.activeJobs.size} active jobs to complete...`);
      await new Promise(resolve => setTimeout(resolve, 1000));
    }

    // Force stop remaining jobs if timeout exceeded
    if (this.activeJobs.size > 0) {
      console.warn(`Force stopping ${this.activeJobs.size} remaining jobs`);
      for (const [jobId] of this.activeJobs) {
        await this.handleJobFailure(jobId, new Error('Worker shutdown timeout'));
      }
    }

    // Shutdown services
    await this.queueService.shutdown();
    await this.batchProcessor.shutdown();

    this.isRunning = false;
    this.emit('workerStopped', { timestamp: new Date() });
    console.log('Queue worker stopped');
  }

  /**
   * Get worker status
   */
  getStatus(): {
    isRunning: boolean;
    activeJobs: number;
    metrics: WorkerMetrics;
    health: WorkerHealth;
  } {
    const now = Date.now();
    const uptime = now - this.startTime.getTime();
    
    const health = this.calculateHealth();
    
    return {
      isRunning: this.isRunning,
      activeJobs: this.activeJobs.size,
      metrics: {
        ...this.metrics,
        uptime: Math.round(uptime / 1000), // seconds
        currentLoad: this.activeJobs.size / this.config.concurrency
      },
      health
    };
  }

  /**
   * Process available jobs
   */
  private async processJobs(): Promise<void> {
    if (this.isShuttingDown || this.activeJobs.size >= this.config.concurrency) {
      return;
    }

    try {
      const availableSlots = this.config.concurrency - this.activeJobs.size;
      const jobs = await this.queueService.getNextJobs(availableSlots);

      if (jobs.length === 0) {
        return;
      }

      console.log(`Processing ${jobs.length} jobs (${this.activeJobs.size}/${this.config.concurrency} slots used)`);

      // Process each job concurrently
      const processingPromises = jobs.map(job => this.processJob(job));
      
      // Don't await all - let them run in background
      Promise.allSettled(processingPromises).then(results => {
        const succeeded = results.filter(r => r.status === 'fulfilled').length;
        const failed = results.filter(r => r.status === 'rejected').length;
        
        if (failed > 0) {
          console.warn(`Batch processing completed: ${succeeded} succeeded, ${failed} failed`);
        }
      });

    } catch (error) {
      console.error('Error processing jobs:', error);
      this.recordError(error);
    }
  }

  /**
   * Process a single job
   */
  private async processJob(job: GenerationJob): Promise<void> {
    const jobId = job.id;
    const startTime = new Date();
    
    // Track active job
    this.activeJobs.set(jobId, { job, startedAt: startTime });
    
    // Update job status to processing
    await this.queueService.updateJob(jobId, { status: 'processing' });

    this.emit('jobStarted', { jobId, job, timestamp: startTime });

    try {
      // Process the job using batch processor
      const result = await this.batchProcessor.processJob(job);
      
      // Calculate processing time
      const processingTime = Date.now() - startTime.getTime();
      this.updateProcessingMetrics(processingTime, true);
      
      this.emit('jobCompleted', { 
        jobId, 
        job, 
        result, 
        processingTimeMs: processingTime,
        timestamp: new Date() 
      });

    } catch (error) {
      await this.handleJobFailure(jobId, error);
      
    } finally {
      // Remove from active jobs
      this.activeJobs.delete(jobId);
    }
  }

  /**
   * Handle job failure with retry logic
   */
  private async handleJobFailure(jobId: string, error: any): Promise<void> {
    const activeJob = this.activeJobs.get(jobId);
    if (!activeJob) return;

    const { job } = activeJob;
    const processingTime = Date.now() - activeJob.startedAt.getTime();
    
    // Update metrics
    this.updateProcessingMetrics(processingTime, false);
    this.recordError(error);

    // Check if job should be retried
    const currentRetries = (job.error?.retryCount || 0);
    const shouldRetry = currentRetries < this.config.maxRetries && 
                       this.isRetryableError(error);

    if (shouldRetry) {
      console.log(`Retrying job ${jobId} (attempt ${currentRetries + 1}/${this.config.maxRetries})`);
      
      // Update job for retry
      await this.queueService.updateJob(jobId, {
        status: 'pending',
        error: {
          code: error.name || 'UNKNOWN_ERROR',
          message: error.message || 'Unknown error',
          retryable: true,
          retryCount: currentRetries + 1,
          lastRetryAt: new Date(),
          originalError: error
        }
      });

      this.metrics.retried++;
      this.emit('jobRetried', { jobId, job, error, retryCount: currentRetries + 1 });

      // Schedule retry after delay
      setTimeout(() => {
        this.processJobs();
      }, this.config.retryDelayMs);

    } else {
      console.error(`Job ${jobId} failed permanently:`, error);
      
      // Mark job as permanently failed
      await this.queueService.updateJob(jobId, {
        status: 'failed',
        error: {
          code: error.name || 'UNKNOWN_ERROR',
          message: error.message || 'Unknown error',
          retryable: false,
          retryCount: currentRetries,
          originalError: error
        }
      });

      this.emit('jobFailed', { jobId, job, error, timestamp: new Date() });
    }
  }

  /**
   * Start polling for jobs
   */
  private startPolling(): void {
    const poll = async () => {
      if (this.isShuttingDown) return;

      try {
        await this.processJobs();
      } catch (error) {
        console.error('Polling error:', error);
      }

      // Schedule next poll
      this.pollTimer = setTimeout(poll, this.config.pollIntervalMs);
    };

    // Start polling
    poll();
  }

  /**
   * Start health checks
   */
  private startHealthChecks(): void {
    this.healthCheckTimer = setInterval(async () => {
      try {
        await this.performHealthCheck();
      } catch (error) {
        console.error('Health check error:', error);
      }
    }, this.config.healthCheckIntervalMs);
  }

  /**
   * Perform health check
   */
  private async performHealthCheck(): Promise<void> {
    // Check for stale jobs
    const staleJobs = await this.getStaleJobs();
    
    if (staleJobs.length > 0) {
      console.warn(`Found ${staleJobs.length} stale jobs`);
      
      for (const jobId of staleJobs) {
        await this.handleJobFailure(jobId, new Error('Job timeout - exceeded processing threshold'));
      }
    }

    // Update queue health metrics
    const queueMetrics = await this.queueService.getMetrics();
    this.metrics.queueHealth = {
      pending: queueMetrics.pending,
      processing: queueMetrics.processing,
      stale: staleJobs.length
    };

    // Emit health status
    const health = this.calculateHealth();
    this.emit('healthCheck', { health, metrics: this.metrics, timestamp: new Date() });
  }

  /**
   * Get stale job IDs
   */
  private getStaleJobs(): string[] {
    const threshold = Date.now() - this.config.staleJobThresholdMs;
    const staleJobs: string[] = [];

    for (const [jobId, { startedAt }] of this.activeJobs) {
      if (startedAt.getTime() < threshold) {
        staleJobs.push(jobId);
      }
    }

    return staleJobs;
  }

  /**
   * Calculate worker health
   */
  private calculateHealth(): WorkerHealth {
    const errorRate = this.metrics.processed > 0 
      ? (this.metrics.failed / this.metrics.processed) * 100 
      : 0;

    let status: 'healthy' | 'degraded' | 'unhealthy' = 'healthy';
    
    if (errorRate > 50 || this.activeJobs.size === 0 && this.metrics.queueHealth.pending > 0) {
      status = 'unhealthy';
    } else if (errorRate > 20 || this.metrics.currentLoad > 0.8) {
      status = 'degraded';
    }

    return {
      status,
      activeJobs: this.activeJobs.size,
      queueSize: this.metrics.queueHealth.pending,
      errorRate,
      lastError: this.lastError?.message,
      lastErrorAt: this.lastError?.timestamp
    };
  }

  /**
   * Update processing metrics
   */
  private updateProcessingMetrics(processingTimeMs: number, successful: boolean): void {
    this.metrics.processed++;
    
    if (successful) {
      this.metrics.successful++;
    } else {
      this.metrics.failed++;
    }

    // Update average processing time
    const totalTime = this.metrics.averageProcessingTime * (this.metrics.processed - 1) + processingTimeMs;
    this.metrics.averageProcessingTime = Math.round(totalTime / this.metrics.processed);
    
    this.metrics.lastProcessedAt = new Date();
  }

  /**
   * Record error for health monitoring
   */
  private recordError(error: any): void {
    this.lastError = {
      message: error.message || error.toString(),
      timestamp: new Date()
    };
  }

  /**
   * Check if error is retryable
   */
  private isRetryableError(error: any): boolean {
    const retryableCodes = [
      'RATE_LIMITED',
      'TIMEOUT',
      'NETWORK_ERROR',
      'SERVER_ERROR',
      'SERVICE_UNAVAILABLE',
      'ECONNRESET',
      'ETIMEDOUT'
    ];

    const errorCode = error.code || error.name || '';
    return retryableCodes.some(code => errorCode.includes(code));
  }

  /**
   * Setup event listeners
   */
  private setupEventListeners(): void {
    // Forward queue service events
    this.queueService.on('generationEvent', (event: GenerationEvent) => {
      this.emit('queueEvent', event);
    });

    // Forward batch processor events
    this.batchProcessor.on('batchCompleted', (result) => {
      this.emit('batchCompleted', result);
    });

    this.batchProcessor.on('batchFailed', (result) => {
      this.emit('batchFailed', result);
    });

    // Handle uncaught errors
    process.on('uncaughtException', (error) => {
      console.error('Uncaught exception in queue worker:', error);
      this.recordError(error);
      this.emit('uncaughtError', error);
    });

    process.on('unhandledRejection', (reason) => {
      console.error('Unhandled rejection in queue worker:', reason);
      this.recordError(reason);
      this.emit('unhandledRejection', reason);
    });
  }
}

export default new QueueWorker();