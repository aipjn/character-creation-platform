/**
 * Polling Service for Generation Job Status Updates
 * Provides polling-based monitoring when webhooks are not available
 * Integrates with nanoBanana API client and status tracker
 */

import { EventEmitter } from 'events';
import {
  GenerationJob,
  GenerationProgress,
  GenerationError,
  GenerationResult,
  GenerationEventType,
  isPendingJob,
  isCompletedJob,
  isFailedJob
} from '../types/generation';
import { StatusTracker, getDefaultStatusTracker } from './statusTracker';
import { NanoBananaClient, getDefaultNanoBananaClient } from './nanoBananaClient';

export interface PollingServiceConfig {
  defaultIntervalMs: number;
  fastIntervalMs: number;
  slowIntervalMs: number;
  maxConcurrentPolls: number;
  adaptivePolling: boolean;
  backoffMultiplier: number;
  maxBackoffMs: number;
  staleJobTimeoutMs: number;
  enableSmartPolling: boolean;
  batchSize: number;
}

export interface PollingJob {
  jobId: string;
  lastPolledAt: Date;
  pollCount: number;
  intervalMs: number;
  priority: 'low' | 'normal' | 'high';
  errors: number;
  maxErrors: number;
  createdAt: Date;
  lastStatusChange: Date;
  consecutiveNoChanges: number;
}

export interface PollingMetrics {
  totalPollsPerformed: number;
  successfulPolls: number;
  failedPolls: number;
  jobsCurrentlyPolled: number;
  averagePollInterval: number;
  averageResponseTime: number;
  statusChangesDetected: number;
  apiCallsSaved: number; // Through smart polling optimizations
}

export interface PollingStrategy {
  name: string;
  condition: (job: PollingJob, lastStatus: GenerationJob | null) => boolean;
  intervalMs: number;
  priority: 'low' | 'normal' | 'high';
  maxDuration?: number;
}

export class PollingService extends EventEmitter {
  private config: PollingServiceConfig;
  private statusTracker: StatusTracker;
  private apiClient: NanoBananaClient;
  private pollingJobs = new Map<string, PollingJob>();
  private activePolls = new Set<string>();
  private pollingTimer?: NodeJS.Timeout;
  private metrics: PollingMetrics;
  private strategies: PollingStrategy[];

  constructor(
    statusTracker?: StatusTracker,
    apiClient?: NanoBananaClient,
    config?: Partial<PollingServiceConfig>
  ) {
    super();
    
    this.statusTracker = statusTracker || getDefaultStatusTracker();
    this.apiClient = apiClient || getDefaultNanoBananaClient();
    
    this.config = {
      defaultIntervalMs: 5000,
      fastIntervalMs: 2000,
      slowIntervalMs: 15000,
      maxConcurrentPolls: 10,
      adaptivePolling: true,
      backoffMultiplier: 1.5,
      maxBackoffMs: 30000,
      staleJobTimeoutMs: 300000, // 5 minutes
      enableSmartPolling: true,
      batchSize: 5,
      ...config
    };

    this.metrics = {
      totalPollsPerformed: 0,
      successfulPolls: 0,
      failedPolls: 0,
      jobsCurrentlyPolled: 0,
      averagePollInterval: this.config.defaultIntervalMs,
      averageResponseTime: 0,
      statusChangesDetected: 0,
      apiCallsSaved: 0
    };

    this.strategies = this.initializePollingStrategies();
    this.startPollingLoop();
    this.setupStatusTrackerIntegration();
  }

  /**
   * Start polling a generation job
   */
  public startPolling(
    jobId: string,
    options?: {
      priority?: 'low' | 'normal' | 'high';
      intervalMs?: number;
      maxErrors?: number;
    }
  ): boolean {
    if (this.pollingJobs.has(jobId)) {
      return false; // Already polling
    }

    const pollingJob: PollingJob = {
      jobId,
      lastPolledAt: new Date(0), // Never polled
      pollCount: 0,
      intervalMs: options?.intervalMs || this.config.defaultIntervalMs,
      priority: options?.priority || 'normal',
      errors: 0,
      maxErrors: options?.maxErrors || 5,
      createdAt: new Date(),
      lastStatusChange: new Date(),
      consecutiveNoChanges: 0
    };

    this.pollingJobs.set(jobId, pollingJob);
    this.updateMetrics();

    this.emit('polling_started', {
      jobId,
      priority: pollingJob.priority,
      intervalMs: pollingJob.intervalMs
    });

    return true;
  }

  /**
   * Stop polling a generation job
   */
  public stopPolling(jobId: string): boolean {
    const pollingJob = this.pollingJobs.get(jobId);
    if (!pollingJob) {
      return false;
    }

    this.pollingJobs.delete(jobId);
    this.activePolls.delete(jobId);
    this.updateMetrics();

    this.emit('polling_stopped', {
      jobId,
      pollCount: pollingJob.pollCount,
      duration: Date.now() - pollingJob.createdAt.getTime()
    });

    return true;
  }

