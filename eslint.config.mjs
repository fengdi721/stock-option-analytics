import js from '@eslint/js';
import { defineConfig } from 'eslint/config';
import tseslint from 'typescript-eslint';
import prettier from 'eslint-config-prettier/flat';

export default defineConfig([
  { ignores: ['node_modules/**', 'outputs/**', 'data/**', 'coverage/**', 'dist/**'] },
  {
    files: ['**/*.mjs'],
    extends: [js.configs.recommended],
  },
  {
    files: ['src/**/*.ts', 'test/**/*.ts'],
    extends: [js.configs.recommended, tseslint.configs.recommendedTypeChecked],
    languageOptions: {
      parserOptions: { projectService: true, tsconfigRootDir: import.meta.dirname },
    },
    linterOptions: { reportUnusedDisableDirectives: 'error' },
    rules: {
      '@typescript-eslint/consistent-type-imports': 'error',
      '@typescript-eslint/switch-exhaustiveness-check': 'error',
      eqeqeq: ['error', 'always'],
    },
  },

  {
    files: ['src/**/*.ts'],
    rules: { '@typescript-eslint/no-floating-promises': ['error', { ignoreVoid: false }] },
  },
  {
    files: [
      'src/domain/**/*.ts',
      'src/shared/**/*.ts',
      'src/financial/**/*.ts',
      'src/sec/{contracts,content,submissions,companyfacts-contracts}.ts',
    ],
    rules: {
      'no-restricted-globals': [
        'error',
        'fetch',
        'process',
        'require',
        'WebSocket',
        'XMLHttpRequest',
      ],
      'no-restricted-properties': [
        'error',
        {
          object: 'globalThis',
          property: 'fetch',
          message: 'Inject network access at the I/O boundary.',
        },
        {
          object: 'globalThis',
          property: 'process',
          message: 'Read the environment at the CLI boundary.',
        },
        {
          object: 'globalThis',
          property: 'WebSocket',
          message: 'Keep network access outside the pure core.',
        },
        {
          object: 'globalThis',
          property: 'XMLHttpRequest',
          message: 'Keep network access outside the pure core.',
        },
      ],
    },
  },
  prettier,
  {
    files: ['src/**/*.ts', 'test/**/*.ts'],
    rules: { curly: ['error', 'all'] },
  },
]);
