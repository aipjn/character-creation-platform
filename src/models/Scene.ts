import { Scene, SceneCharacter, SceneGeneration, Prisma } from '@prisma/client';
import { getPrismaClient } from '../config/database';
import { CreateSceneData, UpdateSceneData, AddCharacterToSceneData, SceneDisplayData } from '../types/collections';

export class SceneModel {
  private prisma = getPrismaClient();

  async create(userId: string, data: CreateSceneData): Promise<Scene> {
    return this.prisma.scene.create({
      data: {
        userId,
        name: data.name,
        description: data.description,
        environment: data.environment,
        setting: data.setting,
        mood: data.mood,
        lighting: data.lighting,
        isPublic: data.isPublic || false,
      },
      include: {
        user: {
          select: {
            id: true,
            name: true,
          },
        },
        characters: {
          include: {
            character: {
              select: {
                id: true,
                name: true,
                thumbnailUrl: true,
                s3Url: true,
                styleType: true,
              },
            },
          },
        },
      },
    });
  }

  async findById(id: string): Promise<Scene | null> {
    return this.prisma.scene.findUnique({
      where: { id },
      include: {
        user: {
          select: {
            id: true,
            name: true,
          },
        },
        characters: {
          include: {
            character: {
              select: {
                id: true,
                name: true,
                thumbnailUrl: true,
                s3Url: true,
                styleType: true,
                generationStatus: true,
                tags: true,
              },
            },
          },
          orderBy: {
            addedAt: 'desc',
          },
        },
        generations: {
          take: 5,
          orderBy: {
            createdAt: 'desc',
          },
        },
      },
    });
  }

  async findByUserId(userId: string, options?: {
    skip?: number;
    take?: number;
    isPublic?: boolean;
  }): Promise<Scene[]> {
    const { skip = 0, take = 20, isPublic } = options || {};

    return this.prisma.scene.findMany({
      where: {
        userId,
        ...(isPublic !== undefined && { isPublic }),
      },
      skip,
      take,
      orderBy: { createdAt: 'desc' },
      include: {
        user: {
          select: {
            id: true,
            name: true,
          },
        },
        characters: {
          take: 4, // Preview characters
          include: {
            character: {
              select: {
                id: true,
                name: true,
                thumbnailUrl: true,
                s3Url: true,
                styleType: true,
              },
            },
          },
        },
        _count: {
          select: {
            characters: true,
          },
        },
      },
    });
  }

  async findPublicScenes(options?: {
    skip?: number;
    take?: number;
    search?: string;
    environment?: string;
    mood?: string;
  }): Promise<SceneDisplayData[]> {
    const { skip = 0, take = 20, search, environment, mood } = options || {};

    const scenes = await this.prisma.scene.findMany({
      where: {
        isPublic: true,
        ...(search && {
          OR: [
            { name: { contains: search, mode: 'insensitive' } },
            { description: { contains: search, mode: 'insensitive' } },
            { environment: { contains: search, mode: 'insensitive' } },
            { setting: { contains: search, mode: 'insensitive' } },
          ],
        }),
        ...(environment && { environment: { contains: environment, mode: 'insensitive' } }),
        ...(mood && { mood: { contains: mood, mode: 'insensitive' } }),
      },
      skip,
      take,
      orderBy: { createdAt: 'desc' },
      include: {
        user: {
          select: {
            id: true,
            name: true,
          },
        },
        characters: {
          take: 4,
          include: {
            character: {
              select: {
                id: true,
                name: true,
                thumbnailUrl: true,
                s3Url: true,
                styleType: true,
              },
            },
          },
        },
        _count: {
          select: {
            characters: true,
          },
        },
      },
    });

    return scenes.map(scene => ({
      id: scene.id,
      name: scene.name,
      description: scene.description,
      environment: scene.environment,
      setting: scene.setting,
      mood: scene.mood,
      lighting: scene.lighting,
      imageUrl: scene.s3Url,
      thumbnailUrl: scene.thumbnailUrl,
      isPublic: scene.isPublic,
      characterCount: scene._count.characters,
      author: scene.user,
      createdAt: scene.createdAt,
      previewCharacters: scene.characters.map(sc => sc.character as any),
    }));
  }

