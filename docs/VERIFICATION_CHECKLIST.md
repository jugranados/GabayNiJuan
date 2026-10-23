# Verification and first deployment checklist

What stands between the repository and its first non-indexed deployment, in the order it has to
happen. Use fictional records only. Tick a box only after seeing the result yourself.

Status words used here and in `docs/ROADMAP.md`:

- **AUTOMATED VERIFIED**: a command or CI job ran and passed.
- **MANUAL CHECK REQUIRED**: a person has to do it or look at it; it cannot be confirmed from code.
- **BLOCKED**: cannot be done until an earlier step is finished.

## Status (re-verified 2026-10-19; hosted rollout 2026-10-16; browser tests added 2026-10-22; local editorial acceptance 2026-10-23)

Status words: AUTOMATED VERIFIED (a command, CI job or API call ran and passed), AUTOMATED, NOT YET
RUN (a Playwright test exists but has not passed against that target yet; it is still open), MANUAL
VERIFIED (a person observed it), MANUAL CHECK REQUIRED, BLOCKED, DEFERRED.

| Item | Status | Evidence or reason |
|---|---|---|
| Clean database from `supabase/migrations` + `seed.sql` | AUTOMATED VERIFIED | CI `database` job; latest: run 38925833312 on `b259313`, all four jobs (web, mobile, drift, database) green |
| SQL tests: RLS, publication, consistency, editorial functions, corrections, roles, slugs, Milestone 5 rules | AUTOMATED VERIFIED | CI `database` job, `supabase/tests/rls_and_publication.test.sql`. Re-run 2026-10-23 on a fresh `db reset` with the 17th migration: 195 checks, including the new source publication-date checks |
| Seed is idempotent and equals the fixtures | AUTOMATED VERIFIED | CI `database` and `web` jobs |
| Enums and both state machines equal the SQL | AUTOMATED VERIFIED | CI `drift` job |
| All 16 migrations applied to hosted | AUTOMATED VERIFIED | `supabase db push`: four on 2026-10-16, then the two Milestone 5 migrations the same day. Re-checked 2026-10-19: `migration list` 16 rows, each Local and Remote; `db push --dry-run` "Remote database is up to date" |
| Migration 17, `20261023090000_source_publication_date_editable`, on hosted | MANUAL CHECK REQUIRED | Added 2026-10-23 (fixes source editing, below). Applies cleanly on a fresh local stack; not yet pushed to hosted. `npx supabase db push --dry-run` must list exactly this file, then `db push`. Required before the hosted editorial run and the deployment. Generated types do not change (function body only; checked with `db:types --local`) |
| Hosted history equals the migration files | AUTOMATED VERIFIED | all 16 recorded statements equal the files (comments, whitespace and statement separators aside) |
| Milestone 5 backfill on hosted | AUTOMATED VERIFIED | 5 election offices backfilled and published, each with its revision; then `db push --include-seed` added the new fictional offices and aligned the display order: 10 published election offices, same as a fresh seed |
| `database.types.ts` regenerated | AUTOMATED VERIFIED | `npm run db:types` from the linked project; no hand-made exception remains. Re-run 2026-10-19: no diff |
| Web typecheck (schema drift), lint, 329 tests | AUTOMATED VERIFIED | `npm run verify` with the regenerated types (re-run 2026-10-19) |
| Integration test against the **hosted** project | AUTOMATED VERIFIED | `npm run test:integration`: 50 of 50, including election pages, office pages and exact statuses equal to the fixtures (re-run 2026-10-19) |
| Production build against hosted | AUTOMATED VERIFIED | `npm run build` with `DATA_SOURCE=supabase`; no privileged key in `.next/static` |
| Smoke test (incl. `/elections`, an election, an office page, readable filters, office-not-in-election 404, UUID → slug 308) | AUTOMATED VERIFIED | `npm run smoke` against a local production build reading hosted: 43 of 43 (2026-10-19). Not yet run against a deployment |
| Milestone 5 routes on hosted data | AUTOMATED VERIFIED | `/elections`, the 2028 page (six offices in ballot order), office pages with every status group, 404 for an office not in the election, 308 from UUID election/office/filter URLs to slug URLs, readable filters, unknown slug shows "Not found" |
| Indexing off (`SITE_INDEXABLE=false`) | AUTOMATED VERIFIED | `X-Robots-Tag: noindex, nofollow`, `robots.txt` `Disallow: /`, empty sitemap |
| Public sign-up disabled; anonymous sign-ins disabled | AUTOMATED VERIFIED | hosted `GET /auth/v1/settings`: `disable_signup: true`, `anonymous_users: false`, only the email provider (re-checked 2026-10-19; an anonymous `POST /auth/v1/signup` is refused) |
| Exposed API schemas are `public`, `graphql_public` | AUTOMATED VERIFIED | PostgREST refuses `Accept-Profile: private`: "Only the following schemas are exposed: public, graphql_public" |
| Leaked-password protection | DEFERRED | the security advisor reports it disabled (2026-10-19). Unavailable on the current plan: Supabase offers it on Pro and above, and the project is on Free (`docs/FREE_TIER_PLAN.md`; owner to confirm). Compensating controls in step 3 |
| MFA for editorial accounts | MANUAL CHECK REQUIRED | not enforced: the app has no MFA enrolment or challenge screen. Required before real political data; does not block the fictional deployment |
| `allow_self_approval` is `false` on hosted | AUTOMATED VERIFIED | read from `private.editorial_settings` (2026-10-19) |
| REVIEWER, APPROVER, ADMIN accounts | MANUAL CHECK REQUIRED | Step 4. Hosted on 2026-10-19: one auth user, holding ADMIN; no REVIEWER or APPROVER account yet. The `local` E2E target creates throwaway accounts on a CI stack instead |
| `e2e-hosted` GitHub environment (secrets and variables) | MANUAL CHECK REQUIRED | Not created by this repository. Exact list in "Hosted acceptance setup" below |
| Editorial acceptance on the **local** target: two-person rule, REVIEWER/APPROVER/ADMIN boundaries, no-role account, publication lifecycle with published edit and retraction, election records, corrections, last-admin protection | AUTOMATED VERIFIED | 2026-10-23, the steps of `e2e.yml` → `local` reproduced in a Linux container with Docker: Supabase CLI 2.121.0 `supabase start` (17 migrations + fictional seed), `create-test-accounts.sql` with a random password, `npm run build` with `DATA_SOURCE=supabase`, `npm run e2e` with `CI=1`, `E2E_TARGET_ENV=local`, retries off. Editorial projects: **19 passed, 0 failed, 0 skipped** (4 sign-ins, 15 tests); again 19 of 19 on the same, reused database. Whole run: 93 passed, 1 skipped. The GitHub Actions run itself has not been started. Failures found on the way and their fixes: "First editorial run" below |
| Editorial acceptance on the **hosted** target | AUTOMATED, NOT YET RUN | needs migration 17 on hosted, REVIEWER and APPROVER accounts (step 4), and the `e2e-hosted` environment ("Hosted acceptance setup" below) |
| Public browser pass: phone (375 px), tablet (768 px), desktop; keyboard paths; neutrality; 404s; indexing; signed-out `/admin` | AUTOMATED VERIFIED | 2026-10-23: against a local production build reading the local stack, 74 passed, 1 skipped (keyboard pagination: one page of people); against a mock build, as CI's `web` job runs it, 71 passed, 4 skipped (no UUIDs, no sign-in, no report form, one page). 2026-10-22 against a build reading hosted: 73 passed, 1 skipped (before the new 404 case). Not yet against a deployment |
| Custom 404 for every unknown address (site shell, navigation, neutral wording) | AUTOMATED VERIFIED | fixed 2026-10-23: an address that matched no route showed Next.js' bare 404. `errors-indexing.spec.ts` now checks an unknown top-level address, an unmatched nested address and four missing records for the heading, the neutral text, the main navigation and the way back (also `@production-smoke`) |
| Production-smoke mode is read-only | AUTOMATED VERIFIED | with `E2E_TARGET_ENV=production` the run lists no `setup` and no writing project; `npm run e2e:production` against a local production build: 36 of 36 (2026-10-23; 35 of 35 on 2026-10-22, one 404 case added since) |
| Vercel deployment | MANUAL CHECK REQUIRED | Step 6 (no longer blocked) |
| Deployed smoke test (`npm run smoke` and `npm run e2e:production`) | BLOCKED | needs step 6. Step 7 |
| Browser pass on real devices, screen reader | BLOCKED | needs step 6; stays manual. Step 7 |
| Archive `mobile/` | BLOCKED | needs the hosted editorial acceptance, the Vercel deployment, the deployed smoke tests and the manual device and screen-reader checks (steps 4 to 7). Step 8 |

