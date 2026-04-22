/** @type {import('jest').Config} */
module.exports = {
  testEnvironment: 'node',
  testMatch: ['**/tests/**/*.test.js'],
  collectCoverageFrom: [
    'server/**/*.js',
    '!server/index.js',   // bootstrap — impossible to unit test meaningfully
  ],
  coverageThreshold: {
    global: { lines: 80 },
  },
  coverageReporters: ['text', 'lcov'],
};
