/**
 * Character Themes and Variants API Routes
 * 角色主题和变体管理路由
 */

import { Router, Request, Response } from 'express';
import { randomUUID } from 'crypto';
import fs from 'fs';
import path from 'path';
import fetch from 'node-fetch';
import {
  CharacterTheme,
  CharacterVariant,
  ThemeWithVariants,
  CreateThemeRequest,
  CreateVariantRequest
} from '../../../../../shared/types/theme';
import { getDefaultGeminiClient } from '../../api/geminiClient';
import { PrismaClient } from '@prisma/client';
import { requireAuth } from '../../middleware/requireAuth';
import { checkCredits } from '../../modules/credits';

const router = Router();
const prisma = new PrismaClient();

// Initialize Gemini client for image generation
const geminiClient = getDefaultGeminiClient();

// Helper function to save base64 as file
function saveBase64AsFile(base64Data: string, outputPath: string): void {
  const matches = base64Data.match(/^data:image\/(\w+);base64,(.+)$/);
  const content = matches?.[2] ?? base64Data;
  const buffer = Buffer.from(content, 'base64');
  const dir = path.dirname(outputPath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  fs.writeFileSync(outputPath, buffer);
}

async function loadImageAsBase64(imageReference?: string): Promise<{ base64: string; mimeType: string } | null> {
  if (!imageReference) {
    return null;
  }

  try {
    if (imageReference.startsWith('data:')) {
      const matches = imageReference.match(/^data:([^;]+);base64,(.+)$/);
      if (!matches || !matches[1] || !matches[2]) {
        throw new Error('Invalid data URL format');
      }
      return { base64: matches[2], mimeType: matches[1] };
    }

    if (imageReference.startsWith('http://') || imageReference.startsWith('https://')) {
      const response = await fetch(imageReference);
      if (!response.ok) {
        throw new Error(`Failed to fetch remote image: ${response.statusText}`);
      }
      const arrayBuffer = await response.arrayBuffer();
      let mimeType = 'image/jpeg';
      const headerContentType = response.headers.get('content-type');
      if (headerContentType) {
        const [primaryType] = headerContentType.split(';');
        if (primaryType) {
          mimeType = primaryType;
        }
      }
      return { base64: Buffer.from(arrayBuffer).toString('base64'), mimeType };
    }

    // Treat as local path (relative or absolute)
    const normalizedPath = imageReference.startsWith('/')
      ? path.resolve(process.cwd(), imageReference.slice(1))
      : path.resolve(process.cwd(), imageReference);

    if (!fs.existsSync(normalizedPath)) {
      throw new Error(`Local image not found at ${normalizedPath}`);
    }

    const fileBuffer = fs.readFileSync(normalizedPath);
    const ext = path.extname(normalizedPath).toLowerCase();
    let mimeType = 'image/png';
    if (ext === '.jpg' || ext === '.jpeg') mimeType = 'image/jpeg';
    else if (ext === '.webp') mimeType = 'image/webp';
    else if (ext === '.gif') mimeType = 'image/gif';

    return { base64: fileBuffer.toString('base64'), mimeType };
  } catch (error) {
    console.warn(`[Variant Generation] Failed to load base image (${imageReference}):`, error instanceof Error ? error.message : error);
    return null;
  }
}

/**
 * GET /api/v1/themes/character/:characterId
 * 获取某个角色的所有主题及其变体
 */
router.get('/character/:characterId', requireAuth, async (req: Request, res: Response): Promise<any> => {
  try {
    const { characterId } = req.params;

    // Verify character ownership first
    const character = await prisma.character.findUnique({
      where: { id: characterId },
      select: { userId: true }
    });

    if (!character) {
      return res.status(404).json({
        success: false,
        error: {
          code: 'NOT_FOUND',
          message: 'Character not found'
        }
      });
    }

    if (character.userId !== req.user!.id) {
      return res.status(403).json({
        success: false,
        error: {
          code: 'FORBIDDEN',
          message: 'You do not have permission to access this character'
        }
      });
    }

    // Read themes from database with variants
    const dbThemes = await prisma.characterTheme.findMany({
      where: { characterId },
      include: {
        variants: {
          orderBy: { createdAt: 'desc' }
        }
      },
      orderBy: { createdAt: 'desc' }
    });

    // Map to API format
    const themes: ThemeWithVariants[] = dbThemes.map(theme => ({
      id: theme.id,
      characterId: theme.characterId,
      name: theme.name,
      description: theme.description || undefined,
      createdAt: theme.createdAt,
      updatedAt: theme.updatedAt,
      variants: theme.variants.map(v => ({
        id: v.id,
        themeId: v.themeId,
        prompt: v.prompt,
        imageUrl: v.imageUrl || '',
        thumbnailUrl: v.thumbnailUrl || undefined,
        metadata: (v.metadata as any) || undefined,
        createdAt: v.createdAt
      }))
    }));

    return res.json({
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
router.post('/', requireAuth, async (req: Request, res: Response): Promise<any> => {
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

    // Verify character ownership before creating theme
    const character = await prisma.character.findUnique({
      where: { id: characterId },
      select: { userId: true }
    });

    if (!character) {
      return res.status(404).json({
        success: false,
        error: {
          code: 'NOT_FOUND',
          message: 'Character not found'
        }
      });
    }

    if (character.userId !== req.user!.id) {
      return res.status(403).json({
        success: false,
        error: {
          code: 'FORBIDDEN',
          message: 'You do not have permission to create themes for this character'
        }
      });
    }

    // Create theme in database
    const dbTheme = await prisma.characterTheme.create({
      data: {
        id: `theme_${Date.now()}_${randomUUID().slice(0, 8)}`,
        characterId,
        name,
        ...(description && { description })
      }
    });

    const theme: CharacterTheme = {
      id: dbTheme.id,
      characterId: dbTheme.characterId,
      name: dbTheme.name,
      ...(dbTheme.description && { description: dbTheme.description }),
      createdAt: dbTheme.createdAt,
      updatedAt: dbTheme.updatedAt
    };

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
router.get('/:themeId', requireAuth, async (req: Request, res: Response): Promise<any> => {
  try {
    const { themeId } = req.params;

    const dbTheme = await prisma.characterTheme.findUnique({
      where: { id: themeId! },
      include: {
        character: {
          select: { userId: true }
        },
        variants: {
          orderBy: { createdAt: 'desc' }
        }
      }
    });

    if (!dbTheme) {
      return res.status(404).json({
        success: false,
        error: {
          code: 'NOT_FOUND',
          message: 'Theme not found'
        }
      });
    }

    // Verify ownership via character
    if (dbTheme.character.userId !== req.user!.id) {
      return res.status(403).json({
        success: false,
        error: {
          code: 'FORBIDDEN',
          message: 'You do not have permission to access this theme'
        }
      });
    }

    const themeWithVariants: ThemeWithVariants = {
      id: dbTheme.id,
      characterId: dbTheme.characterId,
      name: dbTheme.name,
      description: dbTheme.description || undefined,
      createdAt: dbTheme.createdAt,
      updatedAt: dbTheme.updatedAt,
      variants: dbTheme.variants.map(v => ({
        id: v.id,
        themeId: v.themeId,
        prompt: v.prompt,
        imageUrl: v.imageUrl || '',
        thumbnailUrl: v.thumbnailUrl || undefined,
        metadata: (v.metadata as any) || undefined,
        createdAt: v.createdAt
      }))
    };

    return res.json({
      success: true,
      data: themeWithVariants,
      meta: {
        timestamp: new Date().toISOString()
      }
    });
  } catch (error: any) {
    console.error('Error fetching theme:', error);
    return res.status(404).json({
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
router.put('/:themeId', requireAuth, async (req: Request, res: Response): Promise<any> => {
  try {
    const { themeId } = req.params;
    const { name, description } = req.body;

    // First verify ownership via character
    const existingTheme = await prisma.characterTheme.findUnique({
      where: { id: themeId },
      include: {
        character: {
          select: { userId: true }
        }
      }
    });

    if (!existingTheme) {
      return res.status(404).json({
        success: false,
        error: {
          code: 'NOT_FOUND',
          message: 'Theme not found'
        }
      });
    }

    if (existingTheme.character.userId !== req.user!.id) {
      return res.status(403).json({
        success: false,
        error: {
          code: 'FORBIDDEN',
          message: 'You do not have permission to update this theme'
        }
      });
    }

    const updatedTheme = await prisma.characterTheme.update({
      where: { id: themeId },
      data: {
        ...(name && { name }),
        ...(description !== undefined && { description })
      }
    });

    const theme: CharacterTheme = {
      id: updatedTheme.id,
      characterId: updatedTheme.characterId,
      name: updatedTheme.name,
      ...(updatedTheme.description && { description: updatedTheme.description }),
      createdAt: updatedTheme.createdAt,
      updatedAt: updatedTheme.updatedAt
    };

    return res.json({
      success: true,
      data: theme,
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
router.delete('/:themeId', requireAuth, async (req: Request, res: Response): Promise<any> => {
  try {
    const { themeId } = req.params;

    // First verify ownership via character
    const themeWithCharacter = await prisma.characterTheme.findUnique({
      where: { id: themeId },
      include: {
        character: {
          select: { userId: true }
        }
      }
    });

    if (!themeWithCharacter) {
      return res.status(404).json({
        success: false,
        error: {
          code: 'NOT_FOUND',
          message: 'Theme not found'
        }
      });
    }

    if (themeWithCharacter.character.userId !== req.user!.id) {
      return res.status(403).json({
        success: false,
        error: {
          code: 'FORBIDDEN',
          message: 'You do not have permission to delete this theme'
        }
      });
    }

    // Get variants to delete their images
    const variants = await prisma.themeVariant.findMany({
      where: { themeId: themeId! }
    });

    // Delete variant image files
    for (const variant of variants) {
      if (variant.imageUrl) {
        const filename = variant.imageUrl.split('/').pop();
        if (filename) {
          const imagePath = path.join(process.cwd(), 'uploads', 'variants', filename);
          try { fs.unlinkSync(imagePath); } catch {}
        }
      }
      if (variant.thumbnailUrl) {
        const filename = variant.thumbnailUrl.split('/').pop();
        if (filename) {
          const thumbPath = path.join(process.cwd(), 'uploads', 'variants', filename);
          try { fs.unlinkSync(thumbPath); } catch {}
        }
      }
    }

    // Delete theme (cascades to variants)
    await prisma.characterTheme.delete({
      where: { id: themeId }
    });

    return res.json({
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
router.post('/:themeId/variants', requireAuth, async (req: Request, res: Response): Promise<any> => {
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

    // Get theme and verify ownership via character
    const theme = await prisma.characterTheme.findUnique({
      where: { id: themeId! },
      include: {
        character: {
          select: {
            id: true,
            userId: true,
            imageUrl: true
          }
        }
      }
    });

    if (!theme) {
      return res.status(404).json({
        success: false,
        error: {
          code: 'NOT_FOUND',
          message: 'Theme not found'
        }
      });
    }

    if (theme.character.userId !== req.user!.id) {
      return res.status(403).json({
        success: false,
        error: {
          code: 'FORBIDDEN',
          message: 'You do not have permission to create variants for this theme'
        }
      });
    }

    // Create variant in database
    const dbVariant = await prisma.themeVariant.create({
      data: {
        id: `variant_${Date.now()}_${randomUUID().slice(0, 8)}`,
        themeId: themeId!,
        characterId: theme.characterId,
        prompt,
        imageUrl: '',  // 将在图像生成后更新
        ...(metadata && { metadata })
      }
    });

    const variant: CharacterVariant = {
      id: dbVariant.id,
      themeId: dbVariant.themeId,
      prompt: dbVariant.prompt,
      imageUrl: dbVariant.imageUrl || '',
      thumbnailUrl: dbVariant.thumbnailUrl || undefined,
      metadata: (dbVariant.metadata as any) || undefined,
      createdAt: dbVariant.createdAt
    };

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
router.get('/:themeId/variants', requireAuth, async (req: Request, res: Response): Promise<any> => {
  try {
    const { themeId } = req.params;

    // Verify theme ownership via character
    const theme = await prisma.characterTheme.findUnique({
      where: { id: themeId! },
      include: {
        character: {
          select: { userId: true }
        }
      }
    });

    if (!theme) {
      return res.status(404).json({
        success: false,
        error: {
          code: 'NOT_FOUND',
          message: 'Theme not found'
        }
      });
    }

    if (theme.character.userId !== req.user!.id) {
      return res.status(403).json({
        success: false,
        error: {
          code: 'FORBIDDEN',
          message: 'You do not have permission to access this theme'
        }
      });
    }

    const dbVariants = await prisma.themeVariant.findMany({
      where: { themeId: themeId! },
      orderBy: { createdAt: 'desc' }
    });

    const variants: CharacterVariant[] = dbVariants.map(v => ({
      id: v.id,
      themeId: v.themeId,
      prompt: v.prompt,
      imageUrl: v.imageUrl || '',
      thumbnailUrl: v.thumbnailUrl || undefined,
      metadata: (v.metadata as any) || undefined,
      createdAt: v.createdAt
    }));

    return res.json({
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
router.delete('/variants/:variantId', requireAuth, async (req: Request, res: Response): Promise<any> => {
  try {
    const { variantId } = req.params;

    // Get variant with theme and character to verify ownership
    const variant = await prisma.themeVariant.findUnique({
      where: { id: variantId! },
      include: {
        theme: {
          include: {
            character: {
              select: { userId: true }
            }
          }
        }
      }
    });

    if (!variant) {
      return res.status(404).json({
        success: false,
        error: {
          code: 'NOT_FOUND',
          message: 'Variant not found'
        }
      });
    }

    // Verify ownership via theme→character
    if (variant.theme.character.userId !== req.user!.id) {
      return res.status(403).json({
        success: false,
        error: {
          code: 'FORBIDDEN',
          message: 'You do not have permission to delete this variant'
        }
      });
    }

    // Delete variant image files
    if (variant.imageUrl) {
      const filename = variant.imageUrl.split('/').pop();
      if (filename) {
        const imagePath = path.join(process.cwd(), 'uploads', 'variants', filename);
        try { fs.unlinkSync(imagePath); } catch {}
      }
    }
    if (variant.thumbnailUrl) {
      const filename = variant.thumbnailUrl.split('/').pop();
      if (filename) {
        const thumbPath = path.join(process.cwd(), 'uploads', 'variants', filename);
        try { fs.unlinkSync(thumbPath); } catch {}
      }
    }

    // Delete variant from database
    await prisma.themeVariant.delete({
      where: { id: variantId }
    });

    return res.json({
      success: true,
      data: {
        message: `Variant ${variantId} deleted successfully`
      }
    });
  } catch (error: any) {
    console.error('Error deleting variant:', error);
    return res.status(500).json({
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
router.post('/:themeId/variants/generate', requireAuth, checkCredits('/themes/variants/generate'), async (req: Request, res: Response): Promise<any> => {
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

    // Get theme and verify ownership via character
    const theme = await prisma.characterTheme.findUnique({
      where: { id: themeId! },
      include: {
        character: {
          select: { userId: true }
        }
      }
    });

    if (!theme) {
      return res.status(404).json({
        success: false,
        error: {
          code: 'NOT_FOUND',
          message: 'Theme not found'
        }
      });
    }

    if (theme.character.userId !== req.user!.id) {
      return res.status(403).json({
        success: false,
        error: {
          code: 'FORBIDDEN',
          message: 'You do not have permission to generate variants for this theme'
        }
      });
    }

    console.log(`[Variant Generation] Generating variant for theme ${themeId}`);
    console.log(`[Variant Generation] Prompt: ${prompt}`);
    console.log('[Variant Generation] Incoming metadata:', metadata);

    // Variant generation should start from the user's selected character image
    const characterImageUrl = ((theme.character ?? {}) as { imageUrl?: string }).imageUrl;
    const baseImageSource = metadata?.inputImage ?? characterImageUrl ?? undefined;

    let result;
    let generationMode: 'image-to-image' | 'text-to-image';
    const baseImage = await loadImageAsBase64(baseImageSource);

    const logGeminiSummary = (label: string, response: any) => {
      const summary = {
        success: response?.success ?? null,
        error: response?.error ?? null,
        dataKeys: response?.data ? Object.keys(response.data) : [],
        resultKeys: response?.data?.result ? Object.keys(response.data.result) : []
      };
      console.log(`[Variant Generation] ${label} summary:`, summary);
    };

    if (baseImage) {
      console.log(`[Variant Generation] Using base image for variant (${baseImageSource?.substring(0, 80) || 'inline'})`);
      const imageResult = await geminiClient.generateWithImage(
        prompt,
        baseImage.base64,
        baseImage.mimeType
      );

      logGeminiSummary('Image-to-image response', imageResult);

      if (!imageResult.success) {
        throw new Error(imageResult.error || 'Gemini image-to-image request failed');
      }

      if (!(imageResult.data?.imageUrl || imageResult.data?.result?.imageUrl)) {
        throw new Error('Gemini image-to-image returned no image data');
      }

      result = imageResult;
      generationMode = 'image-to-image';
    } else {
      const textResult = await geminiClient.generateImage(prompt);
      logGeminiSummary('Text-to-image response', textResult);

      if (!textResult.success) {
        throw new Error(textResult.error || 'Gemini text-to-image request failed');
      }

      result = textResult;
      generationMode = 'text-to-image';
    }

    console.log('[Variant Generation] Raw result keys:', Object.keys(result || {}));
    if (result?.data?.result) {
      console.log('[Variant Generation] Result payload keys:', Object.keys(result.data.result));
    }

    // Generate variant ID
    const variantId = `variant_${Date.now()}_${randomUUID().slice(0, 8)}`;

    // Save images as files
    let imageUrl = '';
    let thumbnailUrl = '';

    const generatedImage = result?.data?.imageUrl ?? result?.data?.result?.imageUrl;
    const generatedThumbnail = result?.data?.thumbnailUrl ?? result?.data?.result?.thumbnailUrl ?? generatedImage;

    console.log('[Variant Generation] generatedImage length:', generatedImage?.length || 0);
    console.log('[Variant Generation] generatedThumbnail length:', generatedThumbnail?.length || 0);

    if (generatedImage) {
      const imageFilename = `${variantId}.png`;
      const imagePath = path.join(process.cwd(), 'uploads', 'variants', imageFilename);
      saveBase64AsFile(generatedImage, imagePath);
      imageUrl = `/uploads/variants/${imageFilename}`;
    } else {
      throw new Error('Gemini generation did not return image data');
    }

    if (generatedThumbnail) {
      const thumbnailFilename = `${variantId}_thumb.png`;
      const thumbnailPath = path.join(process.cwd(), 'uploads', 'variants', thumbnailFilename);
      saveBase64AsFile(generatedThumbnail, thumbnailPath);
      thumbnailUrl = `/uploads/variants/${thumbnailFilename}`;
    }

    // Create variant in database
    const dbVariant = await prisma.themeVariant.create({
      data: {
        id: variantId,
        themeId: themeId!,
        characterId: theme.characterId,
        prompt,
        imageUrl: imageUrl || null,
        thumbnailUrl: thumbnailUrl || null,
        metadata: {
          ...(metadata || {}),
          generationMode
        }
      }
    });

    const variant: CharacterVariant = {
      id: dbVariant.id,
      themeId: dbVariant.themeId,
      prompt: dbVariant.prompt,
      imageUrl: dbVariant.imageUrl || '',
      thumbnailUrl: dbVariant.thumbnailUrl || undefined,
      metadata: {
        ...(dbVariant.metadata as any),
        generationMode
      },
      createdAt: dbVariant.createdAt
    };

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

export default router;
