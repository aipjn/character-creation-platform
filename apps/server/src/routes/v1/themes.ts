/**
 * Character Themes and Variants API Routes
 * 角色主题和变体管理路由
 */

import { Router, Request, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import fs from 'fs/promises';
import path from 'path';
import {
  CharacterTheme,
  CharacterVariant,
  ThemeWithVariants,
  CreateThemeRequest,
  CreateVariantRequest
} from '../../../../../shared/types/theme';
import { getDefaultGeminiClient } from '../../api/geminiClient';

const router = Router();

// Initialize Gemini client for image generation
const geminiClient = getDefaultGeminiClient();

// Storage paths
const THEMES_DIR = path.join(process.cwd(), 'uploads', 'themes');
const VARIANTS_DIR = path.join(process.cwd(), 'uploads', 'variants');

// Ensure directories exist
async function ensureDirectories() {
  await fs.mkdir(THEMES_DIR, { recursive: true });
  await fs.mkdir(VARIANTS_DIR, { recursive: true });
}

ensureDirectories();

/**
 * GET /api/v1/themes/character/:characterId
 * 获取某个角色的所有主题及其变体
 */
router.get('/character/:characterId', async (req: Request, res: Response) => {
  try {
    const { characterId } = req.params;

    // 读取该角色的所有主题
    const files = await fs.readdir(THEMES_DIR);
    const themeFiles = files.filter(f => f.endsWith('.json') && f.includes(characterId!));

    const themes: ThemeWithVariants[] = [];

    for (const file of themeFiles) {
      const themePath = path.join(THEMES_DIR, file);
      const themeData = JSON.parse(await fs.readFile(themePath, 'utf-8'));

      // 读取该主题的所有变体
      const variants = await getVariantsByThemeId(themeData.id);

      themes.push({
        ...themeData,
        variants
      });
    }

    res.json({
      success: true,
      data: themes,
      meta: {
        timestamp: new Date().toISOString(),
        count: themes.length
      }
    });
  } catch (error: any) {
    console.error('Error fetching themes:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: error.message || 'Failed to fetch themes'
      }
    });
  }
});

/**
 * POST /api/v1/themes
 * 创建新主题
 */
router.post('/', async (req: Request, res: Response): Promise<any> => {
  try {
    const { characterId, name, description }: CreateThemeRequest = req.body;

    if (!characterId || !name) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Character ID and theme name are required'
        }
      });
    }

    const theme: CharacterTheme = {
      id: `theme_${Date.now()}_${uuidv4().slice(0, 8)}`,
      characterId,
      name,
      ...(description && { description }),
      createdAt: new Date(),
      updatedAt: new Date()
    };

    // 保存主题
    const themePath = path.join(THEMES_DIR, `${theme.id}.json`);
    await fs.writeFile(themePath, JSON.stringify(theme, null, 2));

    res.status(201).json({
      success: true,
      data: theme,
      meta: {
        timestamp: new Date().toISOString()
      }
    });
  } catch (error: any) {
    console.error('Error creating theme:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: error.message || 'Failed to create theme'
      }
    });
  }
});

/**
 * GET /api/v1/themes/:themeId
 * 获取单个主题及其变体
 */
router.get('/:themeId', async (req: Request, res: Response) => {
  try {
    const { themeId } = req.params;

    const themePath = path.join(THEMES_DIR, `${themeId!}.json`);
    const themeData = JSON.parse(await fs.readFile(themePath, 'utf-8'));

    const variants = await getVariantsByThemeId(themeId!);

    const themeWithVariants: ThemeWithVariants = {
      ...themeData,
      variants
    };

    res.json({
      success: true,
      data: themeWithVariants,
      meta: {
        timestamp: new Date().toISOString()
      }
    });
  } catch (error: any) {
    console.error('Error fetching theme:', error);
    res.status(404).json({
      success: false,
      error: {
        code: 'NOT_FOUND',
        message: 'Theme not found'
      }
    });
  }
});

/**
 * PUT /api/v1/themes/:themeId
 * 更新主题
 */
router.put('/:themeId', async (req: Request, res: Response) => {
  try {
    const { themeId } = req.params;
    const { name, description } = req.body;

    const themePath = path.join(THEMES_DIR, `${themeId}.json`);
    const themeData = JSON.parse(await fs.readFile(themePath, 'utf-8'));

    const updatedTheme: CharacterTheme = {
      ...themeData,
      name: name || themeData.name,
      description: description !== undefined ? description : themeData.description,
      updatedAt: new Date()
    };

    await fs.writeFile(themePath, JSON.stringify(updatedTheme, null, 2));

    res.json({
      success: true,
      data: updatedTheme,
      meta: {
        timestamp: new Date().toISOString()
      }
    });
  } catch (error: any) {
    console.error('Error updating theme:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: error.message || 'Failed to update theme'
      }
    });
  }
});

/**
 * DELETE /api/v1/themes/:themeId
 * 删除主题及其所有变体
 */
router.delete('/:themeId', async (req: Request, res: Response) => {
  try {
    const { themeId } = req.params;

    // 删除所有变体
    const variants = await getVariantsByThemeId(themeId!);
    for (const variant of variants) {
      const variantPath = path.join(VARIANTS_DIR, `${variant.id}.json`);
      await fs.unlink(variantPath).catch(() => {});

      // 删除变体图片
      if (variant.imageUrl) {
        const imagePath = path.join(process.cwd(), variant.imageUrl);
        await fs.unlink(imagePath).catch(() => {});
      }
    }

    // 删除主题
    const themePath = path.join(THEMES_DIR, `${themeId}.json`);
    await fs.unlink(themePath);

    res.json({
      success: true,
      data: {
        message: `Theme ${themeId} and ${variants.length} variants deleted successfully`
      }
    });
  } catch (error: any) {
    console.error('Error deleting theme:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: error.message || 'Failed to delete theme'
      }
    });
  }
});

