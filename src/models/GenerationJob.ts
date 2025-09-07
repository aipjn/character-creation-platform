/**
 * GenerationJob Model
 * Handles database operations for the generation queue system
 */

import { getPrismaClient } from '../config/database';
import {
  GenerationJob,
  CharacterGenerationJob,
  BatchGenerationJob,
  SingleGenerationJob,
  JobStatus,
  JobPriority,
  JobType,
  GenerationError,
  GenerationProgress,
  QueueMetrics,
  isCharacterGenerationJob,
  isBatchGenerationJob,
  isSingleGenerationJob
} from '../types/generation';

export interface CreateJobData {
  id?: string;
  userId?: string;
  type: JobType;
  priority?: JobPriority;
  scheduledAt?: Date;
  data: any; // The job-specific data (characterSpecs, prompt, etc.)
}

export interface UpdateJobData {
  status?: JobStatus;
  progress?: GenerationProgress;
  error?: GenerationError;
  results?: any[];
  completedAt?: Date;
  scheduledAt?: Date;
}

export interface JobQueryOptions {
  status?: JobStatus | JobStatus[];
  type?: JobType | JobType[];
  userId?: string;
  priority?: JobPriority | JobPriority[];
  limit?: number;
  offset?: number;
  orderBy?: 'createdAt' | 'updatedAt' | 'scheduledAt' | 'priority';
  orderDirection?: 'asc' | 'desc';
}

export class GenerationJobModel {
  private prisma = getPrismaClient();

  /**
   * Create a new generation job
   */
  async create(data: CreateJobData): Promise<GenerationJob> {
    const jobData = {
      id: data.id || this.generateJobId(),
      userId: data.userId,
      type: data.type,
      status: 'pending' as JobStatus,
      priority: data.priority || 'normal' as JobPriority,
      scheduledAt: data.scheduledAt,
      data: JSON.stringify(data.data),
      createdAt: new Date(),
      updatedAt: new Date()
    };

    // Store in a simple JSON structure for now - in production this would be a proper table
    // For now, we'll use a simplified approach with raw queries
    const result = await this.prisma.$executeRaw`
      INSERT INTO generation_jobs (
        id, user_id, type, status, priority, 
        scheduled_at, data, created_at, updated_at
      ) VALUES (
        ${jobData.id}, ${jobData.userId}, ${jobData.type}, 
        ${jobData.status}, ${jobData.priority}, ${jobData.scheduledAt}, 
        ${jobData.data}, ${jobData.createdAt}, ${jobData.updatedAt}
      )
      ON CONFLICT (id) DO NOTHING
    `;

    return this.convertToGenerationJob(jobData);
  }

  /**
   * Find job by ID
   */
  async findById(id: string): Promise<GenerationJob | null> {
    try {
      const result = await this.prisma.$queryRaw<any[]>`
        SELECT * FROM generation_jobs WHERE id = ${id}
      `;

      if (result.length === 0) {
        return null;
      }

      return this.convertToGenerationJob(result[0]);
    } catch (error) {
      // If table doesn't exist, return null for now
      return null;
    }
  }

  /**
   * Find jobs by criteria
   */
  async find(options: JobQueryOptions = {}): Promise<GenerationJob[]> {
    const {
      status,
      type,
      userId,
      priority,
      limit = 50,
      offset = 0,
      orderBy = 'createdAt',
      orderDirection = 'asc'
    } = options;

    let whereClause = 'WHERE 1=1';
    const params: any[] = [];

    if (status) {
      if (Array.isArray(status)) {
        whereClause += ` AND status = ANY($${params.length + 1})`;
        params.push(status);
      } else {
        whereClause += ` AND status = $${params.length + 1}`;
        params.push(status);
      }
    }

    if (type) {
      if (Array.isArray(type)) {
        whereClause += ` AND type = ANY($${params.length + 1})`;
        params.push(type);
      } else {
        whereClause += ` AND type = $${params.length + 1}`;
        params.push(type);
      }
    }

    if (userId) {
      whereClause += ` AND user_id = $${params.length + 1}`;
      params.push(userId);
    }

    if (priority) {
      if (Array.isArray(priority)) {
        whereClause += ` AND priority = ANY($${params.length + 1})`;
        params.push(priority);
      } else {
        whereClause += ` AND priority = $${params.length + 1}`;
        params.push(priority);
      }
    }

    try {
      const query = `
        SELECT * FROM generation_jobs 
        ${whereClause}
        ORDER BY ${orderBy} ${orderDirection.toUpperCase()}
        LIMIT $${params.length + 1} OFFSET $${params.length + 2}
      `;

      const result = await this.prisma.$queryRawUnsafe<any[]>(
        query,
        ...params,
        limit,
        offset
      );

      return result.map(row => this.convertToGenerationJob(row));
    } catch (error) {
      // If table doesn't exist, return empty array for now
      return [];
    }
  }

