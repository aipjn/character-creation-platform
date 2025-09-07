/**
 * Character Generation Workflow Service
 * Orchestrates the complete character generation workflow integrating all components
 */

import { EventEmitter } from 'events';
import {
  CharacterGenerationJob,
  GenerationJob,
  GenerationResult,
  GenerationError,
  JobStatus,
  GenerationEventType,
  GenerationEvent,
  isCharacterGenerationJob
} from '../types/generation';
import { CharacterGenerationRequest, BatchGenerationResponse } from '../types/nanoBanana';
import { NanoBananaClient, getDefaultNanoBananaClient } from './nanoBananaClient';
import { GenerationQueueService } from './generationQueue';
import { BatchProcessorService } from './batchProcessor';
import { StatusTrackerService } from './statusTracker';
import { ErrorRecoveryService } from './errorRecovery';
import { GenerationJobModel } from '../models/GenerationJob';
import { convertToCharacterSpecs, convertFromNanoBananaResponse } from '../utils/dataConverter';

export interface WorkflowConfig {
  enableAutoRetry: boolean;
  maxRetryAttempts: number;
  retryDelayMs: number;
  timeoutMs: number;
  enableStatusTracking: boolean;
  enableErrorRecovery: boolean;
  enableBatchOptimization: boolean;
}

export interface WorkflowMetrics {
  totalJobs: number;
  completedJobs: number;
  failedJobs: number;
  averageCompletionTimeMs: number;
  successRate: number;
  retryRate: number;
  currentActiveJobs: number;
}

export interface WorkflowStatus {
  isHealthy: boolean;
  activeJobs: number;
  queueSize: number;
  metrics: WorkflowMetrics;
  lastUpdate: Date;
}

export class CharacterWorkflowService extends EventEmitter {
  private nanoBananaClient: NanoBananaClient;
  private queueService: GenerationQueueService;
  private batchProcessor: BatchProcessorService;
  private statusTracker: StatusTrackerService;
  private errorRecovery: ErrorRecoveryService;
  private jobModel: GenerationJobModel;
  private config: WorkflowConfig;
  private metrics: WorkflowMetrics;
  private activeJobs: Map<string, CharacterGenerationJob> = new Map();
  
  constructor(
    config?: Partial<WorkflowConfig>,
    nanoBananaClient?: NanoBananaClient,
    dependencies?: {
      queueService?: GenerationQueueService;
      batchProcessor?: BatchProcessorService;
      statusTracker?: StatusTrackerService;
      errorRecovery?: ErrorRecoveryService;
      jobModel?: GenerationJobModel;
    }
  ) {
    super();
    
    this.config = {
      enableAutoRetry: true,
      maxRetryAttempts: 3,
      retryDelayMs: 5000,
      timeoutMs: 300000, // 5 minutes
      enableStatusTracking: true,
      enableErrorRecovery: true,
      enableBatchOptimization: true,
      ...config
    };
    
    // Initialize dependencies
    this.nanoBananaClient = nanoBananaClient || getDefaultNanoBananaClient();
    this.queueService = dependencies?.queueService || new GenerationQueueService();
    this.batchProcessor = dependencies?.batchProcessor || new BatchProcessorService();
    this.statusTracker = dependencies?.statusTracker || new StatusTrackerService();
    this.errorRecovery = dependencies?.errorRecovery || new ErrorRecoveryService();
    this.jobModel = dependencies?.jobModel || new GenerationJobModel();
    
    this.metrics = {
      totalJobs: 0,
      completedJobs: 0,
      failedJobs: 0,
      averageCompletionTimeMs: 0,
      successRate: 0,
      retryRate: 0,
      currentActiveJobs: 0
    };
    
    this.setupEventHandlers();
  }
  
