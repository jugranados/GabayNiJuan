# Web migration

Gabay ni Juan is now a **web-first** product. The Next.js app in `web/` is the authoritative voter
frontend. This document records what changed, what did not, and the decisions made on the way.
`docs/WEB_MIGRATION_PLAN.md` is the specification this work followed.

## Why web-first

This is a deliberate change of platform, not a change of mission.

- A voter usually arrives from a search result or a shared link, wanting to check one person or one
  claim. A web page answers that immediately; an app has to be installed first.
- Evidence is only useful if it can be linked. Every profile and every claim now has its own URL
  that can be shared, cited, bookmarked and archived.
- Public pages can be rendered on the server, so they are readable without JavaScript, on slow
  phones, and by search engines and assistive technology.
- One responsive site covers phones, tablets and desktops with one codebase and no store review.

The trust architecture is unchanged: the Supabase schema, Row Level Security, the publication
workflow, claims, evidence, sources, revisions, verification rules and the neutrality rules.

## Stack

Next.js 16 (App Router) · React 19 · TypeScript (strict) · Tailwind CSS 4 · Zod · Supabase JS and
`@supabase/ssr` · Vitest and Testing Library · Playwright (browser acceptance) · npm.

Deliberately not added:

| Library | Why not (yet) |
|---|---|
| TanStack Query | Public pages read on the server. There is no client-side server state to manage. |
| Zustand | Directory state lives in the URL. |
| React Hook Form | Forms (public and editorial) post to server actions and are validated there with the same Zod schemas; a rejected form keeps its values. |
| shadcn/ui | A handful of primitives covers both areas. |

`next.config.ts` sets `cacheComponents: false`: caching uses route-level `revalidate`, which is the
simplest model that fits read-heavy public pages.

## Repository layout

```text
web/                 Next.js app: public voter site and the editorial area   (the only active frontend)
mobile/              React Native app                                        (frozen; to be archived)
supabase/            migrations, RLS, tests, seed                            (source of truth)
docs/                product, data model, governance, architecture
scripts/             cross-app drift check
```

```text
web/src/
  app/
    (public)/        voter pages: /, /politicians, /politicians/[slug], /claims/[id],
                     /verification, /methodology, /corrections/report
    admin/           editorial area: login, dashboard, queue, records, corrections, revisions, roles
    robots.ts  sitemap.ts
  proxy.ts           /admin only: session refresh, X-Robots-Tag
  domain/            models, enums, pure rules (directory, slug, "current", verification),
                     editorial/ (record definitions, workflow, readiness, roles)
  data/              Zod row schemas, mappers, repositories, Supabase sources, fixtures
  server/            server-only composition: config, public repositories, editorial session
  features/          politicians, elections, offices, affiliations, sources, corrections, admin
  components/        generic UI primitives
  lib/               config parsing, site metadata, dates, errors
```

## Reuse

Copied from `mobile/src` and now authoritative in `web/src`:

- `domain/**` (models, enums, directory normalisation, "current record" rules, timeline ordering,
  correction validation, verification consistency);
- `data/schemas`, `data/mappers`, `data/repositories` (row sources, table repositories, in-memory
  directory), `data/supabase` (public columns, drift check, directory and correction sources);
- the neutral wording: verification states, participation states, office and affiliation labels,
  source type labels, the missing-data sentence, the filter model;
- the fictional fixtures and the seed generator (`web/scripts/generate-seed.mjs`);
- the tests for all of the above (Jest to Vitest; 158 ported, 48 new).

Not ported: every React Native screen and component, Expo Router routes, the Zustand store and the
TanStack Query hooks. Their copy and information hierarchy were carried over; their code was not.

### Shared code decision

Domain and data code lives in `web/src/`. There is **no** `packages/domain` workspace:

- `mobile/` is frozen and will be archived, so it is not a second consumer;
- the standalone `admin/` app was folded into `web/`, so its enum copy, transition table, record
  definitions and role rules now exist once, in `web/src/domain/editorial`;
- with one active app there is nothing to share, and a workspace would only add build configuration.