  /**
   * Get polling status for a job
   */
  public getPollingStatus(jobId: string): PollingJob | null {
    return this.pollingJobs.get(jobId) || null;
  }

  /**
   * Get all currently polled jobs
   */
  public getPolledJobs(): PollingJob[] {
    return Array.from(this.pollingJobs.values());
  }

  /**
   * Update polling interval for a job
   */
  public updatePollingInterval(jobId: string, intervalMs: number): boolean {
    const pollingJob = this.pollingJobs.get(jobId);
    if (!pollingJob) {
      return false;
    }

    pollingJob.intervalMs = Math.max(1000, Math.min(intervalMs, this.config.maxBackoffMs));
    return true;
  }

  /**
   * Get current polling metrics
   */
  public getMetrics(): PollingMetrics {
    return { ...this.metrics };
  }

  /**
   * Force poll a specific job immediately
   */
  public async forcePoll(jobId: string): Promise<boolean> {
    const pollingJob = this.pollingJobs.get(jobId);
    if (!pollingJob) {
      return false;
    }

    if (this.activePolls.has(jobId)) {
      return false; // Already polling
    }

    try {
      await this.pollJob(pollingJob);
      return true;
    } catch (error) {
      console.error(`Force poll failed for job ${jobId}:`, error);
      return false;
    }
  }

  /**
   * Batch poll multiple jobs
   */
  public async batchPoll(jobIds: string[]): Promise<Map<string, boolean>> {
    const results = new Map<string, boolean>();
    const batches = this.chunkArray(jobIds, this.config.batchSize);

    for (const batch of batches) {
      const batchPromises = batch.map(async (jobId) => {
        const pollingJob = this.pollingJobs.get(jobId);
        if (!pollingJob || this.activePolls.has(jobId)) {
          return { jobId, success: false };
        }

        try {
          await this.pollJob(pollingJob);
          return { jobId, success: true };
        } catch (error) {
          return { jobId, success: false };
        }
      });

      const batchResults = await Promise.allSettled(batchPromises);
      
      for (const result of batchResults) {
        if (result.status === 'fulfilled') {
          results.set(result.value.jobId, result.value.success);
        }
      }

      // Small delay between batches to avoid overwhelming the API
      if (batches.length > 1) {
        await this.delay(100);
      }
    }

    return results;
  }

  /**
   * Clean up completed or stale polling jobs
   */
  public cleanup(): number {
    const now = new Date();
    let cleanedCount = 0;

    for (const [jobId, pollingJob] of this.pollingJobs.entries()) {
      const jobStatus = this.statusTracker.getJobStatus(jobId);
      const isStale = now.getTime() - pollingJob.lastStatusChange.getTime() > this.config.staleJobTimeoutMs;
      
      // Remove if job is completed, failed, or stale
      if (!jobStatus || 
          isCompletedJob(jobStatus) || 
          isFailedJob(jobStatus) || 
          isStale ||
          pollingJob.errors >= pollingJob.maxErrors) {
        
        this.stopPolling(jobId);
        cleanedCount++;
      }
    }

    this.updateMetrics();
    return cleanedCount;
  }

  /**
   * Destroy the polling service and cleanup resources
   */
  public destroy(): void {
    if (this.pollingTimer) {
      clearInterval(this.pollingTimer);
    }

    this.pollingJobs.clear();
    this.activePolls.clear();
    this.removeAllListeners();
  }

  /**
   * Private helper methods
   */

  private initializePollingStrategies(): PollingStrategy[] {
    return [
      {
        name: 'fast_active',
        condition: (job, status) => 
          status?.status === 'processing' && job.consecutiveNoChanges < 3,
        intervalMs: this.config.fastIntervalMs,
        priority: 'high',
        maxDuration: 60000 // 1 minute
      },
      {
        name: 'normal_queued',
        condition: (job, status) => 
          status?.status === 'queued' || status?.status === 'pending',
        intervalMs: this.config.defaultIntervalMs,
        priority: 'normal'
      },
      {
        name: 'slow_stable',
        condition: (job, status) => 
          job.consecutiveNoChanges >= 5,
        intervalMs: this.config.slowIntervalMs,
        priority: 'low'
      },
      {
        name: 'adaptive_errors',
        condition: (job, status) => 
          job.errors > 0,
        intervalMs: Math.min(
          this.config.defaultIntervalMs * Math.pow(this.config.backoffMultiplier, job.errors),
          this.config.maxBackoffMs
        ),
        priority: 'low'
      }
    ];
  }

