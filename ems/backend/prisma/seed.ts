import { PrismaPg } from '@prisma/adapter-pg';
import * as argon2 from 'argon2';
import { checkPassword, PASSWORD_PROBLEM_MESSAGES } from '../src/auth/password-policy';
import { syncCatalogue } from '../src/catalogue/sync-catalogue';
import { PrismaClient } from '../src/generated/prisma/client';
import { DEMO_PEOPLE, seedDemoUsers } from './demo-data';

/**
 * Development seed (plan §14): the catalogue plus one demo user per role.
 * `npm run db:seed`. Refuses to run in production; the demo password comes from SEED_PASSWORD.
 */
async function main() {
  if (process.env.NODE_ENV === 'production') throw new Error('The demo seed never runs in production');

  const password = process.env.SEED_PASSWORD;
  if (!password) throw new Error('Set SEED_PASSWORD (at least 10 characters) in ems/.env');
  const problem = checkPassword(password);
  if (problem) throw new Error(`SEED_PASSWORD: ${PASSWORD_PROBLEM_MESSAGES[problem]}`);

  const url = process.env.DATABASE_URL;
  if (!url) throw new Error('DATABASE_URL is required');

  const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: url }) });
  try {
    const catalogue = await syncCatalogue(prisma);
    const hash = await argon2.hash(password, { type: argon2.argon2id, memoryCost: 19_456, timeCost: 2, parallelism: 1 });
    await seedDemoUsers(prisma, hash);
    console.error(`Seeded catalogue ${JSON.stringify(catalogue)} and demo users:`);
    for (const [role, person] of Object.entries(DEMO_PEOPLE)) console.error(`  ${role.padEnd(12)} ${person.email}`);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