  /**
   * Update job
   */
  async update(id: string, data: UpdateJobData): Promise<GenerationJob | null> {
    const updateFields: string[] = [];
    const params: any[] = [];

    if (data.status !== undefined) {
      updateFields.push(`status = $${params.length + 1}`);
      params.push(data.status);
    }

    if (data.progress !== undefined) {
      updateFields.push(`progress = $${params.length + 1}`);
      params.push(JSON.stringify(data.progress));
    }

    if (data.error !== undefined) {
      updateFields.push(`error = $${params.length + 1}`);
      params.push(JSON.stringify(data.error));
    }

    if (data.results !== undefined) {
      updateFields.push(`results = $${params.length + 1}`);
      params.push(JSON.stringify(data.results));
    }

    if (data.completedAt !== undefined) {
      updateFields.push(`completed_at = $${params.length + 1}`);
      params.push(data.completedAt);
    }

    if (data.scheduledAt !== undefined) {
      updateFields.push(`scheduled_at = $${params.length + 1}`);
      params.push(data.scheduledAt);
    }

    updateFields.push(`updated_at = $${params.length + 1}`);
    params.push(new Date());

    if (updateFields.length === 0) {
      return this.findById(id);
    }

    try {
      const query = `
        UPDATE generation_jobs 
        SET ${updateFields.join(', ')}
        WHERE id = $${params.length + 1}
      `;

      await this.prisma.$executeRawUnsafe(query, ...params, id);
      return this.findById(id);
    } catch (error) {
      console.error('Error updating generation job:', error);
      return null;
    }
  }

  /**
   * Delete job
   */
  async delete(id: string): Promise<boolean> {
    try {
      await this.prisma.$executeRaw`
        DELETE FROM generation_jobs WHERE id = ${id}
      `;
      return true;
    } catch (error) {
      return false;
    }
  }

  /**
   * Get next pending jobs to process (for queue worker)
   */
  async getNextPendingJobs(limit: number = 4): Promise<GenerationJob[]> {
    return this.find({
      status: ['pending', 'queued'],
      limit,
      orderBy: 'priority',
      orderDirection: 'desc'
    });
  }

  /**
   * Get jobs ready to be scheduled
   */
  async getScheduledJobs(): Promise<GenerationJob[]> {
    const now = new Date();
    
    try {
      const result = await this.prisma.$queryRaw<any[]>`
        SELECT * FROM generation_jobs 
        WHERE status IN ('pending', 'queued') 
        AND scheduled_at IS NOT NULL 
        AND scheduled_at <= ${now}
        ORDER BY scheduled_at ASC
        LIMIT 10
      `;

      return result.map(row => this.convertToGenerationJob(row));
    } catch (error) {
      return [];
    }
  }

  /**
   * Get processing jobs (for monitoring stale jobs)
   */
  async getProcessingJobs(olderThanMinutes?: number): Promise<GenerationJob[]> {
    let whereClause = "WHERE status = 'processing'";
    const params: any[] = [];

    if (olderThanMinutes) {
      const threshold = new Date();
      threshold.setMinutes(threshold.getMinutes() - olderThanMinutes);
      whereClause += ` AND updated_at < $${params.length + 1}`;
      params.push(threshold);
    }

    try {
      const query = `SELECT * FROM generation_jobs ${whereClause} ORDER BY updated_at ASC`;
      const result = await this.prisma.$queryRawUnsafe<any[]>(query, ...params);
      return result.map(row => this.convertToGenerationJob(row));
    } catch (error) {
      return [];
    }
  }

  /**
   * Get queue metrics
   */
  async getQueueMetrics(): Promise<QueueMetrics> {
    try {
      const result = await this.prisma.$queryRaw<any[]>`
        SELECT 
          status,
          COUNT(*) as count,
          AVG(EXTRACT(EPOCH FROM (updated_at - created_at)) * 1000) as avg_processing_time
        FROM generation_jobs 
        WHERE created_at >= NOW() - INTERVAL '24 hours'
        GROUP BY status
      `;

      const metrics: QueueMetrics = {
        pending: 0,
        processing: 0,
        completed: 0,
        failed: 0,
        averageWaitTimeMs: 0,
        averageProcessingTimeMs: 0,
        throughputPerHour: 0
      };

      let totalProcessingTime = 0;
      let processedJobs = 0;

      result.forEach(row => {
        const count = parseInt(row.count);
        switch (row.status) {
          case 'pending':
          case 'queued':
            metrics.pending += count;
            break;
          case 'processing':
            metrics.processing = count;
            break;
          case 'completed':
            metrics.completed = count;
            if (row.avg_processing_time) {
              totalProcessingTime += parseFloat(row.avg_processing_time) * count;
              processedJobs += count;
            }
            break;
          case 'failed':
          case 'cancelled':
            metrics.failed += count;
            break;
        }
      });

      metrics.averageProcessingTimeMs = processedJobs > 0 ? totalProcessingTime / processedJobs : 0;
      metrics.throughputPerHour = metrics.completed; // Last 24 hours

      return metrics;
    } catch (error) {
      return {
        pending: 0,
        processing: 0,
        completed: 0,
        failed: 0,
        averageWaitTimeMs: 0,
        averageProcessingTimeMs: 0,
        throughputPerHour: 0
      };
    }
  }

