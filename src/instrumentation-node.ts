// Loaded by instrumentation.ts on the Node.js runtime only.
// Refuses to start the server with a broken configuration instead of failing on the first request that needs it.
import { getEnv } from './server/env';

if (process.env.NEXT_PHASE !== 'phase-production-build') {
  try {
    getEnv();
  } catch (error) {
    console.error(error instanceof Error ? error.message : error);
    process.exit(1);
  }
}