`scripts/check-enum-drift.mjs` checks that single copy against the SQL (15 enums, the record state
machine and the correction lifecycle). Revisit a package only if a mobile companion is started.

## Data flow

```text
Supabase (anon key, RLS)  |  in-memory fixtures (DATA_SOURCE=mock)
   -> RowSource / DirectorySource        unknown rows
   -> Zod row schema                     one invalid row fails the read
   -> mapper                             domain model
   -> repository                         src/data/repositories
   -> getRepositories()                  src/server (server-only)
   -> Server Component page -> feature components
```

- An ESLint rule stops `app/`, `components/` and `features/` from importing `@supabase/*`,
  `@/data/*` or the generated database types.
- Public reads always use a session-less anonymous client. They cannot return more than an
  anonymous visitor may see, whoever is signed in to `/admin`.
- There is no service-role key anywhere in `web/`. The config refuses to start if the public key
  variable holds one, and CI greps the browser bundle.
- Client Components are limited to the report form, the error boundary, the sign-in form, the
  editorial record form and the wrapper that displays a server action's result.

## URL strategy

| URL | Notes |
|---|---|
| `/politicians/<slug>` | e.g. `/politicians/juan-dela-cruz`. A URL that uses the database id redirects permanently to the slug. |
| `/claims/<id>` | The claim's UUID. Claims have no natural name, and a UUID never needs to change. |
| `/politicians?q=&election=&office=&level=&status=&organization=&page=` | All directory state is in the URL, all of it readable: `election`, `office` and `organization` are slugs, `level` and `status` enum values (`national`, `filed-coc`). A legacy UUID value redirects permanently (308) to the slug URL, and the canonical URL always uses slugs. A slug that matches nothing shows "Not found" and no results. Malformed values are dropped. There is no `sort` parameter. |
| `/elections`, `/elections/<slug>`, `/elections/<slug>/<office slug>` | Election index, election page, office page (Milestone 5; `docs/ELECTION_INFORMATION_MODEL.md`). A UUID in either position redirects permanently to the slug URL. Cached for 5 minutes (index) and 60 seconds (pages), revalidated on publish. |

### Slugs

`people.slug` (migration `20261012070000_person_slugs`):

- lowercase ASCII words joined by single hyphens, at most 120 characters, unique;
- generated in the database on insert from first name, last name and suffix; a collision gets
  `-2`, `-3`, …; the rule is mirrored in `web/src/domain/slug.ts` and tested against the fixtures;
- the UUID remains the identity. A slug is never a foreign key and never used to relate records.

**Slug-change policy.** A slug is an address, not a description.

1. It is **not** regenerated when a name is corrected or changed, so URLs do not break.
2. Staff may correct a slug while the person has never been published.
3. Once a person has been published the slug is frozen; the database refuses the change.
4. If a published slug must change (for example a legal name change the person asks to be
   reflected), do it in a new migration that also adds a `person_slug_redirects` table and a
   permanent redirect from the old address. That table does not exist yet because it has not been
   needed.

## SEO and indexing

- Every public page sets a title, description, canonical URL, Open Graph and Twitter metadata
  (`web/src/lib/site.ts`).
- Metadata is descriptive only. A profile is "<Name> — Public Record"; a claim page states its
  verification status but keeps the statement itself out of the title and description, because a
  statement shown in a search result without its status and sources could read as fact.
- Searches and filtered directory views are `noindex, follow`; plain paginated pages are indexable.
- `/admin` is never indexable: page metadata, an `X-Robots-Tag` header from `proxy.ts`, and
  `robots.txt`. `/corrections` is excluded too.
- `sitemap.xml` lists the static pages, one URL per person, and one URL per claim whose evidence
  stands (primary source, corroborated, self-declared or reported). Everything is read through the
  anonymous repositories, so a draft, reviewed, approved-but-unpublished or retracted record can
  never appear, and nothing editorial is listed.
- Claim pages that are unverified, disputed or outdated stay public and linkable but are
  `noindex, follow` and are left out of the sitemap: such a statement should be read with its
  status and sources, not as a search result.