  /**
   * Start a character generation workflow
   */
  public async startCharacterGeneration(
    characterSpecs: CharacterGenerationRequest['characterSpecs'],
    userId?: string,
    generationParams?: CharacterGenerationRequest['generationParams']
  ): Promise<string> {
    const jobId = this.generateJobId();
    const startTime = Date.now();
    
    try {
      // Convert character specs to internal format
      const convertedSpecs = convertToCharacterSpecs(characterSpecs);
      
      // Create generation job
      const job: CharacterGenerationJob = {
        id: jobId,
        userId,
        type: 'character',
        status: 'pending',
        priority: 'normal',
        createdAt: new Date(),
        updatedAt: new Date(),
        characterId: this.generateCharacterId(),
        characterSpecs: convertedSpecs,
        generationParams,
        results: []
      };
      
      // Save job to database
      await this.jobModel.create({
        id: job.id,
        userId: job.userId,
        type: job.type,
        status: job.status,
        priority: job.priority,
        data: {
          characterId: job.characterId,
          characterSpecs: job.characterSpecs,
          generationParams: job.generationParams
        }
      });
      
      // Add to active jobs tracking
      this.activeJobs.set(jobId, job);
      this.metrics.totalJobs++;
      this.metrics.currentActiveJobs++;
      
      // Emit job started event
      this.emitEvent('job_created', jobId, { job });
      
      // Start status tracking if enabled
      if (this.config.enableStatusTracking) {
        await this.statusTracker.startTracking(jobId, {
          type: 'character_generation',
          estimatedDurationMs: this.estimateCompletionTime(job),
          metadata: { characterId: job.characterId }
        });
      }
      
      // Queue the job for processing
      await this.queueService.enqueue({
        userId,
        type: 'character',
        priority: 'normal',
        data: job
      });
      
      // Process the job
      this.processJob(job).catch(error => {
        console.error(`Failed to process job ${jobId}:`, error);
        this.handleJobFailure(job, error);
      });
      
      return jobId;
      
    } catch (error) {
      console.error(`Failed to start character generation:`, error);
      
      // Clean up on failure
      this.activeJobs.delete(jobId);
      this.metrics.currentActiveJobs--;
      this.metrics.failedJobs++;
      
      throw this.createWorkflowError(
        'WORKFLOW_START_FAILED',
        `Failed to start character generation: ${error instanceof Error ? error.message : String(error)}`,
        error
      );
    }
  }
  
  /**
   * Get job status and progress
   */
  public async getJobStatus(jobId: string): Promise<{
    job: CharacterGenerationJob | null;
    progress?: any;
    timeline?: any[];
  }> {
    try {
      // Get job from active jobs or database
      let job = this.activeJobs.get(jobId);
      if (!job) {
        const dbJob = await this.jobModel.findById(jobId);
        if (dbJob && isCharacterGenerationJob(dbJob)) {
          job = dbJob;
        }
      }
      
      if (!job) {
        return { job: null };
      }
      
      // Get progress from status tracker if enabled
      let progress;
      let timeline;
      if (this.config.enableStatusTracking) {
        const status = await this.statusTracker.getStatus(jobId);
        progress = status?.progress;
        timeline = status?.timeline;
      }
      
      return { job, progress, timeline };
      
    } catch (error) {
      console.error(`Failed to get job status for ${jobId}:`, error);
      throw this.createWorkflowError(
        'STATUS_RETRIEVAL_FAILED',
        `Failed to get job status: ${error instanceof Error ? error.message : String(error)}`,
        error
      );
    }
  }
  
  /**
   * Cancel a job
   */
  public async cancelJob(jobId: string): Promise<boolean> {
    try {
      const job = this.activeJobs.get(jobId);
      if (!job) {
        return false;
      }
      
      // Update job status
      job.status = 'cancelled';
      job.updatedAt = new Date();
      
      // Save to database
      await this.jobModel.update(jobId, { 
        status: 'cancelled',
        updatedAt: job.updatedAt
      });
      
      // Cancel nanoBanana request if active
      this.nanoBananaClient.cancelRequest(jobId);
      
      // Stop status tracking
      if (this.config.enableStatusTracking) {
        await this.statusTracker.stopTracking(jobId);
      }
      
      // Remove from active jobs
      this.activeJobs.delete(jobId);
      this.metrics.currentActiveJobs--;
      
      // Emit cancelled event
      this.emitEvent('job_cancelled', jobId, { job });
      
      return true;
      
    } catch (error) {
      console.error(`Failed to cancel job ${jobId}:`, error);
      return false;
    }
  }
  
  /**
   * Get workflow status and metrics
   */
  public getWorkflowStatus(): WorkflowStatus {
    const successRate = this.metrics.totalJobs > 0 
      ? this.metrics.completedJobs / this.metrics.totalJobs 
      : 0;
    
    const retryRate = this.metrics.totalJobs > 0 
      ? this.metrics.failedJobs / this.metrics.totalJobs 
      : 0;
    
    return {
      isHealthy: successRate > 0.8, // Consider healthy if >80% success rate
      activeJobs: this.activeJobs.size,
      queueSize: this.queueService.getQueueSize(),
      metrics: {
        ...this.metrics,
        successRate,
        retryRate
      },
      lastUpdate: new Date()
    };
  }
  