  private setupStatusTrackerIntegration(): void {
    // Listen for status changes to optimize polling
    this.statusTracker.on('job_event', (event) => {
      const pollingJob = this.pollingJobs.get(event.jobId);
      if (pollingJob) {
        pollingJob.lastStatusChange = new Date();
        pollingJob.consecutiveNoChanges = 0;
        
        // Adjust polling based on event type
        this.adjustPollingStrategy(pollingJob, event.type);
      }
    });

    // Auto-start polling for new jobs
    this.statusTracker.on('job_created', (event) => {
      if (this.shouldAutoStartPolling(event.data.job)) {
        this.startPolling(event.jobId, {
          priority: this.getJobPriority(event.data.job)
        });
      }
    });
  }

  private startPollingLoop(): void {
    this.pollingTimer = setInterval(async () => {
      await this.performPollingCycle();
    }, 1000); // Check every second
  }

  private async performPollingCycle(): Promise<void> {
    try {
      // Get jobs that need to be polled
      const jobsToPoll = this.getJobsToPoll();
      
      if (jobsToPoll.length === 0) {
        return;
      }

      // Limit concurrent polls
      const availableSlots = this.config.maxConcurrentPolls - this.activePolls.size;
      const selectedJobs = jobsToPoll.slice(0, availableSlots);

      // Start polling selected jobs
      const pollPromises = selectedJobs.map(job => this.pollJob(job));
      await Promise.allSettled(pollPromises);

    } catch (error) {
      console.error('Error in polling cycle:', error);
    }
  }

  private getJobsToPoll(): PollingJob[] {
    const now = new Date();
    const eligibleJobs: PollingJob[] = [];

    for (const pollingJob of this.pollingJobs.values()) {
      if (this.activePolls.has(pollingJob.jobId)) {
        continue; // Already polling
      }

      const timeSinceLastPoll = now.getTime() - pollingJob.lastPolledAt.getTime();
      const shouldPoll = timeSinceLastPoll >= pollingJob.intervalMs;

      if (shouldPoll) {
        eligibleJobs.push(pollingJob);
      }
    }

    // Sort by priority and last poll time
    return eligibleJobs.sort((a, b) => {
      const priorityOrder = { high: 3, normal: 2, low: 1 };
      const priorityDiff = priorityOrder[b.priority] - priorityOrder[a.priority];
      
      if (priorityDiff !== 0) {
        return priorityDiff;
      }
      
      return a.lastPolledAt.getTime() - b.lastPolledAt.getTime();
    });
  }

  private async pollJob(pollingJob: PollingJob): Promise<void> {
    this.activePolls.add(pollingJob.jobId);
    
    try {
      const startTime = Date.now();
      pollingJob.lastPolledAt = new Date();
      pollingJob.pollCount++;

      // Get current job status from API
      const jobStatus = await this.fetchJobStatus(pollingJob.jobId);
      const responseTime = Date.now() - startTime;

      // Update metrics
      this.metrics.totalPollsPerformed++;
      this.updateResponseTime(responseTime);

      if (jobStatus) {
        const previousStatus = this.statusTracker.getJobStatus(pollingJob.jobId);
        const statusChanged = !previousStatus || 
                            previousStatus.status !== jobStatus.status ||
                            this.hasProgressChanged(previousStatus, jobStatus);

        if (statusChanged) {
          this.metrics.statusChangesDetected++;
          pollingJob.consecutiveNoChanges = 0;
          pollingJob.lastStatusChange = new Date();
          
          // Update status tracker
          this.statusTracker.trackJob(jobStatus);
        } else {
          pollingJob.consecutiveNoChanges++;
        }

        // Adjust polling strategy based on current status
        this.adjustPollingBasedOnStatus(pollingJob, jobStatus);

        this.metrics.successfulPolls++;
        pollingJob.errors = 0; // Reset error count on success

      } else {
        throw new Error('No status received from API');
      }

      this.emit('job_polled', {
        jobId: pollingJob.jobId,
        status: jobStatus?.status,
        responseTime,
        pollCount: pollingJob.pollCount
      });

    } catch (error) {
      console.error(`Polling failed for job ${pollingJob.jobId}:`, error);
      
      pollingJob.errors++;
      this.metrics.failedPolls++;

      if (pollingJob.errors >= pollingJob.maxErrors) {
        this.emit('polling_max_errors', {
          jobId: pollingJob.jobId,
          errors: pollingJob.errors,
          maxErrors: pollingJob.maxErrors
        });
        
        this.stopPolling(pollingJob.jobId);
      } else {
        // Exponential backoff on errors
        pollingJob.intervalMs = Math.min(
          pollingJob.intervalMs * this.config.backoffMultiplier,
          this.config.maxBackoffMs
        );
      }

      this.emit('polling_error', {
        jobId: pollingJob.jobId,
        error: error instanceof Error ? error.message : String(error),
        errorCount: pollingJob.errors
      });

    } finally {
      this.activePolls.delete(pollingJob.jobId);
    }
  }