## Step 1. Apply the pending migrations

Already applied on 2026-10-16 with `supabase db push` (history verified equal to the files):
`20261008150050_editorial_evidence_and_queue`, `20261008150100_corrections_and_staff`,
`20261012070000_person_slugs`, `20261012090000_grant_editorial_table_helpers`.

Pending, in order:

1. `20261016090000_election_office_entity_type` (Milestone 5; must be committed before the next one)
2. `20261016090100_election_foundation` (Milestone 5)

From the repository root (`supabase/.temp/` holds the link and is git-ignored):

```bash
npx supabase login
npx supabase link --project-ref gqplutvabfnxakpmqofv
npx supabase migration list          # 14 rows have both Local and Remote; 2 have Local only
npx supabase db push --dry-run       # must list exactly the two files above
npx supabase db push
npx supabase migration list          # every row now has both Local and Remote
```

- [x] the first four: dry run listed exactly them, push succeeded, history equals the files (2026-10-16)
- [x] `db push --dry-run` listed exactly the two Milestone 5 files (2026-10-16)
- [x] `db push` finished without an error
- [x] `migration list` shows 16 rows, each with Local and Remote
- [x] `npx supabase db push --include-seed` re-ran the fictional seed (dry run first: seed only, no migrations)

If a migration fails: stop, keep the error text, and do not edit `schema_migrations` or an applied
file. Files after the failing one are not applied; run `npx supabase migration list` to see exactly
where it stopped before doing anything else.

