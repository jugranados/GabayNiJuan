import { defineConfig, globalIgnores } from 'eslint/config';
import nextVitals from 'eslint-config-next/core-web-vitals';
import nextTs from 'eslint-config-next/typescript';

/**
 * Presentation code consumes domain models from `@/server/*` and `@/domain/*`.
 * It must not reach raw rows, generated database types, fixtures or the
 * Supabase client (AGENTS.md: "UI must consume domain/view models").
 */
const dataBoundary = {
  files: ['src/app/**', 'src/components/**', 'src/features/**'],
  ignores: ['**/__tests__/**'],
  rules: {
    'no-restricted-imports': [
      'error',
      {
        patterns: [
          {
            group: ['@supabase/*', '@/data/*', '@/lib/supabase/*'],
            message:
              'UI code reads through @/server/repositories and domain models. Supabase and raw rows stay in src/data; editorial pages use @/server/editorial.',
          },
        ],
      },
    ],
  },
};

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  dataBoundary,
  globalIgnores(['.next/**', 'out/**', 'build/**', 'next-env.d.ts']),
]);

export default eslintConfig;
