import { CharacterModel } from '../../../src/models/Character';
import { getPrismaClient } from '../../../src/config/database';
import { StyleType, GenerationStatus } from '@prisma/client';

// Mock Prisma client
jest.mock('../../../src/config/database');

const mockPrisma = {
  character: {
    create: jest.fn(),
    findUnique: jest.fn(),
    findMany: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
  },
  characterTemplate: {
    findUnique: jest.fn(),
    update: jest.fn(),
  },
  $queryRaw: jest.fn(),
};

(getPrismaClient as jest.Mock).mockReturnValue(mockPrisma);

describe('CharacterModel', () => {
  let characterModel: CharacterModel;

  beforeEach(() => {
    jest.clearAllMocks();
    characterModel = new CharacterModel();
  });

  describe('create', () => {
    it('should create a character successfully', async () => {
      const characterData = {
        user: { connect: { id: 'user1' } },
        prompt: 'A brave warrior',
        styleType: StyleType.FANTASY,
      };
      const mockCharacter = {
        id: '1',
        userId: 'user1',
        prompt: 'A brave warrior',
        styleType: StyleType.FANTASY,
        user: { id: 'user1', email: 'test@example.com', name: 'Test User' },
      };

      mockPrisma.character.create.mockResolvedValue(mockCharacter);

      const result = await characterModel.create(characterData);

      expect(mockPrisma.character.create).toHaveBeenCalledWith({
        data: characterData,
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
      expect(result).toEqual(mockCharacter);
    });
  });

  describe('findById', () => {
    it('should find character by id', async () => {
      const characterId = '1';
      const mockCharacter = {
        id: characterId,
        prompt: 'A brave warrior',
        user: { id: 'user1', email: 'test@example.com', name: 'Test User' },
      };

      mockPrisma.character.findUnique.mockResolvedValue(mockCharacter);

      const result = await characterModel.findById(characterId);

      expect(mockPrisma.character.findUnique).toHaveBeenCalledWith({
        where: { id: characterId },
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
      expect(result).toEqual(mockCharacter);
    });
  });

  describe('findByUserId', () => {
    it('should find characters by user id', async () => {
      const userId = 'user1';
      const mockCharacters = [
        { id: '1', userId, prompt: 'Character 1' },
        { id: '2', userId, prompt: 'Character 2' },
      ];

      mockPrisma.character.findMany.mockResolvedValue(mockCharacters);

      const result = await characterModel.findByUserId(userId);

      expect(mockPrisma.character.findMany).toHaveBeenCalledWith({
        where: { userId },
        skip: 0,
        take: 20,
        orderBy: { createdAt: 'desc' },
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
      expect(result).toEqual(mockCharacters);
    });

    it('should apply filters for style type and tags', async () => {
      const userId = 'user1';
      const options = {
        styleType: StyleType.ANIME,
        tags: ['hero', 'warrior'],
        skip: 10,
        take: 5,
      };

      mockPrisma.character.findMany.mockResolvedValue([]);

      await characterModel.findByUserId(userId, options);

      expect(mockPrisma.character.findMany).toHaveBeenCalledWith({
        where: {
          userId,
          styleType: StyleType.ANIME,
          tags: {
            hasSome: ['hero', 'warrior'],
          },
        },
        skip: 10,
        take: 5,
        orderBy: { createdAt: 'desc' },
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
    });
  });

  describe('findPublicCharacters', () => {
    it('should find public characters with search filter', async () => {
      const options = {
        search: 'warrior',
        styleType: StyleType.FANTASY,
      };

      const mockCharacters = [
        { id: '1', name: 'Warrior King', isPublic: true },
      ];

      mockPrisma.character.findMany.mockResolvedValue(mockCharacters);

      const result = await characterModel.findPublicCharacters(options);

      expect(mockPrisma.character.findMany).toHaveBeenCalledWith({
        where: {
          isPublic: true,
          generationStatus: GenerationStatus.COMPLETED,
          styleType: StyleType.FANTASY,
          OR: [
            { name: { contains: 'warrior', mode: 'insensitive' } },
            { prompt: { contains: 'warrior', mode: 'insensitive' } },
            { tags: { hasSome: ['warrior'] } },
          ],
        },
        skip: 0,
        take: 20,
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
      expect(result).toEqual(mockCharacters);
    });
  });

  describe('updateGenerationStatus', () => {
    it('should update generation status with URLs', async () => {
      const characterId = '1';
      const status = GenerationStatus.COMPLETED;
      const s3Url = 'https://s3.example.com/image.jpg';
      const thumbnailUrl = 'https://s3.example.com/thumb.jpg';

      const mockCharacter = { id: characterId, generationStatus: status, s3Url, thumbnailUrl };
      mockPrisma.character.update.mockResolvedValue(mockCharacter);

      const result = await characterModel.updateGenerationStatus(characterId, status, s3Url, thumbnailUrl);

      expect(mockPrisma.character.update).toHaveBeenCalledWith({
        where: { id: characterId },
        data: {
          generationStatus: status,
          s3Url,
          thumbnailUrl,
        },
      });
      expect(result).toEqual(mockCharacter);
    });
  });

  describe('addTags', () => {
    it('should add tags to character without duplicates', async () => {
      const characterId = '1';
      const existingCharacter = {
        id: characterId,
        tags: ['existing', 'tags'],
      };
      const newTags = ['new', 'existing']; // 'existing' should not duplicate

      mockPrisma.character.findUnique.mockResolvedValue(existingCharacter);
      mockPrisma.character.update.mockResolvedValue({
        ...existingCharacter,
        tags: ['existing', 'tags', 'new'],
      });

      await characterModel.addTags(characterId, newTags);

      expect(mockPrisma.character.update).toHaveBeenCalledWith({
        where: { id: characterId },
        data: { tags: ['existing', 'tags', 'new'] },
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
    });

    it('should throw error if character not found', async () => {
      mockPrisma.character.findUnique.mockResolvedValue(null);

      await expect(characterModel.addTags('nonexistent', ['tag'])).rejects.toThrow('Character not found');
    });
  });

  describe('validateCharacter', () => {
    it('should validate correct character data', async () => {
      const characterData = {
        userId: 'user1',
        prompt: 'A brave warrior with a magical sword',
        name: 'Hero',
        tags: ['hero', 'warrior'],
      };

      const result = await characterModel.validateCharacter(characterData);

      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should return error for missing prompt', async () => {
      const characterData = {
        userId: 'user1',
        name: 'Hero',
      };

      const result = await characterModel.validateCharacter(characterData as any);

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Character prompt is required');
    });

    it('should return error for too long prompt', async () => {
      const characterData = {
        userId: 'user1',
        prompt: 'a'.repeat(2001), // Too long
      };

      const result = await characterModel.validateCharacter(characterData);

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Prompt must be 2000 characters or less');
    });

    it('should return error for too many tags', async () => {
      const characterData = {
        userId: 'user1',
        prompt: 'A brave warrior',
        tags: Array.from({ length: 11 }, (_, i) => `tag${i}`), // Too many tags
      };

      const result = await characterModel.validateCharacter(characterData);

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Characters can have at most 10 tags');
    });

    it('should return error for invalid tags', async () => {
      const characterData = {
        userId: 'user1',
        prompt: 'A brave warrior',
        tags: ['valid', '', 'a'.repeat(51)], // Empty and too long tags
      };

      const result = await characterModel.validateCharacter(characterData);

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('All tags must be non-empty strings of 50 characters or less');
    });

    it('should return error for missing userId', async () => {
      const characterData = {
        prompt: 'A brave warrior',
      };

      const result = await characterModel.validateCharacter(characterData as any);

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('User ID is required');
    });
  });

  describe('createFromTemplate', () => {
    it('should create character from template successfully', async () => {
      const templateId = 'template1';
      const userId = 'user1';
      const customizations = {
        name: 'Custom Name',
        additionalPrompt: 'Additional details',
        tags: ['custom'],
        isPublic: true,
      };

      const mockTemplate = {
        id: templateId,
        name: 'Template Name',
        prompt: 'Template prompt',
        styleType: StyleType.FANTASY,
        tags: ['template', 'tag'],
        isActive: true,
      };

      const mockCreatedCharacter = {
        id: '1',
        name: 'Custom Name',
        prompt: 'Template prompt\n\nAdditional details',
        styleType: StyleType.FANTASY,
        tags: ['template', 'tag', 'custom'],
        isPublic: true,
        metadata: {
          createdFromTemplate: templateId,
          templateName: 'Template Name',
        },
      };

      mockPrisma.characterTemplate.findUnique.mockResolvedValue(mockTemplate);
      mockPrisma.characterTemplate.update.mockResolvedValue({ ...mockTemplate, usageCount: 1 });
      mockPrisma.character.create.mockResolvedValue(mockCreatedCharacter);

      const result = await characterModel.createFromTemplate(templateId, userId, customizations);

      expect(mockPrisma.characterTemplate.findUnique).toHaveBeenCalledWith({
        where: { id: templateId, isActive: true },
      });
      expect(mockPrisma.characterTemplate.update).toHaveBeenCalledWith({
        where: { id: templateId },
        data: { usageCount: { increment: 1 } },
      });
      expect(result).toEqual(mockCreatedCharacter);
    });

    it('should throw error if template not found or inactive', async () => {
      mockPrisma.characterTemplate.findUnique.mockResolvedValue(null);

      await expect(
        characterModel.createFromTemplate('nonexistent', 'user1')
      ).rejects.toThrow('Template not found or inactive');
    });
  });

  describe('canUserEditCharacter', () => {
    it('should allow edit if user owns character', async () => {
      const userId = 'user1';
      const characterId = '1';
      const mockCharacter = { id: characterId, userId };

      mockPrisma.character.findUnique.mockResolvedValue(mockCharacter);

      const result = await characterModel.canUserEditCharacter(userId, characterId);

      expect(result.allowed).toBe(true);
      expect(result.reason).toBeUndefined();
    });

    it('should deny edit if user does not own character', async () => {
      const userId = 'user1';
      const characterId = '1';
      const mockCharacter = { id: characterId, userId: 'user2' };

      mockPrisma.character.findUnique.mockResolvedValue(mockCharacter);

      const result = await characterModel.canUserEditCharacter(userId, characterId);

      expect(result.allowed).toBe(false);
      expect(result.reason).toBe('You can only edit your own characters');
    });

    it('should deny edit if character not found', async () => {
      mockPrisma.character.findUnique.mockResolvedValue(null);

      const result = await characterModel.canUserEditCharacter('user1', 'nonexistent');

      expect(result.allowed).toBe(false);
      expect(result.reason).toBe('Character not found');
    });
  });

  describe('getPopularTags', () => {
    it('should return popular tags with counts', async () => {
      const mockResults = [
        { tag: 'hero', count: BigInt(10) },
        { tag: 'warrior', count: BigInt(8) },
        { tag: 'magic', count: BigInt(6) },
      ];

      mockPrisma.$queryRaw.mockResolvedValue(mockResults);

      const result = await characterModel.getPopularTags(3);

      expect(result).toEqual([
        { tag: 'hero', count: 10 },
        { tag: 'warrior', count: 8 },
        { tag: 'magic', count: 6 },
      ]);
    });
  });

  describe('getCharacterStats', () => {
    it('should return character statistics for user', async () => {
      const userId = 'user1';
      const mockCharacters = [
        { styleType: StyleType.FANTASY, generationStatus: GenerationStatus.COMPLETED },
        { styleType: StyleType.FANTASY, generationStatus: GenerationStatus.PENDING },
        { styleType: StyleType.ANIME, generationStatus: GenerationStatus.COMPLETED },
      ];

      mockPrisma.character.findMany.mockResolvedValue(mockCharacters);

      const result = await characterModel.getCharacterStats(userId);

      expect(result).toEqual({
        total: 3,
        byStyle: {
          FANTASY: 2,
          ANIME: 1,
        },
        byStatus: {
          COMPLETED: 2,
          PENDING: 1,
        },
      });
    });
  });

  describe('findSimilarCharacters', () => {
    it('should find similar characters based on style and tags', async () => {
      const characterId = '1';
      const mockCharacter = {
        id: characterId,
        styleType: StyleType.FANTASY,
        tags: ['hero', 'warrior'],
      };

      const mockSimilarCharacters = [
        { id: '2', styleType: StyleType.FANTASY, tags: ['hero'] },
        { id: '3', styleType: StyleType.FANTASY, tags: ['warrior'] },
      ];

      mockPrisma.character.findUnique.mockResolvedValue(mockCharacter);
      mockPrisma.character.findMany.mockResolvedValue(mockSimilarCharacters);

      const result = await characterModel.findSimilarCharacters(characterId, 2);

      expect(mockPrisma.character.findMany).toHaveBeenCalledWith({
        where: {
          id: { not: characterId },
          isPublic: true,
          generationStatus: GenerationStatus.COMPLETED,
          OR: [
            { styleType: StyleType.FANTASY },
            {
              tags: {
                hasSome: ['hero', 'warrior'],
              },
            },
          ],
        },
        take: 2,
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
      expect(result).toEqual(mockSimilarCharacters);
    });

    it('should throw error if character not found', async () => {
      mockPrisma.character.findUnique.mockResolvedValue(null);

      await expect(characterModel.findSimilarCharacters('nonexistent')).rejects.toThrow('Character not found');
    });
  });
});