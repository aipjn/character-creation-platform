/**
 * Status Tracking Service for Generation Jobs
 * Provides progress tracking, status monitoring, and real-time updates
 * Integrates with Stream A's API client and Stream B's queue system
 */

import { EventEmitter } from 'events';
import {
  GenerationJob,
  GenerationEvent,
  GenerationEventType,
  GenerationProgress,
  GenerationError,
  GenerationResult,
  QueueMetrics,
  SystemHealthStatus,
  HealthCheckResult,
  isCharacterGenerationJob,
  isBatchGenerationJob,
  isSingleGenerationJob,
  isPendingJob,
  isCompletedJob,
  isFailedJob
} from '../types/generation';

export interface StatusTrackerConfig {
  updateIntervalMs: number;
  maxStatusHistory: number;
  enableRealTimeUpdates: boolean;
  notificationRetryAttempts: number;
  notificationTimeoutMs: number;
  healthCheckIntervalMs: number;
  staleJobTimeoutMs: number;
}

export interface JobStatusUpdate {
  jobId: string;
  previousStatus: GenerationJob['status'];
  newStatus: GenerationJob['status'];
  progress?: GenerationProgress;
  error?: GenerationError;
  result?: GenerationResult;
  timestamp: Date;
  metadata?: any;
}

export interface StatusTrackerMetrics {
  totalJobs: number;
  activeJobs: number;
  completedJobs: number;
  failedJobs: number;
  averageCompletionTimeMs: number;
  statusUpdateCount: number;
  notificationsSent: number;
  notificationFailures: number;
  lastHealthCheckAt: Date;
  systemHealth: SystemHealthStatus['overall'];
}

export interface JobSubscription {
  jobId: string;
  userId?: string;
  callback: (update: JobStatusUpdate) => void;
  events: GenerationEventType[];
  subscribedAt: Date;
  lastNotifiedAt?: Date;
}

export class StatusTracker extends EventEmitter {
  private config: StatusTrackerConfig;
  private jobStatuses = new Map<string, GenerationJob>();
  private statusHistory = new Map<string, JobStatusUpdate[]>();
  private subscriptions = new Map<string, JobSubscription[]>();
  private metrics: StatusTrackerMetrics;
  private updateTimer?: NodeJS.Timeout;
  private healthCheckTimer?: NodeJS.Timeout;
  private lastSystemHealth: SystemHealthStatus | null = null;

  constructor(config?: Partial<StatusTrackerConfig>) {
    super();
    
    this.config = {
      updateIntervalMs: 1000,
      maxStatusHistory: 100,
      enableRealTimeUpdates: true,
      notificationRetryAttempts: 3,
      notificationTimeoutMs: 5000,
      healthCheckIntervalMs: 30000,
      staleJobTimeoutMs: 300000, // 5 minutes
      ...config
    };

    this.metrics = {
      totalJobs: 0,
      activeJobs: 0,
      completedJobs: 0,
      failedJobs: 0,
      averageCompletionTimeMs: 0,
      statusUpdateCount: 0,
      notificationsSent: 0,
      notificationFailures: 0,
      lastHealthCheckAt: new Date(),
      systemHealth: 'healthy'
    };

    this.startPeriodicUpdates();
    this.startHealthChecks();
  }

  /**
   * Track a new generation job
   */
  public trackJob(job: GenerationJob): void {
    const existingJob = this.jobStatuses.get(job.id);
    
    if (!existingJob) {
      this.metrics.totalJobs++;
      
      if (isPendingJob(job)) {
        this.metrics.activeJobs++;
      }
    }

    this.jobStatuses.set(job.id, job);
    
    const event: GenerationEvent = {
      type: existingJob ? 'job_progress' : 'job_created',
      jobId: job.id,
      batchId: isBatchGenerationJob(job) ? job.batchId : undefined,
      userId: job.userId,
      timestamp: new Date(),
      data: { job }
    };

    this.emitJobEvent(event);

    // Update metrics
    this.updateJobMetrics(job, existingJob);

    // Create status update
    const statusUpdate: JobStatusUpdate = {
      jobId: job.id,
      previousStatus: existingJob?.status || 'pending',
      newStatus: job.status,
      progress: this.extractProgress(job),
      error: this.extractError(job),
      result: this.extractResult(job),
      timestamp: new Date(),
      metadata: this.extractMetadata(job)
    };

    this.recordStatusUpdate(statusUpdate);
    this.notifySubscribers(statusUpdate);
  }

