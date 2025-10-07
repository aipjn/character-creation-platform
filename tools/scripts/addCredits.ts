import 'dotenv/config';
import { PrismaClient, TransactionType } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const [email, amountArg] = process.argv.slice(2);

  if (!email) {
    console.error('Usage: ts-node tools/scripts/addCredits.ts <email> [amount]');
    process.exit(1);
  }

  const amount = Number(amountArg ?? '100');

  if (!Number.isFinite(amount) || amount <= 0) {
    console.error('Amount must be a positive number.');
    process.exit(1);
  }

  const user = await prisma.user.findUnique({ where: { email } });

  if (!user) {
    console.error(`User with email ${email} not found.`);
    process.exit(1);
  }

  const updatedUser = await prisma.$transaction(async (tx) => {
    const result = await tx.user.update({
      where: { id: user.id },
      data: { credits: { increment: amount } }
    });

    await tx.creditTransaction.create({
      data: {
        userId: user.id,
        amount,
        balance: result.credits,
        type: TransactionType.REWARD,
        description: `Manual credit adjustment (+${amount})`
      }
    });

    return result;
  });

  console.log(`Added ${amount} credits to ${email}. New balance: ${updatedUser.credits}`);
}

main()
  .catch((error) => {
    console.error('Failed to add credits:', error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