What these change on hosted: the evidence functions and the work queue view; correction requests
and role management (after this, role rows change only through `/admin/roles`); `people.slug`
(existing people get their slug; expected result: the ten fictional people get exactly the slugs in
the fixtures); the grant without which no editor can save or move a record; and, for Milestone 5,
slugs for elections, offices and organizations (generated from their names; expected: exactly the
fixture slugs) and `election_offices`, backfilled from existing participations (expected: five
published election offices, each logged in `revisions` with the reason "Milestone 5: election
office backfilled from existing participations"). Then re-run the seed (`npx supabase db push --include-seed`) to add the new
fictional offices and election offices; it also gives backfilled election offices the fixture
display order, so an upgraded and a fresh database are identical. The upgrade path was rehearsed locally on PostgreSQL 16 (old schema +
old seed, then the two migrations, then the new seed).

## Step 2. Regenerate types and verify the web app

```bash
cd web
npm run db:types            # rewrites src/data/supabase/database.types.ts from the linked project
npm run verify              # typecheck (includes the schema drift check), lint, tests
npm run test:integration    # against the hosted project; reads web/.env.local
npm run build
```

- [x] `db:types` wrote the file (2026-10-16)
- [x] `verify` passes (329 tests)
- [x] `test:integration` passes: 50 of 50, no skips
- [x] `build` passes with `DATA_SOURCE=supabase`
- [x] commit the regenerated `database.types.ts`

If `typecheck` fails in `schemaDrift.ts` after regeneration, that is real drift between the
database and the Zod contracts: fix the cause. Do not loosen a Zod schema to make it compile.

## Step 3. Supabase dashboard security settings

These live in the dashboard, not in SQL. Some can be read from the hosted API (checked
2026-10-16); the dashboard view is still worth a look.

- [x] **Public sign-up OFF** and **anonymous sign-ins OFF**: `GET <project>/auth/v1/settings`
      (with the anon key) returns `disable_signup: true` and `external.anonymous_users: false`.
- [ ] **Leaked-password protection.** Authentication → Sign In / Providers → Email → "Prevent use
      of leaked passwords". Supabase offers it on the **Pro plan and above**; on Free it is
      unavailable. Record which applies. If unavailable, the compensating controls are: accounts
      created only by an administrator, no public sign-up, strong unique passwords, separate
      reviewer and approver accounts, and MFA before real political data.
- [ ] **MFA for editorial users.** Authentication → Multi-Factor → enable TOTP. Note: the web app
      has no MFA enrolment or challenge screen yet, so enabling it here does not enforce it at
      sign-in. Treat MFA as an open item before real data (see "Before real data").
- [ ] **Site URL.** Authentication → URL configuration → Site URL = the deployed origin (step 6).
- [x] API settings: exposed schemas are `public` and `graphql_public` only (PostgREST refuses `private`).

## Step 4. Editorial accounts

Three people, or three addresses you control. Never commit an address, a password or a key.

1. Authentication → Users → **Add user** → email and a strong password → "Auto Confirm User".
   Create three: one each for REVIEWER, APPROVER and ADMIN.
2. Make the first administrator, once, in the SQL editor:

   ```sql
   insert into public.editorial_roles (user_id, role)
   select id, 'ADMIN' from auth.users where email = '<the admin address>';
   ```

3. Sign in at `/admin/login` as that administrator, open **Users / roles**, and assign REVIEWER and
   APPROVER to the other two addresses under "Assign a role".

- [ ] three accounts exist
- [ ] the administrator was bootstrapped with the one SQL statement
- [ ] the other two roles were assigned in `/admin/roles`, and appear in the role change log

The two-person rule means the reviewer and the approver must be different accounts: an approver
cannot approve a record they created or submitted. Leave
`private.editorial_settings.allow_self_approval` at `false`.

## Step 5. Editorial acceptance test

**Automated in Playwright** (`web/e2e/editorial`, README "Browser acceptance tests"). Tick a box
below only after the run that covers it passed against the target you are accepting.

| Checklist part | Spec | Project |
|---|---|---|
| As REVIEWER (all boxes) | `reviewer.spec.ts` | `reviewer` |
| As APPROVER: two-person rule, invalid evidence, no role management | `approver.spec.ts` | `approver` |
| As APPROVER: queue, approve, dependency order, publish, edit with reason, revision history, retract; Published-change test; Retraction workflow | `lifecycle.spec.ts` | `workflow` (REVIEWER + APPROVER + voter) |
| As ADMIN: areas load, role change round trip and log, raw data, no-role account | `admin.spec.ts` | `admin` |
| As ADMIN: last-admin protection | `admin.spec.ts`, only on `E2E_TARGET_ENV=local` with exactly one ADMIN | `admin` |
| Correction request (all boxes but the last, which the integration test covers) | `correction.spec.ts` | `workflow` (voter + ADMIN) |
| Election records (all boxes) | `election.spec.ts` | `workflow` (REVIEWER + APPROVER + voter) |

How to run: `local` target in CI (throwaway stack, accounts and password; no secret), or
`npm run e2e:editorial` with the `E2E_*` variables against an approved hosted test project.
Differences from the manual script: the role changes use the optional role-less test account
(never a real one), the published correction edits a claim's statement (an office term's dates
work the same way), and last-admin protection is tested only on a throwaway local database. On
hosted, last-admin protection stays a manual check.

