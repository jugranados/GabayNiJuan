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
- [ ] "Report an error" entry point (MVP screen 9) is not built; it belongs with the correction workflow in Milestone 3

Deferred, deliberately:
- location filter and a structured `Jurisdiction` model (see `docs/ARCHITECTURE.md`)
- accent-insensitive name search and typo tolerance (`unaccent` / `pg_trgm`)
- cursor (keyset) pagination
- photo storage and resolution (`photo_asset_id` is stored but no bucket exists yet)
- office filter as a typeahead (the option list is fine for the fictional set, not for thousands of offices)

## Milestone 3 — Editorial workflow

- reviewer authentication
- draft/publish workflow
- revision history
- correction submissions
- admin/reviewer tooling

## Milestone 4 — Sensitive public records

Only after workflow is stable:

- legal proceeding timelines
- asset/public disclosure history
- richer legislative records

## Milestone 5 — 2028 election mode

- candidate status transitions
- election/office pages
- official candidate records
- ballot information where officially available
- election-result integration when appropriate

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
- public web version
- analytics
- CDN/read caching
