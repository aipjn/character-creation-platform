import { CharacterCollection, CharacterCollectionItem, Prisma } from '@prisma/client';
import { getPrismaClient } from '../config/database';
import { CreateCollectionData, UpdateCollectionData, CollectionDisplayData } from '../types/collections';

export class CharacterCollectionModel {
  private prisma = getPrismaClient();

  async create(userId: string, data: CreateCollectionData): Promise<CharacterCollection> {
    return this.prisma.characterCollection.create({
      data: {
        userId,
        name: data.name,
        description: data.description,
        isPublic: data.isPublic || false,
        coverImageUrl: data.coverImageUrl,
      },
      include: {
        user: {
          select: {
            id: true,
            name: true,
          },
        },
        items: {
          include: {
            character: {
              select: {
                id: true,
                name: true,
                thumbnailUrl: true,
                s3Url: true,
                styleType: true,
                generationStatus: true,
              },
            },
          },
        },
      },
    });
  }

  async findById(id: string): Promise<CharacterCollection | null> {
    return this.prisma.characterCollection.findUnique({
      where: { id },
      include: {
        user: {
          select: {
            id: true,
            name: true,
          },
        },
        items: {
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
                isPublic: true,
                createdAt: true,
              },
            },
          },
          orderBy: {
            addedAt: 'desc',
          },
        },
      },
    });
  }

  async findByUserId(userId: string, options?: {
    skip?: number;
    take?: number;
    isPublic?: boolean;
  }): Promise<CharacterCollection[]> {
    const { skip = 0, take = 20, isPublic } = options || {};

    return this.prisma.characterCollection.findMany({
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
        items: {
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
          orderBy: {
            addedAt: 'desc',
          },
        },
      },
    });
  }

  async findPublicCollections(options?: {
    skip?: number;
    take?: number;
    search?: string;
  }): Promise<CollectionDisplayData[]> {
    const { skip = 0, take = 20, search } = options || {};

    const collections = await this.prisma.characterCollection.findMany({
      where: {
        isPublic: true,
        ...(search && {
          OR: [
            { name: { contains: search, mode: 'insensitive' } },
            { description: { contains: search, mode: 'insensitive' } },
          ],
        }),
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
        items: {
          take: 4,
          include: {
            character: {
              select: {
                id: true,
                name: true,
                thumbnailUrl: true,
                s3Url: true,
                styleType: true,
                generationStatus: true,
              },
            },
          },
          orderBy: {
            addedAt: 'desc',
          },
        },
        _count: {
          select: {
            items: true,
          },
        },
      },
    });

    return collections.map(collection => ({
      id: collection.id,
      name: collection.name,
      description: collection.description,
      isPublic: collection.isPublic,
      coverImageUrl: collection.coverImageUrl,
      characterCount: collection._count.items,
      author: collection.user,
      createdAt: collection.createdAt,
      previewCharacters: collection.items.map(item => item.character as any),
    }));
  }

  async update(id: string, data: UpdateCollectionData): Promise<CharacterCollection> {
    return this.prisma.characterCollection.update({
      where: { id },
      data: {
        ...(data.name && { name: data.name }),
        ...(data.description !== undefined && { description: data.description }),
        ...(data.isPublic !== undefined && { isPublic: data.isPublic }),
        ...(data.coverImageUrl !== undefined && { coverImageUrl: data.coverImageUrl }),
      },
      include: {
        user: {
          select: {
            id: true,
            name: true,
          },
        },
        items: {
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
          orderBy: {
            addedAt: 'desc',
          },
        },
      },
    });
  }

  async delete(id: string): Promise<CharacterCollection> {
    return this.prisma.characterCollection.delete({
      where: { id },
    });
  }

  async addCharacter(collectionId: string, characterId: string): Promise<CharacterCollectionItem> {
    return this.prisma.characterCollectionItem.create({
      data: {
        collectionId,
        characterId,
      },
      include: {
        collection: {
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

  async removeCharacter(collectionId: string, characterId: string): Promise<CharacterCollectionItem> {
    return this.prisma.characterCollectionItem.delete({
      where: {
        collectionId_characterId: {
          collectionId,
          characterId,
        },
      },
    });
  }

  async isCharacterInCollection(collectionId: string, characterId: string): Promise<boolean> {
    const item = await this.prisma.characterCollectionItem.findUnique({
      where: {
        collectionId_characterId: {
          collectionId,
          characterId,
        },
      },
    });
    return !!item;
  }

  async getCollectionsByCharacter(characterId: string, userId: string): Promise<CharacterCollection[]> {
    return this.prisma.characterCollection.findMany({
      where: {
        userId,
        items: {
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
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async canUserAccessCollection(userId: string, collectionId: string): Promise<{ allowed: boolean; reason?: string }> {
    const collection = await this.findById(collectionId);
    
    if (!collection) {
      return { allowed: false, reason: 'Collection not found' };
    }

    if (collection.userId === userId || collection.isPublic) {
      return { allowed: true };
    }

    return { allowed: false, reason: 'Access denied' };
  }

  async canUserEditCollection(userId: string, collectionId: string): Promise<{ allowed: boolean; reason?: string }> {
    const collection = await this.findById(collectionId);
    
    if (!collection) {
      return { allowed: false, reason: 'Collection not found' };
    }

    if (collection.userId !== userId) {
      return { allowed: false, reason: 'You can only edit your own collections' };
    }

    return { allowed: true };
  }

  async getCollectionStats(userId: string): Promise<{
    total: number;
    public: number;
    private: number;
    totalCharacters: number;
  }> {
    const collections = await this.prisma.characterCollection.findMany({
      where: { userId },
      include: {
        _count: {
          select: {
            items: true,
          },
        },
      },
    });

    const publicCollections = collections.filter(c => c.isPublic).length;
    const privateCollections = collections.length - publicCollections;
    const totalCharacters = collections.reduce((sum, c) => sum + c._count.items, 0);

    return {
      total: collections.length,
      public: publicCollections,
      private: privateCollections,
      totalCharacters,
    };
  }
}

export default new CharacterCollectionModel();