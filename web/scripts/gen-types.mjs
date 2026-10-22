#!/usr/bin/env node
/**
 * Regenerates src/data/supabase/database.types.ts from a Supabase database and keeps the
 * file's header. Needs the Supabase CLI to be signed in (`npx supabase login`).
 *
 *   npm run db:types                 # the linked project (after `npx supabase link`)
 *   npm run db:types -- --local      # the local stack (`supabase start`)
 *   npm run db:types -- --project-id <ref>
 *
 * Afterwards run `npm run typecheck`: schemaDrift.ts fails to compile if the Zod row
 * contracts and the database have drifted apart.
 */
import { spawnSync } from 'node:child_process';
import { writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const outFile = resolve(dirname(fileURLToPath(import.meta.url)), '../src/data/supabase/database.types.ts');
const extra = process.argv.slice(2);
const target = extra.length > 0 ? extra : ['--linked'];

const HEADER = `// GENERATED from the Supabase schema by \`npm run db:types\`. Do not edit by hand.
// Regenerate after every migration, then run \`npm run typecheck\`:
// src/data/supabase/schemaDrift.ts fails to compile if the Zod row contracts drift.
//
// Data layer only. Domain and UI code must never import these types.

`;

const result = spawnSync('npx', ['--yes', 'supabase', 'gen', 'types', 'typescript', ...target, '--schema', 'public'], {
  cwd: resolve(dirname(fileURLToPath(import.meta.url)), '../..'),
  encoding: 'utf8',
  maxBuffer: 64 * 1024 * 1024,
  stdio: ['inherit', 'pipe', 'inherit'],
});

// Never overwrite the current types with an error message or an empty file.
if (result.status !== 0 || !result.stdout.includes('export type Database')) {
  console.error('\nType generation failed; database.types.ts was left unchanged.');
  console.error('Is the CLI signed in (`npx supabase login`) and the project linked (`npx supabase link`)?');
  process.exit(result.status || 1);
}

writeFileSync(outFile, HEADER + result.stdout);
console.log(`Wrote ${outFile}`);
