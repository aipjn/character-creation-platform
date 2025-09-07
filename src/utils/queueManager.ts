/**
 * Queue Manager Utility
 * High-level queue lifecycle management and coordination
 */

import { EventEmitter } from 'events';
import {
  GenerationJob,
  QueueMetrics,
  QueueConfiguration,
  GenerationEvent,
  JobStatus,
  JobType,
  DEFAULT_GENERATION_CONFIG,
  SystemHealthStatus,
  HealthCheckResult
} from '../types/generation';
import { GenerationQueueService, QueueHealthStatus } from '../services/generationQueue';
import { BatchProcessorService } from '../services/batchProcessor';
import { QueueWorker, WorkerHealth, WorkerMetrics } from '../workers/queueWorker';

export interface QueueManagerConfig {
  workers: {
    count: number;
    concurrency: number;
    pollIntervalMs?: number;
    maxRetries?: number;
  };
  queue: Partial<QueueConfiguration>;
  healthCheck: {
    intervalMs: number;
    enabled: boolean;
  };
  cleanup: {
    enabled: boolean;
    intervalHours: number;
    retentionDays: number;
  };
  monitoring: {
    metricsIntervalMs: number;
    alertThresholds: {
      queueSize: number;
      errorRate: number;
      processingTime: number;
    };
  };
}

export interface SystemMetrics {
  queue: QueueMetrics;
  workers: WorkerMetrics[];
  processing: {
    activeBatches: number;
    totalProcessed: number;
    successRate: number;
    averageProcessingTime: number;
  };
  health: {
    overall: 'healthy' | 'degraded' | 'unhealthy';
    queue: QueueHealthStatus;
    workers: WorkerHealth[];
  };
  uptime: number;
  lastUpdated: Date;
}

export interface AlertEvent {
  level: 'warning' | 'error' | 'critical';
  type: 'queue_full' | 'high_error_rate' | 'slow_processing' | 'worker_unhealthy';
  message: string;
  data: any;
  timestamp: Date;
}

export class QueueManagerService extends EventEmitter {
  private config: QueueManagerConfig;
  private queueService: GenerationQueueService;
  private batchProcessor: BatchProcessorService;
  private workers: QueueWorker[] = [];
  private isStarted: boolean = false;
  private startTime: Date = new Date();
  
  // Monitoring intervals
  private healthCheckInterval?: NodeJS.Timer;
  private cleanupInterval?: NodeJS.Timer;
  private metricsInterval?: NodeJS.Timer;
  
  // State tracking
  private lastMetrics?: SystemMetrics;
  private alertHistory: AlertEvent[] = [];

  constructor(
    config?: Partial<QueueManagerConfig>,
    queueService?: GenerationQueueService,
    batchProcessor?: BatchProcessorService
  ) {
    super();
    
    this.config = {
      workers: {
        count: 2,
        concurrency: 4,
        pollIntervalMs: 5000,
        maxRetries: 3,
        ...config?.workers
      },
      queue: {
        ...DEFAULT_GENERATION_CONFIG.queue,
        ...config?.queue
      },
      healthCheck: {
        intervalMs: 30000,
        enabled: true,
        ...config?.healthCheck
      },
      cleanup: {
        enabled: true,
        intervalHours: 24,
        retentionDays: 7,
        ...config?.cleanup
      },
      monitoring: {
        metricsIntervalMs: 60000,
        alertThresholds: {
          queueSize: 50,
          errorRate: 10,
          processingTime: 300000 // 5 minutes
        },
        ...config?.monitoring
      }
    };

    this.queueService = queueService || new GenerationQueueService(undefined, this.config.queue);
    this.batchProcessor = batchProcessor || new BatchProcessorService();
    
    this.setupEventListeners();
  }

  /**
   * Start the queue management system
   */
  async start(): Promise<void> {
    if (this.isStarted) {
      console.warn('Queue manager is already started');
      return;
    }

    console.log('Starting queue management system...');
    this.startTime = new Date();

    try {
      // Initialize services
      await this.queueService.initialize();
      console.log('Queue service initialized');

      // Create and start workers
      await this.startWorkers();
      console.log(`Started ${this.workers.length} queue workers`);

      // Start monitoring
      if (this.config.healthCheck.enabled) {
        this.startHealthChecks();
        console.log('Health monitoring started');
      }

      if (this.config.cleanup.enabled) {
        this.startCleanupScheduler();
        console.log('Cleanup scheduler started');
      }

      this.startMetricsCollection();
      console.log('Metrics collection started');

      this.isStarted = true;
      this.emit('systemStarted', { timestamp: new Date() });
      
      console.log('Queue management system started successfully');
      
    } catch (error) {
      console.error('Failed to start queue management system:', error);
      await this.stop(); // Cleanup on failure
      throw error;
    }
  }

