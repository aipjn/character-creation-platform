import { getDatabaseConnection } from '../database/connection';
import { STYLE_TYPE } from '../../shared/types/enums';

interface SeedOptions {
  verbose?: boolean;
}

const CHARACTER_TEMPLATES = [
  {
    name: 'Fantasy Warrior',
    description: 'A brave warrior ready for epic adventures',
    prompt: 'A heroic fantasy warrior in detailed armor, holding a gleaming sword, standing confidently in a medieval castle courtyard. Strong, noble features with determined eyes. Detailed chainmail and plate armor with intricate engravings.',
    styleType: STYLE_TYPE.FANTASY,
    tags: ['warrior', 'fantasy', 'armor', 'sword', 'hero', 'medieval'],
  },
  {
    name: 'Cyberpunk Hacker',
    description: 'A tech-savvy hacker from the neon-lit future',
    prompt: 'A cyberpunk hacker with neon-colored hair, augmented reality glasses, and glowing cybernetic implants. Wearing a dark hoodie with circuit patterns. Background of futuristic neon-lit cityscape with holographic displays.',
    styleType: STYLE_TYPE.CYBERPUNK,
    tags: ['hacker', 'cyberpunk', 'futuristic', 'neon', 'technology', 'augments'],
  },
  {
    name: 'Anime Schoolgirl',
    description: 'A cheerful anime-style school student',
    prompt: 'A cheerful anime schoolgirl with large expressive eyes, colorful hair in twin tails, wearing a traditional Japanese school uniform. Cherry blossom petals floating in the background. Bright, vibrant colors and typical anime art style.',
    styleType: STYLE_TYPE.ANIME,
    tags: ['anime', 'school', 'student', 'cheerful', 'japanese', 'uniform'],
  },
  {
    name: 'Steampunk Inventor',
    description: 'A brilliant inventor from the steam-powered era',
    prompt: 'A steampunk inventor wearing brass goggles, leather apron, and Victorian-era clothing with mechanical accessories. Standing in a workshop filled with gears, steam pipes, and copper machinery. Warm brass and copper color palette.',
    styleType: STYLE_TYPE.VINTAGE,
    tags: ['steampunk', 'inventor', 'victorian', 'brass', 'gears', 'mechanical'],
  },
  {
    name: 'Realistic Portrait',
    description: 'A photorealistic human portrait',
    prompt: 'A photorealistic portrait of a person with natural lighting, detailed facial features, and professional photography quality. Natural skin texture, realistic hair, and expressive eyes. Studio lighting with soft shadows.',
    styleType: STYLE_TYPE.REALISTIC,
    tags: ['realistic', 'portrait', 'photographic', 'natural', 'professional', 'human'],
  },
  {
    name: 'Cartoon Hero',
    description: 'A fun cartoon-style superhero',
    prompt: 'A cartoon superhero with exaggerated features, bright colorful costume with cape, and a heroic pose. Comic book style with bold outlines, vibrant colors, and dynamic action lines. Cheerful and approachable design.',
    styleType: STYLE_TYPE.CARTOON,
    tags: ['cartoon', 'superhero', 'comic', 'colorful', 'heroic', 'fun'],
  },
  {
    name: 'Minimalist Avatar',
    description: 'A clean, simple minimalist character design',
    prompt: 'A minimalist character design with simple geometric shapes, clean lines, and limited color palette. Abstract representation focusing on essential features. Modern, clean aesthetic with plenty of negative space.',
    styleType: STYLE_TYPE.MINIMALIST,
    tags: ['minimalist', 'simple', 'geometric', 'clean', 'modern', 'abstract'],
  },
  {
    name: 'Fantasy Mage',
    description: 'A powerful spellcaster wielding magical energies',
    prompt: 'A fantasy mage in flowing robes, holding a magical staff with glowing crystals. Mystical aura with floating magical symbols and energy effects. Ancient tome and potion bottles nearby. Ethereal lighting with magical sparkles.',
    styleType: STYLE_TYPE.FANTASY,
    tags: ['mage', 'magic', 'wizard', 'spells', 'fantasy', 'mystical'],
  },
  {
    name: 'Space Explorer',
    description: 'An astronaut ready to explore the cosmos',
    prompt: 'A futuristic space explorer in an advanced spacesuit with glowing helmet visor, standing on an alien planet surface. Stars and nebulae visible in the cosmic background. High-tech equipment and exploration tools.',
    styleType: STYLE_TYPE.CYBERPUNK,
    tags: ['space', 'astronaut', 'explorer', 'futuristic', 'alien', 'cosmic'],
  },
  {
    name: 'Viking Berserker',
    description: 'A fierce Norse warrior from ancient times',
    prompt: 'A fierce Viking berserker with braided beard, fur cloak, and battle axe. Traditional Norse armor with runes and tribal markings. Standing on a rocky cliff with stormy seas in the background. Battle-ready stance.',
    styleType: STYLE_TYPE.REALISTIC,
    tags: ['viking', 'berserker', 'norse', 'warrior', 'ancient', 'fierce'],
  },
];

/**
 * Seed character templates into the database
 */
export async function seedCharacterTemplates(options: SeedOptions = {}): Promise<number> {
  const { verbose = false } = options;
  
  try {
    const dbConnection = getDatabaseConnection();
    const prisma = dbConnection.getPrismaClient();
    
    if (verbose) {
      console.log('   📝 Creating character templates...');
    }
    
    // Use transaction to ensure all templates are created together
    await dbConnection.transaction(async (tx) => {
      for (const template of CHARACTER_TEMPLATES) {
        await tx.characterTemplate.create({
          data: template,
        });
        
        if (verbose) {
          console.log(`      ✅ ${template.name}`);
        }
      }
    });
    
    return CHARACTER_TEMPLATES.length;
    
  } catch (error) {
    console.error('Failed to seed character templates:', error);
    throw error;
  }
}

/**
 * Get all available character template data for reference
 */
export function getCharacterTemplateData() {
  return CHARACTER_TEMPLATES;
}
