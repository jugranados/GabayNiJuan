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

- **Web (the only active frontend):** Next.js 16 App Router, React 19, TypeScript (strict), Tailwind CSS 4, Zod
- Supabase: Postgres, Row Level Security, Auth for reviewers/admins, Edge Functions only when needed
- Vitest + Testing Library

Gabay ni Juan is **web-first**. The React Native app in `mobile/` is a frozen earlier frontend that is kept until it is archived; see `docs/WEB_MIGRATION.md`.

See `docs/` and `AGENTS.md` before implementing features.

## What the site does today

- **Home:** search, browse by election (links to election pages) and office level, how verification works, neutrality statement.
- **Directory** (`/politicians`): alphabetical, name search, combinable filters (election, office, office level, participation status, organization), page-based pagination. All state is in the URL, with readable values (`?election=<slug>&status=filed-coc`); old UUID filter links redirect to the readable URL. Never ranked.
- **Elections** (`/elections`, `/elections/<slug>`, `/elections/<slug>/<office slug>`): upcoming, ongoing and completed elections by date; each election's offices in ballot order; each office's participants grouped by their exact status (potential aspirant, publicly declared aspirant, filed certificate of candidacy, official candidate, …), every record linked to its evidence. See `docs/ELECTION_INFORMATION_MODEL.md`.
- **Profile** (`/politicians/<slug>`): header with documented current context, election participation with exact candidacy state, office history and affiliations as timelines, education, policy positions, sources.
- **Evidence** (`/claims/<id>`): every attested record links to its claim, supporting and conflicting sources, and the original document.
- **Report an error** (`/corrections/report`): from a profile or a claim; sends a private request for editorial review that never changes the public record.
- **Verification** and **Methodology** pages.
- **Editorial area** (`/admin`): sign-in for invited staff, dashboard, work queue, editors for people, election participation, office terms, affiliations, education, policy positions, sources, claims, elections (with slugs and date/status checks), offices, election offices and organizations, evidence with verification readiness, the publication workflow with reasons and retraction, revision history, the correction queue and role management. See `docs/EDITORIAL_WORKFLOW.md`.
- All people in this repository are **fictional** development data, and the site is not indexable until that changes.

## Repository layout

| Path | Contents |
|---|---|
| `web/` | **The application.** Next.js public voter site and the editorial area under `/admin` |
| `mobile/` | React Native / Expo app. **Frozen**; kept until archived |
| `supabase/` | Database migrations, RLS, audit triggers, fictional seed (see `supabase/README.md`) |
| `docs/` | Product, data model, governance, architecture, web migration |
| `.github/workflows/` | CI: web (typecheck, lint, tests, seed check, build, bundle key scan), mobile (frozen: typecheck, lint, tests), domain/database drift, and database (migrations, seed, RLS and workflow tests, web integration test) |

The original native Android (Kotlin/Compose) prototype is archived on the `archive/android-native` branch.

## Development setup

### Requirements

- Node.js 20.19.4+, 22.18+, or 24.3+ (`.nvmrc` pins 24). npm comes with Node.

### Install and run

```bash
cd web
npm install
cp .env.example .env.local   # optional; defaults to fictional mock data
npm run dev                  # http://localhost:3000
```

### Environment

Read from `web/.env.local` (git-ignored). See `web/.env.example`.

| Variable | Purpose |
|---|---|
| `DATA_SOURCE` | `mock` (default, fictional fixtures) or `supabase`. Server-only |
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase project URL (required for `supabase` and for `/admin`) |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Anon / publishable key only |
| `NEXT_PUBLIC_SITE_URL` | Deployed origin, for canonical URLs and the sitemap |
| `SITE_INDEXABLE` | `true` allows search-engine indexing. Only with `DATA_SOURCE=supabase`; keep `false` for fictional data. While off, every response is `noindex` (header, metadata, `robots.txt`) |

`NEXT_PUBLIC_*` values are sent to every browser. **Never** put the Supabase service-role key or any `sb_secret_` key in them. The app refuses to start if it detects one, and it uses no service-role key at all.

With `DATA_SOURCE=supabase` the database must contain every migration in `supabase/migrations` (including `person_slugs` and the Milestone 5 `election_foundation`; without them the directory and election pages fail validation), and the fictional seed if you want the demo profiles. In both modes the same repositories validate every row with Zod and map it to domain models.

### Supabase (database)

Full guide: [`supabase/README.md`](supabase/README.md).

```bash
supabase start && supabase db reset        # local stack: migrations + fictional seed (needs Docker + Supabase CLI)
cd web && npm run seed:generate            # regenerate supabase/seed.sql (idempotent) from the web fixtures
cd web && npm run db:types -- --local      # regenerate database.types.ts (omit --local for the linked project), then npm run typecheck
psql "postgresql://postgres:postgres@127.0.0.1:54322/postgres" -v ON_ERROR_STOP=1 \
  -f supabase/tests/rls_and_publication.test.sql                                       # RLS / publication / audit tests
```

**Publication and RLS model in one paragraph.** Every record has a `publication_status`. Anonymous users (the site) can read only `PUBLISHED` rows, only non-identity columns, and cannot write. Reviewers draft, approvers publish, every change lands in the append-only `revisions` log, and a claim cannot be published unless its evidence matches its verification status.

### Quality checks

```bash
cd web
npm run typecheck          # tsc --noEmit (strict); also checks the database types against the Zod contracts
npm run lint               # ESLint (Next.js config + the data-boundary rule)
npm test                   # Vitest + Testing Library (fictional data; no network)
npm run test:consistency   # verification status vs. evidence rules over the fixtures
npm run seed:check         # supabase/seed.sql is exactly what the fixtures generate
npm run build              # production build
npm run verify             # typecheck + lint + test
npm run test:integration   # the data layer against a real Supabase database (anon key; needs migrations + seed)
npm run db:types           # regenerate database.types.ts from the linked Supabase project
npm run smoke -- <url>     # read-only smoke test of a running site (public routes, indexing, /admin redirects)
```

### Verification status

What is verified automatically, what needs a person, and what is blocked, with the exact steps to the first deployment: [`docs/VERIFICATION_CHECKLIST.md`](docs/VERIFICATION_CHECKLIST.md). In short: CI proves a clean database, the SQL rules and the web app; the hosted project has all 16 migrations and passes the integration test (2026-10-16); the editorial area has not yet been exercised with real accounts, and the site is not deployed yet.

## Editorial area (`/admin`)

Part of `web/`. It needs `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` (it works with `DATA_SOURCE=mock` too, since it always talks to Supabase). Sign in at `/admin/login` with an account an administrator created; there is no sign-up. Every action runs as the signed-in editor under Row Level Security; no service-role key is used. Setup, roles, workflow and security: `docs/EDITORIAL_WORKFLOW.md`.

The earlier standalone Vite tool (`admin/`) was removed after its workflow was ported; it remains in git history (last present in commit `6c875fd`).

## Frozen mobile app (`mobile/`)

Kept as a reference until web parity is confirmed against Supabase, then archived (`docs/WEB_MIGRATION.md`). `cd mobile && npm install && npm run verify` still works; do not add features there.