  /**
   * Process a character generation job
   */
  private async processJob(job: CharacterGenerationJob): Promise<void> {
    const startTime = Date.now();
    
    try {
      // Update job status to processing
      await this.updateJobStatus(job, 'processing');
      
      // Update progress if status tracking is enabled
      if (this.config.enableStatusTracking) {
        await this.statusTracker.updateProgress(job.id, {
          percentage: 10,
          stage: 'preprocessing',
          message: 'Preparing generation request'
        });
      }
      
      // Build nanoBanana request
      const nanoBananaRequest: CharacterGenerationRequest = {
        characterId: job.characterId,
        characterSpecs: job.characterSpecs,
        generationParams: job.generationParams,
        variations: job.generationParams?.variations || 1
      };
      
      // Update progress
      if (this.config.enableStatusTracking) {
        await this.statusTracker.updateProgress(job.id, {
          percentage: 30,
          stage: 'generating',
          message: 'Generating character images'
        });
      }
      
      // Call nanoBanana API
      const nanoBananaResponse = await this.nanoBananaClient.generateCharacter(nanoBananaRequest);
      
      // Update progress
      if (this.config.enableStatusTracking) {
        await this.statusTracker.updateProgress(job.id, {
          percentage: 70,
          stage: 'postprocessing',
          message: 'Processing generated images'
        });
      }
      
      // Convert response to internal format
      const results = await convertFromNanoBananaResponse(nanoBananaResponse);
      
      // Update job with results
      job.results = results;
      job.completedAt = new Date();
      await this.updateJobStatus(job, 'completed');
      
      // Update progress to completed
      if (this.config.enableStatusTracking) {
        await this.statusTracker.updateProgress(job.id, {
          percentage: 100,
          stage: 'uploading',
          message: 'Character generation completed'
        });
        
        await this.statusTracker.completeTracking(job.id, {
          results: results,
          completionTimeMs: Date.now() - startTime
        });
      }
      
      // Update metrics
      this.metrics.completedJobs++;
      this.metrics.currentActiveJobs--;
      this.updateAverageCompletionTime(Date.now() - startTime);
      
      // Remove from active jobs
      this.activeJobs.delete(job.id);
      
      // Emit completion event
      this.emitEvent('job_completed', job.id, { job, results });
      
    } catch (error) {
      console.error(`Job ${job.id} failed:`, error);
      await this.handleJobFailure(job, error, startTime);
    }
  }
  
  /**
   * Handle job failure with optional retry logic
   */
  private async handleJobFailure(
    job: CharacterGenerationJob, 
    error: any, 
    startTime?: number
  ): Promise<void> {
    const processingTime = startTime ? Date.now() - startTime : 0;
    
    // Create error object
    const generationError: GenerationError = {
      code: error.code || 'GENERATION_FAILED',
      message: error.message || String(error),
      details: error,
      retryable: this.isRetryableError(error),
      retryCount: (job.error?.retryCount || 0) + 1,
      lastRetryAt: new Date(),
      originalError: error
    };
    
    // Update job with error
    job.error = generationError;
    job.updatedAt = new Date();
    
    // Check if we should retry
    if (this.config.enableAutoRetry && 
        generationError.retryable && 
        generationError.retryCount <= this.config.maxRetryAttempts) {
      
      // Schedule retry
      job.status = 'pending';
      await this.updateJobInDatabase(job);
      
      // Emit retry event
      this.emitEvent('job_failed', job.id, { job, error: generationError, willRetry: true });
      
      // Use error recovery service if enabled
      if (this.config.enableErrorRecovery) {
        await this.errorRecovery.handleError(error, {
          jobId: job.id,
          retryCount: generationError.retryCount,
          context: 'character_generation'
        });
      }
      
      // Schedule retry after delay
      setTimeout(() => {
        this.processJob(job).catch(retryError => {
          console.error(`Retry failed for job ${job.id}:`, retryError);
          this.handleJobFailure(job, retryError);
        });
      }, this.config.retryDelayMs);
      
      this.metrics.retryRate = (this.metrics.retryRate + 1) / this.metrics.totalJobs;
      
    } else {
      // Mark job as permanently failed
      job.status = 'failed';
      await this.updateJobInDatabase(job);
      
      // Update status tracker
      if (this.config.enableStatusTracking) {
        await this.statusTracker.failTracking(job.id, {
          error: generationError,
          processingTimeMs: processingTime
        });
      }
      
      // Update metrics
      this.metrics.failedJobs++;
      this.metrics.currentActiveJobs--;
      
      // Remove from active jobs
      this.activeJobs.delete(job.id);
      
      // Emit failure event
      this.emitEvent('job_failed', job.id, { job, error: generationError, willRetry: false });
    }
  }
  
