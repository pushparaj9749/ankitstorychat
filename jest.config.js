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
    // Icons are visual-only; swap in a light stub so node-environment tests
    // never load the ESM icon-font package.
    '^@expo/vector-icons$': '<rootDir>/__mocks__/@expo/vector-icons.tsx',
    '\\.(jpg|jpeg|png|gif|webp|bmp|svg|ttf|otf|mp3|wav)$': '<rootDir>/jest.assets.js',
  },
};
