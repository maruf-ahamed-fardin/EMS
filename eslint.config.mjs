import { defineConfig, globalIgnores } from 'eslint/config';
import nextVitals from 'eslint-config-next/core-web-vitals';
import nextTs from 'eslint-config-next/typescript';

export default defineConfig([
  // Generated output, not source. ems/ is a separate workspace with its own lint config.
  globalIgnores(['coverage/**', '.next/**', 'ems/**']),
  ...nextVitals,
  ...nextTs,
]);
