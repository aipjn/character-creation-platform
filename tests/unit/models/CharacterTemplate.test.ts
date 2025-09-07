import { CharacterTemplateModel } from '../../../src/models/CharacterTemplate';
import { getPrismaClient } from '../../../src/config/database';
import { StyleType } from '@prisma/client';

// Mock Prisma client
jest.mock('../../../src/config/database');

const mockPrisma = {
  characterTemplate: {
    create: jest.fn(),
    findUnique: jest.fn(),
    findMany: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
  },
};

(getPrismaClient as jest.Mock).mockReturnValue(mockPrisma);

describe('CharacterTemplateModel', () => {
  let templateModel: CharacterTemplateModel;

  beforeEach(() => {
    jest.clearAllMocks();
    templateModel = new CharacterTemplateModel();
  });

  describe('create', () => {
    it('should create a template successfully', async () => {
      const templateData = {
        name: 'Fantasy Warrior',
        description: 'A brave warrior template',
        prompt: 'A mighty warrior with a sword',
        styleType: StyleType.FANTASY,
        tags: ['warrior', 'hero'],
      };
      const mockTemplate = { id: '1', ...templateData, usageCount: 0, isActive: true };

      mockPrisma.characterTemplate.create.mockResolvedValue(mockTemplate);

      const result = await templateModel.create(templateData);

      expect(mockPrisma.characterTemplate.create).toHaveBeenCalledWith({ data: templateData });
      expect(result).toEqual(mockTemplate);
    });
  });

  describe('findById', () => {
    it('should find template by id', async () => {
      const templateId = '1';
      const mockTemplate = { 
        id: templateId, 
        name: 'Fantasy Warrior', 
        prompt: 'A mighty warrior',
        isActive: true 
      };

      mockPrisma.characterTemplate.findUnique.mockResolvedValue(mockTemplate);

      const result = await templateModel.findById(templateId);

      expect(mockPrisma.characterTemplate.findUnique).toHaveBeenCalledWith({
        where: { id: templateId },
      });
      expect(result).toEqual(mockTemplate);
    });

    it('should return null if template not found', async () => {
      mockPrisma.characterTemplate.findUnique.mockResolvedValue(null);

      const result = await templateModel.findById('nonexistent');

      expect(result).toBeNull();
    });
  });

  describe('findAll', () => {
    it('should find all active templates with default options', async () => {
      const mockTemplates = [
        { id: '1', name: 'Template 1', isActive: true },
        { id: '2', name: 'Template 2', isActive: true },
      ];

      mockPrisma.characterTemplate.findMany.mockResolvedValue(mockTemplates);

      const result = await templateModel.findAll();

      expect(mockPrisma.characterTemplate.findMany).toHaveBeenCalledWith({
        where: { isActive: true },
        skip: 0,
        take: 50,
        orderBy: [
          { usageCount: 'desc' },
          { createdAt: 'desc' },
        ],
      });
      expect(result).toEqual(mockTemplates);
    });

    it('should apply filters for style type and tags', async () => {
      const options = {
        styleType: StyleType.FANTASY,
        tags: ['warrior', 'hero'],
        skip: 10,
        take: 5,
        isActive: false,
      };

      mockPrisma.characterTemplate.findMany.mockResolvedValue([]);

      await templateModel.findAll(options);

      expect(mockPrisma.characterTemplate.findMany).toHaveBeenCalledWith({
        where: {
          isActive: false,
          styleType: StyleType.FANTASY,
          tags: {
            hasSome: ['warrior', 'hero'],
          },
        },
        skip: 10,
        take: 5,
        orderBy: [
          { usageCount: 'desc' },
          { createdAt: 'desc' },
        ],
      });
    });
  });

  describe('findByStyleType', () => {
    it('should find templates by style type', async () => {
      const styleType = StyleType.ANIME;
      const mockTemplates = [
        { id: '1', name: 'Anime Hero', styleType },
        { id: '2', name: 'Anime Villain', styleType },
      ];

      mockPrisma.characterTemplate.findMany.mockResolvedValue(mockTemplates);

      const result = await templateModel.findByStyleType(styleType);

      expect(mockPrisma.characterTemplate.findMany).toHaveBeenCalledWith({
        where: {
          styleType,
          isActive: true,
        },
        skip: 0,
        take: 20,
        orderBy: [
          { usageCount: 'desc' },
          { createdAt: 'desc' },
        ],
      });
      expect(result).toEqual(mockTemplates);
    });
  });

  describe('findPopularTemplates', () => {
    it('should find most popular templates', async () => {
      const mockTemplates = [
        { id: '1', name: 'Popular Template 1', usageCount: 100 },
        { id: '2', name: 'Popular Template 2', usageCount: 80 },
      ];

      mockPrisma.characterTemplate.findMany.mockResolvedValue(mockTemplates);

      const result = await templateModel.findPopularTemplates(2);

      expect(mockPrisma.characterTemplate.findMany).toHaveBeenCalledWith({
        where: { isActive: true },
        take: 2,
        orderBy: { usageCount: 'desc' },
      });
      expect(result).toEqual(mockTemplates);
    });
  });

  describe('searchTemplates', () => {
    it('should search templates by text', async () => {
      const searchQuery = 'warrior';
      const options = {
        styleType: StyleType.FANTASY,
        skip: 0,
        take: 10,
      };

      const mockTemplates = [
        { id: '1', name: 'Fantasy Warrior', description: 'A brave warrior' },
      ];

      mockPrisma.characterTemplate.findMany.mockResolvedValue(mockTemplates);

      const result = await templateModel.searchTemplates(searchQuery, options);

      expect(mockPrisma.characterTemplate.findMany).toHaveBeenCalledWith({
        where: {
          isActive: true,
          styleType: StyleType.FANTASY,
          OR: [
            { name: { contains: 'warrior', mode: 'insensitive' } },
            { description: { contains: 'warrior', mode: 'insensitive' } },
            { prompt: { contains: 'warrior', mode: 'insensitive' } },
            { tags: { hasSome: ['warrior'] } },
          ],
        },
        skip: 0,
        take: 10,
        orderBy: [
          { usageCount: 'desc' },
          { createdAt: 'desc' },
        ],
      });
      expect(result).toEqual(mockTemplates);
    });
  });

  describe('incrementUsage', () => {
    it('should increment template usage count', async () => {
      const templateId = '1';
      const mockTemplate = { id: templateId, usageCount: 5 };

      mockPrisma.characterTemplate.update.mockResolvedValue(mockTemplate);

      const result = await templateModel.incrementUsage(templateId);

      expect(mockPrisma.characterTemplate.update).toHaveBeenCalledWith({
        where: { id: templateId },
        data: {
          usageCount: { increment: 1 },
        },
      });
      expect(result).toEqual(mockTemplate);
    });
  });

  describe('toggleActive', () => {
    it('should toggle template active status', async () => {
      const templateId = '1';
      const existingTemplate = { id: templateId, isActive: true };
      const updatedTemplate = { id: templateId, isActive: false };

      mockPrisma.characterTemplate.findUnique.mockResolvedValue(existingTemplate);
      mockPrisma.characterTemplate.update.mockResolvedValue(updatedTemplate);

      const result = await templateModel.toggleActive(templateId);

      expect(mockPrisma.characterTemplate.update).toHaveBeenCalledWith({
        where: { id: templateId },
        data: { isActive: false },
      });
      expect(result).toEqual(updatedTemplate);
    });

    it('should throw error if template not found', async () => {
      mockPrisma.characterTemplate.findUnique.mockResolvedValue(null);

      await expect(templateModel.toggleActive('nonexistent')).rejects.toThrow('Template not found');
    });
  });

  describe('addTags', () => {
    it('should add tags to template without duplicates', async () => {
      const templateId = '1';
      const existingTemplate = {
        id: templateId,
        tags: ['existing', 'tags'],
      };
      const newTags = ['new', 'existing']; // 'existing' should not duplicate

      mockPrisma.characterTemplate.findUnique.mockResolvedValue(existingTemplate);
      mockPrisma.characterTemplate.update.mockResolvedValue({
        ...existingTemplate,
        tags: ['existing', 'tags', 'new'],
      });

      await templateModel.addTags(templateId, newTags);

      expect(mockPrisma.characterTemplate.update).toHaveBeenCalledWith({
        where: { id: templateId },
        data: { tags: ['existing', 'tags', 'new'] },
      });
    });

    it('should throw error if template not found', async () => {
      mockPrisma.characterTemplate.findUnique.mockResolvedValue(null);

      await expect(templateModel.addTags('nonexistent', ['tag'])).rejects.toThrow('Template not found');
    });
  });

  describe('removeTags', () => {
    it('should remove specified tags from template', async () => {
      const templateId = '1';
      const existingTemplate = {
        id: templateId,
        tags: ['tag1', 'tag2', 'tag3'],
      };
      const tagsToRemove = ['tag2'];

      mockPrisma.characterTemplate.findUnique.mockResolvedValue(existingTemplate);
      mockPrisma.characterTemplate.update.mockResolvedValue({
        ...existingTemplate,
        tags: ['tag1', 'tag3'],
      });

      await templateModel.removeTags(templateId, tagsToRemove);

      expect(mockPrisma.characterTemplate.update).toHaveBeenCalledWith({
        where: { id: templateId },
        data: { tags: ['tag1', 'tag3'] },
      });
    });
  });

  describe('validateTemplate', () => {
    it('should validate correct template data', async () => {
      const templateData = {
        name: 'Valid Template',
        description: 'A valid template description',
        prompt: 'A valid prompt for character generation',
        tags: ['tag1', 'tag2'],
      };

      const result = await templateModel.validateTemplate(templateData);

      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should return error for missing name', async () => {
      const templateData = {
        prompt: 'A valid prompt',
      };

      const result = await templateModel.validateTemplate(templateData);

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Template name is required');
    });

    it('should return error for empty name', async () => {
      const templateData = {
        name: '   ',
        prompt: 'A valid prompt',
      };

      const result = await templateModel.validateTemplate(templateData);

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Template name is required');
    });

    it('should return error for too long name', async () => {
      const templateData = {
        name: 'a'.repeat(101),
        prompt: 'A valid prompt',
      };

      const result = await templateModel.validateTemplate(templateData);

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Template name must be 100 characters or less');
    });

    it('should return error for missing prompt', async () => {
      const templateData = {
        name: 'Valid Name',
      };

      const result = await templateModel.validateTemplate(templateData);

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Template prompt is required');
    });

    it('should return error for too long prompt', async () => {
      const templateData = {
        name: 'Valid Name',
        prompt: 'a'.repeat(2001),
      };

      const result = await templateModel.validateTemplate(templateData);

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Template prompt must be 2000 characters or less');
    });

    it('should return error for too long description', async () => {
      const templateData = {
        name: 'Valid Name',
        prompt: 'Valid prompt',
        description: 'a'.repeat(501),
      };

      const result = await templateModel.validateTemplate(templateData);

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Template description must be 500 characters or less');
    });

    it('should return error for invalid tags', async () => {
      const templateData = {
        name: 'Valid Name',
        prompt: 'Valid prompt',
        tags: 'not an array' as any,
      };

      const result = await templateModel.validateTemplate(templateData);

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Tags must be an array');
    });

    it('should return error for too many tags', async () => {
      const templateData = {
        name: 'Valid Name',
        prompt: 'Valid prompt',
        tags: Array.from({ length: 21 }, (_, i) => `tag${i}`),
      };

      const result = await templateModel.validateTemplate(templateData);

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Templates can have at most 20 tags');
    });

    it('should return error for invalid tag format', async () => {
      const templateData = {
        name: 'Valid Name',
        prompt: 'Valid prompt',
        tags: ['valid', '', 'a'.repeat(51)],
      };

      const result = await templateModel.validateTemplate(templateData);

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('All tags must be non-empty strings of 50 characters or less');
    });

    it('should return multiple errors for multiple issues', async () => {
      const templateData = {
        name: '',
        prompt: '',
        description: 'a'.repeat(501),
        tags: ['valid', ''],
      };

      const result = await templateModel.validateTemplate(templateData);

      expect(result.isValid).toBe(false);
      expect(result.errors).toHaveLength(4);
      expect(result.errors).toContain('Template name is required');
      expect(result.errors).toContain('Template prompt is required');
      expect(result.errors).toContain('Template description must be 500 characters or less');
      expect(result.errors).toContain('All tags must be non-empty strings of 50 characters or less');
    });
  });

  describe('getTemplateStats', () => {
    it('should return template statistics', async () => {
      const mockTemplates = [
        {
          isActive: true,
          styleType: StyleType.FANTASY,
          usageCount: 10,
        },
        {
          isActive: true,
          styleType: StyleType.ANIME,
          usageCount: 5,
        },
        {
          isActive: false,
          styleType: StyleType.FANTASY,
          usageCount: 3,
        },
      ];

      mockPrisma.characterTemplate.findMany.mockResolvedValue(mockTemplates);

      const result = await templateModel.getTemplateStats();

      expect(result).toEqual({
        total: 3,
        active: 2,
        byStyle: {
          FANTASY: 2,
          ANIME: 1,
        },
        totalUsage: 18,
      });
    });
  });

  describe('update', () => {
    it('should update template successfully', async () => {
      const templateId = '1';
      const updateData = {
        name: 'Updated Template',
        description: 'Updated description',
      };
      const mockUpdatedTemplate = { id: templateId, ...updateData };

      mockPrisma.characterTemplate.update.mockResolvedValue(mockUpdatedTemplate);

      const result = await templateModel.update(templateId, updateData);

      expect(mockPrisma.characterTemplate.update).toHaveBeenCalledWith({
        where: { id: templateId },
        data: updateData,
      });
      expect(result).toEqual(mockUpdatedTemplate);
    });
  });

  describe('delete', () => {
    it('should delete template successfully', async () => {
      const templateId = '1';
      const mockDeletedTemplate = { id: templateId, name: 'Deleted Template' };

      mockPrisma.characterTemplate.delete.mockResolvedValue(mockDeletedTemplate);

      const result = await templateModel.delete(templateId);

      expect(mockPrisma.characterTemplate.delete).toHaveBeenCalledWith({
        where: { id: templateId },
      });
      expect(result).toEqual(mockDeletedTemplate);
    });
  });
});