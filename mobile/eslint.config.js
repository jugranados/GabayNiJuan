// https://docs.expo.dev/guides/using-eslint/
const { defineConfig } = require('eslint/config');
const expoConfig = require('eslint-config-expo/flat');
const prettierConfig = require('eslint-config-prettier');

module.exports = defineConfig([
  expoConfig,
  prettierConfig,
  {
    ignores: ['dist/*', '.expo/*', 'coverage/*'],
  },
  {
    files: ['**/*.ts', '**/*.tsx'],
    rules: {
      '@typescript-eslint/no-explicit-any': 'error',
    },
  },
  {
    // UI code must consume domain/view models, never raw backend rows or clients.
    files: ['src/app/**', 'src/components/**', 'src/features/**'],
    ignores: ['**/__tests__/**'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: ['@supabase/*', '@/data/supabase/*', '@/data/schemas/*', '@/data/fixtures/*'],
              message:
                'UI must read through repositories and domain models, not raw backend rows or clients.',
            },
          ],
        },
      ],
    },
  },
]);
