# Supabase

Database for Gabay ni Juan: schema, Row Level Security, editorial workflow, audit log, fictional seed and database tests. Everything here is plain SQL under version control; a clean project can be rebuilt from this folder alone.

| Path | Contents |
|---|---|
| `config.toml` | Supabase CLI config for the local stack (no secrets) |
| `migrations/` | Ordered SQL migrations. Filenames match the versions recorded in the hosted project |
| `seed.sql` | **Fictional** development data, generated from `mobile/src/data/fixtures/devFixtures.ts` |
| `tests/rls_and_publication.test.sql` | RLS, publication lifecycle, audit and consistency tests (plain SQL, run with `psql`) |

## Migrations

| Version | Name | Contents |
|---|---|---|
| `20261008083503` | `core_schema` | Enums, 14 publishable tables + `claim_evidence`, constraints, indexes. Mirrors `mobile/src/data/schemas/rows.ts` |
| `20261008083527` | `editorial_roles_and_rls` | `editorial_roles`, role helpers in the unexposed `private` schema, RLS policies |
| `20261008083613` | `audit_and_publication_guards` | Append-only `revisions` log, publish gate, published-change guard, unpublish guard |
| `20261008103658` | `publication_lifecycle` | `REJECTED` state, `reviewed_by/reviewed_at/published_by`, tamper-proof editorial identity |
| `20261008103749` | `claim_consistency_checks` | Verification-status vs. evidence rules enforced before publishing |
| `20261008103810` | `restrict_public_access` | Column-level `SELECT` for anon (no editorial identity), anon locked out of audit/role tables, secure default for future tables |
| `20261008132502` | `directory_search` | `search_directory()` for the voter directory (name search, filters, alphabetical offset paging; security invoker) and the indexes it needs |

Never edit an applied migration; add a new one. Change a migration and `mobile/src/data/schemas/rows.ts` in the same commit.

## Local setup