  /**
   * Cleanup completed jobs older than specified days
   */
  async cleanupCompletedJobs(daysOld: number = 7): Promise<number> {
    const threshold = new Date();
    threshold.setDate(threshold.getDate() - daysOld);

    try {
      const result = await this.prisma.$executeRaw`
        DELETE FROM generation_jobs 
        WHERE status IN ('completed', 'failed', 'cancelled') 
        AND completed_at < ${threshold}
      `;

      return Number(result);
    } catch (error) {
      return 0;
    }
  }

  /**
   * Generate unique job ID
   */
  private generateJobId(): string {
    return `job_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Convert raw database row to GenerationJob type
   */
  private convertToGenerationJob(row: any): GenerationJob {
    const baseJob = {
      id: row.id,
      userId: row.user_id,
      status: row.status as JobStatus,
      priority: row.priority as JobPriority,
      createdAt: new Date(row.created_at),
      updatedAt: new Date(row.updated_at),
      completedAt: row.completed_at ? new Date(row.completed_at) : undefined,
      scheduledAt: row.scheduled_at ? new Date(row.scheduled_at) : undefined,
      progress: row.progress ? JSON.parse(row.progress) : undefined,
      error: row.error ? JSON.parse(row.error) : undefined
    };

    const jobData = JSON.parse(row.data || '{}');

    switch (row.type) {
      case 'character':
        return {
          ...baseJob,
          type: 'character',
          characterId: jobData.characterId,
          characterSpecs: jobData.characterSpecs,
          generationParams: jobData.generationParams,
          results: row.results ? JSON.parse(row.results) : undefined
        } as CharacterGenerationJob;

      case 'batch':
        return {
          ...baseJob,
          type: 'batch',
          batchId: jobData.batchId,
          requests: jobData.requests || [],
          totalRequests: jobData.totalRequests || 0,
          completedRequests: jobData.completedRequests || 0,
          failedRequests: jobData.failedRequests || 0,
          results: row.results ? JSON.parse(row.results) : undefined
        } as BatchGenerationJob;

      case 'single':
        return {
          ...baseJob,
          type: 'single',
          prompt: jobData.prompt,
          negativePrompt: jobData.negativePrompt,
          generationParams: jobData.generationParams,
          inputImage: jobData.inputImage,
          result: row.results ? JSON.parse(row.results)[0] : undefined
        } as SingleGenerationJob;

      default:
        throw new Error(`Unknown job type: ${row.type}`);
    }
  }

  /**
   * Initialize database table (for development)
   * In production, this would be handled by migrations
   */
  async initializeTable(): Promise<void> {
    try {
      await this.prisma.$executeRaw`
        CREATE TABLE IF NOT EXISTS generation_jobs (
          id VARCHAR(255) PRIMARY KEY,
          user_id VARCHAR(255),
          type VARCHAR(50) NOT NULL,
          status VARCHAR(50) NOT NULL DEFAULT 'pending',
          priority VARCHAR(50) NOT NULL DEFAULT 'normal',
          scheduled_at TIMESTAMP,
          data JSONB NOT NULL,
          progress JSONB,
          error JSONB,
          results JSONB,
          completed_at TIMESTAMP,
          created_at TIMESTAMP NOT NULL DEFAULT NOW(),
          updated_at TIMESTAMP NOT NULL DEFAULT NOW()
        )
      `;

      await this.prisma.$executeRaw`
        CREATE INDEX IF NOT EXISTS idx_generation_jobs_status ON generation_jobs(status)
      `;

      await this.prisma.$executeRaw`
        CREATE INDEX IF NOT EXISTS idx_generation_jobs_type ON generation_jobs(type)
      `;

      await this.prisma.$executeRaw`
        CREATE INDEX IF NOT EXISTS idx_generation_jobs_user_id ON generation_jobs(user_id)
      `;

      await this.prisma.$executeRaw`
        CREATE INDEX IF NOT EXISTS idx_generation_jobs_scheduled_at ON generation_jobs(scheduled_at)
      `;

      await this.prisma.$executeRaw`
        CREATE INDEX IF NOT EXISTS idx_generation_jobs_priority ON generation_jobs(priority)
      `;
    } catch (error) {
      console.error('Error initializing generation_jobs table:', error);
    }
  }
}

export default new GenerationJobModel();