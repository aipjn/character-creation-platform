import { CharacterTemplate, Prisma, StyleType } from '@prisma/client';
import { getPrismaClient } from '../config/database';

export class CharacterTemplateModel {
  private prisma = getPrismaClient();

  async create(data: Prisma.CharacterTemplateCreateInput): Promise<CharacterTemplate> {
    return this.prisma.characterTemplate.create({
      data,
    });
  }

  async findById(id: string): Promise<CharacterTemplate | null> {
    return this.prisma.characterTemplate.findUnique({
      where: { id },
    });
  }

  async findAll(options?: {
    skip?: number;
    take?: number;
    styleType?: StyleType;
    isActive?: boolean;
    tags?: string[];
  }): Promise<CharacterTemplate[]> {
    const { skip = 0, take = 50, styleType, isActive = true, tags } = options || {};

    return this.prisma.characterTemplate.findMany({
      where: {
        isActive,
        ...(styleType && { styleType }),
        ...(tags && tags.length > 0 && {
          tags: {
            hasSome: tags,
          },
        }),
      },
      skip,
      take,
      orderBy: [
        { usageCount: 'desc' },
        { createdAt: 'desc' },
      ],
    });
  }

  async findByStyleType(styleType: StyleType, options?: {
    skip?: number;
    take?: number;
    isActive?: boolean;
  }): Promise<CharacterTemplate[]> {
    const { skip = 0, take = 20, isActive = true } = options || {};

    return this.prisma.characterTemplate.findMany({
      where: {
        styleType,
        isActive,
      },
      skip,
      take,
      orderBy: [
        { usageCount: 'desc' },
        { createdAt: 'desc' },
      ],
    });
  }

  async findPopularTemplates(limit = 10): Promise<CharacterTemplate[]> {
    return this.prisma.characterTemplate.findMany({
      where: { isActive: true },
      take: limit,
      orderBy: { usageCount: 'desc' },
    });
  }

  async searchTemplates(search: string, options?: {
    skip?: number;
    take?: number;
    styleType?: StyleType;
  }): Promise<CharacterTemplate[]> {
    const { skip = 0, take = 20, styleType } = options || {};

    return this.prisma.characterTemplate.findMany({
      where: {
        isActive: true,
        ...(styleType && { styleType }),
        OR: [
          { name: { contains: search, mode: 'insensitive' } },
          { description: { contains: search, mode: 'insensitive' } },
          { prompt: { contains: search, mode: 'insensitive' } },
          { tags: { hasSome: [search] } },
        ],
      },
      skip,
      take,
      orderBy: [
        { usageCount: 'desc' },
        { createdAt: 'desc' },
      ],
    });
  }

  async update(id: string, data: Prisma.CharacterTemplateUpdateInput): Promise<CharacterTemplate> {
    return this.prisma.characterTemplate.update({
      where: { id },
      data,
    });
  }

  async delete(id: string): Promise<CharacterTemplate> {
    return this.prisma.characterTemplate.delete({
      where: { id },
    });
  }

  async incrementUsage(id: string): Promise<CharacterTemplate> {
    return this.prisma.characterTemplate.update({
      where: { id },
      data: {
        usageCount: { increment: 1 },
      },
    });
  }

  async toggleActive(id: string): Promise<CharacterTemplate> {
    const template = await this.findById(id);
    if (!template) {
      throw new Error('Template not found');
    }

    return this.update(id, { isActive: !template.isActive });
  }

  async addTags(id: string, newTags: string[]): Promise<CharacterTemplate> {
    const template = await this.findById(id);
    if (!template) {
      throw new Error('Template not found');
    }

    const updatedTags = [...new Set([...template.tags, ...newTags])];
    
    return this.update(id, { tags: updatedTags });
  }

  async removeTags(id: string, tagsToRemove: string[]): Promise<CharacterTemplate> {
    const template = await this.findById(id);
    if (!template) {
      throw new Error('Template not found');
    }

    const updatedTags = template.tags.filter(tag => !tagsToRemove.includes(tag));
    
    return this.update(id, { tags: updatedTags });
  }

  async getTemplateStats(): Promise<{
    total: number;
    active: number;
    byStyle: Record<string, number>;
    totalUsage: number;
  }> {
    const templates = await this.prisma.characterTemplate.findMany({
      select: {
        isActive: true,
        styleType: true,
        usageCount: true,
      },
    });

    const byStyle: Record<string, number> = {};
    let totalUsage = 0;
    let activeCount = 0;

    templates.forEach(template => {
      byStyle[template.styleType] = (byStyle[template.styleType] || 0) + 1;
      totalUsage += template.usageCount;
      if (template.isActive) activeCount++;
    });

    return {
      total: templates.length,
      active: activeCount,
      byStyle,
      totalUsage,
    };
  }

  async validateTemplate(data: Partial<Prisma.CharacterTemplateCreateInput>): Promise<{
    isValid: boolean;
    errors: string[];
  }> {
    const errors: string[] = [];

    if (!data.name || data.name.trim().length === 0) {
      errors.push('Template name is required');
    }

    if (data.name && data.name.length > 100) {
      errors.push('Template name must be 100 characters or less');
    }

    if (!data.prompt || data.prompt.trim().length === 0) {
      errors.push('Template prompt is required');
    }

    if (data.prompt && data.prompt.length > 2000) {
      errors.push('Template prompt must be 2000 characters or less');
    }

    if (data.description && data.description.length > 500) {
      errors.push('Template description must be 500 characters or less');
    }

    if (data.tags) {
      if (!Array.isArray(data.tags)) {
        errors.push('Tags must be an array');
      } else {
        if (data.tags.length > 20) {
          errors.push('Templates can have at most 20 tags');
        }
        
        const invalidTags = data.tags.filter(tag => 
          typeof tag !== 'string' || tag.length > 50 || tag.trim().length === 0
        );
        
        if (invalidTags.length > 0) {
          errors.push('All tags must be non-empty strings of 50 characters or less');
        }
      }
    }

    return {
      isValid: errors.length === 0,
      errors,
    };
  }
}

export default new CharacterTemplateModel();