# Gabay ni Juan

Gabay ni Juan is a neutral, evidence-first voter information platform for the Philippines.

Its purpose is to help voters understand the documented public record of political figures and election participants without endorsing, ranking, or telling users who to vote for.

## Product principles

1. Every material political claim must be traceable to evidence.
2. Primary sources are preferred over secondary reporting.
3. Allegations, charges, pending cases, dismissals, acquittals, convictions, and final judgments must never be collapsed into one label.
4. The app must separate facts, self-declared positions, reporting, analysis, and unresolved claims.
5. Candidate/election status must be time-aware.
6. Corrections must be visible and auditable.
7. The product must remain politically neutral.
8. No politician score, trust score, endorsement, ranking, or "best candidate" feature.

## Stack

- React Native + TypeScript (strict), Expo SDK 57, Expo Router
- TanStack Query for server state
- Zustand for lightweight local UI state
- Zod for runtime validation
- Supabase: Postgres, Auth for reviewers/admins, Storage where legally appropriate, Edge Functions only when needed
- React Hook Form + Zod resolver, added when the first form ships ("Report an error")
- Jest + React Native Testing Library

See `docs/` and `AGENTS.md` before implementing features.

## What the app does today

- **Home:** search, browse by election and office level, how verification works.
- **Directory:** alphabetical cards, name search, combinable filters (election, office, office level, participation status, organization), pagination. Never ranked.
- **Profile:** header with documented current context, election participation with exact candidacy state, office history and affiliations as timelines, education, policy positions, sources.
- **Evidence:** every attested record links to its claim, supporting and conflicting sources, and the original document.
- All people in this repository are **fictional** development data.

See `docs/ARCHITECTURE.md` for the directory query design, filter model, pagination and the missing-data wording policy.

## Repository layout

| Path | Contents |
|---|---|
| `mobile/` | React Native / Expo app (Android + iOS) |
| `supabase/` | Database migrations, RLS, audit triggers, fictional seed (see `supabase/README.md`) |
| `docs/` | Product, data model, governance, and architecture decisions |
| `.github/workflows/` | CI: mobile (typecheck, lint, tests, verification consistency, seed check, expo-doctor) and database (migrations, seed, RLS tests) |

The original native Android (Kotlin/Compose) prototype is archived on the `archive/android-native` branch. It is a historical reference and is not part of this branch.

## Development setup

### Requirements

- Node.js 20.19.4+, 22.13+, or 24.3+ (`.nvmrc` pins 24). npm comes with Node.
- To run on a device: the **Expo Go** app (Android/iOS), or
- Android Studio with an emulator for `npm run android`, and/or
- Xcode with an iOS Simulator on macOS for `npm run ios`.

### Install and run

```bash
cd mobile
npm install
cp .env.example .env.local   # optional; defaults to fictional mock data
npm start                    # Expo dev server; scan the QR code with Expo Go
npm run android              # open on an Android emulator/device
npm run ios                  # open on the iOS Simulator (macOS only)
```

### Environment

Configuration is read from `EXPO_PUBLIC_*` variables in `mobile/.env.local`, which is git-ignored. See `mobile/.env.example`.

| Variable | Purpose |
|---|---|
| `EXPO_PUBLIC_DATA_SOURCE` | `mock` (default, fictional fixtures) or `supabase` |
| `EXPO_PUBLIC_SUPABASE_URL` | Supabase project URL (required for `supabase`) |
| `EXPO_PUBLIC_SUPABASE_ANON_KEY` | Anon / publishable key only (required for `supabase`) |

`EXPO_PUBLIC_*` values are bundled into the app and are public. **Never** put the Supabase service-role key or any `sb_secret_` key in the app. The app refuses to start if it detects one.

### Switching between mock data and Supabase

Only the environment changes; no code does.

```bash
# fictional in-memory fixtures (default)
EXPO_PUBLIC_DATA_SOURCE=mock

# Supabase (hosted project, or the local stack from `supabase start`)
EXPO_PUBLIC_DATA_SOURCE=supabase
EXPO_PUBLIC_SUPABASE_URL=https://<ref>.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=<anon or sb_publishable_ key>
```

Restart Metro (`npm start -- --clear`) after editing `.env.local`. In both modes the same repositories validate every row with Zod and map it to domain models. The Supabase database must contain the migrations in `supabase/migrations`, and the fictional seed (`supabase/seed.sql`) if you want the demo profiles.

### Supabase (database)

Full guide: [`supabase/README.md`](supabase/README.md).

```bash
supabase start && supabase db reset        # local stack: migrations + fictional seed (needs Docker + Supabase CLI)
cd mobile && npm run seed:generate         # regenerate supabase/seed.sql (idempotent) from the app fixtures
supabase gen types typescript --local > mobile/src/data/supabase/database.types.ts   # then npm run typecheck
psql "postgresql://postgres:postgres@127.0.0.1:54322/postgres" -v ON_ERROR_STOP=1 \
  -f supabase/tests/rls_and_publication.test.sql                                       # RLS / publication / audit tests
cd mobile && npm run test:integration      # mock vs. a real project through the anon key: profiles, directory queries, RLS
```

**Publication and RLS model in one paragraph.** Every record has a `publication_status`. Anonymous users (the app) can read only `PUBLISHED` rows, only non-identity columns, and cannot write. Reviewers draft, approvers publish, every change lands in the append-only `revisions` log, and a claim cannot be published unless its evidence matches its verification status.

### Quality checks

```bash
cd mobile
npm run typecheck          # tsc --noEmit (strict); also checks the database types against the Zod contracts
npm run lint               # ESLint (expo config) + Prettier check
npm test                   # Jest + React Native Testing Library (mock data; no network)
npm run test:consistency   # verification status vs. evidence rules over the fixtures
npm run seed:check         # supabase/seed.sql is exactly what the fixtures generate
npm run verify             # typecheck + lint + test
npm run lint:fix           # auto-fix lint and formatting
```
