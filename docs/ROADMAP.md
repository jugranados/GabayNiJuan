# Roadmap

## Milestone 0 — Reset architecture ✅ (implemented 2026-10-07)

- [x] preserve native Android prototype branch (`origin/develop`, untouched)
- [x] bootstrap React Native + Expo + TypeScript project (`mobile/`, Expo SDK 57)
- [x] configure lint/format/test (ESLint + Prettier + Jest + RNTL)
- [x] configure environment variables (`.env.example`, validated config, service-role key guard)
- [x] add Supabase client (public, session-less; Supabase RowSource)
- [x] create feature folder structure
- [x] establish CI (`.github/workflows/mobile-ci.yml`)
- [x] domain models, Zod row schemas, mappers, repository interfaces
- [x] fictional in-memory fixtures served through the same validation pipeline
- [x] app shell: Home, Politicians, Politician Detail, About / Data Verification
- [x] `VerificationBadge` with an explanation for each state

Exit criteria:
- [x] Android and iOS bundles build (`expo export` for both platforms; `expo-doctor` clean)
- [ ] Android and iOS run on an emulator/simulator: needs a manual check on a machine with Android Studio/Xcode, or Expo Go
- [x] automated type-check/test command exists (`npm run verify`)
- [x] no political data is hard-coded in UI (UI reads repositories; fixtures are fictional)

## Milestone 1 — Data trust foundation ✅ (implemented 2026-10-08)

- [x] Supabase schema under version control (`supabase/migrations`, `config.toml`)
- [x] publication lifecycle on every publishable table (`DRAFT` … `PUBLISHED`, `REJECTED`, `RETRACTED`; created/reviewed/approved/published identity)
- [x] RLS on every table; anon reads only `PUBLISHED` rows and only non-identity columns, and cannot write
- [x] append-only `revisions` audit log, trigger-generated, JSONB snapshots
- [x] verification-consistency rules enforced in the database and in the app; CI runs them
- [x] fictional seed generated from the app fixtures (`supabase/seed.sql`) and loaded into the dev project
- [x] generated Supabase types (data layer only) with a compile-time drift check
- [x] `EXPO_PUBLIC_DATA_SOURCE=supabase` verified against the dev project: repositories return content identical to the fixtures
- [x] claim detail / source viewer (`/claims/[id]`)
- [x] CI: typecheck, lint, tests, consistency, seed check, plus a database job (migrations, seed, RLS tests)

Open items carried forward:
- [ ] run `supabase db reset` and `supabase/tests/rls_and_publication.test.sql` on a machine with Docker (CI job `database` is written but has not run yet)
- [ ] run the app on an Android emulator / iOS simulator against Supabase
- [ ] disable public sign-up on the hosted project (dashboard setting, not in SQL)
- [ ] column-level hiding of editorial identity currently applies to `anon` only (see `supabase/README.md`)

Exit criteria:
- [x] every displayed fixture claim can open evidence metadata
- [x] UI never consumes raw database rows directly
- [x] the app loads from a Supabase dev project with `EXPO_PUBLIC_DATA_SOURCE=supabase`

## Milestone 2 — Politician directory MVP (implemented 2026-10-09; device check and first CI run pending)

- [x] Home: search, browse by election and office level, how verification works, neutrality statement
- [x] directory of reusable `PoliticianCard`s, alphabetical only
- [x] name search: trimmed, debounced, two-character minimum, clear control, preserved when returning from a profile
- [x] filters: election, office, office level, participation status, political organization (combinable, removable chips, "Clear all")
- [x] one directory query (`searchDirectory`) shared by the mock and Supabase backends; Supabase filters, orders and pages in the database (`search_directory`)
- [x] offset pagination with a total count
- [x] profile hierarchy: header, election participation, public office history, political affiliations, education, policy positions, sources
- [x] reverse-chronological timelines for office history and affiliations
- [x] election participation shown with its exact state; aspirant states never labelled "candidate"
- [x] one neutral missing-data sentence; never a negative finding
- [x] evidence reachable from every attested record: record → claim → source viewer → original source
- [x] image component with placeholder, loading and failure fallback
- [x] offline / validation / backend error states with retry
- [x] fictional fixtures expanded to 10 people covering all 8 participation states, all 6 office levels and 4 organizations
- [x] mock and Supabase directory results proven identical by `npm run test:integration`

Open items before this is called finished:
- [ ] run the app on an Android emulator / iOS simulator and a physical device (checklist in the Milestone 2 hand-off)
- [ ] first green CI run, including the `database` job (`supabase db reset`, SQL tests, idempotent seed)
- [x] "Report an error" entry point (built in Milestone 3)

Deferred, deliberately:
- location filter and a structured `Jurisdiction` model (see `docs/ARCHITECTURE.md`)
- accent-insensitive name search and typo tolerance (`unaccent` / `pg_trgm`)
- cursor (keyset) pagination
- photo storage and resolution (`photo_asset_id` is stored but no bucket exists yet)
- office filter as a typeahead (the option list is fine for the fictional set, not for thousands of offices)

