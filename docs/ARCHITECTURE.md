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
    politicians/       directory (cards, search, filters), Home, profile header/view, query hooks, UI state (Zustand)
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

### Directory query architecture

```text
DirectoryView / HomeView (UI, router-free)
   ↓ useDirectory (TanStack useInfiniteQuery)        features/politicians/hooks
PersonRepository.searchDirectory(DirectoryQuery)     domain/repositories
   ↓ normalizeDirectoryQuery  (trim, min length, clamp paging, drop empty filters)
DirectorySource.search(params) -> unknown            data/repositories
   ├─ in-memory: computed in TypeScript from fixtures   (mock)
   └─ Supabase:  rpc('search_directory', …)             (database does the work)
   ↓ Zod (directoryPageRowSchema)  →  mapper  →  Page<DirectoryEntry>
```

- **One query, not one method per filter.** `DirectoryQuery = { query?, filters?, sort?, page? }`. `sort` has a single value, `NAME_ASC`; there is deliberately no relevance, popularity or other ranking sort, and none may be added.
- **Ordering is deterministic and the same everywhere:** lowercase last name, lowercase first name, id, compared by code point (`collate "C"` in SQL). Accented letters sort after `z`. This is stable and neutral; locale-aware ordering is a later refinement.
- **Search:** the text is trimmed and whitespace-collapsed; below two characters it is ignored (the UI says so). Every word must appear, case-insensitively, in `first middle last suffix preferred`.
- **Filters combine with AND.** All participation filters (election, office, office level, status, jurisdiction) must be satisfied by one and the same participation; the organization filter matches any dated affiliation record with that organization (including ended ones).
- **Directory cards are a lightweight read model** (`DirectoryEntry`): name, photo id, participations (office, election, status) and at most one affiliation. No claims, no sources, no counts. The profile loads separately.
- **Why a database function and not client-side filtering:** a national dataset has thousands of people, so the app must never download everyone to filter them, and sending long `id in (…)` lists to the API breaks on URL length. `search_directory` is `SECURITY INVOKER`, so Row Level Security and the anon column grants still apply: it can only ever see published rows and non-identity columns.
- **Two implementations, one behavior.** The SQL function and `inMemoryDirectorySource.ts` follow the same written rules. `npm run test:integration` runs the same queries (search, every filter, combinations, paging) against both and requires identical results. `schemaDrift.ts` also checks at compile time that the arguments the app sends are exactly the function's parameters.

#### Pagination decision

Offset pagination (`limit`/`offset`, 20 per page, maximum 50) with an exact `total`, returned as `Page<T> = { items, total, nextOffset? }`. It is the simplest thing that is adequate for a directory of thousands, supports "N results", and needs no cursor state. The UI uses `useInfiniteQuery` with `onEndReached` plus a visible "Show more" button. Cursor (keyset) pagination can replace it behind the same `Page<T>` contract if rows start being inserted frequently while people scroll.

#### Filter model

`DirectoryFilters` (domain) holds the supported fields; `features/politicians/filterConfig.ts` lists which ones the UI shows (`FILTER_DEFINITIONS`) and how to label their values. Adding a documented, structured field means one entry there plus one column in the query. Prohibited by product rule: any filter that ranks or judges a person ("best", "most trusted", "clean record", "most experienced", "most popular", "least controversial"). A test asserts the filter sheet contains none.

#### Jurisdiction decision

`Office.jurisdictionId` stays an opaque string. A structured `Jurisdiction` model (region → province → city/municipality → district → barangay) is **not** needed for this MVP, because the directory can already be narrowed by election, office and office level, and an office's name states its place. A location filter needs human-readable jurisdiction names and a hierarchy; building that now would mean modelling Philippine administrative geography before there is data to use it. The query and `search_directory` already accept `jurisdictionId` so the filter can be added without changing the contract. When it is built, it needs: a `jurisdictions` table (id, name, level, parent id) with publication metadata, a foreign key from `offices`, and a source policy for the geographic codes.

### Profile information hierarchy

```text
PersonProfileHeader   photo, name, current documented context, evidence counts
Personal Details      (only when identity claims exist)
Election Participation   ElectionParticipationCard × n   (newest election first)
Public Office History    Timeline (most recent first)
Political Affiliations   Timeline (most recent first)
Education
Policy Positions
Sources
```

- **"Current" is derived, never guessed** (`domain/profileContext.ts`, `domain/currentRecords.ts`). The header headlines an office or affiliation only if its start date is known and not in the future, its end date is absent or not in the past, **and** it has a claim that is `PRIMARY_SOURCE`, `CORROBORATED`, `SELF_DECLARED` or `REPORTED`. Anything else stays in its own section, with its badge, but is not headlined. The same rule decides the one affiliation shown on a directory card, in SQL and in TypeScript.
- **Timelines never say "present".** A record with a start but no end date shows "From 2022" and the note "No end date recorded". A missing end is not proof that something is ongoing.
- **Verification belongs to claims, never to a person.** The header shows counts ("12 claims from 9 sources") as information and says they are not a rating. There is no person-level score, percentage or "verified" label.
- **Evidence is never more than one tap away.** Every attested record shows its claims with their `VerificationBadge` and a "View evidence and sources" link to `/claims/[id]` (claim → evidence → original source). A record with no claim shows "Unverified · No source attached."
- Legal cases and asset disclosures are intentionally absent (Milestone 4).

### Missing-data wording policy

Absence in our database is not absence in the world. Every empty profile section shows the single sentence **"No records have been added for this section yet."** (`MISSING_RECORDS_MESSAGE`, one shared component). The app never shows "no political experience", "no cases", "no issues", "no controversies", "no corruption" or "no education", and never "clean record". An empty search says "No politicians match this search" and adds that a missing name does not mean a person has no public record. Tests assert these strings do not appear.

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

### Editorial web app (Milestone 3)

`admin/` is a separate Vite + React + TypeScript app (TanStack Query, React Hook Form, Zod, Supabase JS). Editors sign in with Supabase Auth; the browser uses only the public anon key, so every action is decided by RLS, triggers and RPC checks in PostgreSQL. Reads go through the `editorial_queue` view and tables; writes go through `editorial_update`, `editorial_transition`, `editorial_set_evidence`, `editorial_remove_evidence`, `review_correction` and `set_staff_role` (reasons, optimistic concurrency, state machine). The mobile app gains exactly one write: `submit_correction`. Full rules: `docs/EDITORIAL_WORKFLOW.md`.

Decision: no shared `packages/domain` workspace yet. Shared enums are duplicated and checked for drift in CI (`scripts/check-enum-drift.mjs`).

## Hosting

A mobile app itself does not require traditional web hosting.

For early stages:
- Supabase hosts database/API/auth/storage.
- The editorial web app (`admin/`) is a static build: Cloudflare Pages or Vercel free tier.
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