Record names start with "E2E Fictional" and end with "(fictional)"; links use `example.org`.
Each flow retracts what it published and rejects what it left unpublished, so the public site
returns to the fictional seed. The records stay in `/admin`, with their history.

**Status by target.** `local`: every spec above passed on 2026-10-23 (19 of 19, retries off, then
19 of 19 again on the same database). `hosted`: not yet run. The boxes below stay unticked until
the target being accepted (hosted, then the deployment) has passed.

### First editorial run (2026-10-23, `local` target)

The first run against a real database. Each failure, its class and its fix; no assertion was
loosened, no rule relaxed, no service-role key added.

| Failure | Class | Root cause and fix |
|---|---|---|
| All four sign-ins failed: "Sign-in failed" | AUTH SETUP ISSUE (local stack config) | `supabase/config.toml` set `[auth.email] enable_signup = false`, which the CLI maps to `GOTRUE_EXTERNAL_EMAIL_ENABLED=false`: it disables the email provider, so no one could sign in on a local or CI stack ("Email logins are disabled"). Now `true`; public sign-up stays off through `[auth] enable_signup = false` (`GOTRUE_DISABLE_SIGNUP`), checked: `POST /auth/v1/signup` → "Signups not allowed". Hosted was not affected |
| Election office page: "strict mode violation", three links matched the person's name | TEST BUG | the person link and two "View evidence and sources for: <name> …" links all contain the name. The locator now matches the person link exactly |
| Work queue at 375 px: page 388 px wide | APP BUG | the status badge's screen-reader text (`sr-only`, absolutely positioned) escaped the table's horizontal scroll box, whose position was static, and widened the page. The table scroll boxes in the queue, corrections, roles and revisions are now `relative` |
| Editing any source draft: "Field "published_at" cannot be edited" | APP BUG (database) | on `sources`, `published_at` is the document's own date (a form field); the workflow timestamp is `record_published_at`. `editorial_update` refused `published_at` on every table, and the form always sends it, so no source could be edited at all; `content_of` likewise ignored a source's date when freezing reviewed content. Migration `20261023090000_source_publication_date_editable` treats `record_published_at` as the workflow column of `sources`; SQL tests cover the edit, the still-refused workflow columns and the frozen reviewed source. Found while checking the "Saved." confirmation; `reviewer.spec.ts` now edits a draft source |
| "Saved." not shown after a successful save | APP BUG (UX feedback) | the page keyed the record form by version, so a save (which bumps the version) remounted the form and discarded the action result before it could be shown. The form now keeps its result and status region across the remount, keys only its fields by version, and shows a result only while the version it belongs to is on screen. `saveRecord` in the browser tests now also expects "Saved."; the primary proof of a save is still the new version and the stored values |
| Unknown address showed Next.js' bare 404 | APP BUG | `not-found.tsx` existed only inside the `(public)` route group, which unmatched addresses never reach. `app/not-found.tsx` now renders the same site shell and neutral text |
| Missing `chrome-headless-shell`/`ffmpeg` of the pinned Playwright build | ENVIRONMENT ISSUE | the container's pre-installed browsers were one build older; resolved in the container only (CI runs `npx playwright install --with-deps chromium`). No repository change |

