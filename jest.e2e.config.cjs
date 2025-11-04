module.exports = {
  preset: 'jest-puppeteer',
  testMatch: ['<rootDir>/extension/tests/e2e/**/*.spec.js'],
  testTimeout: 90000,
  transform: {},
  setupFilesAfterEnv: ['<rootDir>/extension/tests/ui/setupTests.js'],
};
