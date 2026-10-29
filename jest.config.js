/** @type {import('jest').Config} */
module.exports = {
  preset: 'jest-expo/ios',
  setupFiles: ['react-native-gesture-handler/jestSetup.js', '<rootDir>/jest.setup.ts'],
  // Reanimated's mock loads its web (JS) build under Jest (SDK 58 / Reanimated 4.7).
  resolver: 'react-native-reanimated/jest/resolver',
  testPathIgnorePatterns: ['/node_modules/', '/.expo/', '/dist/'],
};
