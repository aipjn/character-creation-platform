"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.DEFAULT_GENERATION_CONFIG = exports.isPendingJob = exports.isFailedJob = exports.isCompletedJob = exports.isSingleGenerationJob = exports.isBatchGenerationJob = exports.isCharacterGenerationJob = void 0;
const isCharacterGenerationJob = (job) => {
    return job.type === 'character';
};
exports.isCharacterGenerationJob = isCharacterGenerationJob;
const isBatchGenerationJob = (job) => {
    return job.type === 'batch';
};
exports.isBatchGenerationJob = isBatchGenerationJob;
const isSingleGenerationJob = (job) => {
    return job.type === 'single';
};
exports.isSingleGenerationJob = isSingleGenerationJob;
const isCompletedJob = (job) => {
    return job.status === 'completed';
};
exports.isCompletedJob = isCompletedJob;
const isFailedJob = (job) => {
    return job.status === 'failed';
};
exports.isFailedJob = isFailedJob;
const isPendingJob = (job) => {
    return ['pending', 'queued', 'processing'].includes(job.status);
};
exports.isPendingJob = isPendingJob;
exports.DEFAULT_GENERATION_CONFIG = {
    queue: {
        maxConcurrentJobs: 4,
        maxQueueSize: 100,
        priorityLevels: ['low', 'normal', 'high', 'urgent'],
        retryAttempts: 3,
        retryDelayMs: 5000,
        jobTimeoutMs: 300000
    },
    api: {
        timeout: 30000,
        maxRetries: 3,
        rateLimitBuffer: 0.8,
        batchSize: 4
    },
    storage: {
        tempTtl: 3600,
        resultTtl: 86400 * 7,
        compressionQuality: 0.9
    }
};
//# sourceMappingURL=generation.js.map