  /**
   * Stop the queue management system
   */
  async stop(): Promise<void> {
    if (!this.isStarted) {
      console.warn('Queue manager is not started');
      return;
    }

    console.log('Stopping queue management system...');

    // Stop monitoring
    this.stopMonitoring();

    // Stop workers
    await this.stopWorkers();

    // Shutdown services
    await this.queueService.shutdown();
    await this.batchProcessor.shutdown();

    this.isStarted = false;
    this.emit('systemStopped', { timestamp: new Date() });
    
    console.log('Queue management system stopped');
  }

  /**
   * Get comprehensive system metrics
   */
  async getSystemMetrics(): Promise<SystemMetrics> {
    const queueMetrics = await this.queueService.getMetrics();
    const queueHealth = await this.queueService.getHealthStatus();
    
    const workerMetrics = this.workers.map(worker => worker.getStatus().metrics);
    const workerHealths = this.workers.map(worker => worker.getStatus().health);
    
    const activeBatches = this.batchProcessor.getActiveBatchCount();
    const totalProcessed = workerMetrics.reduce((sum, m) => sum + m.processed, 0);
    const totalSuccessful = workerMetrics.reduce((sum, m) => sum + m.successful, 0);
    const successRate = totalProcessed > 0 ? (totalSuccessful / totalProcessed) * 100 : 100;
    
    const avgProcessingTime = workerMetrics.length > 0
      ? workerMetrics.reduce((sum, m) => sum + m.averageProcessingTime, 0) / workerMetrics.length
      : 0;

    // Determine overall health
    let overallHealth: 'healthy' | 'degraded' | 'unhealthy' = 'healthy';
    const unhealthyWorkers = workerHealths.filter(h => h.status === 'unhealthy').length;
    const degradedWorkers = workerHealths.filter(h => h.status === 'degraded').length;
    
    if (unhealthyWorkers > 0 || !queueHealth.isHealthy) {
      overallHealth = 'unhealthy';
    } else if (degradedWorkers > 0 || queueHealth.queueSize > this.config.monitoring.alertThresholds.queueSize) {
      overallHealth = 'degraded';
    }

    const metrics: SystemMetrics = {
      queue: queueMetrics,
      workers: workerMetrics,
      processing: {
        activeBatches,
        totalProcessed,
        successRate,
        averageProcessingTime: avgProcessingTime
      },
      health: {
        overall: overallHealth,
        queue: queueHealth,
        workers: workerHealths
      },
      uptime: Math.round((Date.now() - this.startTime.getTime()) / 1000),
      lastUpdated: new Date()
    };

    this.lastMetrics = metrics;
    return metrics;
  }

  /**
   * Get system health status
   */
  async getSystemHealth(): Promise<SystemHealthStatus> {
    const metrics = await this.getSystemMetrics();
    
    const queueHealthResult: HealthCheckResult = {
      service: 'queue',
      status: metrics.health.queue.isHealthy ? 'healthy' : 'unhealthy',
      lastCheckedAt: new Date(),
      responseTimeMs: 0, // Would measure actual response time in production
      error: !metrics.health.queue.isHealthy ? 'Queue health check failed' : undefined
    };

    const workerHealthResults = metrics.health.workers.map((health, index): HealthCheckResult => ({
      service: `worker-${index}`,
      status: health.status === 'healthy' ? 'healthy' : 
              health.status === 'degraded' ? 'degraded' : 'unhealthy',
      lastCheckedAt: new Date(),
      responseTimeMs: 0,
      error: health.lastError,
      details: {
        activeJobs: health.activeJobs,
        queueSize: health.queueSize,
        errorRate: health.errorRate
      }
    }));

    return {
      overall: metrics.health.overall,
      services: {
        nanoBananaApi: {
          service: 'nanoBananaApi',
          status: 'healthy', // Would check actual API health
          lastCheckedAt: new Date(),
          responseTimeMs: 0
        },
        database: {
          service: 'database',
          status: 'healthy', // Would check database health
          lastCheckedAt: new Date(),
          responseTimeMs: 0
        },
        storage: {
          service: 'storage',
          status: 'healthy', // Would check storage health
          lastCheckedAt: new Date(),
          responseTimeMs: 0
        },
        cache: {
          service: 'cache',
          status: 'healthy', // Would check cache health
          lastCheckedAt: new Date(),
          responseTimeMs: 0
        },
        queue: queueHealthResult
      },
      checkedAt: new Date()
    };
  }

