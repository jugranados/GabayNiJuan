# Architecture

## Decision

Gabay ni Juan is **web-first**: a Next.js (App Router) + TypeScript application in `web/`, backed by Supabase. The earlier React Native app (`mobile/`) is frozen and will be archived. Rationale, URL/SEO/caching decisions and the retirement plan are in `docs/WEB_MIGRATION.md`.

## Why

- voters arrive from search results and shared links; a page must open without installing anything
- every profile and every claim needs a stable, linkable URL so evidence can be cited
- public, read-heavy pages can be rendered on the server: fast, crawlable, usable without JavaScript
- one responsive codebase for phones, tablets and desktops

## Web stack

- Next.js 16 App Router, React 19, TypeScript (strict)
- Tailwind CSS 4
- `@supabase/supabase-js` and `@supabase/ssr`
- Zod for runtime validation
- Vitest and Testing Library

Not used, on purpose: TanStack Query and Zustand (pages read on the server and keep state in the URL), React Hook Form (forms post to server actions and are validated there with Zod) and shadcn/ui. See `docs/WEB_MIGRATION.md`.

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

## Web architecture

```text
web/src/
  app/
    (public)/          voter pages (Server Components); no cookies, no session
    admin/             editorial area: login, dashboard, queue, records, corrections,
                       revisions, roles (always dynamic, never cached or indexed)
    robots.ts sitemap.ts
  proxy.ts             /admin only: refresh the editor session, X-Robots-Tag
  domain/
    enums/             readonly tuples -> unions (shared with Zod)
    models/            domain types + PersonProfile read model
    repositories/      repository interfaces
    validation/        Zod primitives, error types, verification consistency checks
    editorial/         record definitions, workflow transitions, readiness checklist,
                       roles and capabilities, revision diff, wording guard, view models
    slug.ts directory.ts currentRecords.ts profileContext.ts timeline.ts corrections.ts
  data/
    schemas/           Zod schemas for raw backend rows (snake_case) + parse helpers
    mappers/           row -> domain mappers, profile assembler
    repositories/      RowSource abstraction, repository implementations
    editorial/         staff-only reads and RPC calls, taking the signed-in editor's client
    supabase/          public client, Supabase sources, explicit public column list,
                       generated database types (data layer only) + compile-time drift check
    fixtures/          FICTIONAL development data, in raw row shape (also generates supabase/seed.sql)
  server/              server-only: validated config, getRepositories() (public, anonymous),
                       getEditorial() (the signed-in editor's session and data access)
  features/            politicians, elections, offices, affiliations, sources, corrections, admin
  components/          generic UI primitives
  lib/                 config parsing, site metadata, dates, errors
```

Tests are colocated in `__tests__/` folders.

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
getRepositories() (server/, server-only)
   ↓