- **Indexing is off by default, and off in one place.** A single server-side setting decides it:
  `SITE_INDEXABLE=true`, which only takes effect with `DATA_SOURCE=supabase`. No route sets its own
  policy, so nothing can be indexed by forgetting something. While it is off:
  - every response carries `X-Robots-Tag: noindex, nofollow` (`next.config.ts`, all routes);
  - every page has `noindex, nofollow` metadata (root layout);
  - `robots.txt` disallows everything and the sitemap is empty;
  - a "fictional data" banner is shown on every public page.

  Turning it on is a deliberate act: set `SITE_INDEXABLE=true` in the production environment and
  redeploy (it is read at build time). Do that only when the database holds real, reviewed,
  published records and no fictional seed. `/admin` and `/corrections` stay non-indexable either way.
- JSON-LD only where the mapping is exact: schema.org `Event` (name, date, URL, country) and
  `BreadcrumbList` on election pages, `BreadcrumbList` on office pages. No `Person`: structured data
  about a person would restate claims without their verification status.
- Election titles are `<Election>` and `<Office> — <Election>`; descriptions say what the page
  lists. Published elections and election offices are in the sitemap.

## Caching

| Route | Behaviour |
|---|---|
| `/politicians` | Rendered per request (it depends on the query string). |
| `/politicians/[slug]`, `/claims/[id]`, `/elections/[slug]`, `/elections/[slug]/[office]` | Rendered on first request, cached for 60 seconds. |
| `/elections` | Cached for 5 minutes. |
| `/` | Cached for 5 minutes. `sitemap.xml` for 1 hour. |
| `/admin/**` | Never cached (`force-dynamic`, `Cache-Control: private, no-store`). |

**On-demand revalidation.** Publishing, retracting, editing a published record or changing the
evidence of a published claim in `/admin` revalidates every public route immediately
(`revalidatePath('/', 'layout')`), from inside the authenticated server action and only after the
database accepted the change. There is no purge endpoint to protect. Revalidating everything is
deliberate: one published person changes the directory, their profile, their claims, the home page
lists and the sitemap, and the data set is small. The timed revalidation above remains as a
fallback for changes made outside the app (the SQL editor), which can take up to 60 seconds to show.

## Editorial area

The whole editorial workflow now lives in `web/src/app/admin`: sign-in, dashboard, work queue,
editors for eleven record types, evidence with database-computed verification readiness, the
publication workflow (reasons, two-person rule, retraction), revision history with field diffs,
the correction queue and role management. Screens and rules: `docs/EDITORIAL_WORKFLOW.md`;
request path and access checks: `docs/ARCHITECTURE.md`, "Editorial area".

It was ported from the standalone Vite app `admin/`, which was then removed (kept in git history,
last present in commit `6c875fd`). What changed in the port:

| Before (`admin/`) | Now (`web/admin`) |
|---|---|
| Browser talks to Supabase directly; session in local storage | Server Components and server actions; session in HTTP-only cookies; the browser never calls Supabase |
| Client-side route guards | Checks on the server: proxy, protected layout, and every page and action |
| TanStack Query, React Router, React Hook Form | Server rendering, App Router, forms posting to server actions |
| Filters in component state | Filters in the URL |
| Its own copies of enums, roles and the transition table | One copy in `web/src/domain` |
| No effect on the public site | Publishing and retracting revalidate public pages |

Small usability additions: a line under the workflow bar saying what the current state means and
what comes next; "Linked records" on every record that points to another (person, election, office,
organization, subject record); the correction request page shows the affected record's label and
state; new correction requests on the dashboard; a person's slug can be set or corrected until the
person is first published.

Unchanged: every database function, policy and trigger. The port has not yet been exercised end to
end with a real editor account.

## Corrections

`/corrections/report?type=person|claim&id=<id>`, linked from every profile and claim. The subject
shown on the page is read from the published record, never from the URL. The form posts to a
server action that calls the anonymous `submit_correction` function. With `DATA_SOURCE=mock` the
page says reports are unavailable instead of pretending to send one.

