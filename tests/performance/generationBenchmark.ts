/**
 * Performance Benchmark Tests for Character Generation
 * Measures and validates performance requirements for the generation system
 */

import { 
  CharacterWorkflowService,
  WorkflowConfig 
} from '../../src/services/characterWorkflow';
import { NanoBananaClient } from '../../src/services/nanoBananaClient';
import { GenerationQueueService } from '../../src/services/generationQueue';
import { StatusTrackerService } from '../../src/services/statusTracker';
import { GenerationJobModel } from '../../src/models/GenerationJob';
import { AuthTokenManager } from '../../src/utils/authTokenManager';
import { CharacterGenerationRequest } from '../../src/types/nanoBanana';

interface BenchmarkResult {
  testName: string;
  iterations: number;
  totalTimeMs: number;
  averageTimeMs: number;
  minTimeMs: number;
  maxTimeMs: number;
  p95TimeMs: number;
  p99TimeMs: number;
  throughputPerSecond: number;
  successRate: number;
  errors: string[];
}

interface PerformanceMetrics {
  memory: {
    heapUsed: number;
    heapTotal: number;
    external: number;
    rss: number;
  };
  cpuUsage: NodeJS.CpuUsage;
  timestamp: number;
}

// Performance requirements (based on typical SaaS standards)
const PERFORMANCE_REQUIREMENTS = {
  maxGenerationTimeMs: 60000, // 1 minute max per character
  minThroughputPerSecond: 0.5, // At least 0.5 generations per second under load
  maxMemoryUsageMB: 512, // Max 512MB memory usage
  minSuccessRate: 0.95, // 95% success rate minimum
  maxQueueWaitTimeMs: 30000, // Max 30 seconds queue wait time
  maxP95ResponseTimeMs: 45000, // 95th percentile under 45 seconds
  maxConcurrentJobs: 10, // System should handle 10 concurrent jobs
};

class PerformanceBenchmark {
  private workflowService: CharacterWorkflowService;
  private nanoBananaClient: NanoBananaClient;
  private startMetrics: PerformanceMetrics | null = null;

  constructor() {
    // Setup test environment with optimized config for performance testing
    const perfConfig: WorkflowConfig = {
      enableAutoRetry: true,
      maxRetryAttempts: 1, // Reduce retries for faster testing
      retryDelayMs: 500,
      timeoutMs: PERFORMANCE_REQUIREMENTS.maxGenerationTimeMs,
      enableStatusTracking: true,
      enableErrorRecovery: false, // Disable for cleaner performance measurements
      enableBatchOptimization: true
    };

    this.setupMockServices();
    
    this.workflowService = new CharacterWorkflowService(
      perfConfig,
      this.nanoBananaClient
    );
  }

  private setupMockServices(): void {
    // Create realistic mock services that simulate actual performance characteristics
    
    // Mock AuthTokenManager
    const authManager = new AuthTokenManager({ apiKey: 'perf-test-key' });
    (authManager.getAuthHeader as jest.Mock) = jest.fn().mockResolvedValue({
      'Authorization': 'Bearer perf-test-token'
    });

    this.nanoBananaClient = new NanoBananaClient(authManager);
    
    // Mock nanoBanana client with realistic response times
    jest.spyOn(this.nanoBananaClient, 'generateCharacter')
      .mockImplementation(async (request) => {
        // Simulate realistic API response time (2-30 seconds)
        const responseTime = 2000 + Math.random() * 28000;
        await this.delay(responseTime);
        
        // Simulate 5% failure rate
        if (Math.random() < 0.05) {
          throw {
            code: 'GENERATION_FAILED',
            message: 'Simulated API failure',
            retryable: true
          };
        }

        const variations = request.variations || 1;
        return {
          batchId: `perf-batch-${Date.now()}`,
          status: 'completed' as const,
          totalRequests: variations,
          completedRequests: variations,
          failedRequests: 0,
          results: Array(variations).fill(null).map((_, i) => ({
            id: `perf-result-${Date.now()}-${i}`,
            status: 'completed' as const,
            result: {
              imageUrl: `https://example.com/perf-image-${i}.png`,
              metadata: {
                dimensions: { width: 1024, height: 1024 },
                format: 'png' as const,
                fileSize: 2048000,
                generationTimeMs: responseTime,
                seed: Math.floor(Math.random() * 100000),
                model: 'nanoBanana-v1',
                provider: 'nanoBanana'
              }
            },
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
          })),
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        };
      });

    // Mock job model with realistic database simulation
    const jobModel = new GenerationJobModel();
    (jobModel.create as jest.Mock) = jest.fn().mockImplementation(async (data) => {
      await this.delay(10); // Simulate 10ms DB write time
      return { id: data.id, ...data };
    });
    (jobModel.update as jest.Mock) = jest.fn().mockImplementation(async () => {
      await this.delay(5); // Simulate 5ms DB update time
      return true;
    });
  }

  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  private captureMetrics(): PerformanceMetrics {
    const memUsage = process.memoryUsage();
    const cpuUsage = process.cpuUsage();
    
    return {
      memory: {
        heapUsed: memUsage.heapUsed,
        heapTotal: memUsage.heapTotal,
        external: memUsage.external,
        rss: memUsage.rss
      },
      cpuUsage,
      timestamp: Date.now()
    };
  }

