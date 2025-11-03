import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['extension/tests/**/*.test.js'],
    environment: 'node',
    coverage: {
      reporter: ['text', 'lcov'],
      include: ['extension/lib/**/*.js'],
      exclude: ['extension/lib/export.js'],
      thresholds: {
        statements: 80,
        branches: 70,
        functions: 80,
        lines: 80,
      },
    },
  },
});
