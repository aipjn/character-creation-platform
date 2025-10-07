import { PrismaClient, SubscriptionTier } from '@prisma/client';
import { STYLE_TYPE, GENERATION_STATUS } from '../shared/types/enums';

const prisma = new PrismaClient();

async function main() {
  console.log('Starting database seeding...');

  // Create character templates
  const templates = [
    {
      name: 'Fantasy Warrior',
      description: 'A brave warrior in fantasy armor',
      prompt: 'A heroic warrior wearing gleaming armor, holding a sword, standing in a mystical forest',
      styleType: STYLE_TYPE.FANTASY,
      tags: ['warrior', 'armor', 'sword', 'fantasy', 'hero'],
    },
    {
      name: 'Cyberpunk Hacker',
      description: 'A futuristic hacker in neon-lit city',
      prompt: 'A tech-savvy character with cybernetic enhancements, neon lights, futuristic cityscape background',
      styleType: STYLE_TYPE.CYBERPUNK,
      tags: ['cyberpunk', 'hacker', 'neon', 'futuristic', 'technology'],
    },
    {
      name: 'Anime Protagonist',
      description: 'A classic anime-style main character',
      prompt: 'An energetic character with spiky hair, determined expression, anime art style',
      styleType: STYLE_TYPE.ANIME,
      tags: ['anime', 'protagonist', 'energetic', 'determined'],
    },
    {
      name: 'Cartoon Mascot',
      description: 'A friendly cartoon character',
      prompt: 'A cheerful, friendly character with big eyes and a bright smile, cartoon style',
      styleType: STYLE_TYPE.CARTOON,
      tags: ['cartoon', 'mascot', 'friendly', 'cheerful'],
    },
    {
      name: 'Realistic Portrait',
      description: 'A photorealistic character portrait',
      prompt: 'A professional headshot of a person with natural lighting and realistic details',
      styleType: STYLE_TYPE.REALISTIC,
      tags: ['realistic', 'portrait', 'professional', 'natural'],
    },
  ];

  console.log('Creating character templates...');
  for (const template of templates) {
    await prisma.characterTemplate.upsert({
      where: { name: template.name },
      update: template,
      create: template,
    });
  }

  // Create a demo user for testing
  console.log('Creating demo user...');
  const demoUser = await prisma.user.upsert({
    where: { email: 'demo@example.com' },
    update: {},
    create: {
      email: 'demo@example.com',
      name: 'Demo User',
      subscriptionTier: SubscriptionTier.FREE,
      dailyQuota: 3,
      dailyUsed: 0,
    },
  });

  // Create some sample characters for the demo user
  console.log('Creating sample characters...');
  const sampleCharacters = [
    {
      userId: demoUser.id,
      name: 'Sir Galahad',
      prompt: 'A noble knight in shining armor with a holy sword',
      styleType: STYLE_TYPE.FANTASY,
      tags: ['knight', 'armor', 'sword', 'noble'],
      generationStatus: GENERATION_STATUS.COMPLETED,
      imageUrl: 'https://example.com/sample-knight.jpg',
      thumbnailUrl: 'https://example.com/sample-knight-thumb.jpg',
      isPublic: true,
    },
    {
      userId: demoUser.id,
      name: 'Neo-Tokyo Runner',
      prompt: 'A street racer in a neon-lit cyberpunk city',
      styleType: STYLE_TYPE.CYBERPUNK,
      tags: ['racer', 'neon', 'city', 'cyberpunk'],
      generationStatus: GENERATION_STATUS.COMPLETED,
      imageUrl: 'https://example.com/sample-racer.jpg',
      thumbnailUrl: 'https://example.com/sample-racer-thumb.jpg',
      isPublic: true,
    },
  ];

  for (const character of sampleCharacters) {
    await prisma.character.create({
      data: character,
    });
  }

  // Create corresponding generation records
  console.log('Creating sample generations...');
  const characters = await prisma.character.findMany({
    where: { userId: demoUser.id },
  });

  for (const character of characters) {
    await prisma.generation.create({
      data: {
        userId: demoUser.id,
        characterId: character.id,
        status: GENERATION_STATUS.COMPLETED,
        batchSize: 1,
        prompt: character.prompt,
        styleType: character.styleType,
        completedAt: new Date(),
      },
    });
  }

  console.log('Database seeding completed successfully!');
  
  // Print summary
  const userCount = await prisma.user.count();
  const characterCount = await prisma.character.count();
  const templateCount = await prisma.characterTemplate.count();
  const generationCount = await prisma.generation.count();

  console.log('\nSeed Summary:');
  console.log(`- Users: ${userCount}`);
  console.log(`- Characters: ${characterCount}`);
  console.log(`- Templates: ${templateCount}`);
  console.log(`- Generations: ${generationCount}`);
}

main()
  .catch((e) => {
    console.error('Error during seeding:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