Server Component page (app/*)               -> read model (PersonProfile, Attested<T>)
   ↓
Feature components (features/*)
```

UI code never assumes an unvalidated backend payload is correct. An ESLint `no-restricted-imports` rule stops `app/`, `components/` and `features/` from importing `@supabase/*`, `@/data/*` or `@/lib/supabase/*` (the two server-only editorial session modules are the exception).

### Server and client components

Public pages are Server Components. The directory search and filters are a plain GET form, so they work without JavaScript. Client Components exist only where there is real interaction: the report form, the error boundary, and in the editorial area the record form and the small wrapper that shows a server action's result.

### Switching between mock and Supabase

Repositories are written once against a minimal `RowSource` interface. The fixture source and the Supabase source both implement it, and `createAppRepositories(config)` picks one from the server-only `DATA_SOURCE`. Fixture data is validated exactly like production data. With `mock`, corrections are not wired and the report page says so.

### Validation failure policy

- No `z.coerce`. Wrong types and unknown enum values are rejected.
- One invalid row fails the whole read. Silently dropping a row could hide a correction or a conflicting source.
- A dangling reference (for example, a participation pointing to a missing office) raises `DataIntegrityError`.
- The page falls to the public error boundary, which says that information failing the data checks is not displayed. Nothing partial is rendered.

### Database contract

The backend schema lives in `supabase/migrations/` (see `supabase/README.md`). `web/src/data/supabase/database.types.ts` is generated from it and used **only** in the data layer. `web/src/data/supabase/schemaDrift.ts` is a compile-time check that every table row satisfies its Zod contract, that every contract column exists, and that every DB enum equals its domain enum. A migration that drifts from the app fails `npm run typecheck`.

Generated types do not replace Zod. They describe what the database *should* return; Zod checks what actually arrived.

The database also enforces the editorial rules (RLS, column-level grants, publish gate, verification-consistency checks, audit trail), so the web app is never the only line of defence.

### Public URLs

`/politicians/<slug>`, `/claims/<id>`, `/elections`, `/elections/<election slug>` and
`/elections/<election slug>/<office slug>`. People, elections, offices and organizations have slugs
that are unique, generated in the database and frozen once published; the UUID stays the identity.
Policy: `docs/WEB_MIGRATION.md`, "Slugs", and `docs/ELECTION_INFORMATION_MODEL.md`.

### Election information (Milestone 5)

```text
/elections                       ElectionRepository.listElections        -> grouped by recorded status, by date
/elections/<slug>                ElectionRepository.getElectionDetail    -> election offices in ballot order + per-status counts
/elections/<slug>/<office slug>  ElectionRepository.getElectionOfficeDetail
                                   -> participants grouped by exact status of their most recent record,
                                      each record with its own claims and evidence
```

- Offices of an election come from the publishable `election_offices` table, not from
  participations, so an office with no documented participant still appears (with the neutral
  missing-records sentence).
- Pure rules (ordering, date/status consistency, participation succession, Philippine date) are in
  `domain/elections.ts`, shared by repositories, pages and the editorial area; PostgreSQL enforces
  the date rule, the election-office integrity and the frozen participation status.
- Structured data: `Event` and `BreadcrumbList` on election pages, `BreadcrumbList` on office pages
  (`lib/structuredData.ts`); still no `Person`.
- The directory resolves `?election=`, `?office=` and `?organization=` slugs to ids on the server
  (`resolveDirectoryState`) and permanently redirects legacy UUID links to the readable URL.
  Details: `docs/ELECTION_INFORMATION_MODEL.md`.

### Directory query architecture

```text
/politicians?q=&election=&office=&level=&status=&organization=&page=   (URL is the state; slugs)
   ↓ parseDirectoryState -> resolveDirectoryState (slug|legacy id -> id) -> toDirectoryQuery
                                                       features/politicians/directoryParams
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
- **Directory cards are a lightweight read model** (`DirectoryEntry`): name, slug, photo id, participations (office, election, status) and at most one affiliation. No claims, no sources, no counts. The profile loads separately.
- **Why a database function and not client-side filtering:** a national dataset has thousands of people, so the server must never load everyone to filter them, and sending long `id in (…)` lists to the API breaks on URL length. `search_directory` is `SECURITY INVOKER`, so Row Level Security and the anon column grants still apply: it can only ever see published rows and non-identity columns.
- **Two implementations, one behavior.** The SQL function and `inMemoryDirectorySource.ts` follow the same written rules. `npm run test:integration` in `web/` runs the same queries (search, every filter, combinations, paging) against both and requires identical results; CI runs it against the local stack. `schemaDrift.ts` also checks at compile time that the arguments the app sends are exactly the function's parameters.

#### Pagination decision

Offset pagination (`limit`/`offset`, 20 per page, maximum 50) with an exact `total`, returned as `Page<T> = { items, total, nextOffset? }`. It is the simplest thing that is adequate for a directory of thousands, supports "N results", and needs no cursor state. On the web each page is a real URL (`?page=2`) with Previous/Next links; a page number past the end redirects to page 1. Cursor (keyset) pagination can replace it behind the same `Page<T>` contract if rows start being inserted frequently while people scroll.

#### Filter model

`DirectoryFilters` (domain) holds the supported fields; `features/politicians/filterConfig.ts` lists which ones the UI shows (`FILTER_DEFINITIONS`) and how to label their values. Adding a documented, structured field means one entry there plus one column in the query. Prohibited by product rule: any filter that ranks or judges a person ("best", "most trusted", "clean record", "most experienced", "most popular", "least controversial"). A test asserts the filter form contains none, and unknown URL parameters (such as `sort`) are ignored.

#### Jurisdiction decision

`Office.jurisdictionId` stays an opaque string. A structured `Jurisdiction` model (region → province → city/municipality → district → barangay) is **not** needed for this MVP, because the directory can already be narrowed by election, office and office level, and an office's name states its place. A location filter needs human-readable jurisdiction names and a hierarchy; building that now would mean modelling Philippine administrative geography before there is data to use it. The query and `search_directory` already accept `jurisdictionId` so the filter can be added without changing the contract. When it is built, it needs: a `jurisdictions` table (id, name, level, parent id) with publication metadata, a foreign key from `offices`, and a source policy for the geographic codes.

### Profile information hierarchy

```text
ProfileHeader         name, current documented context, evidence counts
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
- **Evidence is never more than one click away.** Every attested record shows its claims with their `VerificationBadge` and a "View evidence and sources" link to `/claims/[id]` (claim → evidence → original source). A record with no claim shows "Unverified · No source attached."
- Legal cases and asset disclosures are intentionally absent (Milestone 4).

### Missing-data wording policy

Absence in our database is not absence in the world. Every empty profile section shows the single sentence **"No records have been added for this section yet."** (`MISSING_RECORDS_MESSAGE`, one shared component). The app never shows "no political experience", "no cases", "no issues", "no controversies", "no corruption" or "no education", and never "clean record". An empty search says "No politicians match this search" and adds that a missing name does not mean a person has no public record. Tests assert these strings do not appear.

### Public read path

The public role has **column-level** `SELECT` on published rows only; editorial identity columns are not readable and a bare `select *` is refused. `SupabaseRowSource` therefore requests exactly the columns of each Zod row schema (`publicColumns.ts`), which also keeps payloads small. The audit log and role tables are not in the app's table list at all.

### Claim detail / source viewer

`ClaimRepository.getClaimDetail(id)` returns a claim with all of its evidence (supporting and contradicting) and the person it is about, if publicly readable. `/claims/[id]` renders it with the `ClaimDetail` component. It shows the status and its meaning, effective and review dates, and each source with publisher, type and tier, published and retrieved dates, the relationship (supports or conflicts), the reviewer's note and links to the original and archived copy. If the loaded evidence is inconsistent with the status, the page says so instead of hiding it. It shows no score or aggregate rating.

### Config and secrets

`lib/config.ts` validates the environment with Zod and refuses to start if the public Supabase key is a service-role JWT or an `sb_secret_` key. `DATA_SOURCE` and `SITE_INDEXABLE` are server-only. The public Supabase client does not persist or refresh sessions, because voters do not sign in. No service-role key is used anywhere.

### SEO, indexing and caching

Metadata, canonical URLs, `robots.txt`, `sitemap.xml`, the default-off indexing switch and the revalidation times are specified in `docs/WEB_MIGRATION.md`.

## Backend access model

### Public visitors
Read only data that has been published.

### Reviewers
Can create/edit draft records.

### Approvers
Can mark records as verified/published.

### Admin
Manages user roles and exceptional corrections.

No app in this repository contains privileged backend credentials.

### Editorial area

`web/src/app/admin` is the whole editorial tool: dashboard, work queue, record editors, evidence and verification readiness, the publication workflow, revision history, the correction queue and role management (`docs/EDITORIAL_WORKFLOW.md`).

```text
/admin page or server action
   ↓ getEditorial() / getEditorialForPage()      server/editorial.ts (server-only)
   │    verifies the user with the auth server, loads their editorial_roles row,
   │    refuses anyone without a role
   ↓ data/editorial/api.ts                       reads: tables + editorial_queue view
   │                                             writes: editorial_update, editorial_transition,
   │                                             editorial_set_evidence, editorial_remove_evidence,
   │                                             review_correction, set_staff_role
   ↓ Supabase, as the signed-in editor (anon key + their session cookie)
PostgreSQL: RLS, state machine, two-person rule, reasons, optimistic concurrency, revisions
```

- **The UI is not the security boundary.** Role checks in pages and actions decide what is offered; every read and write is decided again by PostgreSQL with the editor's own token. There is no service-role client.
- **Three layers of access checks**, each sufficient alone to keep an outsider out: `proxy.ts` refreshes the session and marks responses non-indexable; the protected layout redirects or shows "No editorial access"; every page and every server action calls `getEditorial()` itself, because layouts and pages render independently and actions can be invoked directly.
- **Server-rendered, forms post to server actions.** Validation uses the same Zod schema built from the record's field list (`domain/editorial/records.ts`); a rejected form keeps what the editor typed. Queue and history filters are URL parameters.
- **On-demand revalidation.** When an action publishes, retracts, or changes published content, it calls `revalidatePath('/', 'layout')`, so no public page stays stale. There is no purge endpoint; the 60-second page revalidation remains as a fallback for changes made outside the app (SQL editor).
- The public site has exactly one write: `submit_correction`.

Decision: no shared `packages/domain` workspace. `web/src/domain` is the only active TypeScript implementation of the enums, workflow tables and record definitions; `scripts/check-enum-drift.mjs` checks it against the SQL in CI (and against the frozen `mobile/` copy until that is archived).

## Hosting

- Vercel (Hobby) hosts `web/`; Supabase (Free) hosts database, API and auth.
- GitHub hosts source code and CI.
- Cloudflare with the OpenNext adapter is a possible alternative for `web/`; untested.

## Previous frontend (frozen)

`mobile/` (Expo SDK 57, React Native, Expo Router, TanStack Query, Zustand) implemented Milestones 0–3 for Android and iOS. Its domain, validation, repository and wording code was copied into `web/src` and is maintained there. It is kept, with its CI checks, until web parity is confirmed against Supabase, then moved to `archive/mobile-react-native/`.

## Architecture decision to revisit later

If the site reaches substantial traffic or requires complex ingestion pipelines:
- introduce a dedicated backend/service layer
- background ingestion workers
- dedicated search service
- cached read models

Do not build these prematurely.
