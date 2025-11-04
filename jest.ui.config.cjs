module.exports = {
  preset: 'jest-puppeteer',
  testMatch: ['<rootDir>/extension/tests/ui/**/*.spec.js'],
  testTimeout: 60000,
  transform: {},
  setupFilesAfterEnv: ['<rootDir>/extension/tests/ui/setupTests.js'],
};