Abuse protection, without accounts, CAPTCHAs or tracking: a honeypot field, a minimum fill time
(3 seconds), a per-address cooldown (5 reports per 10 minutes, in server memory, never stored or
logged), server-side validation of lengths, URL scheme and email shape, and then the database's own
validation and caps (10 open reports per record, 300 per hour overall). The in-memory cooldown is
per server instance, so on serverless hosting it slows abuse rather than stopping it; the database
caps are the hard limit. If abuse appears in practice, add a CAPTCHA or an edge rate limiter then.

## Deployment (free tier)

Preferred: **Vercel (Hobby) + Supabase (Free)**. Project root `web/`, framework preset Next.js.

| Variable | Value |
|---|---|
| `DATA_SOURCE` | `supabase` |
| `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` | public values only |
| `NEXT_PUBLIC_SITE_URL` | the deployed origin |
| `SITE_INDEXABLE` | `false` until real, reviewed data is published |

These are read at build time (headers, `robots.txt`, metadata), so redeploy after changing them.
The build fails if the environment is unsafe, for example a service-role key in the public key
variable. No server-only secret is needed: the app uses no service-role key.

First deployment, step by step:

1. Vercel → Add New → Project → import the GitHub repository. **Root Directory: `web`**. Framework
   preset Next.js; leave build and output settings at their defaults. Node.js 24.x.
2. Add the five variables above for Production (and Preview if you use it). Set
   `NEXT_PUBLIC_SITE_URL` to the production URL Vercel assigns (or your domain), without a trailing
   slash.
3. Deploy. Then in Supabase → Authentication → URL configuration, set the Site URL to the deployed
   origin.
4. Confirm indexing is off: `curl -sI https://<site>/ | grep -i x-robots-tag` prints
   `noindex, nofollow`, and `https://<site>/robots.txt` says `Disallow: /`.
5. Run `npm run smoke -- https://<site>` and `E2E_BASE_URL=https://<site> npm run e2e:production`
   from `web/` (both read-only), then the manual part of the smoke test in
   `docs/VERIFICATION_CHECKLIST.md` (step 7).

The deployment must read a project with every migration in `supabase/migrations`: without the
slug columns and `election_offices` the directory, profiles and election pages fail validation.
The hosted development project has all 16 (2026-10-16), and a production build reading it passes
`npm run smoke` (43 of 43). Deploy the committed `development` branch. The full order of
operations is in `docs/VERIFICATION_CHECKLIST.md`.

Readiness review (2026-10-13): the production build passes; the environment is validated at build
time; public pages use a session-less anonymous client; `/admin` is checked in the proxy, the
layout and every page and action, is always dynamic, `no-store` and `noindex`; session cookies are
set by `@supabase/ssr` on the server; `robots.txt`, the sitemap and the `noindex` header all follow
the one `SITE_INDEXABLE` switch.

Alternative: Cloudflare (Workers with the OpenNext adapter). The app uses no Vercel-specific API,
but this has not been tried; verify ISR and the proxy there before relying on it.

## Mobile retirement

`mobile/` is **frozen**: no new features, CI still runs its typecheck, lint and tests so the
reference keeps working. Its last unique asset, the real-database integration test, has been ported
to `web/` (`npm run test:integration`) and passes in CI. It is not archived yet because the remaining
gates in `docs/ROADMAP.md` ("Verification and first deployment") are still open: the hosted project,
the manual editorial pass, the browser pass and the deployed smoke test. When they are done:

1. `git mv mobile archive/mobile-react-native`;
2. remove the `mobile` CI job and the mobile half of the drift check, noting why in the commit;
3. update `README.md` and this section.

What remains reusable for a future mobile companion: everything under `web/src/domain` and
`web/src/data` is plain TypeScript with no web dependency, and the database contract
(`search_directory`, `submit_correction`, column-level public reads) is client-agnostic.

## Testing layers