/**
 * POST /api/v1/themes/:themeId/variants
 * 在主题下创建新变体
 */
router.post('/:themeId/variants', async (req: Request, res: Response): Promise<any> => {
  try {
    const { themeId } = req.params;
    const { prompt, metadata }: CreateVariantRequest = req.body;

    if (!prompt) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Prompt is required'
        }
      });
    }

    const variant: CharacterVariant = {
      id: `variant_${Date.now()}_${uuidv4().slice(0, 8)}`,
      themeId: themeId!,
      prompt,
      imageUrl: '',  // 将在图像生成后更新
      ...(metadata && { metadata }),
      createdAt: new Date()
    };

    // 保存变体元数据
    const variantPath = path.join(VARIANTS_DIR, `${variant.id}.json`);
    await fs.writeFile(variantPath, JSON.stringify(variant, null, 2));

    res.status(201).json({
      success: true,
      data: variant,
      meta: {
        timestamp: new Date().toISOString()
      }
    });
  } catch (error: any) {
    console.error('Error creating variant:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: error.message || 'Failed to create variant'
      }
    });
  }
});

/**
 * GET /api/v1/themes/:themeId/variants
 * 获取主题的所有变体
 */
router.get('/:themeId/variants', async (req: Request, res: Response) => {
  try {
    const { themeId } = req.params;
    const variants = await getVariantsByThemeId(themeId!);

    res.json({
      success: true,
      data: variants,
      meta: {
        timestamp: new Date().toISOString(),
        count: variants.length
      }
    });
  } catch (error: any) {
    console.error('Error fetching variants:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: error.message || 'Failed to fetch variants'
      }
    });
  }
});

/**
 * DELETE /api/v1/themes/variants/:variantId
 * 删除单个变体
 */
router.delete('/variants/:variantId', async (req: Request, res: Response) => {
  try {
    const { variantId } = req.params;

    const variantPath = path.join(VARIANTS_DIR, `${variantId}.json`);
    const variantData = JSON.parse(await fs.readFile(variantPath, 'utf-8'));

    // 删除变体图片
    if (variantData.imageUrl) {
      const imagePath = path.join(process.cwd(), variantData.imageUrl);
      await fs.unlink(imagePath).catch(() => {});
    }

    // 删除变体元数据
    await fs.unlink(variantPath);

    res.json({
      success: true,
      data: {
        message: `Variant ${variantId} deleted successfully`
      }
    });
  } catch (error: any) {
    console.error('Error deleting variant:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: error.message || 'Failed to delete variant'
      }
    });
  }
});

/**
 * POST /api/v1/themes/:themeId/variants/generate
 * 生成变体图像
 */
router.post('/:themeId/variants/generate', async (req: Request, res: Response): Promise<any> => {
  try {
    const { themeId } = req.params;
    const { prompt, metadata }: {
      prompt: string;
      metadata?: any;
    } = req.body;

    if (!prompt) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Prompt is required'
        }
      });
    }

    console.log(`[Variant Generation] Generating variant for theme ${themeId}`);
    console.log(`[Variant Generation] Prompt: ${prompt}`);

    // 使用Gemini生成图像
    const result = await geminiClient.generateImage(prompt);

    if (!result.success) {
      throw new Error(result.error || 'Failed to generate image');
    }

    // 创建变体记录
    const variant: CharacterVariant = {
      id: `variant_${Date.now()}_${uuidv4().slice(0, 8)}`,
      themeId: themeId!,
      prompt,
      imageUrl: result.data.result.imageUrl,  // Base64 data URL
      ...(result.data.result.thumbnailUrl && { thumbnailUrl: result.data.result.thumbnailUrl }),
      ...(metadata && { metadata }),
      createdAt: new Date()
    };

    // 保存变体元数据
    const variantPath = path.join(VARIANTS_DIR, `${variant.id}.json`);
    await fs.writeFile(variantPath, JSON.stringify(variant, null, 2));

    console.log(`[Variant Generation] Variant ${variant.id} generated successfully`);

    res.status(201).json({
      success: true,
      data: variant,
      meta: {
        timestamp: new Date().toISOString()
      }
    });
  } catch (error: any) {
    console.error('Error generating variant:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: error.message || 'Failed to generate variant'
      }
    });
  }
});

// Helper function: 获取主题的所有变体
async function getVariantsByThemeId(themeId: string): Promise<CharacterVariant[]> {
  try {
    const files = await fs.readdir(VARIANTS_DIR);
    const variantFiles = files.filter(f => f.endsWith('.json'));

    const variants: CharacterVariant[] = [];

    for (const file of variantFiles) {
      const variantPath = path.join(VARIANTS_DIR, file);
      const variantData = JSON.parse(await fs.readFile(variantPath, 'utf-8'));

      if (variantData.themeId === themeId) {
        variants.push(variantData);
      }
    }

    // 按创建时间降序排序
    variants.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

    return variants;
  } catch (error) {
    return [];
  }
}

export default router;
