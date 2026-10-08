# Architecture

## Decision

Use React Native + TypeScript + Expo.

## Why

- one codebase for Android and iOS
- good fit for the team's existing React Native experience
- lower setup friction for AI-assisted development
- Expo simplifies builds, updates, routing, assets, and platform configuration
- modern React Native defaults to TypeScript
- supports the New Architecture

## Recommended client stack

### Core
- React Native
- TypeScript (strict)
- Expo
- Expo Router

### Data
- `@supabase/supabase-js`
- TanStack Query for server state
- Zod for runtime validation

### Local state
- Zustand only for lightweight local/UI state
- avoid duplicating server data in Zustand

### Forms
- React Hook Form
- Zod resolver

### Testing
- Jest
- React Native Testing Library
- domain/model unit tests
- mapper/validation tests

## Backend

### Recommended initial backend: Supabase

Use:
- Postgres
- Row Level Security
- Auth for internal reviewers/admins
- Storage where appropriate
- Edge Functions only for server-only operations

Why Postgres fits this product:

Political data is relational and historical. A person can have many:
- election participations
- office terms
- affiliations
- sources
- claims
- case records
- disclosures
- relationships

Relational constraints and joins are useful here.

## Client architecture

The app lives in `mobile/` (Expo SDK 57, React Native 0.86, New Architecture). Keeping it in its own directory leaves room beside it for `supabase/` migrations and a possible admin web app, without nesting another repository.

Feature-first organization (implemented in Milestone 0):

```text
mobile/src/
  app/                 Expo Router routes ONLY (every file is a screen)
    _layout.tsx        composition root: config -> repositories -> providers
    index.tsx          Home
    politicians/       list + [id] detail
    claims/[id].tsx    claim detail / source viewer
    about.tsx          About / data verification
  components/          generic UI primitives (no domain knowledge beyond errors)
  features/
    politicians/       query hooks, profile view, directory UI state (Zustand)
    elections/         candidacy-status wording
    offices/           office-term wording
    affiliations/      affiliation wording
    sources/           VerificationBadge, ClaimCard, ClaimDetailView (source viewer), SourceItem, verification copy
    legal-cases/       reserved (Milestone 4)
    disclosures/       reserved (Milestone 4)
  domain/
    enums/             readonly tuples -> unions (shared with Zod)
    models/            domain types + PersonProfile read model
    repositories/      repository interfaces
    validation/        Zod primitives, error types, verification consistency checks
  data/
    schemas/           Zod schemas for raw backend rows (snake_case) + parse helpers
    mappers/           row -> domain mappers, profile assembler
    repositories/      RowSource abstraction, repository implementations, composition
    supabase/          public Supabase client, Supabase RowSource, explicit public column list,
                       generated database types (data layer only) + compile-time drift check
    fixtures/          FICTIONAL development data, in raw row shape
  shared/
    config/            validated env config
    hooks/             repositories React context
    utils/             date formatting
```

Tests are colocated in `__tests__/` folders outside `src/app/`, because every file in `src/app/` is treated as a route.

## Data flow

```text
RowSource (in-memory fixtures | Supabase)   -> unknown[]
   ↓
Zod row schema (data/schemas)               -> throws DataValidationError
   ↓
Mapper (data/mappers)                       -> domain model
   ↓
Repository (data/repositories)              -> implements domain/repositories interface
   ↓
TanStack Query hook (features/*/hooks)
   ↓
Read model (PersonProfile, Attested<T>)
   ↓
Screen (app/*)
```

UI code never assumes an unvalidated backend payload is correct. An ESLint `no-restricted-imports` rule stops `app/`, `components/` and `features/` from importing `@supabase/*`, `data/supabase`, `data/schemas` or `data/fixtures`.

### Switching between mock and Supabase

Repositories are written once against a minimal `RowSource` interface (`select` with `eq`/`in` filters, and `search`). The fixture source and the Supabase source both implement it. `createAppRepositories(config)` picks one based on `EXPO_PUBLIC_DATA_SOURCE`. Switching backends changes no repository, hook or UI code, and fixture data is validated exactly like production data.

The profile read currently issues several small queries. If that becomes a bottleneck, add a Postgres view/RPC and a dedicated repository method. The domain interface stays the same.

### Validation failure policy

- No `z.coerce`. Wrong types and unknown enum values are rejected.
- One invalid row fails the whole read. Silently dropping a row could hide a correction or a conflicting source.
- A dangling reference (for example, a participation pointing to a missing office) raises `DataIntegrityError`.
- The UI shows an explicit "Some records failed validation" state. TanStack Query does not retry data errors.

### Database contract

The backend schema lives in `supabase/migrations/` (see `supabase/README.md`). `mobile/src/data/supabase/database.types.ts` is generated from it and used **only** in the data layer: ESLint forbids importing it (or `@supabase/*`) from `app/`, `components/` and `features/`, and `domain/` never imports it. `mobile/src/data/supabase/schemaDrift.ts` is a compile-time check that every table row satisfies its Zod contract, that every contract column exists, and that every DB enum equals its domain enum. A migration that drifts from the app fails `npm run typecheck`.

Generated types do not replace Zod. They describe what the database *should* return; Zod checks what actually arrived.

The database also enforces the editorial rules (RLS, column-level grants, publish gate, verification-consistency checks, audit trail), so the mobile app is never the only line of defence.

### Public read path

The public role has **column-level** `SELECT` on published rows only; editorial identity columns are not readable and a bare `select *` is refused. `SupabaseRowSource` therefore requests exactly the columns of each Zod row schema (`publicColumns.ts`), which also keeps payloads small. The audit log and role tables are not in the app's table list at all.

### Claim detail / source viewer

`ClaimRepository.getClaimDetail(id)` returns a claim with all of its evidence (supporting and contradicting) and the person it is about, if publicly readable. `/claims/[id]` renders it with `ClaimDetailView`. It shows the status and its meaning, effective and review dates, and each source with publisher, type and tier, published and retrieved dates, the relationship (supports or conflicts), the reviewer's note and links to the original and archived copy. If the loaded evidence is inconsistent with the status, the screen says so instead of hiding it. It shows no score or aggregate rating.

### Config and secrets

`shared/config/env.ts` validates `EXPO_PUBLIC_*` variables with Zod and refuses to start if the Supabase key is a service-role JWT or an `sb_secret_` key. The public Supabase client does not persist or refresh sessions, because voters do not sign in.

### Library decisions (Milestone 0)

- React Hook Form is deferred until the first form ("Report an error") so that no unused dependency ships.
- `@react-native-async-storage/async-storage` is not installed, because there is no voter session to persist.
- RNTL 14 uses `test-renderer` (not the deprecated `react-test-renderer`), and `render` is async.

## Backend access model

### Public mobile users
Read only data that has been published.

### Reviewers
Can create/edit draft records.

### Approvers
Can mark records as verified/published.

### Admin
Manages user roles and exceptional corrections.

The mobile app must never contain privileged backend credentials.

## Hosting

A mobile app itself does not require traditional web hosting.

For early stages:
- Supabase hosts database/API/auth/storage.
- Expo/EAS handles development and mobile build services.
- GitHub hosts source code.
- Optional public project/privacy pages can use GitHub Pages or Cloudflare Pages.

## Architecture decision to revisit later

If the app reaches substantial traffic or requires complex ingestion pipelines:
- introduce a dedicated backend/service layer
- background ingestion workers
- dedicated search service
- cached read models

Do not build these prematurely.