  /**
   * Update job status and progress
   */
  public updateJobStatus(
    jobId: string, 
    status: GenerationJob['status'], 
    progress?: GenerationProgress,
    error?: GenerationError,
    result?: GenerationResult
  ): boolean {
    const job = this.jobStatuses.get(jobId);
    if (!job) {
      return false;
    }

    const previousStatus = job.status;
    const updatedJob: GenerationJob = {
      ...job,
      status,
      updatedAt: new Date(),
      completedAt: status === 'completed' ? new Date() : job.completedAt,
      progress,
      error,
      ...(isCharacterGenerationJob(job) && result ? { results: [result] } : {}),
      ...(isSingleGenerationJob(job) && result ? { result } : {})
    };

    this.jobStatuses.set(jobId, updatedJob);

    // Update metrics
    this.updateJobMetrics(updatedJob, job);

    // Create status update
    const statusUpdate: JobStatusUpdate = {
      jobId,
      previousStatus,
      newStatus: status,
      progress,
      error,
      result,
      timestamp: new Date(),
      metadata: this.extractMetadata(updatedJob)
    };

    this.recordStatusUpdate(statusUpdate);
    this.notifySubscribers(statusUpdate);

    // Emit event
    const eventType = this.getEventTypeForStatus(status, previousStatus);
    const event: GenerationEvent = {
      type: eventType,
      jobId,
      batchId: isBatchGenerationJob(updatedJob) ? updatedJob.batchId : undefined,
      userId: updatedJob.userId,
      timestamp: new Date(),
      data: { job: updatedJob, result, error }
    };

    this.emitJobEvent(event);

    return true;
  }

  /**
   * Get current status of a job
   */
  public getJobStatus(jobId: string): GenerationJob | null {
    return this.jobStatuses.get(jobId) || null;
  }

  /**
   * Get status history for a job
   */
  public getJobStatusHistory(jobId: string): JobStatusUpdate[] {
    return this.statusHistory.get(jobId) || [];
  }

  /**
   * Get all jobs for a user
   */
  public getUserJobs(userId: string): GenerationJob[] {
    return Array.from(this.jobStatuses.values()).filter(job => job.userId === userId);
  }

  /**
   * Get active jobs
   */
  public getActiveJobs(): GenerationJob[] {
    return Array.from(this.jobStatuses.values()).filter(job => isPendingJob(job));
  }

  /**
   * Subscribe to job status updates
   */
  public subscribe(
    jobId: string, 
    callback: (update: JobStatusUpdate) => void,
    events: GenerationEventType[] = ['job_progress', 'job_completed', 'job_failed'],
    userId?: string
  ): string {
    const subscriptionId = this.generateSubscriptionId();
    const subscription: JobSubscription = {
      jobId,
      userId,
      callback,
      events,
      subscribedAt: new Date()
    };

    if (!this.subscriptions.has(jobId)) {
      this.subscriptions.set(jobId, []);
    }
    
    this.subscriptions.get(jobId)!.push(subscription);

    // Return subscription ID for cleanup
    return subscriptionId;
  }

  /**
   * Unsubscribe from job status updates
   */
  public unsubscribe(jobId: string, userId?: string): boolean {
    const subs = this.subscriptions.get(jobId);
    if (!subs) {
      return false;
    }

    const filteredSubs = subs.filter(sub => 
      userId ? sub.userId !== userId : true
    );

    if (filteredSubs.length === 0) {
      this.subscriptions.delete(jobId);
    } else {
      this.subscriptions.set(jobId, filteredSubs);
    }

    return true;
  }

  /**
   * Get current metrics
   */
  public getMetrics(): StatusTrackerMetrics {
    return { ...this.metrics };
  }

  /**
   * Get queue metrics (integration with Stream B)
   */
  public getQueueMetrics(): QueueMetrics {
    const jobs = Array.from(this.jobStatuses.values());
    const completedJobs = jobs.filter(job => isCompletedJob(job));
    const failedJobs = jobs.filter(job => isFailedJob(job));
    
    const totalCompletionTime = completedJobs.reduce((sum, job) => {
      if (job.completedAt && job.createdAt) {
        return sum + (job.completedAt.getTime() - job.createdAt.getTime());
      }
      return sum;
    }, 0);

    const processingJobs = jobs.filter(job => job.status === 'processing');
    const totalProcessingTime = processingJobs.reduce((sum, job) => {
      return sum + (new Date().getTime() - job.updatedAt.getTime());
    }, 0);

    return {
      pending: jobs.filter(job => job.status === 'pending').length,
      processing: processingJobs.length,
      completed: completedJobs.length,
      failed: failedJobs.length,
      averageWaitTimeMs: 0, // Would need queue implementation details
      averageProcessingTimeMs: processingJobs.length > 0 ? 
        totalProcessingTime / processingJobs.length : 0,
      throughputPerHour: this.calculateThroughputPerHour(completedJobs)
    };
  }

