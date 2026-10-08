#!/usr/bin/env node
// Fails when the admin app, the mobile app and the database disagree on shared enums,
// or when the admin workflow table differs from the SQL state machine.
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

const root = new URL('..', import.meta.url).pathname;
const read = (p) => readFileSync(join(root, p), 'utf8');
const errors = [];

const tsList = (src, name) => {
  const m = new RegExp(`export const ${name} = \\[([^\\]]*)\\]`).exec(src);
  return m ? [...m[1].matchAll(/'([A-Z_]+)'/g)].map((x) => x[1]) : undefined;
};

const sql = readdirSync(join(root, 'supabase/migrations'))
  .filter((f) => f.endsWith('.sql'))
  .sort()
  .map((f) => read(`supabase/migrations/${f}`))
  .join('\n');

function sqlEnum(name) {
  const created = new RegExp(`create type public\\.${name} as enum \\(([^)]*)\\)`, 's').exec(sql);
  if (!created) return undefined;
  const values = [...created[1].matchAll(/'([A-Z_]+)'/g)].map((x) => x[1]);
  for (const m of sql.matchAll(new RegExp(`alter type public\\.${name} add value(?: if not exists)? '([A-Z_]+)'`, 'g'))) {
    values.push(m[1]);
  }
  return values;
}

const same = (a, b) => JSON.stringify([...a].sort()) === JSON.stringify([...b].sort());
const admin = read('admin/src/domain/enums.ts');
const mobile = read('mobile/src/domain/enums/index.ts');

const pairs = [
  ['PUBLICATION_STATUSES', 'publication_status', false],
  ['VERIFICATION_STATUSES', 'verification_status', true],
  ['SOURCE_TYPES', 'source_type', true],
  ['ELECTION_STATUSES', 'election_status', true],
  ['OFFICE_LEVELS', 'office_level', true],
  ['ELECTION_PARTICIPATION_STATUSES', 'election_participation_status', true],
  ['OFFICE_TERM_STATUSES', 'office_term_status', true],
  ['POLITICAL_ORGANIZATION_TYPES', 'political_organization_type', true],
  ['AFFILIATION_TYPES', 'affiliation_type', true],
  ['POLICY_ATTRIBUTION_TYPES', 'policy_attribution_type', true],
  ['CORRECTION_STATUSES', 'correction_status', false],
  ['EDITORIAL_ROLES', 'editorial_role', false],
];
for (const [tsName, sqlName, inMobile] of pairs) {
  const a = tsList(admin, tsName);
  const d = sqlEnum(sqlName);
  if (!a || !d) errors.push(`missing ${tsName} (admin) or ${sqlName} (sql)`);
  else if (!same(a, d)) errors.push(`${tsName}: admin ${a} != sql ${d}`);
  if (inMobile) {
    const m = tsList(mobile, tsName);
    if (!m) errors.push(`${tsName} missing in mobile`);
    else if (a && !same(a, m)) errors.push(`${tsName}: admin ${a} != mobile ${m}`);
  }
}

// Claim subject record types: admin offers a subset of the database enum (no legal/asset editors yet).
const subj = tsList(admin, 'CLAIM_SUBJECT_RECORD_TYPES');
const subjSql = sqlEnum('claim_subject_record_type');
if (!subj || !subjSql || !subj.every((v) => subjSql.includes(v))) errors.push('CLAIM_SUBJECT_RECORD_TYPES is not a subset of the SQL enum');

// State machine.
const fn = /function private\.is_allowed_transition[\s\S]*?\$\$;/.exec(sql)?.[0] ?? '';
const sqlPairs = [...fn.matchAll(/\('([A-Z_]+)',\s*'([A-Z_]+)'\)/g)].map((m) => `${m[1]}>${m[2]}`);
const wf = read('admin/src/domain/workflow.ts');
const table = /export const TRANSITIONS[\s\S]*?\n\};/.exec(wf)?.[0] ?? '';
const tsPairs = [];
for (const m of table.matchAll(/([A-Z_]+):\s*\[([^\]]*)\]/g)) {
  for (const to of m[2].matchAll(/'([A-Z_]+)'/g)) tsPairs.push(`${m[1]}>${to[1]}`);
}
if (sqlPairs.length === 0 || !same(sqlPairs, tsPairs)) {
  errors.push(`TRANSITIONS differ.\n  sql: ${sqlPairs.sort()}\n  admin: ${tsPairs.sort()}`);
}

if (errors.length) {
  console.error('Enum/workflow drift detected:\n- ' + errors.join('\n- '));
  process.exit(1);
}
console.log(`Enums and workflow in sync (${pairs.length} enums, ${sqlPairs.length} transitions).`);