  async update(id: string, data: UpdateSceneData): Promise<Scene> {
    return this.prisma.scene.update({
      where: { id },
      data: {
        ...(data.name && { name: data.name }),
        ...(data.description !== undefined && { description: data.description }),
        ...(data.environment !== undefined && { environment: data.environment }),
        ...(data.setting !== undefined && { setting: data.setting }),
        ...(data.mood !== undefined && { mood: data.mood }),
        ...(data.lighting !== undefined && { lighting: data.lighting }),
        ...(data.isPublic !== undefined && { isPublic: data.isPublic }),
      },
      include: {
        user: {
          select: {
            id: true,
            name: true,
          },
        },
        characters: {
          include: {
            character: {
              select: {
                id: true,
                name: true,
                thumbnailUrl: true,
                s3Url: true,
                styleType: true,
              },
            },
          },
        },
      },
    });
  }

  async delete(id: string): Promise<Scene> {
    return this.prisma.scene.delete({
      where: { id },
    });
  }

  async addCharacter(sceneId: string, data: AddCharacterToSceneData): Promise<SceneCharacter> {
    return this.prisma.sceneCharacter.create({
      data: {
        sceneId,
        characterId: data.characterId,
        pose: data.pose,
        expression: data.expression,
        action: data.action,
        position: data.position,
      },
      include: {
        scene: {
          select: {
            id: true,
            name: true,
          },
        },
        character: {
          select: {
            id: true,
            name: true,
            thumbnailUrl: true,
            s3Url: true,
            styleType: true,
          },
        },
      },
    });
  }

  async removeCharacter(sceneId: string, characterId: string): Promise<SceneCharacter> {
    return this.prisma.sceneCharacter.delete({
      where: {
        sceneId_characterId: {
          sceneId,
          characterId,
        },
      },
    });
  }

  async updateCharacterInScene(
    sceneId: string, 
    characterId: string, 
    data: Partial<AddCharacterToSceneData>
  ): Promise<SceneCharacter> {
    return this.prisma.sceneCharacter.update({
      where: {
        sceneId_characterId: {
          sceneId,
          characterId,
        },
      },
      data: {
        ...(data.pose !== undefined && { pose: data.pose }),
        ...(data.expression !== undefined && { expression: data.expression }),
        ...(data.action !== undefined && { action: data.action }),
        ...(data.position !== undefined && { position: data.position }),
      },
      include: {
        scene: {
          select: {
            id: true,
            name: true,
          },
        },
        character: {
          select: {
            id: true,
            name: true,
            thumbnailUrl: true,
            s3Url: true,
            styleType: true,
          },
        },
      },
    });
  }

  async isCharacterInScene(sceneId: string, characterId: string): Promise<boolean> {
    const sceneCharacter = await this.prisma.sceneCharacter.findUnique({
      where: {
        sceneId_characterId: {
          sceneId,
          characterId,
        },
      },
    });
    return !!sceneCharacter;
  }