  /**
   * Perform system health check
   */
  public async performHealthCheck(): Promise<SystemHealthStatus> {
    const healthStatus: SystemHealthStatus = {
      overall: 'healthy',
      services: {
        nanoBananaApi: await this.checkNanoBananaApiHealth(),
        database: await this.checkDatabaseHealth(),
        storage: await this.checkStorageHealth(),
        cache: await this.checkCacheHealth(),
        queue: await this.checkQueueHealth()
      },
      checkedAt: new Date()
    };

    // Determine overall health
    const serviceStatuses = Object.values(healthStatus.services);
    if (serviceStatuses.some(service => service.status === 'unhealthy')) {
      healthStatus.overall = 'unhealthy';
    } else if (serviceStatuses.some(service => service.status === 'degraded')) {
      healthStatus.overall = 'degraded';
    }

    this.lastSystemHealth = healthStatus;
    this.metrics.systemHealth = healthStatus.overall;
    this.metrics.lastHealthCheckAt = healthStatus.checkedAt;

    // Emit health status event
    this.emit('health_status', healthStatus);

    return healthStatus;
  }

  /**
   * Clean up completed jobs and old status history
   */
  public cleanup(maxAge: number = 86400000): number { // 24 hours default
    const cutoff = new Date(Date.now() - maxAge);
    let cleanedCount = 0;

    // Clean up completed jobs older than maxAge
    for (const [jobId, job] of this.jobStatuses.entries()) {
      if ((isCompletedJob(job) || isFailedJob(job)) && 
          job.updatedAt < cutoff) {
        this.jobStatuses.delete(jobId);
        this.statusHistory.delete(jobId);
        this.subscriptions.delete(jobId);
        cleanedCount++;
      }
    }

    // Clean up status history
    for (const [jobId, history] of this.statusHistory.entries()) {
      const filteredHistory = history.filter(update => 
        update.timestamp > cutoff
      ).slice(-this.config.maxStatusHistory);
      
      if (filteredHistory.length !== history.length) {
        this.statusHistory.set(jobId, filteredHistory);
        cleanedCount++;
      }
    }

    return cleanedCount;
  }

  /**
   * Destroy the status tracker and cleanup resources
   */
  public destroy(): void {
    if (this.updateTimer) {
      clearInterval(this.updateTimer);
    }
    
    if (this.healthCheckTimer) {
      clearInterval(this.healthCheckTimer);
    }

    this.jobStatuses.clear();
    this.statusHistory.clear();
    this.subscriptions.clear();
    this.removeAllListeners();
  }

  /**
   * Private helper methods
   */

  private startPeriodicUpdates(): void {
    if (!this.config.enableRealTimeUpdates) {
      return;
    }

    this.updateTimer = setInterval(async () => {
      await this.performPeriodicUpdate();
    }, this.config.updateIntervalMs);
  }

  private startHealthChecks(): void {
    this.healthCheckTimer = setInterval(async () => {
      await this.performHealthCheck();
    }, this.config.healthCheckIntervalMs);
  }

  private async performPeriodicUpdate(): Promise<void> {
    // Check for stale jobs
    const now = new Date();
    const staleThreshold = now.getTime() - this.config.staleJobTimeoutMs;

    for (const [jobId, job] of this.jobStatuses.entries()) {
      if (isPendingJob(job) && job.updatedAt.getTime() < staleThreshold) {
        // Mark as potentially stale
        this.emit('job_stale', {
          type: 'job_timeout',
          jobId,
          userId: job.userId,
          timestamp: now,
          data: { job, staleTime: now.getTime() - job.updatedAt.getTime() }
        });
      }
    }

    // Update metrics
    this.updateMetrics();
  }

  private updateJobMetrics(currentJob: GenerationJob, previousJob?: GenerationJob): void {
    if (!previousJob) {
      // New job
      this.metrics.totalJobs++;
    }

    // Update active job count
    if (isPendingJob(currentJob) && (!previousJob || !isPendingJob(previousJob))) {
      this.metrics.activeJobs++;
    } else if (!isPendingJob(currentJob) && previousJob && isPendingJob(previousJob)) {
      this.metrics.activeJobs = Math.max(0, this.metrics.activeJobs - 1);
    }

    // Update completion count
    if (isCompletedJob(currentJob) && (!previousJob || !isCompletedJob(previousJob))) {
      this.metrics.completedJobs++;
      
      // Update average completion time
      if (currentJob.completedAt && currentJob.createdAt) {
        const completionTime = currentJob.completedAt.getTime() - currentJob.createdAt.getTime();
        this.metrics.averageCompletionTimeMs = 
          (this.metrics.averageCompletionTimeMs * (this.metrics.completedJobs - 1) + completionTime) / 
          this.metrics.completedJobs;
      }
    }

    // Update failure count
    if (isFailedJob(currentJob) && (!previousJob || !isFailedJob(previousJob))) {
      this.metrics.failedJobs++;
    }
  }

