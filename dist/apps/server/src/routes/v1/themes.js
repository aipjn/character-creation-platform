"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const crypto_1 = require("crypto");
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
const node_fetch_1 = __importDefault(require("node-fetch"));
const geminiClient_1 = require("../../api/geminiClient");
const client_1 = require("@prisma/client");
const requireAuth_1 = require("../../middleware/requireAuth");
const credits_1 = require("../../modules/credits");
const router = (0, express_1.Router)();
const prisma = new client_1.PrismaClient();
const geminiClient = (0, geminiClient_1.getDefaultGeminiClient)();
function saveBase64AsFile(base64Data, outputPath) {
    const matches = base64Data.match(/^data:image\/(\w+);base64,(.+)$/);
    const content = matches?.[2] ?? base64Data;
    const buffer = Buffer.from(content, 'base64');
    const dir = path_1.default.dirname(outputPath);
    if (!fs_1.default.existsSync(dir)) {
        fs_1.default.mkdirSync(dir, { recursive: true });
    }
    fs_1.default.writeFileSync(outputPath, buffer);
}
async function loadImageAsBase64(imageReference) {
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
            const response = await (0, node_fetch_1.default)(imageReference);
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
        const normalizedPath = imageReference.startsWith('/')
            ? path_1.default.resolve(process.cwd(), imageReference.slice(1))
            : path_1.default.resolve(process.cwd(), imageReference);
        if (!fs_1.default.existsSync(normalizedPath)) {
            throw new Error(`Local image not found at ${normalizedPath}`);
        }
        const fileBuffer = fs_1.default.readFileSync(normalizedPath);
        const ext = path_1.default.extname(normalizedPath).toLowerCase();
        let mimeType = 'image/png';
        if (ext === '.jpg' || ext === '.jpeg')
            mimeType = 'image/jpeg';
        else if (ext === '.webp')
            mimeType = 'image/webp';
        else if (ext === '.gif')
            mimeType = 'image/gif';
        return { base64: fileBuffer.toString('base64'), mimeType };
    }
    catch (error) {
        console.warn(`[Variant Generation] Failed to load base image (${imageReference}):`, error instanceof Error ? error.message : error);
        return null;
    }
}
router.get('/character/:characterId', requireAuth_1.requireAuth, async (req, res) => {
    try {
        const { characterId } = req.params;
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
        if (character.userId !== req.user.id) {
            return res.status(403).json({
                success: false,
                error: {
                    code: 'FORBIDDEN',
                    message: 'You do not have permission to access this character'
                }
            });
        }
        const dbThemes = await prisma.characterTheme.findMany({
            where: { characterId },
            include: {
                variants: {
                    orderBy: { createdAt: 'desc' }
                }
            },
            orderBy: { createdAt: 'desc' }
        });
        const themes = dbThemes.map(theme => ({
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
                metadata: v.metadata || undefined,
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
    }
    catch (error) {
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
router.post('/', requireAuth_1.requireAuth, async (req, res) => {
    try {
        const { characterId, name, description } = req.body;
        if (!characterId || !name) {
            return res.status(400).json({
                success: false,
                error: {
                    code: 'VALIDATION_ERROR',
                    message: 'Character ID and theme name are required'
                }
            });
        }
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
        if (character.userId !== req.user.id) {
            return res.status(403).json({
                success: false,
                error: {
                    code: 'FORBIDDEN',
                    message: 'You do not have permission to create themes for this character'
                }
            });
        }
        const dbTheme = await prisma.characterTheme.create({
            data: {
                id: `theme_${Date.now()}_${(0, crypto_1.randomUUID)().slice(0, 8)}`,
                characterId,
                name,
                ...(description && { description })
            }
        });
        const theme = {
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
    }
    catch (error) {
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
router.get('/:themeId', requireAuth_1.requireAuth, async (req, res) => {
    try {
        const { themeId } = req.params;
        const dbTheme = await prisma.characterTheme.findUnique({
            where: { id: themeId },
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
        if (dbTheme.character.userId !== req.user.id) {
            return res.status(403).json({
                success: false,
                error: {
                    code: 'FORBIDDEN',
                    message: 'You do not have permission to access this theme'
                }
            });
        }
        const themeWithVariants = {
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
                metadata: v.metadata || undefined,
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
    }
    catch (error) {
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
router.put('/:themeId', requireAuth_1.requireAuth, async (req, res) => {
    try {
        const { themeId } = req.params;
        const { name, description } = req.body;
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
        if (existingTheme.character.userId !== req.user.id) {
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
        const theme = {
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
    }
    catch (error) {
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
router.delete('/:themeId', requireAuth_1.requireAuth, async (req, res) => {
    try {
        const { themeId } = req.params;
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
        if (themeWithCharacter.character.userId !== req.user.id) {
            return res.status(403).json({
                success: false,
                error: {
                    code: 'FORBIDDEN',
                    message: 'You do not have permission to delete this theme'
                }
            });
        }
        const variants = await prisma.themeVariant.findMany({
            where: { themeId: themeId }
        });
        for (const variant of variants) {
            if (variant.imageUrl) {
                const filename = variant.imageUrl.split('/').pop();
                if (filename) {
                    const imagePath = path_1.default.join(process.cwd(), 'uploads', 'variants', filename);
                    try {
                        fs_1.default.unlinkSync(imagePath);
                    }
                    catch { }
                }
            }
            if (variant.thumbnailUrl) {
                const filename = variant.thumbnailUrl.split('/').pop();
                if (filename) {
                    const thumbPath = path_1.default.join(process.cwd(), 'uploads', 'variants', filename);
                    try {
                        fs_1.default.unlinkSync(thumbPath);
                    }
                    catch { }
                }
            }
        }
        await prisma.characterTheme.delete({
            where: { id: themeId }
        });
        return res.json({
            success: true,
            data: {
                message: `Theme ${themeId} and ${variants.length} variants deleted successfully`
            }
        });
    }
    catch (error) {
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
router.post('/:themeId/variants', requireAuth_1.requireAuth, async (req, res) => {
    try {
        const { themeId } = req.params;
        const { prompt, metadata } = req.body;
        if (!prompt) {
            return res.status(400).json({
                success: false,
                error: {
                    code: 'VALIDATION_ERROR',
                    message: 'Prompt is required'
                }
            });
        }
        const theme = await prisma.characterTheme.findUnique({
            where: { id: themeId },
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
        if (theme.character.userId !== req.user.id) {
            return res.status(403).json({
                success: false,
                error: {
                    code: 'FORBIDDEN',
                    message: 'You do not have permission to create variants for this theme'
                }
            });
        }
        const dbVariant = await prisma.themeVariant.create({
            data: {
                id: `variant_${Date.now()}_${(0, crypto_1.randomUUID)().slice(0, 8)}`,
                themeId: themeId,
                characterId: theme.characterId,
                prompt,
                imageUrl: '',
                ...(metadata && { metadata })
            }
        });
        const variant = {
            id: dbVariant.id,
            themeId: dbVariant.themeId,
            prompt: dbVariant.prompt,
            imageUrl: dbVariant.imageUrl || '',
            thumbnailUrl: dbVariant.thumbnailUrl || undefined,
            metadata: dbVariant.metadata || undefined,
            createdAt: dbVariant.createdAt
        };
        res.status(201).json({
            success: true,
            data: variant,
            meta: {
                timestamp: new Date().toISOString()
            }
        });
    }
    catch (error) {
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
router.get('/:themeId/variants', requireAuth_1.requireAuth, async (req, res) => {
    try {
        const { themeId } = req.params;
        const theme = await prisma.characterTheme.findUnique({
            where: { id: themeId },
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
        if (theme.character.userId !== req.user.id) {
            return res.status(403).json({
                success: false,
                error: {
                    code: 'FORBIDDEN',
                    message: 'You do not have permission to access this theme'
                }
            });
        }
        const dbVariants = await prisma.themeVariant.findMany({
            where: { themeId: themeId },
            orderBy: { createdAt: 'desc' }
        });
        const variants = dbVariants.map(v => ({
            id: v.id,
            themeId: v.themeId,
            prompt: v.prompt,
            imageUrl: v.imageUrl || '',
            thumbnailUrl: v.thumbnailUrl || undefined,
            metadata: v.metadata || undefined,
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
    }
    catch (error) {
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
router.delete('/variants/:variantId', requireAuth_1.requireAuth, async (req, res) => {
    try {
        const { variantId } = req.params;
        const variant = await prisma.themeVariant.findUnique({
            where: { id: variantId },
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
        if (variant.theme.character.userId !== req.user.id) {
            return res.status(403).json({
                success: false,
                error: {
                    code: 'FORBIDDEN',
                    message: 'You do not have permission to delete this variant'
                }
            });
        }
        if (variant.imageUrl) {
            const filename = variant.imageUrl.split('/').pop();
            if (filename) {
                const imagePath = path_1.default.join(process.cwd(), 'uploads', 'variants', filename);
                try {
                    fs_1.default.unlinkSync(imagePath);
                }
                catch { }
            }
        }
        if (variant.thumbnailUrl) {
            const filename = variant.thumbnailUrl.split('/').pop();
            if (filename) {
                const thumbPath = path_1.default.join(process.cwd(), 'uploads', 'variants', filename);
                try {
                    fs_1.default.unlinkSync(thumbPath);
                }
                catch { }
            }
        }
        await prisma.themeVariant.delete({
            where: { id: variantId }
        });
        return res.json({
            success: true,
            data: {
                message: `Variant ${variantId} deleted successfully`
            }
        });
    }
    catch (error) {
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
router.post('/:themeId/variants/generate', requireAuth_1.requireAuth, (0, credits_1.checkCredits)('/themes/variants/generate'), async (req, res) => {
    try {
        const { themeId } = req.params;
        const { prompt, metadata } = req.body;
        if (!prompt) {
            return res.status(400).json({
                success: false,
                error: {
                    code: 'VALIDATION_ERROR',
                    message: 'Prompt is required'
                }
            });
        }
        const theme = await prisma.characterTheme.findUnique({
            where: { id: themeId },
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
        if (theme.character.userId !== req.user.id) {
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
        const characterImageUrl = (theme.character ?? {}).imageUrl;
        const baseImageSource = metadata?.inputImage ?? characterImageUrl ?? undefined;
        let result;
        let generationMode;
        const baseImage = await loadImageAsBase64(baseImageSource);
        const logGeminiSummary = (label, response) => {
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
            const imageResult = await geminiClient.generateWithImage(prompt, baseImage.base64, baseImage.mimeType);
            logGeminiSummary('Image-to-image response', imageResult);
            if (!imageResult.success) {
                throw new Error(imageResult.error || 'Gemini image-to-image request failed');
            }
            if (!(imageResult.data?.imageUrl || imageResult.data?.result?.imageUrl)) {
                throw new Error('Gemini image-to-image returned no image data');
            }
            result = imageResult;
            generationMode = 'image-to-image';
        }
        else {
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
        const variantId = `variant_${Date.now()}_${(0, crypto_1.randomUUID)().slice(0, 8)}`;
        let imageUrl = '';
        let thumbnailUrl = '';
        const generatedImage = result?.data?.imageUrl ?? result?.data?.result?.imageUrl;
        const generatedThumbnail = result?.data?.thumbnailUrl ?? result?.data?.result?.thumbnailUrl ?? generatedImage;
        console.log('[Variant Generation] generatedImage length:', generatedImage?.length || 0);
        console.log('[Variant Generation] generatedThumbnail length:', generatedThumbnail?.length || 0);
        if (generatedImage) {
            const imageFilename = `${variantId}.png`;
            const imagePath = path_1.default.join(process.cwd(), 'uploads', 'variants', imageFilename);
            saveBase64AsFile(generatedImage, imagePath);
            imageUrl = `/uploads/variants/${imageFilename}`;
        }
        else {
            throw new Error('Gemini generation did not return image data');
        }
        if (generatedThumbnail) {
            const thumbnailFilename = `${variantId}_thumb.png`;
            const thumbnailPath = path_1.default.join(process.cwd(), 'uploads', 'variants', thumbnailFilename);
            saveBase64AsFile(generatedThumbnail, thumbnailPath);
            thumbnailUrl = `/uploads/variants/${thumbnailFilename}`;
        }
        const dbVariant = await prisma.themeVariant.create({
            data: {
                id: variantId,
                themeId: themeId,
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
        const variant = {
            id: dbVariant.id,
            themeId: dbVariant.themeId,
            prompt: dbVariant.prompt,
            imageUrl: dbVariant.imageUrl || '',
            thumbnailUrl: dbVariant.thumbnailUrl || undefined,
            metadata: {
                ...dbVariant.metadata,
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
    }
    catch (error) {
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
exports.default = router;
//# sourceMappingURL=themes.js.map