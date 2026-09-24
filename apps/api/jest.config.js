// @ts-check

/** SWC compiles tests quickly and emits the decorator metadata Nest's injector needs. */
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

// The generated Prisma client imports './x.js' (nodenext style). Jest resolves the .ts source instead.
const moduleNameMapper = { '^(\\.{1,2}/.*)\\.js$': '$1' };

/** @type {import('jest').Config} */
module.exports = {
  projects: [
    {
      displayName: 'unit',
      testEnvironment: 'node',
      roots: ['<rootDir>/src'],
      testMatch: ['**/*.spec.ts'],
      transform: { '^.+\\.ts$': swc },
      moduleNameMapper,
    },
    {
      // HTTP tests against the real Nest app. Database tests inside skip without TEST_DATABASE_URL.
      displayName: 'e2e',
      testEnvironment: 'node',
      roots: ['<rootDir>/test'],
      testMatch: ['**/*.e2e-spec.ts'],
      transform: { '^.+\\.ts$': swc },
      moduleNameMapper,
    },
  ],
};