  /**
   * Utility methods
   */
  private generateJobId(): string {
    return `job_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
  
  private generateCharacterId(): string {
    return `char_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
  
  private async updateJobStatus(job: CharacterGenerationJob, status: JobStatus): Promise<void> {
    job.status = status;
    job.updatedAt = new Date();
    if (status === 'completed') {
      job.completedAt = new Date();
    }
    await this.updateJobInDatabase(job);
  }
  
  private async updateJobInDatabase(job: CharacterGenerationJob): Promise<void> {
    await this.jobModel.update(job.id, {
      status: job.status,
      updatedAt: job.updatedAt,
      completedAt: job.completedAt,
      data: {
        characterId: job.characterId,
        characterSpecs: job.characterSpecs,
        generationParams: job.generationParams,
        results: job.results,
        error: job.error,
        progress: job.progress
      }
    });
  }
  
  private estimateCompletionTime(job: CharacterGenerationJob): number {
    const baseTime = 30000; // 30 seconds base
    const variationMultiplier = job.generationParams?.variations || 1;
    const qualityMultiplier = this.getQualityMultiplier(job.generationParams?.quality);
    
    return Math.floor(baseTime * variationMultiplier * qualityMultiplier);
  }
  
  private getQualityMultiplier(quality?: string): number {
    switch (quality) {
      case 'low': return 0.5;
      case 'medium': return 1;
      case 'high': return 1.5;
      case 'ultra': return 2;
      default: return 1;
    }
  }
  
  private updateAverageCompletionTime(completionTime: number): void {
    const totalCompleted = this.metrics.completedJobs;
    this.metrics.averageCompletionTimeMs = 
      (this.metrics.averageCompletionTimeMs * (totalCompleted - 1) + completionTime) / totalCompleted;
  }
  
  private isRetryableError(error: any): boolean {
    if (error?.retryable !== undefined) {
      return error.retryable;
    }
    
    // Check for specific retryable error codes
    const retryableErrors = [
      'RATE_LIMIT_EXCEEDED',
      'TIMEOUT',
      'NETWORK_ERROR',
      'SERVICE_UNAVAILABLE',
      'INTERNAL_SERVER_ERROR'
    ];
    
    return retryableErrors.includes(error?.code);
  }
  
  private createWorkflowError(code: string, message: string, originalError?: any): Error {
    const error = new Error(message);
    (error as any).code = code;
    (error as any).originalError = originalError;
    return error;
  }
  
  private emitEvent(type: GenerationEventType, jobId: string, data: any): void {
    const event: GenerationEvent = {
      type,
      jobId,
      timestamp: new Date(),
      data
    };
    
    this.emit(type, event);
  }
  
  private setupEventHandlers(): void {
    // Listen to queue events
    this.queueService.on('job_started', (event) => {
      this.emit('job_started', event);
    });
    
    this.queueService.on('job_completed', (event) => {
      this.emit('job_completed', event);
    });
    
    this.queueService.on('job_failed', (event) => {
      this.emit('job_failed', event);
    });
    
    // Listen to nanoBanana client events
    this.nanoBananaClient.on('request_started', (event) => {
      this.emit('generation_started', event);
    });
    
    this.nanoBananaClient.on('request_completed', (event) => {
      this.emit('generation_completed', event);
    });
    
    this.nanoBananaClient.on('request_failed', (event) => {
      this.emit('generation_failed', event);
    });
  }
  
  /**
   * Cleanup and shutdown
   */
  public async shutdown(): Promise<void> {
    // Cancel all active jobs
    for (const [jobId] of this.activeJobs) {
      await this.cancelJob(jobId);
    }
    
    // Stop services
    await this.queueService.stop();
    await this.statusTracker.shutdown();
    this.nanoBananaClient.destroy();
    
    // Clear all listeners
    this.removeAllListeners();
  }
}

// Factory function
export const createCharacterWorkflowService = (
  config?: Partial<WorkflowConfig>
): CharacterWorkflowService => {
  return new CharacterWorkflowService(config);
};

// Singleton instance
let defaultWorkflowService: CharacterWorkflowService | null = null;

export const getDefaultCharacterWorkflowService = (): CharacterWorkflowService => {
  if (!defaultWorkflowService) {
    defaultWorkflowService = new CharacterWorkflowService();
  }
  return defaultWorkflowService;
};

export default CharacterWorkflowService;