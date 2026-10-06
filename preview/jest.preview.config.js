/**
 * UI preview renderer config.
 *
 * Renders the REAL screen/component code through react-native-web inside jsdom
 * and writes a static HTML page (docs/ui-preview/live.html) for design review.
 * Device-only modules are replaced by preview/stubs/all.tsx.
 *
 *   npm run preview:ui       (see package.json)
 *
 * This config is separate from the app's jest.config.js: it never runs in CI
 * test suites and touches no app code.
 */
/** @type {import('ts-jest').JestConfigWithTsJest} */
const STUB = '<rootDir>/preview/stubs/all.tsx';

module.exports = {
  rootDir: '..',
  testEnvironment: 'jsdom',
  roots: ['<rootDir>/preview'],
  testMatch: ['**/*.render.tsx'],
  setupFiles: ['<rootDir>/preview/setup.js'],
  moduleFileExtensions: ['ts', 'tsx', 'js', 'jsx', 'json'],
  transform: {
    '^.+\\.(ts|tsx)$': [
      'ts-jest',
      {
        tsconfig: {
          jsx: 'react-jsx',
          esModuleInterop: true,
          skipLibCheck: true,
          strict: false,
          noImplicitAny: false,
          allowJs: true,
          types: ['jest', 'node'],
        },
      },
    ],
  },
  moduleNameMapper: {
    '^react-native$': 'react-native-web',
    '^react-native-safe-area-context$': STUB,
    '^expo-linear-gradient$': STUB,
    '^@expo/vector-icons$': STUB,
    '^(.*)/lib/(haptics|sound|secureKeys|ai|engine|memory|memoryEngine|memoryCore|worldState|storyMemory|storyMemoryCore|storyMemoryStore|db|playthrough|backup|notifications|storage|files|filesSafe|imagePicker|offlineEngine|validate)$': STUB,
    '^(.*)/content/loader$': STUB,
    '^(.*)/state/AppContext$': STUB,
    '\\.(jpg|jpeg|png|gif|webp|svg|ttf|otf|mp3|wav)$': '<rootDir>/jest.assets.js',
  },
};