| Layer | Command | What it proves | Where it runs |
|---|---|---|---|
| Unit and component | `npm test` | domain rules, mappers, repositories, pages and editorial screens over the fixtures (jsdom) | every CI run |
| Database | `supabase/tests/rls_and_publication.test.sql` | RLS, state machine, two-person rule, reasons, audit | CI `database` job |
| Integration | `npm run test:integration` | the data layer against a real database through the anon key | CI `database` job; by hand against hosted |
| HTTP smoke | `npm run smoke -- <url>` | about 40 read-only GET checks of a running site: routes, redirects, 404s, indexing, signed-out `/admin` | by hand; `e2e.yml` (production) |
| Browser, public | `npm run e2e:public` | real pages at 375 px, 768 px and desktop: navigation, search, filters, pagination, claim → evidence → source, elections, neutral wording, keyboard paths, layout | CI `web` job (mock build); by hand |
| Browser, editorial | `npm run e2e:editorial` | REVIEWER, APPROVER and ADMIN acceptance, publication lifecycle, election records, corrections, signed in as real editors under RLS | `e2e.yml`, by hand: `local` (throwaway stack) or `hosted` |
| Browser, production | `npm run e2e:production` | the `@production-smoke` subset; read-only | `e2e.yml` (production) |

The smoke script stays: it needs no browser, runs in seconds and checks status codes and headers
exactly (`308`, `X-Robots-Tag`, `Cache-Control`), which is the fastest signal after a deployment.
Playwright covers what needs a browser or an account. Neither uses a service-role key.

Browser tests choose their projects by target (`E2E_TARGET_ENV`): `local` and `hosted` run
everything; `production` defines only the read-only projects unless
`E2E_ALLOW_PRODUCTION_MUTATIONS=true` (default off). Records written by the editorial projects are
named "E2E Fictional …", and each flow ends by retracting what it published.

## Parity checklist (web vs. the React Native app)

| Capability | Web | How it is verified |
|---|---|---|
| Home | `/` | page test; production build smoke test |
| Politician directory | `/politicians` | page tests over fixtures; integration test (database) |
| Search | `?q=` | page tests; integration test |
| Filters (election, office, level, status, organization) | URL parameters | page tests; integration test, every filter and combinations |
| Pagination | `?page=` | component test; repository paging tests; integration test |
| Politician profile | `/politicians/<slug>` | page tests; integration test (profile content identical to fixtures) |
| Election participation, office history, affiliations, education, policy positions | profile sections | page tests (order, wording); integration test |
| Claims | `/claims/<id>` | page tests; integration test |
| Evidence and sources (supporting and conflicting) | claim page, profile | page tests; integration test |
| Report an error | `/corrections/report` | page tests, guard tests; integration test (rejections only) |
| Neutral missing-data states | every section and empty result | page tests |
| Photos | not rendered | no photo exists in any data set; see "Deferred" |

"Integration test" rows pass in CI's `database` job, against a database built from scratch from
`supabase/migrations` and `seed.sql`. They have not yet been run against the hosted project, which
is still missing migrations.

## Deferred, with reasons

- ~~Readable filter URLs~~: done in Milestone 5 (`20261016090100_election_foundation`), with
  legacy UUID links redirecting to the readable URL.
- **Photos.** Decision: keep the placeholder (no image) until the real-data pilot.
  `people.photo_asset_id` stays a reference. Publishing a person's photo raises questions the
  fictional data cannot answer (source, licence, attribution, consent), and there is nothing to
  display yet. When it is built: a public `profile-images` bucket; JPEG, PNG or WebP up to 1 MB;
  path `people/<person id>/<sha256>.<ext>`; uploads by staff only through storage RLS; public
  read; a source and licence recorded for every image; never scraped in bulk.
- **Editorial end-to-end run** with real accounts: automated in Playwright (`web/e2e/editorial`,
  2026-10-22) but not yet run against a database; run `e2e.yml` with target `local`.
- **MFA** for editorial accounts.
- **Stronger report-form protection** (CAPTCHA or edge rate limiting) if abuse appears.
