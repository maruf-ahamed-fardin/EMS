// @ts-check

/**
 * Tests for the API modules (lib/server, lib/services, lib/auth, lib/http, config). SWC compiles them
 * quickly and emits the decorator metadata Nest's injector needs. The frontend's tests run on Vitest.
 */
const swc = [
  '@swc/jest',
  {
    jsc: {
      parser: { syntax: 'typescript', decorators: true },
      transform: { legacyDecorator: true, decoratorMetadata: true },
      target: 'es2023',
    },
    module: { type: 'commonjs' },
    sourceMaps: 'inline',
  },
];

const moduleNameMapper = {
  // The generated Prisma client imports './x.js' (nodenext style). Jest resolves the .ts source instead.
  '^(\\.{1,2}/.*)\\.js$': '$1',
  '^@/(.*)$': '<rootDir>/$1',
};

/** @type {import('jest').Config} */
module.exports = {
  projects: [
    {
      displayName: 'unit',
      testEnvironment: 'node',
      roots: ['<rootDir>/tests/unit'],
      testMatch: ['**/*.spec.ts'],
      transform: { '^.+\\.ts$': swc },
      moduleNameMapper,
    },
    {
      // HTTP tests against the real Nest app. Database tests inside skip without TEST_DATABASE_URL.
      displayName: 'integration',
      testEnvironment: 'node',
      roots: ['<rootDir>/tests/integration'],
      testMatch: ['**/*.e2e-spec.ts'],
      transform: { '^.+\\.ts$': swc },
      moduleNameMapper,
    },
  ],
};
