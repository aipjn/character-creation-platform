export interface GenerationJobBase {
    id: string;
    userId?: string;
    type: 'character' | 'batch' | 'single';
    status: 'pending' | 'queued' | 'processing' | 'completed' | 'failed' | 'cancelled';
    priority: 'low' | 'normal' | 'high' | 'urgent';
    createdAt: Date;
    updatedAt: Date;
    completedAt?: Date;
    scheduledAt?: Date;
}
export interface CharacterGenerationJob extends GenerationJobBase {
    type: 'character';
    characterId: string;
    characterSpecs: {
        name?: string;
        description: string;
        traits?: string[];
        appearance?: {
            age?: string;
            gender?: string;
            height?: string;
            build?: string;
            hair?: string;
            eyes?: string;
            skin?: string;
            clothing?: string;
            accessories?: string[];
        };
        personality?: string[];
        background?: string;
    };
    generationParams?: {
        quality?: 'low' | 'medium' | 'high' | 'ultra';
        aspectRatio?: '1:1' | '16:9' | '9:16' | '4:3' | '3:4' | '2:1' | '1:2';
        outputFormat?: 'png' | 'jpeg' | 'jpg' | 'webp';
        style?: 'realistic' | 'artistic' | 'anime' | 'cartoon' | 'concept-art';
        variations?: number;
    };
    results?: GenerationResult[];
    error?: GenerationError;
    progress?: GenerationProgress;
}
export interface BatchGenerationJob extends GenerationJobBase {
    type: 'batch';
    batchId: string;
    requests: SingleGenerationJob[];
    totalRequests: number;
    completedRequests: number;
    failedRequests: number;
    results?: GenerationResult[];
    error?: GenerationError;
}
export interface SingleGenerationJob extends GenerationJobBase {
    type: 'single';
    prompt: string;
    negativePrompt?: string;
    generationParams?: {
        quality?: 'low' | 'medium' | 'high' | 'ultra';
        aspectRatio?: '1:1' | '16:9' | '9:16' | '4:3' | '3:4' | '2:1' | '1:2';
        outputFormat?: 'png' | 'jpeg' | 'jpg' | 'webp';
        style?: 'realistic' | 'artistic' | 'anime' | 'cartoon' | 'concept-art';
        seed?: number;
        steps?: number;
        guidanceScale?: number;
    };
    inputImage?: string;
    result?: GenerationResult;
    error?: GenerationError;
    progress?: GenerationProgress;
}
export type GenerationJob = CharacterGenerationJob | BatchGenerationJob | SingleGenerationJob;
export interface GenerationResult {
    id: string;
    imageUrl?: string;
    imageData?: string;
    thumbnailUrl?: string;
    metadata: {
        dimensions: {
            width: number;
            height: number;
        };
        format: 'png' | 'jpeg' | 'jpg' | 'webp';
        fileSize: number;
        generationTimeMs: number;
        seed: number;
        model: string;
        provider: string;
        cost?: number;
    };
    createdAt: Date;
    storageInfo?: {
        storageKey?: string;
        cloudfrontUrl?: string;
        expiresAt?: Date;
    };
}
export interface GenerationError {
    code: string;
    message: string;
    details?: any;
    retryable: boolean;
    retryCount?: number;
    lastRetryAt?: Date;
    originalError?: any;
}
export interface GenerationProgress {
    percentage: number;
    stage: 'queued' | 'preprocessing' | 'generating' | 'postprocessing' | 'uploading';
    message?: string;
    estimatedTimeRemainingMs?: number;
    startedAt?: Date;
}
export interface QueueMetrics {
    pending: number;
    processing: number;
    completed: number;
    failed: number;
    averageWaitTimeMs: number;
    averageProcessingTimeMs: number;
    throughputPerHour: number;
}
export interface QueueConfiguration {
    maxConcurrentJobs: number;
    maxQueueSize: number;
    priorityLevels: readonly string[];
    retryAttempts: number;
    retryDelayMs: number;
    jobTimeoutMs: number;
}
export type GenerationEventType = 'job_created' | 'job_queued' | 'job_started' | 'job_progress' | 'job_completed' | 'job_failed' | 'job_cancelled' | 'job_timeout' | 'queue_full' | 'queue_empty' | 'batch_started' | 'batch_completed' | 'batch_failed';
export interface GenerationEvent {
    type: GenerationEventType;
    jobId: string;
    batchId?: string;
    userId?: string;
    timestamp: Date;
    data: any;
}
export interface ApiIntegrationConfig {
    provider: 'GOOGLE_OFFICIAL' | 'NANOBANANA_API' | 'FAL_AI';
    baseUrl: string;
    model: string;
    apiKey: string;
    rateLimits: {
        requestsPerMinute: number;
        requestsPerHour: number;
        concurrentRequests: number;
    };
    pricing: {
        pricePerImage: number;
        currency: 'USD';
    };
    features: {
        batchProcessing: boolean;
        imageToImage: boolean;
        multiImage: boolean;
        webhooks: boolean;
    };
}
export interface StorageConfig {
    provider: 'GOOGLE_CLOUD' | 'LOCAL';
    bucketName?: string;
    region?: string;
    paths: {
        characters: string;
        thumbnails: string;
        temp: string;
        exports: string;
    };
    cdn?: {
        enabled: boolean;
        baseUrl: string;
        cacheTtl: number;
    };
}
export interface UserGenerationLimits {
    userId: string;
    tier: 'free' | 'premium' | 'enterprise';
    limits: {
        dailyGenerations: number;
        monthlyGenerations: number;
        concurrentJobs: number;
        maxImageResolution: number;
        allowedFormats: string[];
    };
    usage: {
        dailyUsed: number;
        monthlyUsed: number;
        currentJobs: number;
    };
    resetDates: {
        dailyResetAt: Date;
        monthlyResetAt: Date;
    };
}
export interface WebhookConfig {
    url: string;
    secret?: string;
    events: GenerationEventType[];
    retryAttempts: number;
    retryDelayMs: number;
    timeoutMs: number;
    enabled: boolean;
}
export interface WebhookPayload {
    event: GenerationEventType;
    timestamp: string;
    data: {
        job: Partial<GenerationJob>;
        user?: {
            id: string;
            tier: string;
        };
        result?: GenerationResult;
        error?: GenerationError;
    };
    signature?: string;
}
export interface GenerationAnalytics {
    timeRange: {
        start: Date;
        end: Date;
    };
    totals: {
        jobs: number;
        successful: number;
        failed: number;
        cancelled: number;
    };
    performance: {
        averageGenerationTime: number;
        p95GenerationTime: number;
        p99GenerationTime: number;
        throughputPerHour: number;
    };
    costs: {
        totalCost: number;
        costPerGeneration: number;
        costByProvider: Record<string, number>;
    };
    errors: {
        byCode: Record<string, number>;
        byProvider: Record<string, number>;
        retryRate: number;
    };
    usage: {
        byUser: Record<string, number>;
        byTier: Record<string, number>;
        popularStyles: Record<string, number>;
        popularAspectRatios: Record<string, number>;
    };
}
export interface CacheEntry {
    key: string;
    data: any;
    createdAt: Date;
    expiresAt: Date;
    accessCount: number;
    lastAccessedAt: Date;
}
export interface CacheMetrics {
    hitRate: number;
    missRate: number;
    evictionRate: number;
    averageResponseTime: number;
    totalEntries: number;
    usedMemory: number;
}
export interface HealthCheckResult {
    service: string;
    status: 'healthy' | 'degraded' | 'unhealthy';
    lastCheckedAt: Date;
    responseTimeMs: number;
    error?: string;
    details?: any;
}
export interface SystemHealthStatus {
    overall: 'healthy' | 'degraded' | 'unhealthy';
    services: {
        nanoBananaApi: HealthCheckResult;
        database: HealthCheckResult;
        storage: HealthCheckResult;
        cache: HealthCheckResult;
        queue: HealthCheckResult;
    };
    checkedAt: Date;
}
export interface ConfigurationValidation {
    valid: boolean;
    errors: string[];
    warnings: string[];
    missingRequired: string[];
    deprecated: string[];
}
export declare const isCharacterGenerationJob: (job: GenerationJob) => job is CharacterGenerationJob;
export declare const isBatchGenerationJob: (job: GenerationJob) => job is BatchGenerationJob;
export declare const isSingleGenerationJob: (job: GenerationJob) => job is SingleGenerationJob;
export declare const isCompletedJob: (job: GenerationJob) => boolean;
export declare const isFailedJob: (job: GenerationJob) => boolean;
export declare const isPendingJob: (job: GenerationJob) => boolean;
export type JobStatus = GenerationJob['status'];
export type JobType = GenerationJob['type'];
export type JobPriority = GenerationJob['priority'];
export declare const DEFAULT_GENERATION_CONFIG: {
    readonly queue: {
        readonly maxConcurrentJobs: 4;
        readonly maxQueueSize: 100;
        readonly priorityLevels: readonly ["low", "normal", "high", "urgent"];
        readonly retryAttempts: 3;
        readonly retryDelayMs: 5000;
        readonly jobTimeoutMs: 300000;
    };
    readonly api: {
        readonly timeout: 30000;
        readonly maxRetries: 3;
        readonly rateLimitBuffer: 0.8;
        readonly batchSize: 4;
    };
    readonly storage: {
        readonly tempTtl: 3600;
        readonly resultTtl: number;
        readonly compressionQuality: 0.9;
    };
};
//# sourceMappingURL=generation.d.ts.map