  private calculatePercentile(times: number[], percentile: number): number {
    const sorted = times.sort((a, b) => a - b);
    const index = Math.ceil(sorted.length * percentile / 100) - 1;
    return sorted[index] || 0;
  }

  public async runBenchmark(
    testName: string,
    testFunction: () => Promise<number>,
    iterations: number = 10
  ): Promise<BenchmarkResult> {
    console.log(`Starting benchmark: ${testName} (${iterations} iterations)`);
    
    this.startMetrics = this.captureMetrics();
    const times: number[] = [];
    const errors: string[] = [];
    let successCount = 0;

    const startTime = Date.now();

    for (let i = 0; i < iterations; i++) {
      try {
        const iterationStartTime = Date.now();
        await testFunction();
        const iterationTime = Date.now() - iterationStartTime;
        
        times.push(iterationTime);
        successCount++;
        
        console.log(`  Iteration ${i + 1}: ${iterationTime}ms`);
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        errors.push(`Iteration ${i + 1}: ${errorMessage}`);
        console.error(`  Iteration ${i + 1} failed: ${errorMessage}`);
      }
    }

    const totalTime = Date.now() - startTime;
    const averageTime = times.length > 0 ? times.reduce((a, b) => a + b, 0) / times.length : 0;
    const minTime = times.length > 0 ? Math.min(...times) : 0;
    const maxTime = times.length > 0 ? Math.max(...times) : 0;
    const p95Time = this.calculatePercentile(times, 95);
    const p99Time = this.calculatePercentile(times, 99);
    const throughput = successCount / (totalTime / 1000);
    const successRate = successCount / iterations;

    const result: BenchmarkResult = {
      testName,
      iterations,
      totalTimeMs: totalTime,
      averageTimeMs: averageTime,
      minTimeMs: minTime,
      maxTimeMs: maxTime,
      p95TimeMs: p95Time,
      p99TimeMs: p99Time,
      throughputPerSecond: throughput,
      successRate,
      errors
    };

    console.log(`Benchmark completed: ${testName}`);
    console.log(`  Average time: ${averageTime.toFixed(2)}ms`);
    console.log(`  P95 time: ${p95Time.toFixed(2)}ms`);
    console.log(`  Throughput: ${throughput.toFixed(3)} ops/sec`);
    console.log(`  Success rate: ${(successRate * 100).toFixed(1)}%`);

    return result;
  }

  public validatePerformance(results: BenchmarkResult[]): { 
    passed: boolean; 
    failures: string[]; 
    warnings: string[];
  } {
    const failures: string[] = [];
    const warnings: string[] = [];

    for (const result of results) {
      // Check generation time requirements
      if (result.averageTimeMs > PERFORMANCE_REQUIREMENTS.maxGenerationTimeMs) {
        failures.push(
          `${result.testName}: Average generation time ${result.averageTimeMs}ms exceeds limit ${PERFORMANCE_REQUIREMENTS.maxGenerationTimeMs}ms`
        );
      }

      // Check P95 response time
      if (result.p95TimeMs > PERFORMANCE_REQUIREMENTS.maxP95ResponseTimeMs) {
        failures.push(
          `${result.testName}: P95 response time ${result.p95TimeMs}ms exceeds limit ${PERFORMANCE_REQUIREMENTS.maxP95ResponseTimeMs}ms`
        );
      }

      // Check success rate
      if (result.successRate < PERFORMANCE_REQUIREMENTS.minSuccessRate) {
        failures.push(
          `${result.testName}: Success rate ${(result.successRate * 100).toFixed(1)}% is below minimum ${(PERFORMANCE_REQUIREMENTS.minSuccessRate * 100)}%`
        );
      }

      // Check throughput
      if (result.throughputPerSecond < PERFORMANCE_REQUIREMENTS.minThroughputPerSecond) {
        warnings.push(
          `${result.testName}: Throughput ${result.throughputPerSecond.toFixed(3)} ops/sec is below target ${PERFORMANCE_REQUIREMENTS.minThroughputPerSecond} ops/sec`
        );
      }
    }

    // Check memory usage
    const endMetrics = this.captureMetrics();
    const memoryUsageMB = endMetrics.memory.heapUsed / 1024 / 1024;
    if (memoryUsageMB > PERFORMANCE_REQUIREMENTS.maxMemoryUsageMB) {
      failures.push(
        `Memory usage ${memoryUsageMB.toFixed(2)}MB exceeds limit ${PERFORMANCE_REQUIREMENTS.maxMemoryUsageMB}MB`
      );
    }

    return {
      passed: failures.length === 0,
      failures,
      warnings
    };
  }

