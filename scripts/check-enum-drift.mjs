#!/usr/bin/env node
// Fails when the TypeScript domain rules and the database disagree:
//   - every shared enum in web/src/domain/enums must equal its Postgres enum,
//   - the editorial transition table must equal private.is_allowed_transition(),
//   - while the frozen mobile app still exists, its copy of the voter enums must match too.
// web/ is the single authoritative TypeScript implementation.
import { existsSync, readFileSync, readdirSync } from 'node:fs';
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
const web = read('web/src/domain/enums/index.ts');
const MOBILE_ENUMS = 'mobile/src/domain/enums/index.ts';
const mobile = existsSync(join(root, MOBILE_ENUMS)) ? read(MOBILE_ENUMS) : undefined;

// [TypeScript name, Postgres enum, also present in the frozen mobile app]
const pairs = [
  ['PUBLICATION_STATUSES', 'publication_status', true],
  ['VERIFICATION_STATUSES', 'verification_status', true],
  ['SOURCE_TYPES', 'source_type', true],
  ['ELECTION_STATUSES', 'election_status', true],
  ['OFFICE_LEVELS', 'office_level', true],
  ['ELECTION_PARTICIPATION_STATUSES', 'election_participation_status', true],
  ['OFFICE_TERM_STATUSES', 'office_term_status', true],
  ['POLITICAL_ORGANIZATION_TYPES', 'political_organization_type', true],
  ['AFFILIATION_TYPES', 'affiliation_type', true],
  ['POLICY_ATTRIBUTION_TYPES', 'policy_attribution_type', true],
  ['LEGAL_CASE_STATUSES', 'legal_case_status', true],
  ['CLAIM_SUBJECT_RECORD_TYPES', 'claim_subject_record_type', true],
  // Audit-log entity types are editorial only; the frozen mobile app never reads revisions, so its
  // copy is not compared (it predates ELECTION_OFFICE, added in Milestone 5).
  ['REVISION_ENTITY_TYPES', 'revision_entity_type', false],
  ['CORRECTION_STATUSES', 'correction_status', false],
  ['EDITORIAL_ROLES', 'editorial_role', false],
];
for (const [tsName, sqlName, inMobile] of pairs) {
  const w = tsList(web, tsName);
  const d = sqlEnum(sqlName);
  if (!w || !d) errors.push(`missing ${tsName} (web) or ${sqlName} (sql)`);
  else if (!same(w, d)) errors.push(`${tsName}: web ${w} != sql ${d}`);
  if (inMobile && mobile) {
    const m = tsList(mobile, tsName);
    if (!m) errors.push(`${tsName} missing in mobile`);
    else if (w && !same(w, m)) errors.push(`${tsName}: web ${w} != mobile ${m}`);
  }
}

// The report form offers a subset of the database's correction targets.
const targets = tsList(read('web/src/domain/models/correction.ts'), 'CORRECTION_TARGET_TYPES');
const targetsSql = sqlEnum('correction_target_type');
if (!targets || !targetsSql || !same(targets, targetsSql)) errors.push('CORRECTION_TARGET_TYPES differs from the SQL enum');

// Editors can attach claims to a subset of the database's subject record types.
const subj = tsList(web, 'EDITABLE_CLAIM_SUBJECT_RECORD_TYPES');
const subjSql = sqlEnum('claim_subject_record_type');
if (!subj || !subjSql || !subj.every((v) => subjSql.includes(v))) {
  errors.push('EDITABLE_CLAIM_SUBJECT_RECORD_TYPES is not a subset of the SQL enum');
}

// State machine.
const fn = /function private\.is_allowed_transition[\s\S]*?\$\$;/.exec(sql)?.[0] ?? '';
const sqlPairs = [...fn.matchAll(/\('([A-Z_]+)',\s*'([A-Z_]+)'\)/g)].map((m) => `${m[1]}>${m[2]}`);
const wf = read('web/src/domain/editorial/workflow.ts');
const table = /export const TRANSITIONS[\s\S]*?\n\};/.exec(wf)?.[0] ?? '';
const tsPairs = [];
for (const m of table.matchAll(/([A-Z_]+):\s*\[([^\]]*)\]/g)) {
  for (const to of m[2].matchAll(/'([A-Z_]+)'/g)) tsPairs.push(`${m[1]}>${to[1]}`);
}
if (sqlPairs.length === 0 || !same(sqlPairs, tsPairs)) {
  errors.push(`TRANSITIONS differ.\n  sql: ${sqlPairs.sort()}\n  web: ${tsPairs.sort()}`);
}

// Correction request lifecycle (review_correction).
const reviewFn = /function public\.review_correction[\s\S]*?\$\$;/.exec(sql)?.[0] ?? '';
const reviewSql = [...reviewFn.matchAll(/\('([A-Z_]+)',\s*'([A-Z_]+)'\)/g)].map((m) => `${m[1]}>${m[2]}`);
const reviewTable = /export const CORRECTION_TRANSITIONS[\s\S]*?\n\};/.exec(read('web/src/domain/editorial/correctionReview.ts'))?.[0] ?? '';
const reviewTs = [];
for (const m of reviewTable.matchAll(/([A-Z_]+):\s*\[([^\]]*)\]/g)) {
  for (const to of m[2].matchAll(/'([A-Z_]+)'/g)) reviewTs.push(`${m[1]}>${to[1]}`);
}
if (reviewSql.length === 0 || !same(reviewSql, reviewTs)) {
  errors.push(`CORRECTION_TRANSITIONS differ.\n  sql: ${reviewSql.sort()}\n  web: ${reviewTs.sort()}`);
}

if (errors.length) {
  console.error('Enum/workflow drift detected:\n- ' + errors.join('\n- '));
  process.exit(1);
}
console.log(
  `Enums and workflows in sync (${pairs.length} enums, ${sqlPairs.length} record transitions, ${reviewSql.length} correction transitions${mobile ? ', mobile copy checked' : ''}).`,
);
