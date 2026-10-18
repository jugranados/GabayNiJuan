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
- [x] apply the pending migrations to the hosted project (done 2026-10-16)
- [x] first green CI run, including the `database` job (see "Verification and first deployment")
- [x] regenerate `web/src/data/supabase/database.types.ts` (done 2026-10-16 from hosted)
- [ ] run `web/` with `DATA_SOURCE=supabase` in a browser: phone, tablet, desktop; keyboard only; a screen reader pass
- [ ] exercise `/admin` end to end with real accounts: signed out, no role, REVIEWER, APPROVER, ADMIN; create → sources → review → approve (second person) → publish → correct with a reason → retract; evidence; a correction request from the public form through to resolved; role changes
- [x] hosted sign-up disabled, anonymous sign-ins disabled, exposed schemas checked (2026-10-16); leaked-password protection deferred (plan); MFA open (tracked under "Verification and first deployment")
- [ ] deploy to Vercel with `SITE_INDEXABLE=false`

Then:
- [ ] archive `mobile/` to `archive/mobile-react-native/` once the web integration test is green; remove its CI job and the mobile half of the drift check; drop the Expo notes

Deferred, deliberately (reasons in `docs/WEB_MIGRATION.md`, "Deferred"):
- ~~readable filter URLs for elections, offices and organizations, and `/elections` pages~~: done in Milestone 5
- photos: placeholder until the real-data pilot
- a `person_slug_redirects` table (only needed if a published slug must change)
- CAPTCHA or edge rate limiting for the report form
- legal-case and asset-disclosure editors (Milestone 4)

## Milestone 4 — Sensitive public records

Only after workflow is stable:

- legal proceeding timelines
- asset/public disclosure history
- richer legislative records

## Verification and first deployment (in progress, started 2026-10-12; hosted rollout done 2026-10-16)

No new voter-facing features. The purpose is to prove the web app against the real backend,
deploy it non-indexed, and only then archive `mobile/`. Procedure, evidence and tick boxes:
`docs/VERIFICATION_CHECKLIST.md`. Status as of 2026-10-16:

### AUTOMATED VERIFIED

- [x] CI green on all four jobs (web, mobile, drift, database) for `51e4586` (Milestone 5): clean `supabase start` and `db reset`, all 16 migrations, seed, SQL/RLS tests, seed idempotence, anon directory queries, web integration test against the local stack
- [x] all 16 migrations applied to the hosted project with `supabase db push`; history equals the files
- [x] Milestone 5 backfill on hosted (5 election offices, audited) and the fictional seed re-run (`db push --include-seed`): hosted data equals a fresh seed, including the fictional 2028 structure
- [x] `database.types.ts` regenerated from hosted; no hand-made exception remains
- [x] `npm run verify` (329 tests), `npm run test:integration` against hosted (50 of 50), `npm run build` against hosted
- [x] Milestone 5 against hosted: election and office slug lookup, election → offices, office → participants, the eight statuses kept distinct, readable filters, 308 redirects from UUID URLs, canonical URLs
- [x] `npm run smoke` against a production build reading hosted: 43 of 43 (2026-10-19), including election routes, UUID → slug redirects and indexing protection
- [x] hosted auth: sign-up disabled, anonymous sign-ins disabled, only the email provider; exposed schemas `public` and `graphql_public` only
- [x] earlier: the repository copy of `editorial_rpcs_records` restored; the `grant_editorial_table_helpers` defect fixed

### DEFERRED

- leaked-password protection: Pro plan and above; unavailable on the Free plan (owner to confirm the plan). Compensating controls in `docs/VERIFICATION_CHECKLIST.md`, step 3

### MANUAL CHECK REQUIRED

- [ ] create REVIEWER, APPROVER and ADMIN accounts (step 4)
- [ ] editorial acceptance: reviewer, approver, admin, election records, correction request, published edit, retraction (step 5)
- [ ] deploy to Vercel with `SITE_INDEXABLE=false`; set the Supabase Site URL (step 6)
- [ ] MFA: not enforced (no MFA screen in the app). Required before real political data; does not block the fictional deployment

### BLOCKED (each waits for the item named)

- [ ] deployed smoke test and browser/keyboard pass: needs the deployment (step 7)
- [ ] archive `mobile/`, remove its CI job and the mobile half of the drift check: needs every item above (step 8)

## Milestone 5 — Election Information Foundation (implemented 2026-10-16; on hosted 2026-10-16)

Structure for elections, not claims about them. Model and rules: `docs/ELECTION_INFORMATION_MODEL.md`.

- [x] `/elections`, `/elections/[slug]`, `/elections/[slug]/[office]`; Elections in the main navigation; home links to election pages
- [x] stable slugs for elections, offices and organizations (generate-and-freeze, like people; UUIDs stay the identity); organizations justified by readable filter URLs only
- [x] `election_offices`: an office contested in an election, publishable under the full workflow; participations must belong to one (composite foreign key)
- [x] human-readable directory filters; legacy UUID links redirect permanently; canonical URLs always use slugs
- [x] participation shown with its exact state, grouped by state on office pages; only `OFFICIAL_CANDIDATE` is called an official candidate
- [x] each status is its own evidence-backed record; published status frozen in the database; succession checked in the editorial area
- [x] election date/status consistency (database and editorial form)
- [x] election source hierarchy (`docs/SOURCE_POLICY.md`)
- [x] SEO metadata, sitemap entries, `Event` / `BreadcrumbList` structured data
- [x] fictional 2028 structure (6 offices, 2 deliberately empty); no real data imported
- [x] tests: 59 new web tests (pages, filters, canonical URLs, labels, repositories, domain rules, editorial forms and actions), ~40 new SQL checks, integration equality for election pages, smoke test covers election routes

Open items:
- [x] both migrations applied to hosted, seed re-run, `database.types.ts` regenerated (2026-10-16)
- [x] CI green with the new migrations and integration checks (run 38922164879); hosted integration test 50 of 50
- [ ] election editorial acceptance with real accounts (`docs/VERIFICATION_CHECKLIST.md`, step 5, "Election records")
- [ ] election and office metadata linked to sources (today only participations carry claims)

Deferred:
- ballot information and results; candidate status transitions beyond the succession check
- slug redirect table (only needed if a published slug must change)
- resolving filter slugs with a single lookup instead of the full option lists (needed at national data volume)

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