  public async cleanup(): Promise<void> {
    await this.workflowService.shutdown();
  }
}

// Test suite for performance benchmarks
describe('Character Generation Performance Benchmarks', () => {
  let benchmark: PerformanceBenchmark;
  
  // Sample character specs for testing
  const testCharacterSpecs: CharacterGenerationRequest['characterSpecs'] = {
    name: 'Performance Test Hero',
    description: 'A character used for performance testing with detailed appearance and background',
    traits: ['brave', 'intelligent', 'magical', 'noble'],
    appearance: {
      age: 'young adult',
      gender: 'female',
      build: 'athletic',
      hair: 'silver',
      eyes: 'violet',
      skin: 'pale',
      clothing: 'mystical robes',
      accessories: ['staff', 'crystal pendant', 'leather boots']
    },
    personality: ['determined', 'wise', 'compassionate'],
    background: 'A powerful mage from the ancient order of crystal keepers'
  };

  beforeAll(async () => {
    benchmark = new PerformanceBenchmark();
  });

  afterAll(async () => {
    await benchmark.cleanup();
  });

  // Skip performance tests in CI unless explicitly enabled
  const runPerformanceTests = process.env.RUN_PERFORMANCE_TESTS === 'true';
  const testFn = runPerformanceTests ? test : test.skip;

  testFn('Single Character Generation Performance', async () => {
    const result = await benchmark.runBenchmark(
      'Single Character Generation',
      async () => {
        const jobId = await benchmark['workflowService'].startCharacterGeneration(
          testCharacterSpecs,
          'perf-user'
        );

        // Wait for completion
        let attempts = 0;
        const maxAttempts = 120; // 2 minutes max wait
        
        while (attempts < maxAttempts) {
          const { job } = await benchmark['workflowService'].getJobStatus(jobId);
          if (job && ['completed', 'failed'].includes(job.status)) {
            if (job.status === 'failed') {
              throw new Error(`Generation failed: ${job.error?.message}`);
            }
            return Date.now();
          }
          
          await benchmark['delay'](1000); // Check every second
          attempts++;
        }
        
        throw new Error('Generation timed out');
      },
      5
    );

    expect(result.successRate).toBeGreaterThanOrEqual(PERFORMANCE_REQUIREMENTS.minSuccessRate);
    expect(result.averageTimeMs).toBeLessThanOrEqual(PERFORMANCE_REQUIREMENTS.maxGenerationTimeMs);
  }, 600000); // 10 minute timeout

  testFn('Batch Character Generation Performance', async () => {
    const result = await benchmark.runBenchmark(
      'Batch Character Generation (2 variations)',
      async () => {
        const jobId = await benchmark['workflowService'].startCharacterGeneration(
          testCharacterSpecs,
          'batch-perf-user',
          { variations: 2 }
        );

        // Wait for completion
        let attempts = 0;
        const maxAttempts = 180; // 3 minutes max wait for batch
        
        while (attempts < maxAttempts) {
          const { job } = await benchmark['workflowService'].getJobStatus(jobId);
          if (job && ['completed', 'failed'].includes(job.status)) {
            if (job.status === 'failed') {
              throw new Error(`Batch generation failed: ${job.error?.message}`);
            }
            return Date.now();
          }
          
          await benchmark['delay'](1000);
          attempts++;
        }
        
        throw new Error('Batch generation timed out');
      },
      3
    );

    expect(result.successRate).toBeGreaterThanOrEqual(PERFORMANCE_REQUIREMENTS.minSuccessRate);
  }, 900000); // 15 minute timeout

  testFn('Concurrent Generation Load Test', async () => {
    const result = await benchmark.runBenchmark(
      'Concurrent Generation Load',
      async () => {
        // Start multiple concurrent generations
        const concurrentJobs = 3;
        const promises = Array(concurrentJobs).fill(null).map(async (_, i) => {
          const jobId = await benchmark['workflowService'].startCharacterGeneration(
            { ...testCharacterSpecs, name: `Concurrent Hero ${i}` },
            `concurrent-user-${i}`
          );
          return jobId;
        });

        const jobIds = await Promise.all(promises);

        // Wait for all to complete
        await Promise.all(jobIds.map(async (jobId) => {
          let attempts = 0;
          const maxAttempts = 120;
          
          while (attempts < maxAttempts) {
            const { job } = await benchmark['workflowService'].getJobStatus(jobId);
            if (job && ['completed', 'failed'].includes(job.status)) {
              if (job.status === 'failed') {
                throw new Error(`Concurrent generation ${jobId} failed`);
              }
              return;
            }
            
            await benchmark['delay'](1000);
            attempts++;
          }
          
          throw new Error(`Concurrent generation ${jobId} timed out`);
        }));

        return Date.now();
      },
      2
    );

    expect(result.successRate).toBeGreaterThanOrEqual(PERFORMANCE_REQUIREMENTS.minSuccessRate);
  }, 1200000); // 20 minute timeout

  testFn('System Resource Usage Test', async () => {
    const initialMemory = process.memoryUsage();
    
    // Run multiple generations to test resource usage
    const result = await benchmark.runBenchmark(
      'Resource Usage Test',
      async () => {
        const jobId = await benchmark['workflowService'].startCharacterGeneration(
          testCharacterSpecs,
          'resource-user'
        );

        let attempts = 0;
        while (attempts < 60) {
          const { job } = await benchmark['workflowService'].getJobStatus(jobId);
          if (job && ['completed', 'failed'].includes(job.status)) {
            return Date.now();
          }
          await benchmark['delay'](1000);
          attempts++;
        }
        
        throw new Error('Resource test generation timed out');
      },
      8
    );

    const finalMemory = process.memoryUsage();
    const memoryIncreaseMB = (finalMemory.heapUsed - initialMemory.heapUsed) / 1024 / 1024;
    
    console.log(`Memory increase: ${memoryIncreaseMB.toFixed(2)}MB`);
    
    // Check for memory leaks (should not increase by more than 100MB)
    expect(memoryIncreaseMB).toBeLessThan(100);
    expect(result.successRate).toBeGreaterThanOrEqual(PERFORMANCE_REQUIREMENTS.minSuccessRate);
  }, 900000);

  testFn('Performance Requirements Validation', async () => {
    // Run all benchmark tests and validate against requirements
    const results: BenchmarkResult[] = [
      await benchmark.runBenchmark('Validation Test', async () => {
        const jobId = await benchmark['workflowService'].startCharacterGeneration(testCharacterSpecs);
        
        let attempts = 0;
        while (attempts < 60) {
          const { job } = await benchmark['workflowService'].getJobStatus(jobId);
          if (job && ['completed', 'failed'].includes(job.status)) {
            if (job.status === 'failed') {
              throw new Error('Validation generation failed');
            }
            return Date.now();
          }
          await benchmark['delay'](1000);
          attempts++;
        }
        
        throw new Error('Validation generation timed out');
      }, 3)
    ];

    const validation = benchmark.validatePerformance(results);
    
    console.log('Performance Validation Results:');
    console.log(`  Overall: ${validation.passed ? 'PASSED' : 'FAILED'}`);
    
    if (validation.failures.length > 0) {
      console.log('  Failures:');
      validation.failures.forEach(failure => console.log(`    - ${failure}`));
    }
    
    if (validation.warnings.length > 0) {
      console.log('  Warnings:');
      validation.warnings.forEach(warning => console.log(`    - ${warning}`));
    }

    // Fail test if performance requirements are not met
    if (!validation.passed) {
      throw new Error(`Performance requirements not met: ${validation.failures.join(', ')}`);
    }

    expect(validation.passed).toBe(true);
  }, 600000);
});

// Export benchmark utility for use in other tests
export { PerformanceBenchmark, PERFORMANCE_REQUIREMENTS };
export default PerformanceBenchmark;