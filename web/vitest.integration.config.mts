import { fileURLToPath } from 'node:url';
import { loadEnv } from 'vite';
import { defineConfig } from 'vitest/config';

/**
 * Tests that talk to a real Supabase database with the public anon key.
 * Values come from the environment, or from web/.env.local when present.
 */
export default defineConfig({
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
      'server-only': fileURLToPath(new URL('./src/test/server-only.ts', import.meta.url)),
    },
  },
  test: {
    environment: 'node',
    globals: true,
    include: ['src/**/*.integration.test.ts'],
    // Real network calls; a profile is several requests.
    testTimeout: 60_000,
    hookTimeout: 60_000,
    fileParallelism: false,
    env: loadEnv('', fileURLToPath(new URL('.', import.meta.url)), 'NEXT_PUBLIC_'),
  },
});
