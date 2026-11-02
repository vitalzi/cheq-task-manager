// Runs only the *.integration.test.ts files, which need DynamoDB Local (see README).
// Kept apart from jest.config.js: no coverage here, `npm test` owns that.
/** @type {import('jest').Config} */
module.exports = {
  testEnvironment: 'node',
  roots: ['<rootDir>/src'],
  testMatch: ['**/*.integration.test.ts'],
  transform: { '^.+\\.[tj]sx?$': 'ts-jest' },
};
