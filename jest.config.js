/** @type {import('ts-jest').JestConfigWithTsJest} */
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  roots: ['<rootDir>/__tests__'],
  moduleFileExtensions: ['ts', 'tsx', 'js', 'json'],
  testMatch: ['**/*.test.ts', '**/*.test.tsx'],
  // Cover art is imported by src/content/bundled.ts — stub it so tests can
  // exercise the real bundled-story registry.
  moduleNameMapper: {
    '\\.(jpg|jpeg|png|gif|webp|bmp|svg|ttf|otf|mp3|wav)$': '<rootDir>/jest.assets.js',
  },
};
