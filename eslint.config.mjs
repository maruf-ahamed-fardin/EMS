import { defineConfig, globalIgnores } from 'eslint/config';
import nextVitals from 'eslint-config-next/core-web-vitals';
import nextTs from 'eslint-config-next/typescript';

export default defineConfig([
  // Generated output, not source
  globalIgnores(['coverage/**', '.next/**']),
  ...nextVitals,
  ...nextTs,
]);