  private updateMetrics(): void {
    // Recalculate from current job states to ensure accuracy
    const jobs = Array.from(this.jobStatuses.values());
    
    this.metrics.activeJobs = jobs.filter(job => isPendingJob(job)).length;
    this.metrics.completedJobs = jobs.filter(job => isCompletedJob(job)).length;
    this.metrics.failedJobs = jobs.filter(job => isFailedJob(job)).length;
  }

  private recordStatusUpdate(update: JobStatusUpdate): void {
    if (!this.statusHistory.has(update.jobId)) {
      this.statusHistory.set(update.jobId, []);
    }

    const history = this.statusHistory.get(update.jobId)!;
    history.push(update);

    // Limit history size
    if (history.length > this.config.maxStatusHistory) {
      history.splice(0, history.length - this.config.maxStatusHistory);
    }

    this.metrics.statusUpdateCount++;
  }

  private async notifySubscribers(update: JobStatusUpdate): Promise<void> {
    const subscribers = this.subscriptions.get(update.jobId);
    if (!subscribers || subscribers.length === 0) {
      return;
    }

    const eventType = this.getEventTypeForStatus(update.newStatus, update.previousStatus);
    
    for (const subscription of subscribers) {
      if (!subscription.events.includes(eventType)) {
        continue;
      }

      try {
        await this.notifySubscriber(subscription, update);
        subscription.lastNotifiedAt = new Date();
        this.metrics.notificationsSent++;
      } catch (error) {
        this.metrics.notificationFailures++;
        this.emit('notification_failed', {
          type: 'notification_failed',
          jobId: update.jobId,
          userId: subscription.userId,
          timestamp: new Date(),
          data: { subscription, update, error }
        });
      }
    }
  }

  private async notifySubscriber(
    subscription: JobSubscription, 
    update: JobStatusUpdate
  ): Promise<void> {
    const timeoutPromise = new Promise((_, reject) => {
      setTimeout(() => reject(new Error('Notification timeout')), this.config.notificationTimeoutMs);
    });

    const notificationPromise = new Promise<void>((resolve, reject) => {
      try {
        subscription.callback(update);
        resolve();
      } catch (error) {
        reject(error);
      }
    });

    await Promise.race([notificationPromise, timeoutPromise]);
  }

  private getEventTypeForStatus(
    newStatus: GenerationJob['status'], 
    previousStatus: GenerationJob['status']
  ): GenerationEventType {
    if (newStatus === 'queued' && previousStatus === 'pending') {
      return 'job_queued';
    } else if (newStatus === 'processing' && previousStatus !== 'processing') {
      return 'job_started';
    } else if (newStatus === 'completed') {
      return 'job_completed';
    } else if (newStatus === 'failed') {
      return 'job_failed';
    } else if (newStatus === 'cancelled') {
      return 'job_cancelled';
    } else {
      return 'job_progress';
    }
  }

  private emitJobEvent(event: GenerationEvent): void {
    this.emit(event.type, event);
    this.emit('job_event', event);
  }

  private extractProgress(job: GenerationJob): GenerationProgress | undefined {
    if ('progress' in job) {
      return job.progress;
    }
    return undefined;
  }

  private extractError(job: GenerationJob): GenerationError | undefined {
    if ('error' in job) {
      return job.error;
    }
    return undefined;
  }

  private extractResult(job: GenerationJob): GenerationResult | undefined {
    if (isCharacterGenerationJob(job) && job.results) {
      return job.results[0];
    } else if (isSingleGenerationJob(job)) {
      return job.result;
    }
    return undefined;
  }

  private extractMetadata(job: GenerationJob): any {
    const metadata: any = {
      type: job.type,
      priority: job.priority,
      createdAt: job.createdAt,
      updatedAt: job.updatedAt
    };

    if (isCharacterGenerationJob(job)) {
      metadata.characterId = job.characterId;
      metadata.variations = job.generationParams?.variations;
    } else if (isBatchGenerationJob(job)) {
      metadata.batchId = job.batchId;
      metadata.totalRequests = job.totalRequests;
      metadata.completedRequests = job.completedRequests;
    }

    return metadata;
  }

