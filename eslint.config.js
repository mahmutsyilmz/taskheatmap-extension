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
        caughtErrors: 'all',
        caughtErrorsIgnorePattern: '^_',
      },
    ],
  },
};

const vitestConfig = {
  files: ['extension/tests/**/*.test.js'],
  languageOptions: {
    globals: {
      ...globals.node,
      ...globals.vitest,
    },
  },
};

const uiTestConfig = {
  files: ['extension/tests/ui/**/*.spec.js', 'extension/tests/ui/setupTests.js'],
  languageOptions: {
    globals: {
      ...globals.node,
      ...globals.jest,
      page: true,
      browser: true,
      context: true,
    },
  },
};

const nodeScriptsConfig = {
  files: ['scripts/**/*.js', 'jest*.config.cjs'],
  languageOptions: {
    globals: {
      ...globals.node,
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
  vitestConfig,
  uiTestConfig,
  nodeScriptsConfig,
];