  /**
   * Queue a new job
   */
  async queueJob(request: {
    userId?: string;
    type: JobType;
    priority?: 'low' | 'normal' | 'high' | 'urgent';
    scheduledAt?: Date;
    data: any;
  }): Promise<string> {
    return this.queueService.enqueue(request);
  }

  /**
   * Get job status
   */
  async getJobStatus(jobId: string): Promise<GenerationJob | null> {
    return this.queueService.getJob(jobId);
  }

  /**
   * Cancel a job
   */
  async cancelJob(jobId: string, userId?: string): Promise<boolean> {
    return this.queueService.cancelJob(jobId, userId);
  }

  /**
   * Get user's jobs
   */
  async getUserJobs(userId: string, options?: {
    status?: JobStatus | JobStatus[];
    limit?: number;
    offset?: number;
  }): Promise<GenerationJob[]> {
    return this.queueService.getUserJobs(userId, options);
  }

  /**
   * Pause job processing
   */
  async pauseProcessing(): Promise<void> {
    for (const worker of this.workers) {
      await worker.stop();
    }
    this.emit('processingPaused', { timestamp: new Date() });
  }

  /**
   * Resume job processing
   */
  async resumeProcessing(): Promise<void> {
    for (const worker of this.workers) {
      await worker.start();
    }
    this.emit('processingResumed', { timestamp: new Date() });
  }

  /**
   * Scale workers up or down
   */
  async scaleWorkers(targetCount: number): Promise<void> {
    const currentCount = this.workers.length;
    
    if (targetCount === currentCount) {
      return;
    }

    if (targetCount > currentCount) {
      // Scale up
      const newWorkers = targetCount - currentCount;
      for (let i = 0; i < newWorkers; i++) {
        await this.addWorker();
      }
      console.log(`Scaled up: added ${newWorkers} workers (total: ${this.workers.length})`);
      
    } else {
      // Scale down
      const workersToRemove = currentCount - targetCount;
      for (let i = 0; i < workersToRemove; i++) {
        await this.removeWorker();
      }
      console.log(`Scaled down: removed ${workersToRemove} workers (total: ${this.workers.length})`);
    }

    this.config.workers.count = targetCount;
    this.emit('workersScaled', { 
      previousCount: currentCount, 
      newCount: targetCount, 
      timestamp: new Date() 
    });
  }

  /**
   * Manual cleanup of old jobs
   */
  async cleanupJobs(daysOld: number = this.config.cleanup.retentionDays): Promise<number> {
    return this.queueService.cleanup(daysOld);
  }

  /**
   * Get recent alerts
   */
  getRecentAlerts(hours: number = 24): AlertEvent[] {
    const threshold = new Date(Date.now() - (hours * 60 * 60 * 1000));
    return this.alertHistory.filter(alert => alert.timestamp >= threshold);
  }

  /**
   * Start queue workers
   */
  private async startWorkers(): Promise<void> {
    const promises = [];
    
    for (let i = 0; i < this.config.workers.count; i++) {
      promises.push(this.addWorker());
    }

    await Promise.all(promises);
  }

  /**
   * Stop all workers
   */
  private async stopWorkers(): Promise<void> {
    const promises = this.workers.map(worker => worker.stop());
    await Promise.all(promises);
    this.workers = [];
  }

  /**
   * Add a new worker
   */
  private async addWorker(): Promise<void> {
    const worker = new QueueWorker(
      this.queueService,
      this.batchProcessor,
      {
        concurrency: this.config.workers.concurrency,
        pollIntervalMs: this.config.workers.pollIntervalMs,
        maxRetries: this.config.workers.maxRetries
      }
    );

    // Setup worker event forwarding
    worker.on('jobStarted', (event) => this.emit('jobStarted', event));
    worker.on('jobCompleted', (event) => this.emit('jobCompleted', event));
    worker.on('jobFailed', (event) => this.emit('jobFailed', event));
    worker.on('jobRetried', (event) => this.emit('jobRetried', event));
    worker.on('healthCheck', (event) => this.emit('workerHealthCheck', event));

    await worker.start();
    this.workers.push(worker);
  }

