/**
 * BatchProcessor Service Tests
 */

import { BatchProcessorService } from '../batchProcessor';
import { NanoBananaClient } from '../nanoBananaClient';
import { GenerationJobModel } from '../../models/GenerationJob';
import {
  BatchGenerationJob,
  CharacterGenerationJob,
  SingleGenerationJob,
  GenerationResult,
  GenerationError
} from '../../types/generation';
import {
  BatchGenerationResponse,
  CharacterGenerationResponse,
  GenerationResponse
} from '../../types/nanoBanana';

// Mock dependencies
jest.mock('../nanoBananaClient');
jest.mock('../../models/GenerationJob');

describe('BatchProcessorService', () => {
  let batchProcessor: BatchProcessorService;
  let mockNanoBananaClient: jest.Mocked<NanoBananaClient>;
  let mockJobModel: jest.Mocked<GenerationJobModel>;

  beforeEach(() => {
    jest.clearAllMocks();

    // Create mock nanoBanana client
    mockNanoBananaClient = {
      generateBatch: jest.fn(),
      generateCharacter: jest.fn(),
      generate: jest.fn()
    } as any;

    // Create mock job model
    mockJobModel = {
      update: jest.fn()
    } as any;

    // Create batch processor with mocked dependencies
    batchProcessor = new BatchProcessorService(
      mockNanoBananaClient,
      mockJobModel,
      {
        maxBatchSize: 4,
        maxRetries: 3,
        retryDelayMs: 5000,
        timeoutMs: 300000
      }
    );
  });

  afterEach(async () => {
    await batchProcessor.shutdown();
  });

  describe('processBatchJob', () => {
    it('should successfully process a batch job', async () => {
      const batchJob: BatchGenerationJob = {
        id: 'batch_123',
        userId: 'user_123',
        type: 'batch',
        status: 'pending',
        priority: 'normal',
        createdAt: new Date(),
        updatedAt: new Date(),
        batchId: 'batch_123',
        requests: [
          {
            id: 'single_1',
            type: 'single',
            status: 'pending',
            priority: 'normal',
            createdAt: new Date(),
            updatedAt: new Date(),
            prompt: 'A beautiful landscape'
          },
          {
            id: 'single_2',
            type: 'single',
            status: 'pending',
            priority: 'normal',
            createdAt: new Date(),
            updatedAt: new Date(),
            prompt: 'A futuristic city'
          }
        ] as SingleGenerationJob[],
        totalRequests: 2,
        completedRequests: 0,
        failedRequests: 0
      };

      const batchResponse: BatchGenerationResponse = {
        batchId: 'batch_123',
        results: [
          {
            success: true,
            requestId: 'single_1',
            imageUrl: 'https://example.com/landscape.png',
            thumbnailUrl: 'https://example.com/landscape_thumb.png',
            width: 1024,
            height: 1024,
            format: 'png',
            fileSize: 1024000,
            seed: 123456,
            model: 'nanoBanana-v1',
            cost: 0.05
          },
          {
            success: true,
            requestId: 'single_2',
            imageUrl: 'https://example.com/city.png',
            thumbnailUrl: 'https://example.com/city_thumb.png',
            width: 1024,
            height: 1024,
            format: 'png',
            fileSize: 1024000,
            seed: 789012,
            model: 'nanoBanana-v1',
            cost: 0.05
          }
        ]
      };

      mockNanoBananaClient.generateBatch.mockResolvedValue(batchResponse);
      mockJobModel.update.mockResolvedValue(batchJob);

      const result = await batchProcessor.processBatchJob(batchJob);

      expect(result.batchId).toBe('batch_123');
      expect(result.totalRequests).toBe(2);
      expect(result.successCount).toBe(2);
      expect(result.failureCount).toBe(0);
      expect(result.results).toHaveLength(2);
      expect(result.errors).toHaveLength(0);

      // Verify job model updates
      expect(mockJobModel.update).toHaveBeenCalledWith('batch_123', {
        status: 'processing',
        progress: {
          percentage: 0,
          stage: 'preprocessing',
          message: 'Preparing batch requests...',
          startedAt: expect.any(Date)
        }
      });

      expect(mockJobModel.update).toHaveBeenCalledWith('batch_123', {
        status: 'completed',
        results: expect.any(Array),
        error: undefined,
        progress: {
          percentage: 100,
          stage: 'uploading',
          message: 'Batch processing completed'
        }
      });
    });

    it('should handle batch job with partial failures', async () => {
      const batchJob: BatchGenerationJob = {
        id: 'batch_123',
        userId: 'user_123',
        type: 'batch',
        status: 'pending',
        priority: 'normal',
        createdAt: new Date(),
        updatedAt: new Date(),
        batchId: 'batch_123',
        requests: [
          {
            id: 'single_1',
            type: 'single',
            status: 'pending',
            priority: 'normal',
            createdAt: new Date(),
            updatedAt: new Date(),
            prompt: 'A beautiful landscape'
          },
          {
            id: 'single_2',
            type: 'single',
            status: 'pending',
            priority: 'normal',
            createdAt: new Date(),
            updatedAt: new Date(),
            prompt: 'Invalid prompt that fails'
          }
        ] as SingleGenerationJob[],
        totalRequests: 2,
        completedRequests: 0,
        failedRequests: 0
      };

      const batchResponse: BatchGenerationResponse = {
        batchId: 'batch_123',
        results: [
          {
            success: true,
            requestId: 'single_1',
            imageUrl: 'https://example.com/landscape.png',
            thumbnailUrl: 'https://example.com/landscape_thumb.png',
            width: 1024,
            height: 1024,
            format: 'png',
            fileSize: 1024000,
            seed: 123456,
            model: 'nanoBanana-v1',
            cost: 0.05
          },
          {
            success: false,
            requestId: 'single_2',
            errorCode: 'INVALID_PROMPT',
            errorMessage: 'The provided prompt is invalid',
            error: new Error('Invalid prompt')
          }
        ]
      };

      mockNanoBananaClient.generateBatch.mockResolvedValue(batchResponse);
      mockJobModel.update.mockResolvedValue(batchJob);

      const result = await batchProcessor.processBatchJob(batchJob);

      expect(result.successCount).toBe(1);
      expect(result.failureCount).toBe(1);
      expect(result.results).toHaveLength(1);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0].code).toBe('INVALID_PROMPT');
      expect(result.errors[0].message).toBe('The provided prompt is invalid');
    });

    it('should reject batch exceeding maximum size', async () => {
      const largeBatch: BatchGenerationJob = {
        id: 'batch_123',
        userId: 'user_123',
        type: 'batch',
        status: 'pending',
        priority: 'normal',
        createdAt: new Date(),
        updatedAt: new Date(),
        batchId: 'batch_123',
        requests: Array.from({ length: 5 }, (_, i) => ({
          id: `single_${i}`,
          type: 'single',
          status: 'pending',
          priority: 'normal',
          createdAt: new Date(),
          updatedAt: new Date(),
          prompt: `Test prompt ${i}`
        })) as SingleGenerationJob[],
        totalRequests: 5,
        completedRequests: 0,
        failedRequests: 0
      };

      mockJobModel.update.mockResolvedValue(largeBatch);

      await expect(batchProcessor.processBatchJob(largeBatch))
        .rejects
        .toThrow('Batch size 5 exceeds maximum of 4');

      expect(mockJobModel.update).toHaveBeenCalledWith('batch_123', {
        status: 'failed',
        error: expect.objectContaining({
          code: 'Error',
          message: 'Batch size 5 exceeds maximum of 4'
        })
      });
    });
  });

  describe('processCharacterJob', () => {
    it('should successfully process a character generation job', async () => {
      const characterJob: CharacterGenerationJob = {
        id: 'char_job_123',
        userId: 'user_123',
        type: 'character',
        status: 'pending',
        priority: 'normal',
        createdAt: new Date(),
        updatedAt: new Date(),
        characterId: 'char_123',
        characterSpecs: {
          name: 'Aria',
          description: 'A brave elven warrior',
          appearance: {
            age: 'young adult',
            gender: 'female',
            hair: 'silver',
            eyes: 'green',
            height: 'tall',
            build: 'athletic',
            clothing: 'leather armor'
          },
          personality: ['brave', 'loyal', 'determined'],
          traits: ['skilled archer', 'nature lover']
        },
        generationParams: {
          quality: 'high',
          aspectRatio: '1:1',
          outputFormat: 'png',
          style: 'realistic',
          variations: 1
        }
      };

      const characterResponse: CharacterGenerationResponse = {
        characterId: 'char_123',
        images: [
          {
            url: 'https://example.com/aria.png',
            thumbnailUrl: 'https://example.com/aria_thumb.png',
            width: 1024,
            height: 1024,
            format: 'png',
            fileSize: 1024000,
            seed: 123456
          }
        ],
        model: 'nanoBanana-v1',
        cost: 0.10
      };

      mockNanoBananaClient.generateCharacter.mockResolvedValue(characterResponse);
      mockJobModel.update.mockResolvedValue(characterJob);

      const results = await batchProcessor.processCharacterJob(characterJob);

      expect(results).toHaveLength(1);
      expect(results[0].imageUrl).toBe('https://example.com/aria.png');
      expect(results[0].metadata.model).toBe('nanoBanana-v1');
      expect(results[0].metadata.cost).toBe(0.10);

      // Verify job updates
      expect(mockJobModel.update).toHaveBeenCalledWith('char_job_123', {
        status: 'processing',
        progress: {
          percentage: 0,
          stage: 'preprocessing',
          message: 'Preparing character generation...',
          startedAt: expect.any(Date)
        }
      });

      expect(mockJobModel.update).toHaveBeenCalledWith('char_job_123', {
        status: 'completed',
        results: expect.any(Array),
        progress: {
          percentage: 100,
          stage: 'uploading',
          message: 'Character generation completed'
        }
      });
    });

    it('should build proper prompt from character specs', async () => {
      const characterJob: CharacterGenerationJob = {
        id: 'char_job_123',
        userId: 'user_123',
        type: 'character',
        status: 'pending',
        priority: 'normal',
        createdAt: new Date(),
        updatedAt: new Date(),
        characterId: 'char_123',
        characterSpecs: {
          description: 'A mysterious wizard',
          appearance: {
            age: 'middle-aged',
            gender: 'male',
            hair: 'white beard',
            eyes: 'blue',
            clothing: 'robes'
          },
          personality: ['wise', 'mysterious'],
          traits: ['spellcaster', 'scholar']
        }
      };

      const characterResponse: CharacterGenerationResponse = {
        characterId: 'char_123',
        images: [],
        model: 'nanoBanana-v1',
        cost: 0.10
      };

      mockNanoBananaClient.generateCharacter.mockResolvedValue(characterResponse);
      mockJobModel.update.mockResolvedValue(characterJob);

      await batchProcessor.processCharacterJob(characterJob);

      expect(mockNanoBananaClient.generateCharacter).toHaveBeenCalledWith(
        expect.objectContaining({
          characterId: 'char_123',
          prompt: 'A mysterious wizard, middle-aged years old male white beard hair blue eyes wearing robes, personality: wise, mysterious, traits: spellcaster, scholar',
          characterSpecs: characterJob.characterSpecs,
          quality: 'high',
          aspectRatio: '1:1',
          outputFormat: 'png',
          style: 'realistic',
          variations: 1
        })
      );
    });
  });

  describe('processSingleJob', () => {
    it('should successfully process a single generation job', async () => {
      const singleJob: SingleGenerationJob = {
        id: 'single_123',
        userId: 'user_123',
        type: 'single',
        status: 'pending',
        priority: 'normal',
        createdAt: new Date(),
        updatedAt: new Date(),
        prompt: 'A majestic mountain landscape at sunset',
        negativePrompt: 'blurry, low quality',
        generationParams: {
          quality: 'high',
          aspectRatio: '16:9',
          outputFormat: 'png',
          seed: 123456,
          steps: 30,
          guidanceScale: 7.5
        }
      };

      const generationResponse: GenerationResponse = {
        imageUrl: 'https://example.com/mountain.png',
        thumbnailUrl: 'https://example.com/mountain_thumb.png',
        width: 1024,
        height: 576,
        format: 'png',
        fileSize: 1024000,
        seed: 123456,
        model: 'nanoBanana-v1',
        cost: 0.05
      };

      mockNanoBananaClient.generate.mockResolvedValue(generationResponse);
      mockJobModel.update.mockResolvedValue(singleJob);

      const result = await batchProcessor.processSingleJob(singleJob);

      expect(result.imageUrl).toBe('https://example.com/mountain.png');
      expect(result.metadata.dimensions).toEqual({ width: 1024, height: 576 });
      expect(result.metadata.seed).toBe(123456);

      // Verify nanoBanana client call
      expect(mockNanoBananaClient.generate).toHaveBeenCalledWith({
        prompt: 'A majestic mountain landscape at sunset',
        negativePrompt: 'blurry, low quality',
        quality: 'high',
        aspectRatio: '16:9',
        outputFormat: 'png',
        seed: 123456,
        steps: 30,
        guidanceScale: 7.5,
        inputImage: undefined
      });
    });

    it('should handle image-to-image generation', async () => {
      const singleJob: SingleGenerationJob = {
        id: 'single_123',
        userId: 'user_123',
        type: 'single',
        status: 'pending',
        priority: 'normal',
        createdAt: new Date(),
        updatedAt: new Date(),
        prompt: 'Transform this into a painting style',
        inputImage: 'data:image/jpeg;base64,/9j/4AAQSkZJRgABAQAAAQABAAD...'
      };

      const generationResponse: GenerationResponse = {
        imageUrl: 'https://example.com/painting.png',
        width: 1024,
        height: 1024,
        format: 'png',
        fileSize: 1024000,
        seed: 123456,
        model: 'nanoBanana-v1',
        cost: 0.08
      };

      mockNanoBananaClient.generate.mockResolvedValue(generationResponse);
      mockJobModel.update.mockResolvedValue(singleJob);

      await batchProcessor.processSingleJob(singleJob);

      expect(mockNanoBananaClient.generate).toHaveBeenCalledWith({
        prompt: 'Transform this into a painting style',
        negativePrompt: undefined,
        inputImage: 'data:image/jpeg;base64,/9j/4AAQSkZJRgABAQAAAQABAAD...'
      });
    });
  });

  describe('processJob', () => {
    it('should route to correct processor based on job type', async () => {
      const characterJob: CharacterGenerationJob = {
        id: 'char_job',
        type: 'character',
        status: 'pending',
        priority: 'normal',
        createdAt: new Date(),
        updatedAt: new Date(),
        characterId: 'char_123',
        characterSpecs: { description: 'Test character' }
      };

      const batchJob: BatchGenerationJob = {
        id: 'batch_job',
        type: 'batch',
        status: 'pending',
        priority: 'normal',
        createdAt: new Date(),
        updatedAt: new Date(),
        batchId: 'batch_123',
        requests: [],
        totalRequests: 0,
        completedRequests: 0,
        failedRequests: 0
      };

      const singleJob: SingleGenerationJob = {
        id: 'single_job',
        type: 'single',
        status: 'pending',
        priority: 'normal',
        createdAt: new Date(),
        updatedAt: new Date(),
        prompt: 'Test prompt'
      };

      // Mock the individual processors
      jest.spyOn(batchProcessor, 'processCharacterJob').mockResolvedValue([]);
      jest.spyOn(batchProcessor, 'processBatchJob').mockResolvedValue({
        batchId: 'batch_123',
        totalRequests: 0,
        successCount: 0,
        failureCount: 0,
        results: [],
        errors: [],
        processingTimeMs: 1000
      });
      jest.spyOn(batchProcessor, 'processSingleJob').mockResolvedValue({} as GenerationResult);

      await batchProcessor.processJob(characterJob);
      expect(batchProcessor.processCharacterJob).toHaveBeenCalledWith(characterJob);

      await batchProcessor.processJob(batchJob);
      expect(batchProcessor.processBatchJob).toHaveBeenCalledWith(batchJob);

      await batchProcessor.processJob(singleJob);
      expect(batchProcessor.processSingleJob).toHaveBeenCalledWith(singleJob);
    });

    it('should throw error for unknown job type', async () => {
      const unknownJob = {
        id: 'unknown_job',
        type: 'unknown',
        status: 'pending',
        priority: 'normal',
        createdAt: new Date(),
        updatedAt: new Date()
      } as any;

      await expect(batchProcessor.processJob(unknownJob))
        .rejects
        .toThrow('Unknown job type: unknown');
    });
  });

  describe('cancelBatch', () => {
    it('should cancel active batch', async () => {
      // Simulate an active batch by creating a long-running operation
      const batchJob: BatchGenerationJob = {
        id: 'batch_123',
        type: 'batch',
        status: 'pending',
        priority: 'normal',
        createdAt: new Date(),
        updatedAt: new Date(),
        batchId: 'batch_123',
        requests: [],
        totalRequests: 0,
        completedRequests: 0,
        failedRequests: 0
      };

      // Start processing (but don't await)
      const processingPromise = batchProcessor.processBatchJob(batchJob);
      
      // Cancel the batch
      const cancelled = batchProcessor.cancelBatch('batch_123');
      
      expect(cancelled).toBe(true);
      
      // The processing should be aborted
      await expect(processingPromise).rejects.toThrow();
    });

    it('should return false for non-existent batch', () => {
      const cancelled = batchProcessor.cancelBatch('non_existent_batch');
      expect(cancelled).toBe(false);
    });
  });

  describe('getActiveBatchCount', () => {
    it('should return 0 when no batches are active', () => {
      expect(batchProcessor.getActiveBatchCount()).toBe(0);
    });
  });

  describe('getActiveBatchIds', () => {
    it('should return empty array when no batches are active', () => {
      expect(batchProcessor.getActiveBatchIds()).toEqual([]);
    });
  });

  describe('error handling', () => {
    it('should handle API errors gracefully', async () => {
      const singleJob: SingleGenerationJob = {
        id: 'single_123',
        type: 'single',
        status: 'pending',
        priority: 'normal',
        createdAt: new Date(),
        updatedAt: new Date(),
        prompt: 'Test prompt'
      };

      const apiError = new Error('API rate limit exceeded');
      apiError.name = 'RATE_LIMITED';

      mockNanoBananaClient.generate.mockRejectedValue(apiError);
      mockJobModel.update.mockResolvedValue(singleJob);

      await expect(batchProcessor.processSingleJob(singleJob))
        .rejects
        .toThrow('API rate limit exceeded');

      expect(mockJobModel.update).toHaveBeenCalledWith('single_123', {
        status: 'failed',
        error: {
          code: 'RATE_LIMITED',
          message: 'API rate limit exceeded',
          retryable: true,
          originalError: apiError
        }
      });
    });

    it('should emit error events', async () => {
      const singleJob: SingleGenerationJob = {
        id: 'single_123',
        type: 'single',
        status: 'pending',
        priority: 'normal',
        createdAt: new Date(),
        updatedAt: new Date(),
        prompt: 'Test prompt'
      };

      const apiError = new Error('Generation failed');
      mockNanoBananaClient.generate.mockRejectedValue(apiError);
      mockJobModel.update.mockResolvedValue(singleJob);

      const events: any[] = [];
      batchProcessor.on('singleFailed', (event) => events.push(event));

      await expect(batchProcessor.processSingleJob(singleJob))
        .rejects
        .toThrow('Generation failed');

      expect(events).toHaveLength(1);
      expect(events[0].job.id).toBe('single_123');
      expect(events[0].error.message).toBe('Generation failed');
    });
  });

  describe('progress tracking', () => {
    it('should update progress during processing', async () => {
      const singleJob: SingleGenerationJob = {
        id: 'single_123',
        type: 'single',
        status: 'pending',
        priority: 'normal',
        createdAt: new Date(),
        updatedAt: new Date(),
        prompt: 'Test prompt'
      };

      const generationResponse: GenerationResponse = {
        imageUrl: 'https://example.com/result.png',
        width: 1024,
        height: 1024,
        format: 'png',
        fileSize: 1024000,
        seed: 123456,
        model: 'nanoBanana-v1'
      };

      mockNanoBananaClient.generate.mockResolvedValue(generationResponse);
      mockJobModel.update.mockResolvedValue(singleJob);

      await batchProcessor.processSingleJob(singleJob);

      // Verify multiple progress updates
      const updateCalls = mockJobModel.update.mock.calls;
      
      expect(updateCalls.find(call => 
        call[1].progress?.stage === 'preprocessing'
      )).toBeTruthy();
      
      expect(updateCalls.find(call => 
        call[1].progress?.stage === 'generating'
      )).toBeTruthy();
      
      expect(updateCalls.find(call => 
        call[1].progress?.stage === 'postprocessing'
      )).toBeTruthy();
      
      expect(updateCalls.find(call => 
        call[1].status === 'completed'
      )).toBeTruthy();
    });
  });
});