## Milestone 3 — Editorial & correction workflow (implemented 2026-10-09; database migrations partly unrun, see below)

- [x] separate `admin/` web app (Vite, React, TypeScript, TanStack Query, React Hook Form, Zod) using Supabase Auth with the public key only
- [x] roles REVIEWER / APPROVER / ADMIN, enforced by PostgreSQL; role-aware UI
- [x] dashboard, work queue (status / type / creator / date), editors for people, election participation, office terms, affiliations, education, policy positions, sources, claims, elections, offices, organizations
- [x] evidence editor with verification readiness (database verdict from `claim_readiness`)
- [x] ordered state machine, two-person rule (with documented dev exception), frozen review content
- [x] mandatory change reasons through RPCs; retraction without deletion
- [x] revision viewer with field-level diff
- [x] optimistic concurrency (`version`)
- [x] "Report an error" in the mobile app (person profile, claim detail) via `submit_correction`; private `correction_requests`; editorial correction queue
- [x] admin role management with last-admin protection and an append-only role log
- [x] CI: admin typecheck/lint/tests/build, enum drift, database job extended
- [x] storage deferred and documented; shared package deferred and documented (`docs/EDITORIAL_WORKFLOW.md`)

Open items before this is called finished:
- [ ] run the **unapplied** migrations on the hosted project: `20261008150050_editorial_evidence_and_queue.sql`, `20261008150100_corrections_and_staff.sql` (first three Milestone 3 migrations are applied)
- [ ] run `supabase/tests/rls_and_publication.test.sql` in full against a database with all migrations (never run as one script) and a first green CI run including `supabase db reset`
- [ ] exercise the editorial area end to end against a real editor account (carried into the consolidation milestone)
- [ ] regenerate `mobile/src/data/supabase/database.types.ts` after the migrations are applied
- [ ] enable MFA for editorial accounts before real data
- [ ] carried forward: Android and iOS runs against Supabase; confirm hosted public sign-up is disabled and leaked-password protection is on

## Web migration — web-first platform (implemented 2026-10-12; database and browser checks pending)

Intentional platform change: the Next.js app in `web/` is now the primary product (`docs/WEB_MIGRATION.md`).

- [x] `web/` Next.js 16 App Router app, TypeScript strict, Tailwind
- [x] domain, validation, mappers, repositories, wording and fixtures moved to `web/src` with their tests
- [x] stable person slugs: migration `20261012070000_person_slugs`, `search_directory` returns `slug`
- [x] public routes: `/`, `/politicians`, `/politicians/[slug]`, `/claims/[id]`, `/verification`, `/methodology`, `/corrections/report`
- [x] directory state in the URL (search, five filters, page); alphabetical only
- [x] server-rendered public pages; client components only for forms and the error boundary
- [x] metadata, canonical URLs, Open Graph, `robots.txt`, `sitemap.xml`; indexing off by default
- [x] `/admin` boundary: Supabase Auth sign-in, role loading, unauthorized state, never indexed or cached
- [x] seed generation and fixtures owned by `web/`; drift check covers web
- [x] CI: web job (typecheck, lint, tests, seed check, build, bundle key scan)
- [x] documentation and `AGENTS.md` updated

Open items: carried into the consolidation milestone below.

## Web consolidation and editorial workflow (implemented 2026-10-12; database verification pending)

One active frontend, one database, one set of domain rules.

- [x] editorial workflow ported from `admin/` into `web/src/app/admin`: dashboard, work queue, editors for 11 record types, evidence and verification readiness, publication workflow (reasons, retraction, optimistic concurrency), revision history, correction queue, role management
- [x] editorial requests run on the server as the signed-in editor (anon key + session cookie); no service-role key; access checked in the proxy, the layout, and every page and action
- [x] enums, roles, transition table, correction lifecycle, record definitions, readiness checklist and wording guard exist once, in `web/src/domain`; drift check compares them with the SQL
- [x] standalone `admin/` removed (git history keeps it); its domain, component and guard tests have web equivalents
- [x] real-database integration test ported from `mobile/` to `web/` (`npm run test:integration`) and added to CI's `database` job
- [x] on-demand revalidation of public pages on publish, retract and published-content changes; no purge endpoint
- [x] sitemap includes claim pages whose evidence stands; unverified, disputed and outdated claim pages are `noindex`
- [x] report form: honeypot, minimum fill time, per-address cooldown, server-side validation
- [x] web parity checklist documented (`docs/WEB_MIGRATION.md`)
- [x] CI: web, frozen mobile, drift, database (+ web integration test); admin job removed

Open items before this is called finished:
- [ ] apply the pending migrations to the hosted project (now four; tracked under "Verification and first deployment")
- [x] first green CI run, including the `database` job (see "Verification and first deployment")
- [ ] regenerate `web/src/data/supabase/database.types.ts` (it carries a hand-added `people.slug` and predates the Milestone 3 functions)
- [ ] run `web/` with `DATA_SOURCE=supabase` in a browser: phone, tablet, desktop; keyboard only; a screen reader pass
- [ ] exercise `/admin` end to end with real accounts: signed out, no role, REVIEWER, APPROVER, ADMIN; create → sources → review → approve (second person) → publish → correct with a reason → retract; evidence; a correction request from the public form through to resolved; role changes
- [ ] hosted project settings, **not verified**: public sign-up disabled; leaked-password protection enabled; MFA for editorial accounts (not set up)
- [ ] deploy to Vercel with `SITE_INDEXABLE=false`