  /**
   * Remove a worker
   */
  private async removeWorker(): Promise<void> {
    const worker = this.workers.pop();
    if (worker) {
      await worker.stop();
    }
  }

  /**
   * Start health checks
   */
  private startHealthChecks(): void {
    this.healthCheckInterval = setInterval(async () => {
      try {
        const metrics = await this.getSystemMetrics();
        await this.checkAlertThresholds(metrics);
      } catch (error) {
        console.error('Health check error:', error);
      }
    }, this.config.healthCheck.intervalMs);
  }

  /**
   * Start cleanup scheduler
   */
  private startCleanupScheduler(): void {
    const intervalMs = this.config.cleanup.intervalHours * 60 * 60 * 1000;
    
    this.cleanupInterval = setInterval(async () => {
      try {
        const cleaned = await this.cleanupJobs();
        console.log(`Cleanup completed: removed ${cleaned} old jobs`);
        this.emit('cleanupCompleted', { removedJobs: cleaned, timestamp: new Date() });
      } catch (error) {
        console.error('Cleanup error:', error);
      }
    }, intervalMs);
  }

  /**
   * Start metrics collection
   */
  private startMetricsCollection(): void {
    this.metricsInterval = setInterval(async () => {
      try {
        const metrics = await this.getSystemMetrics();
        this.emit('metricsUpdated', metrics);
      } catch (error) {
        console.error('Metrics collection error:', error);
      }
    }, this.config.monitoring.metricsIntervalMs);
  }

  /**
   * Stop all monitoring
   */
  private stopMonitoring(): void {
    if (this.healthCheckInterval) {
      clearInterval(this.healthCheckInterval);
      this.healthCheckInterval = undefined;
    }

    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = undefined;
    }

    if (this.metricsInterval) {
      clearInterval(this.metricsInterval);
      this.metricsInterval = undefined;
    }
  }

  /**
   * Check alert thresholds and emit alerts
   */
  private async checkAlertThresholds(metrics: SystemMetrics): Promise<void> {
    const thresholds = this.config.monitoring.alertThresholds;

    // Check queue size
    if (metrics.queue.pending > thresholds.queueSize) {
      this.emitAlert('warning', 'queue_full', 
        `Queue size (${metrics.queue.pending}) exceeds threshold (${thresholds.queueSize})`,
        { queueSize: metrics.queue.pending, threshold: thresholds.queueSize }
      );
    }

    // Check error rate
    const errorRate = ((metrics.processing.totalProcessed - metrics.workers.reduce((sum, w) => sum + w.successful, 0)) / metrics.processing.totalProcessed) * 100;
    if (errorRate > thresholds.errorRate) {
      this.emitAlert('error', 'high_error_rate',
        `Error rate (${errorRate.toFixed(2)}%) exceeds threshold (${thresholds.errorRate}%)`,
        { errorRate, threshold: thresholds.errorRate }
      );
    }

    // Check processing time
    if (metrics.processing.averageProcessingTime > thresholds.processingTime) {
      this.emitAlert('warning', 'slow_processing',
        `Average processing time (${metrics.processing.averageProcessingTime}ms) exceeds threshold (${thresholds.processingTime}ms)`,
        { averageProcessingTime: metrics.processing.averageProcessingTime, threshold: thresholds.processingTime }
      );
    }

    // Check worker health
    const unhealthyWorkers = metrics.health.workers.filter(w => w.status === 'unhealthy').length;
    if (unhealthyWorkers > 0) {
      this.emitAlert('error', 'worker_unhealthy',
        `${unhealthyWorkers} worker(s) are unhealthy`,
        { unhealthyWorkers, totalWorkers: this.workers.length }
      );
    }
  }

  /**
   * Emit an alert
   */
  private emitAlert(level: 'warning' | 'error' | 'critical', type: AlertEvent['type'], message: string, data: any): void {
    const alert: AlertEvent = {
      level,
      type,
      message,
      data,
      timestamp: new Date()
    };

    this.alertHistory.push(alert);
    
    // Keep only last 1000 alerts
    if (this.alertHistory.length > 1000) {
      this.alertHistory = this.alertHistory.slice(-1000);
    }

    this.emit('alert', alert);
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
  }
}

export default new QueueManagerService();