/**
 * Batch Processor Service
 * Handles batch processing of up to 4 character generation requests using nanoBanana API
 */

import { EventEmitter } from 'events';
import {
  GenerationJob,
  CharacterGenerationJob,
  BatchGenerationJob,
  SingleGenerationJob,
  GenerationResult,
  GenerationError,
  GenerationProgress,
  isBatchGenerationJob,
  isCharacterGenerationJob,
  isSingleGenerationJob
} from '../types/generation';
import {
  BatchGenerationRequest,
  CharacterGenerationRequest,
  GenerationRequest
} from '../types/nanoBanana';
import { NanoBananaClient } from './nanoBananaClient';
import { GenerationJobModel } from '../models/GenerationJob';

export interface BatchProcessingOptions {
  maxBatchSize?: number;
  maxRetries?: number;
  retryDelayMs?: number;
  timeoutMs?: number;
}

export interface BatchProcessingResult {
  batchId: string;
  totalRequests: number;
  successCount: number;
  failureCount: number;
  results: GenerationResult[];
  errors: GenerationError[];
  processingTimeMs: number;
}

export class BatchProcessorService extends EventEmitter {
  private nanoBananaClient: NanoBananaClient;
  private jobModel: GenerationJobModel;
  private options: BatchProcessingOptions;
  private activeBatches: Map<string, AbortController> = new Map();

  constructor(
    nanoBananaClient?: NanoBananaClient,
    jobModel?: GenerationJobModel,
    options?: BatchProcessingOptions
  ) {
    super();
    
    this.nanoBananaClient = nanoBananaClient || new NanoBananaClient();
    this.jobModel = jobModel || new GenerationJobModel();
    this.options = {
      maxBatchSize: 4,
      maxRetries: 3,
      retryDelayMs: 5000,
      timeoutMs: 300000, // 5 minutes
      ...options
    };
  }

  /**
   * Process a batch job
   */
  async processBatchJob(job: BatchGenerationJob): Promise<BatchProcessingResult> {
    const startTime = Date.now();
    const abortController = new AbortController();
    this.activeBatches.set(job.batchId, abortController);

    try {
      // Update job status to processing
      await this.jobModel.update(job.id, {
        status: 'processing',
        progress: {
          percentage: 0,
          stage: 'preprocessing',
          message: 'Preparing batch requests...',
          startedAt: new Date()
        }
      });

      // Validate batch size
      if (job.requests.length > this.options.maxBatchSize!) {
        throw new Error(`Batch size ${job.requests.length} exceeds maximum of ${this.options.maxBatchSize}`);
      }

      // Convert to nanoBanana requests
      const nanoBananaRequests = await this.convertToNanoBananaRequests(job.requests);

      // Update progress
      await this.updateProgress(job.id, {
        percentage: 10,
        stage: 'generating',
        message: `Processing ${nanoBananaRequests.length} requests...`
      });

      // Process batch with nanoBanana API
      const batchRequest: BatchGenerationRequest = {
        requests: nanoBananaRequests,
        batchId: job.batchId,
        webhook: {
          url: process.env.WEBHOOK_URL,
          events: ['batch_completed', 'batch_failed']
        }
      };

      const batchResponse = await this.nanoBananaClient.generateBatch(
        batchRequest,
        abortController.signal
      );

      // Update progress
      await this.updateProgress(job.id, {
        percentage: 50,
        stage: 'postprocessing',
        message: 'Processing results...'
      });

      // Process results
      const results: GenerationResult[] = [];
      const errors: GenerationError[] = [];
      let successCount = 0;
      let failureCount = 0;

      if (batchResponse.results) {
        for (const result of batchResponse.results) {
          if (result.success) {
            results.push(this.convertToGenerationResult(result));
            successCount++;
          } else {
            errors.push(this.convertToGenerationError(result));
            failureCount++;
          }
        }
      }

      // Update job with final results
      const finalStatus = successCount > 0 ? 'completed' : 'failed';
      const processingTimeMs = Date.now() - startTime;

      await this.jobModel.update(job.id, {
        status: finalStatus,
        results,
        error: errors.length > 0 ? errors[0] : undefined,
        progress: {
          percentage: 100,
          stage: 'uploading',
          message: 'Batch processing completed'
        }
      });

      const batchResult: BatchProcessingResult = {
        batchId: job.batchId,
        totalRequests: job.requests.length,
        successCount,
        failureCount,
        results,
        errors,
        processingTimeMs
      };

      this.emit('batchCompleted', batchResult);
      return batchResult;

    } catch (error) {
      const processingTimeMs = Date.now() - startTime;
      const errorObj: GenerationError = {
        code: error instanceof Error ? error.name : 'UNKNOWN_ERROR',
        message: error instanceof Error ? error.message : 'Unknown error occurred',
        retryable: this.isRetryableError(error),
        originalError: error
      };

      await this.jobModel.update(job.id, {
        status: 'failed',
        error: errorObj
      });

      const batchResult: BatchProcessingResult = {
        batchId: job.batchId,
        totalRequests: job.requests.length,
        successCount: 0,
        failureCount: job.requests.length,
        results: [],
        errors: [errorObj],
        processingTimeMs
      };

      this.emit('batchFailed', batchResult);
      throw error;

    } finally {
      this.activeBatches.delete(job.batchId);
    }
  }

