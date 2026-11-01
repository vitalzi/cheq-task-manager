/** @type {import('jest').Config} */
module.exports = {
  testEnvironment: 'node',
  roots: ['<rootDir>/src'],
  // `cookie` (pulled in by Fastify's inject) is ESM-only and Jest runs CommonJS.
  // Let ts-jest transpile it (needs allowJs in tsconfig.json) instead of ignoring node_modules.
  transform: { '^.+\\.[tj]sx?$': 'ts-jest' },
  transformIgnorePatterns: ['/node_modules/(?!cookie/)'],
};
