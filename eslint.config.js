import js from '@eslint/js';
import globals from 'globals';
import eslintConfigPrettier from 'eslint-config-prettier';

const baseConfig = {
  files: ['**/*.js'],
  languageOptions: {
    ...js.configs.recommended.languageOptions,
    ecmaVersion: 2023,
    sourceType: 'module',
    globals: {
      ...globals.browser,
      ...globals.webextensions,
    },
  },
  rules: {
    ...js.configs.recommended.rules,
    'no-console': ['error', { allow: ['info', 'warn', 'error', 'debug'] }],
    'no-unused-vars': [
      'error',
      {
        args: 'after-used',
        argsIgnorePattern: '^_',
        ignoreRestSiblings: true,
      },
    ],
  },
};

const testConfig = {
  files: ['extension/tests/**/*.test.js'],
  languageOptions: {
    globals: {
      ...globals.node,
      ...globals.vitest,
    },
  },
};

export default [
  {
    ignores: ['dist/**', 'artifacts/**', 'node_modules/**', 'coverage/**'],
  },
  {
    ...js.configs.recommended,
    ...baseConfig,
  },
  eslintConfigPrettier,
  testConfig,
];
