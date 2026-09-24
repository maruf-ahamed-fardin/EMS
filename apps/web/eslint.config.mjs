import { defineConfig, globalIgnores } from 'eslint/config';
import nextVitals from 'eslint-config-next/core-web-vitals';
import nextTs from 'eslint-config-next/typescript';

export default defineConfig([
  // server/ is the API, linted by its own eslint.config.mjs
  globalIgnores(['.next/**', 'coverage/**', 'next-env.d.ts', 'server/**']),
  ...nextVitals,
  ...nextTs,
]);