No timing or race problem appeared: the specs wait on locators, `expect.poll` and URLs, and the
writing projects already run with one worker each.

### Hosted acceptance setup

What the owner must configure before Actions → "Browser acceptance (Playwright)" → `hosted` can
run. Names are those `.github/workflows/e2e.yml` reads; do not invent others. Nothing here belongs
in the repository.

1. Apply migration 17 to the hosted project (`npx supabase db push --dry-run`, then `db push`).
2. Accounts (step 4), each holding exactly one role, created in the Supabase dashboard with "Auto
   Confirm User": one **REVIEWER**, one **APPROVER**, one **ADMIN**, all different people or
   addresses. Optional fourth account with **no role** (enables the no-role boundary test and the
   role change round trip; without it those two tests are skipped). Do not use the real
   administrator's account for E2E if that person also does real editorial work: the role test
   changes only the no-role account, but every test writes fictional records as the signed-in user.
3. GitHub → Settings → Environments → **New environment `e2e-hosted`**, ideally with required
   reviewers so a person approves each run.
   - Environment **secrets** (required): `E2E_REVIEWER_EMAIL`, `E2E_REVIEWER_PASSWORD`,
     `E2E_APPROVER_EMAIL`, `E2E_APPROVER_PASSWORD`, `E2E_ADMIN_EMAIL`, `E2E_ADMIN_PASSWORD`.
   - Environment **secrets** (optional): `E2E_NOROLE_EMAIL`, `E2E_NOROLE_PASSWORD`.
   - Environment **variables** (public values): `NEXT_PUBLIC_SUPABASE_URL`,
     `NEXT_PUBLIC_SUPABASE_ANON_KEY` (the anon / publishable key, never a service-role or
     `sb_secret_` key).
4. Leave `private.editorial_settings.allow_self_approval` at `false`.

On hosted, last-admin protection is skipped by design (it runs only on a throwaway local
database); it stays a manual check. A hosted run leaves its fictional records in `/admin` as
REJECTED or RETRACTED (published rows cannot be deleted); a run that fails midway can leave some
fictional records in an earlier state, which an approver retracts or rejects by hand.

