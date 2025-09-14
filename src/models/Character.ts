import { Character, Prisma, StyleType, GenerationStatus } from '@prisma/client';
import { getPrismaClient } from '../config/database';
import { CharacterCreateData, CharacterUpdateData, ModelValidationResult, CharacterConstraints } from '../types/models';

export class CharacterModel {
  private prisma = getPrismaClient();

  async create(data: Prisma.CharacterCreateInput): Promise<Character> {
    return this.prisma.character.create({
      data,
      include: {
        user: {
          select: {
            id: true,
            email: true,
            name: true,
          },
        },
      },
    });
  }

  async findById(id: string): Promise<Character | null> {
    return this.prisma.character.findUnique({
      where: { id },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            name: true,
          },
        },
      },
    });
  }

  async findByUserId(userId: string, options?: {
    skip?: number;
    take?: number;
    styleType?: StyleType;
    tags?: string[];
    isInLibrary?: boolean;
    isFavorite?: boolean;
    age?: string;
    gender?: string;
    occupation?: string;
    personality?: string[];
  }): Promise<Character[]> {
    const { skip = 0, take = 20, styleType, tags, isInLibrary, isFavorite, age, gender, occupation, personality } = options || {};
    
    return this.prisma.character.findMany({
      where: {
        userId,
        ...(styleType && { styleType }),
        ...(tags && tags.length > 0 && {
          tags: {
            hasSome: tags,
          },
        }),
        ...(isInLibrary !== undefined && { isInLibrary }),
        ...(isFavorite !== undefined && { isFavorite }),
        ...(age && { age: { contains: age, mode: 'insensitive' } }),
        ...(gender && { gender: { contains: gender, mode: 'insensitive' } }),
        ...(occupation && { occupation: { contains: occupation, mode: 'insensitive' } }),
        ...(personality && personality.length > 0 && {
          personality: {
            hasSome: personality,
          },
        }),
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
        collectionItems: {
          include: {
            collection: {
              select: {
                id: true,
                name: true,
              },
            },
          },
        },
      },
    });
  }

  async findPublicCharacters(options?: {
    skip?: number;
    take?: number;
    styleType?: StyleType;
    tags?: string[];
    search?: string;
  }): Promise<Character[]> {
    const { skip = 0, take = 20, styleType, tags, search } = options || {};

    return this.prisma.character.findMany({
      where: {
        isPublic: true,
        generationStatus: GenerationStatus.COMPLETED,
        ...(styleType && { styleType }),
        ...(tags && tags.length > 0 && {
          tags: {
            hasSome: tags,
          },
        }),
        ...(search && {
          OR: [
            { name: { contains: search, mode: 'insensitive' } },
            { prompt: { contains: search, mode: 'insensitive' } },
            { tags: { hasSome: [search] } },
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
      },
    });
  }

  async update(id: string, data: Prisma.CharacterUpdateInput): Promise<Character> {
    return this.prisma.character.update({
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
      },
    });
  }

  async delete(id: string): Promise<Character> {
    return this.prisma.character.delete({
      where: { id },
    });
  }

  async updateGenerationStatus(id: string, status: GenerationStatus, s3Url?: string, thumbnailUrl?: string): Promise<Character> {
    return this.prisma.character.update({
      where: { id },
      data: {
        generationStatus: status,
        ...(s3Url && { s3Url }),
        ...(thumbnailUrl && { thumbnailUrl }),
      },
    });
  }

  async addTags(id: string, newTags: string[]): Promise<Character> {
    const character = await this.findById(id);
    if (!character) {
      throw new Error('Character not found');
    }

    const updatedTags = [...new Set([...character.tags, ...newTags])];
    
    return this.update(id, { tags: updatedTags });
  }

  async removeTags(id: string, tagsToRemove: string[]): Promise<Character> {
    const character = await this.findById(id);
    if (!character) {
      throw new Error('Character not found');
    }

    const updatedTags = character.tags.filter(tag => !tagsToRemove.includes(tag));
    
    return this.update(id, { tags: updatedTags });
  }

  async getCharactersByStyle(styleType: StyleType, limit = 10): Promise<Character[]> {
    return this.prisma.character.findMany({
      where: {
        styleType,
        isPublic: true,
        generationStatus: GenerationStatus.COMPLETED,
      },
      take: limit,
      orderBy: { createdAt: 'desc' },
      include: {
        user: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    });
  }

  async getPopularTags(limit = 20): Promise<{ tag: string; count: number }[]> {
    const result = await this.prisma.$queryRaw<{ tag: string; count: bigint }[]>`
      SELECT unnest(tags) as tag, COUNT(*) as count
      FROM characters
      WHERE is_public = true AND generation_status = 'COMPLETED'
      GROUP BY tag
      ORDER BY count DESC
      LIMIT ${limit}
    `;

    return result.map(item => ({
      tag: item.tag,
      count: Number(item.count),
    }));
  }

  async getCharacterStats(userId: string): Promise<{
    total: number;
    byStyle: Record<string, number>;
    byStatus: Record<string, number>;
  }> {
    const characters = await this.prisma.character.findMany({
      where: { userId },
      select: {
        styleType: true,
        generationStatus: true,
      },
    });

    const byStyle: Record<string, number> = {};
    const byStatus: Record<string, number> = {};

    characters.forEach(char => {
      byStyle[char.styleType] = (byStyle[char.styleType] || 0) + 1;
      byStatus[char.generationStatus] = (byStatus[char.generationStatus] || 0) + 1;
    });

    return {
      total: characters.length,
      byStyle,
      byStatus,
    };
  }

  // Enhanced validation and constraint methods
  private readonly constraints: CharacterConstraints = {
    name: {
      maxLength: 100,
      required: false,
    },
    prompt: {
      maxLength: 2000,
      required: true,
    },
    tags: {
      maxCount: 10,
      maxTagLength: 50,
      required: false,
    },
  };

  async validateCharacter(data: Partial<CharacterCreateData>): Promise<ModelValidationResult> {
    const errors: string[] = [];

    // Prompt validation (required)
    if (!data.prompt || data.prompt.trim().length === 0) {
      errors.push('Character prompt is required');
    } else if (data.prompt.length > this.constraints.prompt.maxLength) {
      errors.push(`Prompt must be ${this.constraints.prompt.maxLength} characters or less`);
    }

    // Name validation (optional)
    if (data.name !== undefined) {
      if (data.name && data.name.length > this.constraints.name.maxLength) {
        errors.push(`Name must be ${this.constraints.name.maxLength} characters or less`);
      }
    }

    // Tags validation
    if (data.tags) {
      if (!Array.isArray(data.tags)) {
        errors.push('Tags must be an array');
      } else {
        if (data.tags.length > this.constraints.tags.maxCount) {
          errors.push(`Characters can have at most ${this.constraints.tags.maxCount} tags`);
        }
        
        const invalidTags = data.tags.filter(tag => 
          typeof tag !== 'string' || 
          tag.length > this.constraints.tags.maxTagLength || 
          tag.trim().length === 0
        );
        
        if (invalidTags.length > 0) {
          errors.push(`All tags must be non-empty strings of ${this.constraints.tags.maxTagLength} characters or less`);
        }
      }
    }

    // UserId validation (required)
    if (!data.userId || data.userId.trim().length === 0) {
      errors.push('User ID is required');
    }

    return {
      isValid: errors.length === 0,
      errors,
    };
  }

  async validateCharacterUpdate(id: string, data: Partial<CharacterUpdateData>): Promise<ModelValidationResult> {
    const errors: string[] = [];

    // Check if character exists
    const existingCharacter = await this.findById(id);
    if (!existingCharacter) {
      errors.push('Character not found');
      return { isValid: false, errors };
    }

    // Prompt validation
    if (data.prompt !== undefined) {
      if (!data.prompt || data.prompt.trim().length === 0) {
        errors.push('Character prompt cannot be empty');
      } else if (data.prompt.length > this.constraints.prompt.maxLength) {
        errors.push(`Prompt must be ${this.constraints.prompt.maxLength} characters or less`);
      }
    }

    // Name validation
    if (data.name !== undefined) {
      if (data.name && data.name.length > this.constraints.name.maxLength) {
        errors.push(`Name must be ${this.constraints.name.maxLength} characters or less`);
      }
    }

    // Tags validation
    if (data.tags) {
      if (!Array.isArray(data.tags)) {
        errors.push('Tags must be an array');
      } else {
        if (data.tags.length > this.constraints.tags.maxCount) {
          errors.push(`Characters can have at most ${this.constraints.tags.maxCount} tags`);
        }
        
        const invalidTags = data.tags.filter(tag => 
          typeof tag !== 'string' || 
          tag.length > this.constraints.tags.maxTagLength || 
          tag.trim().length === 0
        );
        
        if (invalidTags.length > 0) {
          errors.push(`All tags must be non-empty strings of ${this.constraints.tags.maxTagLength} characters or less`);
        }
      }
    }

    return {
      isValid: errors.length === 0,
      errors,
    };
  }

  async createFromTemplate(templateId: string, userId: string, customizations?: {
    name?: string;
    additionalPrompt?: string;
    tags?: string[];
    isPublic?: boolean;
  }): Promise<Character> {
    // Get template
    const template = await this.prisma.characterTemplate.findUnique({
      where: { id: templateId, isActive: true },
    });
    
    if (!template) {
      throw new Error('Template not found or inactive');
    }

    // Increment template usage
    await this.prisma.characterTemplate.update({
      where: { id: templateId },
      data: { usageCount: { increment: 1 } },
    });

    // Build character data from template
    const characterData: Prisma.CharacterCreateInput = {
      user: { connect: { id: userId } },
      name: customizations?.name || template.name,
      prompt: customizations?.additionalPrompt 
        ? `${template.prompt}\n\n${customizations.additionalPrompt}` 
        : template.prompt,
      styleType: template.styleType,
      tags: customizations?.tags 
        ? [...new Set([...template.tags, ...customizations.tags])] 
        : template.tags,
      isPublic: customizations?.isPublic ?? false,
      metadata: {
        createdFromTemplate: templateId,
        templateName: template.name,
      },
    };

    return this.create(characterData);
  }

  async findByTemplate(templateId: string, options?: {
    skip?: number;
    take?: number;
    userId?: string;
    isPublic?: boolean;
  }): Promise<Character[]> {
    const { skip = 0, take = 20, userId, isPublic } = options || {};

    return this.prisma.character.findMany({
      where: {
        metadata: {
          path: ['createdFromTemplate'],
          equals: templateId,
        },
        ...(userId && { userId }),
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
      },
    });
  }

  async canUserEditCharacter(userId: string, characterId: string): Promise<{ allowed: boolean; reason?: string }> {
    const character = await this.findById(characterId);
    
    if (!character) {
      return { allowed: false, reason: 'Character not found' };
    }

    if (character.userId !== userId) {
      return { allowed: false, reason: 'You can only edit your own characters' };
    }

    return { allowed: true };
  }

  async canUserDeleteCharacter(userId: string, characterId: string): Promise<{ allowed: boolean; reason?: string }> {
    const character = await this.findById(characterId);
    
    if (!character) {
      return { allowed: false, reason: 'Character not found' };
    }

    if (character.userId !== userId) {
      return { allowed: false, reason: 'You can only delete your own characters' };
    }

    return { allowed: true };
  }

  async getGlobalCharacterStats(): Promise<{
    total: number;
    public: number;
    byStyle: Record<string, number>;
    byStatus: Record<string, number>;
    totalTags: number;
    templatesUsed: number;
  }> {
    const characters = await this.prisma.character.findMany({
      select: {
        isPublic: true,
        styleType: true,
        generationStatus: true,
        tags: true,
        metadata: true,
      },
    });

    const byStyle: Record<string, number> = {};
    const byStatus: Record<string, number> = {};
    const allTags = new Set<string>();
    let publicCount = 0;
    let templatesUsed = 0;

    characters.forEach(char => {
      if (char.isPublic) publicCount++;
      
      byStyle[char.styleType] = (byStyle[char.styleType] || 0) + 1;
      byStatus[char.generationStatus] = (byStatus[char.generationStatus] || 0) + 1;
      
      char.tags.forEach(tag => allTags.add(tag));
      
      if (char.metadata && typeof char.metadata === 'object' && 
          'createdFromTemplate' in char.metadata) {
        templatesUsed++;
      }
    });

    return {
      total: characters.length,
      public: publicCount,
      byStyle,
      byStatus,
      totalTags: allTags.size,
      templatesUsed,
    };
  }

  async findSimilarCharacters(characterId: string, limit = 5): Promise<Character[]> {
    const character = await this.findById(characterId);
    if (!character) {
      throw new Error('Character not found');
    }

    return this.prisma.character.findMany({
      where: {
        id: { not: characterId },
        isPublic: true,
        generationStatus: GenerationStatus.COMPLETED,
        OR: [
          { styleType: character.styleType },
          {
            tags: {
              hasSome: character.tags.length > 0 ? character.tags : ['_none_'],
            },
          },
        ],
      },
      take: limit,
      orderBy: { createdAt: 'desc' },
      include: {
        user: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    });
  }

  // Library management methods
  async addToLibrary(characterId: string): Promise<Character> {
    return this.update(characterId, { isInLibrary: true });
  }

  async removeFromLibrary(characterId: string): Promise<Character> {
    return this.update(characterId, { isInLibrary: false });
  }

  async toggleFavorite(characterId: string): Promise<Character> {
    const character = await this.findById(characterId);
    if (!character) {
      throw new Error('Character not found');
    }
    return this.update(characterId, { isFavorite: !character.isFavorite });
  }

  async findLibraryCharacters(userId: string, options?: {
    skip?: number;
    take?: number;
    filters?: {
      styleType?: StyleType;
      tags?: string[];
      age?: string;
      gender?: string;
      occupation?: string;
      personality?: string[];
    };
  }): Promise<Character[]> {
    const { skip = 0, take = 20, filters } = options || {};
    
    return this.findByUserId(userId, {
      skip,
      take,
      isInLibrary: true,
      ...filters,
    });
  }

  async findFavoriteCharacters(userId: string, options?: {
    skip?: number;
    take?: number;
  }): Promise<Character[]> {
    const { skip = 0, take = 20 } = options || {};
    
    return this.findByUserId(userId, {
      skip,
      take,
      isFavorite: true,
    });
  }

  async updateCharacterAttributes(characterId: string, attributes: {
    age?: string;
    gender?: string;
    occupation?: string;
    personality?: string[];
    physicalTraits?: any;
    clothing?: string;
    background?: string;
  }): Promise<Character> {
    return this.update(characterId, attributes);
  }

  async getCharacterAttributeStats(userId: string): Promise<{
    ageDistribution: Record<string, number>;
    genderDistribution: Record<string, number>;
    occupationDistribution: Record<string, number>;
    popularPersonalityTraits: { trait: string; count: number }[];
  }> {
    const characters = await this.prisma.character.findMany({
      where: { userId },
      select: {
        age: true,
        gender: true,
        occupation: true,
        personality: true,
      },
    });

    const ageDistribution: Record<string, number> = {};
    const genderDistribution: Record<string, number> = {};
    const occupationDistribution: Record<string, number> = {};
    const personalityTraits = new Map<string, number>();

    characters.forEach(char => {
      if (char.age) {
        ageDistribution[char.age] = (ageDistribution[char.age] || 0) + 1;
      }
      if (char.gender) {
        genderDistribution[char.gender] = (genderDistribution[char.gender] || 0) + 1;
      }
      if (char.occupation) {
        occupationDistribution[char.occupation] = (occupationDistribution[char.occupation] || 0) + 1;
      }
      if (char.personality) {
        char.personality.forEach(trait => {
          personalityTraits.set(trait, (personalityTraits.get(trait) || 0) + 1);
        });
      }
    });

    const popularPersonalityTraits = Array.from(personalityTraits.entries())
      .map(([trait, count]) => ({ trait, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 20);

    return {
      ageDistribution,
      genderDistribution,
      occupationDistribution,
      popularPersonalityTraits,
    };
  }

  async searchCharactersByAttributes(userId: string, search: {
    query?: string;
    age?: string;
    gender?: string;
    occupation?: string;
    personality?: string[];
    tags?: string[];
    styleType?: StyleType;
  }, options?: {
    skip?: number;
    take?: number;
  }): Promise<Character[]> {
    const { skip = 0, take = 20 } = options || {};
    const { query, age, gender, occupation, personality, tags, styleType } = search;

    return this.prisma.character.findMany({
      where: {
        userId,
        ...(query && {
          OR: [
            { name: { contains: query, mode: 'insensitive' } },
            { prompt: { contains: query, mode: 'insensitive' } },
            { background: { contains: query, mode: 'insensitive' } },
            { clothing: { contains: query, mode: 'insensitive' } },
          ],
        }),
        ...(age && { age: { contains: age, mode: 'insensitive' } }),
        ...(gender && { gender: { contains: gender, mode: 'insensitive' } }),
        ...(occupation && { occupation: { contains: occupation, mode: 'insensitive' } }),
        ...(personality && personality.length > 0 && {
          personality: { hasSome: personality },
        }),
        ...(tags && tags.length > 0 && {
          tags: { hasSome: tags },
        }),
        ...(styleType && { styleType }),
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
        collectionItems: {
          include: {
            collection: {
              select: {
                id: true,
                name: true,
              },
            },
          },
        },
      },
    });
  }

  async getCharacterWorkflowSuggestions(characterId: string): Promise<{
    suggestedCollections: { id: string; name: string; characterCount: number }[];
    suggestedScenes: { id: string; name: string; environment?: string; characterCount: number }[];
    similarCharacters: Character[];
  }> {
    const character = await this.findById(characterId);
    if (!character) {
      throw new Error('Character not found');
    }

    // Get user's collections
    const collections = await this.prisma.characterCollection.findMany({
      where: { 
        userId: character.userId,
        items: {
          none: {
            characterId: character.id,
          },
        },
      },
      select: {
        id: true,
        name: true,
        _count: {
          select: {
            items: true,
          },
        },
      },
      take: 5,
      orderBy: { updatedAt: 'desc' },
    });

    // Get user's scenes that might work with this character
    const scenes = await this.prisma.scene.findMany({
      where: {
        userId: character.userId,
        characters: {
          none: {
            characterId: character.id,
          },
        },
      },
      select: {
        id: true,
        name: true,
        environment: true,
        _count: {
          select: {
            characters: true,
          },
        },
      },
      take: 5,
      orderBy: { updatedAt: 'desc' },
    });

    // Get similar characters
    const similarCharacters = await this.findSimilarCharacters(character.id, 3);

    return {
      suggestedCollections: collections.map(c => ({
        id: c.id,
        name: c.name,
        characterCount: c._count.items,
      })),
      suggestedScenes: scenes.map(s => ({
        id: s.id,
        name: s.name,
        environment: s.environment,
        characterCount: s._count.characters,
      })),
      similarCharacters,
    };
  }
}

export default new CharacterModel();