module.exports = {
  testEnvironment: 'node',
  testTimeout: 30000,
  setupFilesAfterEnv: ['./tests/setup.js'],
  clearMocks: true,
  collectCoverageFrom: [
    '**/*.js',
    '!tests/**',
    '!scripts/**',
    '!node_modules/**',
  ],
  coverageDirectory: 'coverage',
  coverageReporters: ['text', 'lcov'],
  coverageThreshold: {
    global: {
      lines: 15,
      branches: 10,
      functions: 10,
      statements: 15,
    },
  },
};