To run it by hand instead: locally (`cd web && npm run dev`, `DATA_SOURCE=supabase`) or on the
deployment. Every record is fictional; put "(fictional)" in names so nothing can be mistaken for a
real record.

### As REVIEWER

- [ ] sign in at `/admin/login`; the dashboard loads; there is no "Users / roles" link
- [ ] Dashboard → New source: title, publisher, type "Official government", a URL, retrieved date → Save draft
- [ ] New person: first and last name (fictional) → Save draft. The slug field can stay empty
- [ ] on the person page → New office term (or election participation): choose the person and an office → Save draft
- [ ] on the person page → New claim: subject person, subject record type and record, claim type, a
      neutral statement, verification status "Primary source" → Save draft
- [ ] a statement such as "… is a corrupt mayor" is rejected with a "judgment" error
- [ ] on the claim: the Verification panel says **Not ready** before any source is attached
- [ ] attach the source as "Supports the claim"; the panel now says **Ready for review**
- [ ] move the source, the person, the office term and the claim: Mark sources attached → Submit for approval
- [ ] a record under review is locked: its form is disabled with "under review" wording
- [ ] **cannot publish:** on a REVIEWED record there is no Approve or Publish button
- [ ] **cannot grant roles:** `/admin/roles` says "Your role does not include this area"

### As APPROVER (a different account)

- [ ] Work queue filtered to "Reviewed" shows the reviewer's records
- [ ] Approve, then Publish, in dependency order: source, person, office term, claim
- [ ] publishing a claim before its source or person is published is refused by the database
- [ ] **two-person rule:** create and submit a record yourself, then try to approve it: refused
- [ ] **invalid evidence blocks publication:** a claim marked "Primary source" whose only evidence
      is a news source cannot be submitted or published; the readiness panel explains why
- [ ] the published person appears at `/politicians` and at `/politicians/<slug>` without waiting
- [ ] **edit published with a reason:** change a field on the published office term; the form
      demands "Reason for change"; after saving, the public profile shows the new value
- [ ] Revision history on that record shows the field's old and new value, the reason, editor and state
- [ ] **retract:** Retract… requires a reason; afterwards the record is gone from the public profile
      and its admin page says it cannot be edited
- [ ] a person with published dependents cannot be retracted until they are retracted first

### As ADMIN

- [ ] dashboard, queue, corrections, revisions and "Users / roles" all load
- [ ] change a role, remove a role, assign it again; each appears in the role change log
- [ ] **last-admin protection:** removing your own ADMIN role while you are the only administrator is refused
- [ ] Revisions page shows "Show raw data" (administrators only)

### Correction request

- [ ] signed out, open a published fictional profile → Report an error → describe it (10+
      characters), add a source link → Send report → "Your report was received"
- [ ] the same form rejects a 5-character description and a `javascript:` link
- [ ] the request appears under `/admin/corrections` with its description, link (marked untrusted) and state
- [ ] Start review → Accept with a note → the public record is **unchanged**
- [ ] correct the record through the normal workflow, then mark the request resolved
- [ ] signed out, there is no URL that shows the request (covered automatically by the integration test)

### Published-change test (one fictional record, start to finish)

- [ ] draft → sources attached → reviewed → approved → published
- [ ] visible on the public site
- [ ] corrected by an approver with a reason
- [ ] the public site shows the corrected value
- [ ] revision history holds both values
- [ ] retracted with a reason
- [ ] no longer shown publicly; still present, with its history, in `/admin`

### Election records (Milestone 5)

Fictional only. As REVIEWER unless stated.

- [ ] New election: name "Halalan Test (fictional)", a date next year, status Upcoming, slug empty
      → Save draft. The slug is generated from the name
- [ ] change the status to Completed → refused ("cannot be completed before its date")
- [ ] change the date to last year with status Upcoming → refused ("date has passed")
- [ ] set the slug to `halalan-test-fictional` → saved (unpublished slugs can be corrected)
- [ ] New office: "Konsehal Test (fictional)", level City, slug empty → slug generated
- [ ] on the election page → "Add an office to this election": choose the office, display order 50 → saved
- [ ] adding the same office to the same election again → "already part of this election"
- [ ] New election participation for a fictional person with an office that is **not** an
      election office of that election → refused ("not recorded as contested")
