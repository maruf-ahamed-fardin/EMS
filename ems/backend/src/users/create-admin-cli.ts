import { PrismaPg } from '@prisma/adapter-pg';
import * as argon2 from 'argon2';
import { z } from 'zod';
import { USABLE_SUPER_ADMIN } from '../auth/account-protection';
import { generateToken } from '../common/security/tokens';
import { parseEnv } from '../config/env';
import { PrismaClient } from '../generated/prisma/client';

/**
 * First deploy only: `node dist/users/create-admin-cli.js admin@example.com` (after the release step).
 * Creates the first Super Admin with a password nobody knows; they set theirs with "Forgot password?".
 * Refuses while any Super Admin can sign in, so it can't be used to take over a running system. When
 * none can (every one inactive), it is the way back in; running it needs the production database login.
 */
async function main() {
  try {
    process.loadEnvFile('../.env');
  } catch {
    // no .env file
  }
  const email = z.email().safeParse(process.argv[2]?.trim().toLowerCase());
  if (!email.success) throw new Error('Usage: node dist/users/create-admin-cli.js admin@example.com');

  const config = parseEnv();
  const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: config.DATABASE_URL }) });
  try {
    const role = await prisma.role.findUnique({ where: { key: 'super_admin' }, select: { id: true } });
    if (!role) throw new Error('Run the release step (migrate and catalogue sync) first');
    const passwordHash = await argon2.hash(generateToken(), { type: argon2.argon2id });
    await prisma.$transaction(async (tx) => {
      // Only when nobody can sign in as Super Admin; the lock stops two runs both creating one
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext('users.super_admin'))`;
      if (await tx.user.count({ where: USABLE_SUPER_ADMIN })) throw new Error('A Super Admin already exists. Add more accounts in Users.');
      const user = await tx.user.create({ data: { email: email.data, passwordHash, roleId: role.id }, select: { id: true } });
      await tx.auditLog.create({
        data: { action: 'user.created', entityType: 'user', entityId: user.id, after: { email: email.data, roleId: role.id, via: 'create-admin-cli' }, requestId: 'cli' },
      });
    });
    console.error(`Created Super Admin ${email.data}. Open the sign-in page and use "Forgot password?" to set the password.`);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
