import { fileURLToPath } from 'node:url';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('.', import.meta.url)),
      // Next resolves this through its bundler; under Vitest it needs a real module
      'server-only': fileURLToPath(new URL('./tests/setup/server-only.ts', import.meta.url)),
    },
  },
  test: {
    environment: 'jsdom',
    globals: true,
    include: ['{app,components,hooks,lib}/**/*.test.{ts,tsx}', 'proxy.test.ts'],
    setupFiles: ['./tests/setup/setup.ts'],
  },
});