  async getScenesByCharacter(characterId: string, userId: string): Promise<Scene[]> {
    return this.prisma.scene.findMany({
      where: {
        userId,
        characters: {
          some: {
            characterId,
          },
        },
      },
      include: {
        user: {
          select: {
            id: true,
            name: true,
          },
        },
        _count: {
          select: {
            characters: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async createGeneration(
    userId: string, 
    sceneId: string, 
    prompt: string
  ): Promise<SceneGeneration> {
    return this.prisma.sceneGeneration.create({
      data: {
        userId,
        sceneId,
        prompt,
        status: 'PENDING',
      },
      include: {
        user: {
          select: {
            id: true,
            name: true,
          },
        },
        scene: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    });
  }

  async updateGenerationStatus(
    id: string, 
    status: 'PENDING' | 'PROCESSING' | 'COMPLETED' | 'FAILED',
    errorMessage?: string
  ): Promise<SceneGeneration> {
    return this.prisma.sceneGeneration.update({
      where: { id },
      data: {
        status,
        ...(errorMessage && { errorMessage }),
        ...(status === 'COMPLETED' && { completedAt: new Date() }),
      },
    });
  }

  async updateSceneImage(id: string, s3Url: string, thumbnailUrl?: string): Promise<Scene> {
    return this.prisma.scene.update({
      where: { id },
      data: {
        s3Url,
        ...(thumbnailUrl && { thumbnailUrl }),
      },
    });
  }

  async canUserAccessScene(userId: string, sceneId: string): Promise<{ allowed: boolean; reason?: string }> {
    const scene = await this.findById(sceneId);
    
    if (!scene) {
      return { allowed: false, reason: 'Scene not found' };
    }

    if (scene.userId === userId || scene.isPublic) {
      return { allowed: true };
    }

    return { allowed: false, reason: 'Access denied' };
  }

  async canUserEditScene(userId: string, sceneId: string): Promise<{ allowed: boolean; reason?: string }> {
    const scene = await this.findById(sceneId);
    
    if (!scene) {
      return { allowed: false, reason: 'Scene not found' };
    }

    if (scene.userId !== userId) {
      return { allowed: false, reason: 'You can only edit your own scenes' };
    }

    return { allowed: true };
  }

  async getSceneStats(userId: string): Promise<{
    total: number;
    public: number;
    private: number;
    totalCharacters: number;
    totalGenerations: number;
  }> {
    const scenes = await this.prisma.scene.findMany({
      where: { userId },
      include: {
        _count: {
          select: {
            characters: true,
            generations: true,
          },
        },
      },
    });

    const publicScenes = scenes.filter(s => s.isPublic).length;
    const privateScenes = scenes.length - publicScenes;
    const totalCharacters = scenes.reduce((sum, s) => sum + s._count.characters, 0);
    const totalGenerations = scenes.reduce((sum, s) => sum + s._count.generations, 0);

    return {
      total: scenes.length,
      public: publicScenes,
      private: privateScenes,
      totalCharacters,
      totalGenerations,
    };
  }

  async getPopularSceneAttributes(): Promise<{
    environments: { name: string; count: number }[];
    moods: { name: string; count: number }[];
    settings: { name: string; count: number }[];
  }> {
    const environmentResult = await this.prisma.$queryRaw<{ environment: string; count: bigint }[]>`
      SELECT environment, COUNT(*) as count
      FROM scenes
      WHERE is_public = true AND environment IS NOT NULL
      GROUP BY environment
      ORDER BY count DESC
      LIMIT 10
    `;

    const moodResult = await this.prisma.$queryRaw<{ mood: string; count: bigint }[]>`
      SELECT mood, COUNT(*) as count
      FROM scenes
      WHERE is_public = true AND mood IS NOT NULL
      GROUP BY mood
      ORDER BY count DESC
      LIMIT 10
    `;

    const settingResult = await this.prisma.$queryRaw<{ setting: string; count: bigint }[]>`
      SELECT setting, COUNT(*) as count
      FROM scenes
      WHERE is_public = true AND setting IS NOT NULL
      GROUP BY setting
      ORDER BY count DESC
      LIMIT 10
    `;

    return {
      environments: environmentResult.map(item => ({
        name: item.environment,
        count: Number(item.count),
      })),
      moods: moodResult.map(item => ({
        name: item.mood,
        count: Number(item.count),
      })),
      settings: settingResult.map(item => ({
        name: item.setting,
        count: Number(item.count),
      })),
    };
  }
}

export default new SceneModel();