  private async fetchJobStatus(jobId: string): Promise<GenerationJob | null> {
    try {
      // This would typically make an API call to get job status
      // For now, we'll simulate it by checking if the job exists in the status tracker
      const existingJob = this.statusTracker.getJobStatus(jobId);
      
      if (!existingJob || isCompletedJob(existingJob) || isFailedJob(existingJob)) {
        return existingJob;
      }

      // In a real implementation, this would call the nanoBanana API to get updated status
      // For now, we'll return the existing job with minimal changes to simulate polling
      return {
        ...existingJob,
        updatedAt: new Date()
      };

    } catch (error) {
      console.error(`Failed to fetch status for job ${jobId}:`, error);
      return null;
    }
  }

  private hasProgressChanged(
    previous: GenerationJob, 
    current: GenerationJob
  ): boolean {
    const prevProgress = this.getJobProgress(previous);
    const currProgress = this.getJobProgress(current);

    if (!prevProgress && !currProgress) return false;
    if (!prevProgress || !currProgress) return true;

    return prevProgress.percentage !== currProgress.percentage ||
           prevProgress.stage !== currProgress.stage;
  }

  private getJobProgress(job: GenerationJob): GenerationProgress | undefined {
    if ('progress' in job) {
      return job.progress;
    }
    return undefined;
  }

  private adjustPollingStrategy(pollingJob: PollingJob, eventType: GenerationEventType): void {
    if (!this.config.adaptivePolling) {
      return;
    }

    const currentJob = this.statusTracker.getJobStatus(pollingJob.jobId);
    
    for (const strategy of this.strategies) {
      if (strategy.condition(pollingJob, currentJob)) {
        pollingJob.intervalMs = strategy.intervalMs;
        pollingJob.priority = strategy.priority;
        
        this.emit('strategy_changed', {
          jobId: pollingJob.jobId,
          strategy: strategy.name,
          intervalMs: strategy.intervalMs,
          priority: strategy.priority
        });
        
        break;
      }
    }
  }

  private adjustPollingBasedOnStatus(pollingJob: PollingJob, jobStatus: GenerationJob): void {
    if (this.config.enableSmartPolling) {
      // Slow down polling for stable jobs
      if (pollingJob.consecutiveNoChanges >= 3) {
        pollingJob.intervalMs = Math.min(
          pollingJob.intervalMs * 1.2,
          this.config.slowIntervalMs
        );
        this.metrics.apiCallsSaved++;
      }

      // Speed up polling for active jobs
      if (jobStatus.status === 'processing' && pollingJob.consecutiveNoChanges === 0) {
        pollingJob.intervalMs = Math.max(
          pollingJob.intervalMs * 0.8,
          this.config.fastIntervalMs
        );
      }
    }
  }

  private shouldAutoStartPolling(job: GenerationJob): boolean {
    // Auto-start polling for pending jobs
    return isPendingJob(job) && job.priority !== 'low';
  }

  private getJobPriority(job: GenerationJob): 'low' | 'normal' | 'high' {
    if (job.priority === 'urgent') return 'high';
    if (job.priority === 'high') return 'high';
    if (job.priority === 'low') return 'low';
    return 'normal';
  }

  private updateMetrics(): void {
    this.metrics.jobsCurrentlyPolled = this.pollingJobs.size;
    
    const intervals = Array.from(this.pollingJobs.values()).map(job => job.intervalMs);
    if (intervals.length > 0) {
      this.metrics.averagePollInterval = intervals.reduce((sum, interval) => sum + interval, 0) / intervals.length;
    }
  }

  private updateResponseTime(responseTime: number): void {
    const totalRequests = this.metrics.totalPollsPerformed;
    if (totalRequests === 1) {
      this.metrics.averageResponseTime = responseTime;
    } else {
      this.metrics.averageResponseTime = 
        (this.metrics.averageResponseTime * (totalRequests - 1) + responseTime) / totalRequests;
    }
  }

  private chunkArray<T>(array: T[], chunkSize: number): T[][] {
    const chunks: T[][] = [];
    for (let i = 0; i < array.length; i += chunkSize) {
      chunks.push(array.slice(i, i + chunkSize));
    }
    return chunks;
  }

  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

// Factory function
export const createPollingService = (
  statusTracker?: StatusTracker,
  apiClient?: NanoBananaClient,
  config?: Partial<PollingServiceConfig>
): PollingService => {
  return new PollingService(statusTracker, apiClient, config);
};

// Default singleton instance
let defaultPollingService: PollingService | null = null;

export const getDefaultPollingService = (): PollingService => {
  if (!defaultPollingService) {
    defaultPollingService = new PollingService();
  }
  return defaultPollingService;
};

export default PollingService;