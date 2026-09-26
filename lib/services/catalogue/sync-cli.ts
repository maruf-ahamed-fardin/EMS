import { PrismaPg } from '@prisma/adapter-pg';
import { parseEnv } from '@/config/env';
import { loadRepoEnv } from '@/config/load-env';
import { PrismaClient } from '@/lib/db/generated/prisma/client';
import { syncCatalogue } from './sync-catalogue';

/**
 * Release step, after `prisma migrate deploy`: `npm run catalogue:sync -w @ems/backend`.
 * Brings permissions and system roles in line with this build. Creates no users and no demo data.
 */
async function main() {
  loadRepoEnv();
  const config = parseEnv();
  const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: config.DATABASE_URL }) });
  try {
    const summary = await syncCatalogue(prisma);
    console.error(`Catalogue synced: ${JSON.stringify(summary)}`);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
