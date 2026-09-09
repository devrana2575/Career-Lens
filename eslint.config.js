import js from '@eslint/js';
import globals from 'globals';
import react from 'eslint-plugin-react';
import reactHooks from 'eslint-plugin-react-hooks';
import reactRefresh from 'eslint-plugin-react-refresh';

const nodeConfig = {
  files: ['packages/api/**/*.js', 'packages/shared/**/*.js', 'scripts/**/*.js'],
  languageOptions: {
    ecmaVersion: 2022,
    sourceType: 'module',
    globals: globals.node,
  },
  rules: {
    ...js.configs.recommended.rules,
    'no-unused-vars': ['error', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }],
    'no-console': 'off',
  },
};

const testConfig = {
  files: ['packages/api/test/**/*.js', '**/*.test.js'],
  languageOptions: {
    globals: { ...globals.node, ...globals.jest },
  },
};

const reactConfig = {
  files: ['packages/frontend/**/*.{js,jsx}'],
  plugins: {
    react,
    'react-hooks': reactHooks,
    'react-refresh': reactRefresh,
  },
  languageOptions: {
    ecmaVersion: 2022,
    sourceType: 'module',
    parserOptions: { ecmaFeatures: { jsx: true } },
    globals: globals.browser,
  },
  settings: { react: { version: 'detect' } },
  rules: {
    ...js.configs.recommended.rules,
    ...react.configs.flat.recommended.rules,
    ...react.configs.flat['jsx-runtime'].rules,
    ...reactHooks.configs.recommended.rules,
    'react-refresh/only-export-components': 'off',
    'react/prop-types': 'off',
    'no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
  },
};

export default [
  {
    ignores: [
      '**/node_modules/**',
      '**/dist/**',
      '**/build/**',
      '**/.venv/**',
      '**/venv/**',
      '**/coverage/**',
      'packages/data-service/**',
    ],
  },
  nodeConfig,
  testConfig,
  reactConfig,
];