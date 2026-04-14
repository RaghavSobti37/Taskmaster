export default {
  testEnvironment: 'node',
  coveragePathIgnorePatterns: ['/node_modules/'],
  testMatch: ['**/__tests__/**/*.js', '**/?(*.)+(spec|test).js'],
  testPathIgnorePatterns: ['/node_modules/', '/.git/'],
  collectCoverageFrom: [
    'controllers/**/*.js',
    'routes/**/*.js',
    'middleware/**/*.js',
    'utils/**/*.js',
    'models/**/*.js',
    '!**/*.test.js',
    '!**/node_modules/**',
  ],
  coverageThreshold: {
    global: {
      branches: 60,
      functions: 60,
      lines: 60,
      statements: 60
    }
  },
  testTimeout: 10000,
  verbose: true
};