- [ ] participation "Filed certificate of candidacy" dated 1 October, then a second one
      "Potential aspirant" dated 1 November → the second is refused ("cannot follow")
- [ ] a second one "Official candidate" dated 1 December → accepted (a new record, not an edit)
- [ ] claims for each participation with a source; submit everything for approval
- [ ] as APPROVER: publishing the participation before its election office is refused; publish in
      order: source, person, election, office, election office, participations, claims
- [ ] `/elections` lists the test election; its page shows the office; the office page shows the
      person under "Official candidates" with the earlier "Filed certificate of candidacy" record
      below it, each linking to its evidence
- [ ] as APPROVER, edit the published election's slug → refused (permanent once published);
      edit the published participation's status → refused ("cannot be changed")
- [ ] retract the "Official candidate" participation with a reason → the office page now groups
      the person under "Filed a certificate of candidacy" straight away
- [ ] retracting the election office while a published participation belongs to it → refused

### Retraction workflow (as APPROVER, with the ADMIN watching the revisions)

Use the fictional person, office term, claim and source published above.

- [ ] on the published **person**, Retract… is refused while the office term and claim are still
      published ("cannot be unpublished: published rows … still reference it")
- [ ] retract the **claim** first: Retract… without a reason is refused; with a reason it succeeds
- [ ] the claim's `/claims/<id>` page now returns 404, and the profile no longer shows it
- [ ] retract the **office term**, then the **person**, each with a reason
- [ ] `/politicians/<slug>` returns 404 and the person is gone from `/politicians` straight away
- [ ] in `/admin` each record shows "Retracted records are kept for the audit trail and cannot be
      edited", with no Save button and no further workflow action
- [ ] Revisions shows each retraction with its reason, editor and state RETRACTED
- [ ] a REVIEWER cannot retract (no Retract… action; the database refuses it)

Afterwards retract every test record you published. Published rows cannot be deleted, by design.

## Step 6. Deploy to Vercel

Only after step 1: without `people.slug` the directory and profiles fail.

1. Vercel → Add New → Project → import the GitHub repository.
2. **Root Directory: `web`.** Framework preset Next.js. Build and output settings: defaults. Node.js 24.x.
3. Environment variables (Production, and Preview if used):

   | Variable | Value | Reaches the browser |
   |---|---|---|
   | `DATA_SOURCE` | `supabase` | no |
   | `NEXT_PUBLIC_SUPABASE_URL` | the project URL | yes (public) |
   | `NEXT_PUBLIC_SUPABASE_ANON_KEY` | the anon / publishable key | yes (public) |
   | `NEXT_PUBLIC_SITE_URL` | the production origin, no trailing slash | yes (public) |
   | `SITE_INDEXABLE` | `false` | no |

   There is no server-only secret. Do **not** add a service-role or `sb_secret_` key anywhere; the
   build fails if one is put in the anon key variable.
4. Deploy. Set `NEXT_PUBLIC_SITE_URL` to the assigned production URL and redeploy if it differed
   (values are read at build time).
5. Supabase → Authentication → URL configuration → Site URL = that origin.

- [ ] build succeeded on Vercel
- [ ] the five variables are set; no other Supabase key exists in the project settings
- [ ] Supabase Site URL updated

## Step 7. Smoke test the deployment

Automated part (read-only; signs in nowhere, submits nothing):

```bash
cd web
npm run smoke -- https://<production-url>
```

It checks home, directory, an empty search, a filter, an out-of-range page, a profile, a claim,
safe source links, `/elections`, an election, one of its offices, a readable election filter, a
404 for an office that is not in the election, 308 redirects from the fictional 2028 election's UUID
URL and UUID filter to its slug (only while that fictional election is published), the report page,
four 404s, the `noindex` header and metadata, `robots.txt`,
the empty sitemap, that five `/admin` routes redirect a signed-out visitor, and that the sign-in
page is uncached, unindexed and has no sign-up. Vercel preview URLs may sit behind Vercel's own
login; test the production URL.