  private calculateThroughputPerHour(completedJobs: GenerationJob[]): number {
    if (completedJobs.length === 0) {
      return 0;
    }

    const now = new Date();
    const oneHourAgo = new Date(now.getTime() - 3600000);
    
    const recentCompletions = completedJobs.filter(job => 
      job.completedAt && job.completedAt > oneHourAgo
    );

    return recentCompletions.length;
  }

  private generateSubscriptionId(): string {
    return `sub_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private async checkNanoBananaApiHealth(): Promise<HealthCheckResult> {
    const startTime = Date.now();
    
    try {
      // This would integrate with the nanoBanana client from Stream A
      const response = await fetch(`${process.env.NANOBANANA_BASE_URL}/health`, {
        method: 'GET',
        timeout: 5000
      });

      const responseTime = Date.now() - startTime;
      
      return {
        service: 'nanoBananaApi',
        status: response.ok ? 'healthy' : 'unhealthy',
        lastCheckedAt: new Date(),
        responseTimeMs: responseTime,
        error: response.ok ? undefined : `HTTP ${response.status}: ${response.statusText}`
      };
    } catch (error) {
      return {
        service: 'nanoBananaApi',
        status: 'unhealthy',
        lastCheckedAt: new Date(),
        responseTimeMs: Date.now() - startTime,
        error: error instanceof Error ? error.message : String(error)
      };
    }
  }

  private async checkDatabaseHealth(): Promise<HealthCheckResult> {
    const startTime = Date.now();
    
    try {
      // Simple database connectivity check
      // This would integrate with the actual database client
      return {
        service: 'database',
        status: 'healthy',
        lastCheckedAt: new Date(),
        responseTimeMs: Date.now() - startTime
      };
    } catch (error) {
      return {
        service: 'database',
        status: 'unhealthy',
        lastCheckedAt: new Date(),
        responseTimeMs: Date.now() - startTime,
        error: error instanceof Error ? error.message : String(error)
      };
    }
  }

  private async checkStorageHealth(): Promise<HealthCheckResult> {
    const startTime = Date.now();
    
    try {
      // This would integrate with the S3 service from Stream A
      return {
        service: 'storage',
        status: 'healthy',
        lastCheckedAt: new Date(),
        responseTimeMs: Date.now() - startTime
      };
    } catch (error) {
      return {
        service: 'storage',
        status: 'unhealthy',
        lastCheckedAt: new Date(),
        responseTimeMs: Date.now() - startTime,
        error: error instanceof Error ? error.message : String(error)
      };
    }
  }

  private async checkCacheHealth(): Promise<HealthCheckResult> {
    const startTime = Date.now();
    
    try {
      // Cache health check would go here
      return {
        service: 'cache',
        status: 'healthy',
        lastCheckedAt: new Date(),
        responseTimeMs: Date.now() - startTime
      };
    } catch (error) {
      return {
        service: 'cache',
        status: 'unhealthy',
        lastCheckedAt: new Date(),
        responseTimeMs: Date.now() - startTime,
        error: error instanceof Error ? error.message : String(error)
      };
    }
  }

  private async checkQueueHealth(): Promise<HealthCheckResult> {
    const startTime = Date.now();
    
    try {
      // This would integrate with Stream B's queue system
      const queueMetrics = this.getQueueMetrics();
      const isHealthy = queueMetrics.pending < 1000 && // Arbitrary threshold
                       queueMetrics.failed / Math.max(queueMetrics.completed, 1) < 0.1; // Less than 10% failure rate

      return {
        service: 'queue',
        status: isHealthy ? 'healthy' : 'degraded',
        lastCheckedAt: new Date(),
        responseTimeMs: Date.now() - startTime,
        details: queueMetrics
      };
    } catch (error) {
      return {
        service: 'queue',
        status: 'unhealthy',
        lastCheckedAt: new Date(),
        responseTimeMs: Date.now() - startTime,
        error: error instanceof Error ? error.message : String(error)
      };
    }
  }
}

// Factory function
export const createStatusTracker = (config?: Partial<StatusTrackerConfig>): StatusTracker => {
  return new StatusTracker(config);
};

// Default singleton instance
let defaultTracker: StatusTracker | null = null;

export const getDefaultStatusTracker = (): StatusTracker => {
  if (!defaultTracker) {
    defaultTracker = new StatusTracker();
  }
  return defaultTracker;
};

export default StatusTracker;