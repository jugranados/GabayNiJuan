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

## Milestone 1 — Data trust foundation (in progress)

- [x] create Supabase project
- [x] implement schema (`supabase/migrations/*_core_schema.sql`)
  - [x] tables matching the row contracts in `mobile/src/data/schemas/rows.ts`
  - [x] publication workflow fields (`publication_status`, `published_at`, `created_by`, `approved_by`, timestamps)
  - [x] `revisions` audit table, filled by triggers and append-only
- [x] implement RLS (anon reads `PUBLISHED` only and cannot write; REVIEWER < APPROVER < ADMIN)
- [x] database-enforced publish gate, published-change guard (approver + reason), unpublish guard
- [x] generate Supabase types for the data layer only; compile-time drift check (`schemaDrift.ts`)
- [x] fictional seed generated from the app fixtures (`supabase/seed.sql`), tested in a rolled-back transaction, not applied to the project
- [ ] seed a dev database (local stack or Supabase branch) and run the app with `EXPO_PUBLIC_DATA_SOURCE=supabase`
- [ ] source viewer screen per claim (`/claims/[id]`)
- [ ] run verification consistency checks against seed data in CI
- [ ] decide whether published rows should expose `created_by`/`approved_by` user ids to anon (column-level grants or a public view)

Exit criteria:
- every displayed fixture claim can open evidence metadata
- UI never consumes raw database rows directly
- the app runs with `EXPO_PUBLIC_DATA_SOURCE=supabase` against a dev database

## Milestone 2 — Politician directory MVP

- person list
- search
- filters
- profile
- election participation
- office history
- affiliations
- source viewer

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