Then:
- [ ] archive `mobile/` to `archive/mobile-react-native/` once the web integration test is green; remove its CI job and the mobile half of the drift check; drop the Expo notes

Deferred, deliberately (reasons in `docs/WEB_MIGRATION.md`, "Deferred"):
- readable filter URLs for elections, offices and organizations, and `/elections` pages (Milestone 5)
- photos: placeholder until the real-data pilot
- a `person_slug_redirects` table (only needed if a published slug must change)
- CAPTCHA or edge rate limiting for the report form
- legal-case and asset-disclosure editors (Milestone 4)

## Milestone 4 — Sensitive public records

Only after workflow is stable:

- legal proceeding timelines
- asset/public disclosure history
- richer legislative records

## Verification and first deployment (in progress, started 2026-10-12)

No new voter-facing features. The purpose is to prove the consolidated web app against the real
backend, then deploy it non-indexed and archive `mobile/`. A gate is ticked only when it was
actually observed.

- [x] indexing policy that cannot be forgotten: one server-side switch; while off, a `noindex` header on every response, `noindex` metadata, `robots.txt` disallowing everything, empty sitemap (verified on a production build)
- [x] all work committed and pushed so CI runs
- [x] every applied migration file compared with the statement recorded in the hosted history: all ten are identical apart from comments. One file (`editorial_rpcs_records`) had lost a closing `$$;` in the repository copy and could not run on a clean database; it was restored to what hosted actually ran
- [x] defect found by the first full database test run and fixed in a new migration (`20261012090000_grant_editorial_table_helpers`): staff could not execute two helpers that `editorial_update` and `editorial_transition` call, so **every save and workflow transition was refused for every editor**, on hosted as well
- [ ] pending migrations applied to the hosted project. **10 of 14 applied.** Pending, in order: `20261008150050_editorial_evidence_and_queue`, `20261008150100_corrections_and_staff`, `20261012070000_person_slugs`, `20261012090000_grant_editorial_table_helpers`. Use `supabase db push` so the recorded versions equal the file names
- [ ] `database.types.ts` regenerated from the hosted schema; typecheck, lint, tests, build
- [x] clean `supabase start` and `supabase db reset` from `supabase/migrations` + `seed.sql`, the complete SQL test script (RLS, publication, verification consistency, editorial RPCs, corrections, roles, slugs), seed idempotency, and the web integration test against that database: green in CI's `database` job (commit `cf4521b`). Not run on the development machine (no Docker)
- [ ] `npm run test:integration` green against the **hosted** project (green against CI's local stack; hosted needs the pending migrations first)
- [x] CI green on all four jobs (first fully green run of this repository)
- [ ] editorial accounts for REVIEWER, APPROVER and ADMIN exist; manual pass of each role (create fictional person, related record, source, claim, evidence, submit; reviewer cannot publish or grant roles; approver approves another person's work, publishes, corrects with a reason, retracts; invalid evidence blocks publication; admin manages roles, last-admin protection)
- [ ] correction flow: public report → private queue → reviewed; accepting changes no public data
- [ ] published-change test with one fictional record: publish → visible → correct with reason → visible → both values in revision history → retract → gone
- [ ] browser pass of the public site: phone, tablet and desktop widths; keyboard and focus; 404 and error states
- [ ] deployed to Vercel with `SITE_INDEXABLE=false` (steps in `docs/WEB_MIGRATION.md`, "Deployment")
- [ ] deployed smoke test: directory, profile, claim, source links, report submission, admin sign-in and authorization, publish appears, retraction disappears, `X-Robots-Tag: noindex` present
- [ ] only then: archive `mobile/`, remove its CI job and the mobile half of the drift check
- [ ] hosted settings confirmed: public sign-up disabled, leaked-password protection on, MFA for editorial accounts

## Milestone 5 — Election Information Foundation

Not started. Structure for elections, not claims about them.

- `/elections` and `/elections/[slug]`
- readable slugs for elections and offices, and for organizations where justified (same generate-and-freeze rule as people; UUIDs stay the identity)
- human-readable directory filters (`?election=…&office=…`), with existing UUID links still working
- the 2028 election structure: election → offices → participants navigation
- participation shown with its exact state; aspirant states are never called candidacies
- no official 2028 candidate claim without authoritative evidence (COMELEC or equivalent primary record); until then the structure is filled only with what is documented
- later in this area: candidate status transitions, ballot information where officially available, election results when appropriate

## Phase 2

- family relationship graph
- political-family visualization
- party switching timeline
- legislative vote/action history
- side-by-side neutral comparison

## Future scaling

Only when usage justifies it:
- ingestion workers
- source archiving
- full-text search service
- analytics
- CDN/read caching