- [ ] `npm run smoke` reports 0 failed

Browser part (read-only, automated):

```bash
cd web
E2E_BASE_URL=https://<production-url> npm run e2e:production
```

or Actions → "Browser acceptance (Playwright)" → target `production`, `base_url`. It runs the
`@production-smoke` tests: public pages, navigation, directory, profile → claim → source (links open
in a new tab with `noopener noreferrer`), elections, 404s, `noindex` header and metadata,
`robots.txt`, empty sitemap, no privileged key in the page, the signed-out `/admin` redirects, and
the layout at desktop width. It signs in nowhere and submits nothing.

- [ ] `npm run e2e:production` reports 0 failed

Covered by `npm run e2e:public` (automated; run it against the deployment too, with
`E2E_BASE_URL`, `E2E_TARGET_ENV=production`):

- [ ] public pages at phone (375 px), tablet (768 px) and desktop widths: no sideways scrolling,
      filters usable (`responsive.spec.ts`, `navigation.spec.ts`); `/admin` tables scroll inside
      their card (`reviewer.spec.ts`)
- [ ] keyboard only: Tab reaches "Skip to main content" first, every control shows a focus outline,
      the filter form and pagination work without a mouse (`keyboard.spec.ts`)
- [ ] a source link opens in a new tab (`profile-claims.spec.ts` checks `target` and `rel`)
- [ ] `X-Robots-Tag: noindex, nofollow` (`errors-indexing.spec.ts`)

Covered by the editorial projects, which write; run them on the deployment only if writing
fictional records to that database is approved (`E2E_ALLOW_PRODUCTION_MUTATIONS=true`):

- [ ] submit one correction from the deployed site; it arrives in `/admin/corrections` (`correction.spec.ts`)
- [ ] sign in to `/admin` on the deployment as each role; the role-less case shows "No editorial access" (`setup`, `admin.spec.ts`)
- [ ] publish one fictional record in `/admin`; it appears publicly straight away (`lifecycle.spec.ts`)
- [ ] retract it; it disappears publicly straight away (`lifecycle.spec.ts`)

Manual, on purpose (Playwright does not replace these):

- [ ] a real phone and a real tablet: look at the pages, tap the filters, open a source
- [ ] a screen-reader spot check (VoiceOver or TalkBack, NVDA): home, directory with a filter, a
      profile, a claim, the report form
- [ ] subjective clarity: would a voter understand the verification states and the candidacy note?
- [ ] the open source link really is the original document

## Step 8. Archive `mobile/`

Only when every box above is ticked:

1. migrations applied; 2. types regenerated; 3. `npm run verify` passes; 4. hosted integration
test passes; 5. database and RLS tests pass (CI); 6. editorial acceptance passed; 7. Vercel
deployment succeeded; 8. deployed public and admin smoke tests passed.

Then: `git mv mobile archive/mobile-react-native`, remove the `mobile` CI job and the mobile half of
`scripts/check-enum-drift.mjs`, and update `README.md`, `AGENTS.md` and `docs/WEB_MIGRATION.md`.

## Manual checks that browser tests do not replace

- Supabase dashboard security review (step 3): sign-up, providers, leaked-password protection, MFA,
  Site URL, exposed schemas, advisors
- Vercel project review (step 6): environment variables, no Supabase key other than the anon key,
  preview protection
- Supabase and Vercel plan limits (leaked-password protection is Pro and above)
- MFA readiness: the app has no MFA enrolment or challenge screen
- real-device inspection, a screen-reader pass, subjective UX clarity (step 7)
- last-admin protection on any database other than a throwaway local one

## Before real data

Passing this checklist makes the site deployable with fictional data. Before any real political
record is entered, these are still open:

- MFA enforced at editorial sign-in (the app has no MFA screen yet)
- `allow_self_approval` confirmed `false`, with at least two real people in the approval path
- a decision on indexing (`SITE_INDEXABLE=true`) taken deliberately, after the fictional seed is gone:
  it lives in a database that must then be replaced or cleaned, because published rows cannot be deleted
- stronger abuse protection for the report form if it is abused (the cooldown is per server instance)
- photos remain placeholders (`docs/WEB_MIGRATION.md`, "Deferred")
