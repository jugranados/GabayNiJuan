/**
 * Jest config for tests that talk to a real Supabase project.
 *
 * The default config (jest-expo) replaces `fetch` with a React Native stub, so
 * network tests need a plain Node environment. Run with:
 *
 *   npm run test:integration        (reads EXPO_PUBLIC_SUPABASE_* from the environment)
 */
// babel-preset-expo is a dependency of `expo`, so resolve it from there.
const expoBabelPreset = require.resolve('babel-preset-expo', {
  paths: [require.resolve('expo/package.json')],
});

module.exports = {
  testEnvironment: 'node',
  testMatch: ['**/*.integration.test.ts'],
  transform: {
    '^.+\\.(ts|tsx)$': ['babel-jest', { presets: [expoBabelPreset] }],
  },
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/src/$1',
    // babel-preset-expo rewrites process.env.EXPO_PUBLIC_* to this ES module.
    '^expo/virtual/env$': '<rootDir>/jest.expo-env.js',
    // URL is already available in Node; the React Native polyfill is not needed.
    '^react-native-url-polyfill/auto$': '<rootDir>/jest.empty.js',
  },
};