  /**
   * Process a character generation job
   */
  async processCharacterJob(job: CharacterGenerationJob): Promise<GenerationResult[]> {
    const startTime = Date.now();

    try {
      // Update job status to processing
      await this.jobModel.update(job.id, {
        status: 'processing',
        progress: {
          percentage: 0,
          stage: 'preprocessing',
          message: 'Preparing character generation...',
          startedAt: new Date()
        }
      });

      // Convert to nanoBanana request
      const nanoBananaRequest = await this.convertCharacterToNanoBananaRequest(job);

      // Update progress
      await this.updateProgress(job.id, {
        percentage: 10,
        stage: 'generating',
        message: 'Generating character...'
      });

      // Process with nanoBanana API
      const response = await this.nanoBananaClient.generateCharacter(nanoBananaRequest);

      // Update progress
      await this.updateProgress(job.id, {
        percentage: 80,
        stage: 'postprocessing',
        message: 'Processing results...'
      });

      // Convert results
      const results: GenerationResult[] = [];
      if (response.images) {
        for (const image of response.images) {
          results.push({
            id: `result_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
            imageUrl: image.url,
            thumbnailUrl: image.thumbnailUrl,
            metadata: {
              dimensions: {
                width: image.width || 1024,
                height: image.height || 1024
              },
              format: image.format || 'png',
              fileSize: image.fileSize || 0,
              generationTimeMs: Date.now() - startTime,
              seed: image.seed || 0,
              model: response.model || 'nanoBanana-v1',
              provider: 'NANOBANANA_API',
              cost: response.cost
            },
            createdAt: new Date()
          });
        }
      }

      // Update job with results
      await this.jobModel.update(job.id, {
        status: 'completed',
        results,
        progress: {
          percentage: 100,
          stage: 'uploading',
          message: 'Character generation completed'
        }
      });

      this.emit('characterCompleted', { job, results });
      return results;

    } catch (error) {
      const errorObj: GenerationError = {
        code: error instanceof Error ? error.name : 'UNKNOWN_ERROR',
        message: error instanceof Error ? error.message : 'Unknown error occurred',
        retryable: this.isRetryableError(error),
        originalError: error
      };

      await this.jobModel.update(job.id, {
        status: 'failed',
        error: errorObj
      });

      this.emit('characterFailed', { job, error: errorObj });
      throw error;
    }
  }

  /**
   * Process a single generation job
   */
  async processSingleJob(job: SingleGenerationJob): Promise<GenerationResult> {
    const startTime = Date.now();

    try {
      // Update job status to processing
      await this.jobModel.update(job.id, {
        status: 'processing',
        progress: {
          percentage: 0,
          stage: 'preprocessing',
          message: 'Preparing generation...',
          startedAt: new Date()
        }
      });

      // Convert to nanoBanana request
      const nanoBananaRequest: GenerationRequest = {
        prompt: job.prompt,
        negativePrompt: job.negativePrompt,
        ...job.generationParams,
        inputImage: job.inputImage
      };

      // Update progress
      await this.updateProgress(job.id, {
        percentage: 10,
        stage: 'generating',
        message: 'Generating image...'
      });

      // Process with nanoBanana API
      const response = await this.nanoBananaClient.generate(nanoBananaRequest);

      // Update progress
      await this.updateProgress(job.id, {
        percentage: 80,
        stage: 'postprocessing',
        message: 'Processing result...'
      });

      // Convert result
      const result: GenerationResult = {
        id: `result_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        imageUrl: response.imageUrl,
        thumbnailUrl: response.thumbnailUrl,
        metadata: {
          dimensions: {
            width: response.width || 1024,
            height: response.height || 1024
          },
          format: response.format || 'png',
          fileSize: response.fileSize || 0,
          generationTimeMs: Date.now() - startTime,
          seed: response.seed || 0,
          model: response.model || 'nanoBanana-v1',
          provider: 'NANOBANANA_API',
          cost: response.cost
        },
        createdAt: new Date()
      };

      // Update job with result
      await this.jobModel.update(job.id, {
        status: 'completed',
        results: [result],
        progress: {
          percentage: 100,
          stage: 'uploading',
          message: 'Generation completed'
        }
      });

      this.emit('singleCompleted', { job, result });
      return result;

    } catch (error) {
      const errorObj: GenerationError = {
        code: error instanceof Error ? error.name : 'UNKNOWN_ERROR',
        message: error instanceof Error ? error.message : 'Unknown error occurred',
        retryable: this.isRetryableError(error),
        originalError: error
      };

      await this.jobModel.update(job.id, {
        status: 'failed',
        error: errorObj
      });

      this.emit('singleFailed', { job, error: errorObj });
      throw error;
    }
  }

  /**
   * Process any generation job based on its type
   */
  async processJob(job: GenerationJob): Promise<GenerationResult | GenerationResult[] | BatchProcessingResult> {
    if (isBatchGenerationJob(job)) {
      return this.processBatchJob(job);
    } else if (isCharacterGenerationJob(job)) {
      return this.processCharacterJob(job);
    } else if (isSingleGenerationJob(job)) {
      return this.processSingleJob(job);
    } else {
      throw new Error(`Unknown job type: ${job.type}`);
    }
  }

  /**
   * Cancel a batch processing job
   */
  async cancelBatch(batchId: string): Promise<boolean> {
    const abortController = this.activeBatches.get(batchId);
    if (abortController) {
      abortController.abort();
      this.activeBatches.delete(batchId);
      return true;
    }
    return false;
  }

  /**
   * Get active batch count
   */
  getActiveBatchCount(): number {
    return this.activeBatches.size;
  }

  /**
   * Get active batch IDs
   */
  getActiveBatchIds(): string[] {
    return Array.from(this.activeBatches.keys());
  }

  /**
   * Convert character job to nanoBanana request
   */
  private async convertCharacterToNanoBananaRequest(
    job: CharacterGenerationJob
  ): Promise<CharacterGenerationRequest> {
    const { characterSpecs, generationParams } = job;

    // Build prompt from character specs
    let prompt = characterSpecs.description || '';
    
    if (characterSpecs.appearance) {
      const appearance = characterSpecs.appearance;
      const appearanceParts = [];
      
      if (appearance.age) appearanceParts.push(`${appearance.age} years old`);
      if (appearance.gender) appearanceParts.push(appearance.gender);
      if (appearance.build) appearanceParts.push(`${appearance.build} build`);
      if (appearance.hair) appearanceParts.push(`${appearance.hair} hair`);
      if (appearance.eyes) appearanceParts.push(`${appearance.eyes} eyes`);
      if (appearance.skin) appearanceParts.push(`${appearance.skin} skin`);
      if (appearance.clothing) appearanceParts.push(`wearing ${appearance.clothing}`);
      
      if (appearanceParts.length > 0) {
        prompt += `, ${appearanceParts.join(', ')}`;
      }
    }

    if (characterSpecs.personality && characterSpecs.personality.length > 0) {
      prompt += `, personality: ${characterSpecs.personality.join(', ')}`;
    }

    if (characterSpecs.traits && characterSpecs.traits.length > 0) {
      prompt += `, traits: ${characterSpecs.traits.join(', ')}`;
    }

    return {
      characterId: job.characterId,
      prompt,
      characterSpecs,
      quality: generationParams?.quality || 'high',
      aspectRatio: generationParams?.aspectRatio || '1:1',
      outputFormat: generationParams?.outputFormat || 'png',
      style: generationParams?.style || 'realistic',
      variations: generationParams?.variations || 1
    };
  }

  /**
   * Convert job array to nanoBanana requests
   */
  private async convertToNanoBananaRequests(jobs: SingleGenerationJob[]): Promise<GenerationRequest[]> {
    return jobs.map(job => ({
      prompt: job.prompt,
      negativePrompt: job.negativePrompt,
      ...job.generationParams,
      inputImage: job.inputImage
    }));
  }

  /**
   * Convert nanoBanana result to GenerationResult
   */
  private convertToGenerationResult(nanoBananaResult: any): GenerationResult {
    return {
      id: `result_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      imageUrl: nanoBananaResult.imageUrl,
      thumbnailUrl: nanoBananaResult.thumbnailUrl,
      metadata: {
        dimensions: {
          width: nanoBananaResult.width || 1024,
          height: nanoBananaResult.height || 1024
        },
        format: nanoBananaResult.format || 'png',
        fileSize: nanoBananaResult.fileSize || 0,
        generationTimeMs: nanoBananaResult.generationTime || 0,
        seed: nanoBananaResult.seed || 0,
        model: nanoBananaResult.model || 'nanoBanana-v1',
        provider: 'NANOBANANA_API',
        cost: nanoBananaResult.cost
      },
      createdAt: new Date()
    };
  }

  /**
   * Convert nanoBanana error to GenerationError
   */
  private convertToGenerationError(nanoBananaResult: any): GenerationError {
    return {
      code: nanoBananaResult.errorCode || 'UNKNOWN_ERROR',
      message: nanoBananaResult.errorMessage || 'Unknown error occurred',
      retryable: this.isRetryableError(nanoBananaResult.error),
      originalError: nanoBananaResult.error
    };
  }

  /**
   * Update job progress
   */
  private async updateProgress(jobId: string, progress: Partial<GenerationProgress>): Promise<void> {
    await this.jobModel.update(jobId, { progress });
    this.emit('jobProgress', { jobId, progress });
  }

  /**
   * Check if error is retryable
   */
  private isRetryableError(error: any): boolean {
    if (!error) return false;
    
    const retryableCodes = [
      'RATE_LIMITED',
      'TIMEOUT',
      'NETWORK_ERROR',
      'SERVER_ERROR',
      'SERVICE_UNAVAILABLE'
    ];

    const errorCode = error.code || error.name || '';
    return retryableCodes.includes(errorCode);
  }

  /**
   * Shutdown the batch processor
   */
  async shutdown(): Promise<void> {
    // Cancel all active batches
    for (const [batchId, controller] of this.activeBatches) {
      controller.abort();
    }
    this.activeBatches.clear();
    
    this.removeAllListeners();
  }
}

export default new BatchProcessorService();