import { getDatabaseConnection } from '../database/connection';
import { StyleType, GenerationStatus } from '@prisma/client';

interface SeedOptions {
  verbose?: boolean;
}

/**
 * Seed sample characters for development and testing
 */
export async function seedSampleCharacters(options: SeedOptions = {}): Promise<number> {
  const { verbose = false } = options;
  
  try {
    const dbConnection = getDatabaseConnection();
    const prisma = dbConnection.getPrismaClient();
    
    if (verbose) {
      console.log('   🎭 Creating sample characters...');
    }
    
    // Get existing users to assign characters to
    const users = await prisma.user.findMany({
      select: { id: true, name: true, email: true },
      take: 5,
    });
    
    if (users.length === 0) {
      console.warn('   ⚠️  No users found. Skipping character seeding.');
      return 0;
    }
    
    const sampleCharacters = [
      {
        name: 'Aragorn the Ranger',
        prompt: 'A rugged fantasy ranger with dark hair, wearing leather armor and a weathered green cloak. Battle-scarred but noble face with determined eyes. Holding a bow and sword.',
        styleType: StyleType.FANTASY,
        tags: ['ranger', 'fantasy', 'warrior', 'noble'],
        isPublic: true,
        generationStatus: GenerationStatus.COMPLETED,
        metadata: {
          inspiration: 'Lord of the Rings',
          difficulty: 'intermediate',
        },
      },
      {
        name: 'Neon Runner',
        prompt: 'A cyberpunk street runner with bright pink and blue hair, wearing a black leather jacket with LED strips. Neon city background with rain-slicked streets.',
        styleType: StyleType.CYBERPUNK,
        tags: ['cyberpunk', 'runner', 'neon', 'street'],
        isPublic: true,
        generationStatus: GenerationStatus.COMPLETED,
        metadata: {
          inspiration: 'Blade Runner',
          difficulty: 'advanced',
        },
      },
      {
        name: 'Kawaii Magical Girl',
        prompt: 'A cute anime magical girl with long pink hair in twin tails, wearing a frilly magical girl outfit with star patterns. Holding a magical wand with sparkles.',
        styleType: StyleType.ANIME,
        tags: ['anime', 'magical girl', 'cute', 'sparkles'],
        isPublic: true,
        generationStatus: GenerationStatus.COMPLETED,
        metadata: {
          inspiration: 'Sailor Moon',
          difficulty: 'beginner',
        },
      },
      {
        name: 'Captain Steamheart',
        prompt: 'A steampunk airship captain with brass goggles, Victorian military uniform, and mechanical arm prosthetic. Standing on the deck of a flying airship.',
        styleType: StyleType.VINTAGE,
        tags: ['steampunk', 'captain', 'airship', 'mechanical'],
        isPublic: false,
        generationStatus: GenerationStatus.COMPLETED,
        metadata: {
          inspiration: 'Victorian era',
          difficulty: 'advanced',
        },
      },
      {
        name: 'Modern Professional',
        prompt: 'A realistic portrait of a confident business professional in a modern office setting. Well-groomed, wearing a sharp business suit, with natural lighting.',
        styleType: StyleType.REALISTIC,
        tags: ['realistic', 'professional', 'modern', 'business'],
        isPublic: false,
        generationStatus: GenerationStatus.COMPLETED,
        metadata: {
          inspiration: 'Corporate headshot',
          difficulty: 'intermediate',
        },
      },
      {
        name: 'Super Cartoon Cat',
        prompt: 'A cartoon superhero cat with a red cape, blue costume with a star emblem, and a heroic pose. Bright colors with comic book style shading.',
        styleType: StyleType.CARTOON,
        tags: ['cartoon', 'cat', 'superhero', 'comic'],
        isPublic: true,
        generationStatus: GenerationStatus.COMPLETED,
        metadata: {
          inspiration: 'Classic comics',
          difficulty: 'beginner',
        },
      },
      {
        name: 'Zen Master',
        prompt: 'A minimalist representation of a meditation teacher using simple geometric shapes and a calm color palette. Focus on serenity and balance.',
        styleType: StyleType.MINIMALIST,
        tags: ['minimalist', 'zen', 'meditation', 'simple'],
        isPublic: true,
        generationStatus: GenerationStatus.COMPLETED,
        metadata: {
          inspiration: 'Zen philosophy',
          difficulty: 'intermediate',
        },
      },
      {
        name: 'Work in Progress',
        prompt: 'A fantasy dragon knight with scale armor, standing beside a massive dragon companion in a volcanic landscape.',
        styleType: StyleType.FANTASY,
        tags: ['dragon', 'knight', 'fantasy', 'companion'],
        isPublic: false,
        generationStatus: GenerationStatus.PROCESSING,
        metadata: {
          inspiration: 'Dragon Age',
          difficulty: 'expert',
        },
      },
    ];
    
    let createdCount = 0;
    
    // Use transaction to ensure all characters are created together
    await dbConnection.transaction(async (tx) => {
      for (let i = 0; i < sampleCharacters.length; i++) {
        const character = sampleCharacters[i];
        const user = users[i % users.length]; // Cycle through users
        
        await tx.character.create({
          data: {
            ...character,
            userId: user.id,
          },
        });
        
        createdCount++;
        
        if (verbose) {
          console.log(`      ✅ ${character.name} (assigned to ${user.name})`);
        }
      }
    });
    
    return createdCount;
    
  } catch (error) {
    console.error('Failed to seed sample characters:', error);
    throw error;
  }
}

/**
 * Get sample character data for reference
 */
export function getSampleCharacterData() {
  return {
    count: 8,
    styles: [
      StyleType.FANTASY,
      StyleType.CYBERPUNK,
      StyleType.ANIME,
      StyleType.VINTAGE,
      StyleType.REALISTIC,
      StyleType.CARTOON,
      StyleType.MINIMALIST,
    ],
    statuses: [
      GenerationStatus.COMPLETED,
      GenerationStatus.PROCESSING,
    ],
  };
}