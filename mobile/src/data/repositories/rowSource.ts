/**
 * Minimal read-only access to backend tables. Both the in-memory fixture
 * source and the Supabase source implement this, so the repositories (and
 * their validation + mapping) are identical regardless of backend.
 *
 * Rows come back as `unknown` on purpose: nothing may use them before Zod
 * validation.
 *
 * Only public tables are listed. The audit log (`revisions`) and
 * `editorial_roles` are never read by the voter app.
 */

export const TABLES = [
  'people',
  'elections',
  'offices',
  'election_participations',
  'office_terms',
  'political_organizations',
  'affiliation_records',
  'education_records',
  'award_records',
  'policy_position_records',
  'legal_case_records',
  'asset_disclosure_records',
  'sources',
  'claims',
  'claim_evidence',
] as const;
export type TableName = (typeof TABLES)[number];

export type RowQuery = {
  /** Column equals value. */
  eq?: Readonly<Record<string, string>>;
  /** Column is one of the values. */
  in?: { column: string; values: readonly string[] };
};

export interface RowSource {
  select(table: TableName, query?: RowQuery): Promise<unknown[]>;
  /** Case-insensitive substring match on any of the given text columns. */
  search(table: TableName, columns: readonly string[], term: string): Promise<unknown[]>;
}