Requires Docker and the [Supabase CLI](https://supabase.com/docs/guides/local-development/cli/getting-started).

```bash
supabase start        # starts a local stack, applies migrations/ and seed.sql
supabase db reset     # drops the local database and rebuilds it from migrations/ + seed.sql
supabase stop
```

`supabase status` prints the local API URL and keys. Use them in `mobile/.env.local` to run the app against the local stack.

### Applying migrations to a hosted project

```bash
supabase link --project-ref <ref>
supabase db push                       # applies pending files in migrations/
```

or use the Supabase MCP server's `apply_migration` tool. Then rename the local file to the version the server recorded (`list_migrations`).

### Directory function

`public.search_directory(p_query, p_election_id, p_office_id, p_office_level, p_participation_status, p_organization_id, p_jurisdiction_id, p_limit, p_offset)` returns `{ total, items[] }` as JSON. It is `SECURITY INVOKER`: Row Level Security and the anon column grants apply exactly as for a direct query, so the public can only ever see published rows. Execute is granted to `anon` and `authenticated` only. The rules it implements (token name search, one-participation-satisfies-all-filters, alphabetical order by code point, which affiliation counts as current) are written in the migration header and mirrored in `mobile/src/data/repositories/inMemoryDirectorySource.ts`; `npm run test:integration` proves they agree.

Indexes added: `offices(level)`, `offices(jurisdiction_id)`, `election_participations(status)` and an expression index on the directory ordering. Foreign-key indexes for participations, affiliations and claim subjects already existed.

### Seed (fictional)

```bash
cd mobile && npm run seed:generate     # regenerate supabase/seed.sql from the app fixtures
cd mobile && npm run seed:check        # fails if seed.sql is out of date (runs in CI)
```

`seed.sql` is idempotent (`on conflict do nothing`, publish steps only touch unpublished rows), so it can be re-run to add new fixtures without touching existing ones. It refuses to run if the database already holds published people that are not fixtures. Published rows cannot be deleted by design, so seeding a hosted project is not undoable except by resetting the database. Use a local stack or a throwaway project.

### Generating TypeScript types

```bash
supabase gen types typescript --local > ../mobile/src/data/supabase/database.types.ts
# or: supabase gen types typescript --project-id <ref>
# or: the Supabase MCP server's generate_typescript_types tool
cd ../mobile && npm run typecheck
```

The generated file keeps its header comment; restore it if the command overwrites it. Types are used **only** in `mobile/src/data/supabase/`. `schemaDrift.ts` fails the typecheck when a table or enum no longer matches the app's Zod contracts.

### Database tests

```bash
psql "postgresql://postgres:postgres@127.0.0.1:54322/postgres" \
  -v ON_ERROR_STOP=1 -f supabase/tests/rls_and_publication.test.sql
```

(`54322` is the local stack's database port.) The script runs in one transaction that is rolled back, creates only `@example.org` users and `RlsTest` rows, and can run on a seeded database. It exits non-zero with `FAILED: <what>` on the first broken rule. CI runs it after `supabase db reset` (`.github/workflows/ci.yml`, job `database`).

It covers: anon sees only `PUBLISHED` rows; anon cannot insert, update or delete anything; anon cannot read editorial identity columns, `revisions` or `editorial_roles`; the publish gate and every verification-status rule; reasons and approvers required to change published data; no deletes of published rows; append-only audit log; reviewer/approver separation; tamper-proof identity columns.

### App integration test (hosted or local)

```bash
cd mobile
EXPO_PUBLIC_SUPABASE_URL=... EXPO_PUBLIC_SUPABASE_ANON_KEY=... npm run test:integration
```

Uses only the public key, checks that the app's repositories return profiles identical in content to the fixtures, and that every write attempt fails. Needs the seed loaded.

## Publication lifecycle

```text
DRAFT -> SOURCE_ATTACHED -> REVIEWED -> APPROVED -> PUBLISHED -> RETRACTED
   any not-yet-published state -> REJECTED   (kept for the audit trail)
```

Publication metadata lives **on each publishable table** (not in a shared publication table): `publication_status`, `published_at`, `created_by`, `reviewed_by`, `reviewed_at`, `approved_by`, `published_by`, `created_at`, `updated_at`. This is the simplest option that stays auditable. The data set is small and uniform, RLS stays a one-column test, public reads need no join, and the `revisions` log already records every transition.

Not enforced yet: an ordered state machine (an approver may jump from `DRAFT` straight to `PUBLISHED`; the jump is visible in `revisions`) and a database-level editor ≠ approver rule. Both are Milestone 3 candidates.

## Access model

| Who | Can |
|---|---|
| anon (voters, app) | `SELECT` **only** non-identity columns of `PUBLISHED` rows; evidence only when both its claim and source are published. Cannot write. Cannot touch `revisions` or `editorial_roles`. A bare `select *` is refused (the app lists columns explicitly) |
| signed-in, no role | same as anon for rows (no drafts); no writes |
| `REVIEWER` | read everything, create and edit records, move records to `SOURCE_ATTACHED`/`REVIEWED`/`REJECTED` |
| `APPROVER` | everything a reviewer can, plus `APPROVED`, `PUBLISHED`, `RETRACTED`, and changes to published rows (with a reason) |
| `ADMIN` | everything an approver can, plus granting and revoking roles |

Nobody deletes rows through the API. Editorial identity columns (`created_by`, `reviewed_by`, `approved_by`, `published_by`) are set by triggers; clients cannot set or change them.

> **Keep public sign-up disabled** and turn on **leaked-password protection** (Auth settings) on the hosted project; the security advisor flags the latter. Column-level hiding of editorial identity applies to `anon` only. A self-registered `authenticated` user without a role sees no extra rows but could read those columns on published rows. `config.toml` disables sign-up locally.

### Bootstrapping the first admin

There is no admin UI yet (Milestone 3). Invite your user in Supabase Auth, then in the SQL editor:

```sql
insert into public.editorial_roles (user_id, role)
select id, 'ADMIN' from auth.users where email = '<your email>';
```

## Audit strategy

Audit entries are **trigger-generated**, not application-generated. Political data should not depend on every client remembering to log. Triggers on every publishable table (and `claim_evidence`) append to `public.revisions`:

`entity_type`, `entity_id`, `old_value` and `new_value` (JSONB row snapshots), `editor_id` (auth user id, or `system:<db role>`), `approver_id`, `reason`, `approval_state`, `created_at`.

`revisions` rejects `UPDATE`, `DELETE` and `TRUNCATE`, is unreadable by anon and staff-readable only. The `reason` comes from the transaction setting `gnj.change_reason`, which is **required** to change a published row:

```sql
begin;
select set_config('gnj.change_reason', 'Corrected end date per <source>', true);
update public.office_terms set end_date = '2025-06-30' where id = '...';
commit;
```

## Verification rules enforced in the database

A claim cannot be published (and the evidence of a published claim cannot be changed into) a state that contradicts its status:

| Status | Requirement |
|---|---|
| `UNVERIFIED` | none |
| `PRIMARY_SOURCE` | a *supporting* source of type official government, court or tribunal, or legislative record |
| `CORROBORATED` | supporting sources from at least two distinct publishers |
| `SELF_DECLARED`, `REPORTED` | at least one supporting source (no source-type rule) |
| `DISPUTED` | at least one supporting **and** one contradicting source |
| `OUTDATED` | at least one supporting source; contradicting sources allowed |
| anything except `DISPUTED`/`OUTDATED` | no contradicting source attached; mark it `DISPUTED` instead |

Nothing is corrected automatically; the write fails with the reason. The same rules run in the app's tests (`mobile/src/domain/validation/verification.ts`).

## Not covered by these tests

- A clean rebuild with `supabase db reset` runs in CI only; it has not been run on a developer machine here.
- Hosted-project settings that are not in SQL: disabling public sign-up, which schemas the API exposes (only `public` and `graphql_public`; `private` must stay hidden).
