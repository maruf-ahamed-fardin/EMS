// Runs once when the server starts: refuse to boot with a broken configuration
// instead of failing on the first request that needs it.
export async function register() {
  if (process.env.NEXT_RUNTIME !== 'nodejs' || process.env.NEXT_PHASE === 'phase-production-build') return;

  const { getEnv } = await import('./server/env');
  try {
    getEnv();
  } catch (error) {
    console.error(error instanceof Error ? error.message : error);
    process.exit(1);
  }
}
