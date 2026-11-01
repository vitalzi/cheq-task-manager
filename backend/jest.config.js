/** @type {import('jest').Config} */
module.exports = {
  testEnvironment: 'node',
  roots: ['<rootDir>/src'],
  // `cookie` (pulled in by Fastify's inject) is ESM-only and Jest runs CommonJS.
  // Let ts-jest transpile it (needs allowJs in tsconfig.json) instead of ignoring node_modules.
  transform: { '^.+\\.[tj]sx?$': 'ts-jest' },
  transformIgnorePatterns: ['/node_modules/(?!cookie/)'],
  collectCoverage: true,
  // Listed explicitly so files no test imports (server.ts) still count; the
  // shared contract test is test code, not product code.
  collectCoverageFrom: ['src/**/*.ts', '!src/**/*.test.ts', '!src/**/*.contract.ts'],
  coverageReporters: ['text-summary', 'text', 'html'],
  coverageThreshold: { global: { statements: 80, branches: 80, functions: 80, lines: 80 } },
};
