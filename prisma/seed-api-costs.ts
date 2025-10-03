/**
 * Seed API Cost Configuration
 * Seeds the database with API endpoint costs
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('Seeding API cost configuration...');

  // Define API costs (only for endpoints that call external APIs)
  const apiCosts = [
    {
      apiEndpoint: '/characters/optimize-prompt',
      cost: 5,
      description: 'Gemini API call for prompt optimization',
      enabled: true
    },
    {
      apiEndpoint: '/characters/optimize-prompt-25flash',
      cost: 5,
      description: 'Gemini 2.5 Flash API call for prompt optimization',
      enabled: true
    },
    {
      apiEndpoint: '/characters/generate-image',
      cost: 10,
      description: 'AI image generation for character',
      enabled: true
    },
    {
      apiEndpoint: '/themes/variants/generate',
      cost: 10,
      description: 'AI image generation for theme variant',
      enabled: true
    }
  ];

  // Upsert each API cost config
  for (const config of apiCosts) {
    await prisma.apiCostConfig.upsert({
      where: { apiEndpoint: config.apiEndpoint },
      update: {
        cost: config.cost,
        description: config.description,
        enabled: config.enabled
      },
      create: config
    });
    console.log(`✓ Configured ${config.apiEndpoint}: ${config.cost} credits`);
  }

  console.log('\n✅ API cost configuration complete!');
  console.log('\nCurrent API costs:');
  apiCosts.forEach(config => {
    console.log(`  ${config.apiEndpoint.padEnd(40)} ${config.cost} credits`);
  });
}

main()
  .catch((e) => {
    console.error('Error seeding API costs:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
