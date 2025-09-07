import { Generation, Prisma, GenerationStatus } from '@prisma/client';
import { getPrismaClient } from '../config/database';

export class GenerationModel {
  private prisma = getPrismaClient();

  async create(data: Prisma.GenerationCreateInput): Promise<Generation> {
    return this.prisma.generation.create({
      data,
      include: {
        user: {
          select: {
            id: true,
            email: true,
            name: true,
          },
        },
        character: true,
      },
    });
  }

  async findById(id: string): Promise<Generation | null> {
    return this.prisma.generation.findUnique({
      where: { id },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            name: true,
          },
        },
        character: true,
      },
    });
  }

  async findByUserId(userId: string, options?: {
    skip?: number;
    take?: number;
    status?: GenerationStatus;
  }): Promise<Generation[]> {
    const { skip = 0, take = 20, status } = options || {};
    
    return this.prisma.generation.findMany({
      where: {
        userId,
        ...(status && { status }),
      },
      skip,
      take,
      orderBy: { createdAt: 'desc' },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            name: true,
          },
        },
        character: true,
      },
    });
  }

  async findByNanoBananaRequestId(nanoBananaRequestId: string): Promise<Generation | null> {
    return this.prisma.generation.findFirst({
      where: { nanoBananaRequestId },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            name: true,
          },
        },
        character: true,
      },
    });
  }

  async update(id: string, data: Prisma.GenerationUpdateInput): Promise<Generation> {
    return this.prisma.generation.update({
      where: { id },
      data,
      include: {
        user: {
          select: {
            id: true,
            email: true,
            name: true,
          },
        },
        character: true,
      },
    });
  }

  async updateStatus(
    id: string, 
    status: GenerationStatus, 
    errorMessage?: string,
    completedAt?: Date
  ): Promise<Generation> {
    return this.update(id, {
      status,
      ...(errorMessage && { errorMessage }),
      ...(completedAt && { completedAt }),
    });
  }

  async updateNanoBananaRequestId(id: string, nanoBananaRequestId: string): Promise<Generation> {
    return this.update(id, {
      nanoBananaRequestId,
      status: GenerationStatus.PROCESSING,
    });
  }

  async delete(id: string): Promise<Generation> {
    return this.prisma.generation.delete({
      where: { id },
    });
  }

  async getPendingGenerations(): Promise<Generation[]> {
    return this.prisma.generation.findMany({
      where: {
        status: GenerationStatus.PENDING,
      },
      orderBy: { createdAt: 'asc' },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            name: true,
          },
        },
        character: true,
      },
    });
  }

  async getProcessingGenerations(): Promise<Generation[]> {
    return this.prisma.generation.findMany({
      where: {
        status: GenerationStatus.PROCESSING,
      },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            name: true,
          },
        },
        character: true,
      },
    });
  }

  async getStaleGenerations(minutesOld = 30): Promise<Generation[]> {
    const threshold = new Date();
    threshold.setMinutes(threshold.getMinutes() - minutesOld);

    return this.prisma.generation.findMany({
      where: {
        status: GenerationStatus.PROCESSING,
        updatedAt: {
          lt: threshold,
        },
      },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            name: true,
          },
        },
        character: true,
      },
    });
  }

  async getGenerationStats(userId?: string): Promise<{
    total: number;
    byStatus: Record<string, number>;
    averageProcessingTime?: number;
    successRate?: number;
  }> {
    const generations = await this.prisma.generation.findMany({
      where: userId ? { userId } : undefined,
      select: {
        status: true,
        createdAt: true,
        completedAt: true,
      },
    });

    const byStatus: Record<string, number> = {};
    let totalProcessingTime = 0;
    let completedCount = 0;

    generations.forEach(gen => {
      byStatus[gen.status] = (byStatus[gen.status] || 0) + 1;
      
      if (gen.status === GenerationStatus.COMPLETED && gen.completedAt) {
        const processingTime = gen.completedAt.getTime() - gen.createdAt.getTime();
        totalProcessingTime += processingTime;
        completedCount++;
      }
    });

    const successfulCount = byStatus[GenerationStatus.COMPLETED] || 0;
    const failedCount = byStatus[GenerationStatus.FAILED] || 0;
    const totalFinished = successfulCount + failedCount;

    return {
      total: generations.length,
      byStatus,
      averageProcessingTime: completedCount > 0 ? Math.round(totalProcessingTime / completedCount) : undefined,
      successRate: totalFinished > 0 ? Number((successfulCount / totalFinished * 100).toFixed(2)) : undefined,
    };
  }

  async cleanupOldGenerations(daysOld = 30): Promise<number> {
    const threshold = new Date();
    threshold.setDate(threshold.getDate() - daysOld);

    const result = await this.prisma.generation.deleteMany({
      where: {
        createdAt: {
          lt: threshold,
        },
        status: {
          in: [GenerationStatus.COMPLETED, GenerationStatus.FAILED],
        },
      },
    });

    return result.count;
  }
}

export default new GenerationModel();