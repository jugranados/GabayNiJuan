# Verification and first deployment checklist

What stands between the repository and its first non-indexed deployment, in the order it has to
happen. Use fictional records only. Tick a box only after seeing the result yourself.

Status words used here and in `docs/ROADMAP.md`:

- **AUTOMATED VERIFIED**: a command or CI job ran and passed.
- **MANUAL CHECK REQUIRED**: a person has to do it or look at it; it cannot be confirmed from code.
- **BLOCKED**: cannot be done until an earlier step is finished.

## Status (2026-10-13)

| Item | Status | Evidence or reason |
|---|---|---|
| Clean database from `supabase/migrations` + `seed.sql` | AUTOMATED VERIFIED | CI `database` job: `supabase start`, `supabase db reset` |
| SQL tests: RLS, publication, verification consistency, editorial functions, corrections, roles, slugs | AUTOMATED VERIFIED | CI `database` job, `supabase/tests/rls_and_publication.test.sql` |
| Seed is idempotent and equals the fixtures | AUTOMATED VERIFIED | CI `database` and `web` jobs |
| Web integration test against a real database | AUTOMATED VERIFIED (local stack only) | CI `database` job |
| Web typecheck, lint, 269 tests, production build, no privileged key in the bundle | AUTOMATED VERIFIED | CI `web` job; also run locally |
| Enums and both state machines equal the SQL | AUTOMATED VERIFIED | CI `drift` job |
| Applied migration files equal the hosted history | AUTOMATED VERIFIED | all 10 applied files match the recorded statements (comments aside) |
| Indexing off by default | AUTOMATED VERIFIED | `npm run smoke` on a production build |
| Signed-out visitors cannot reach `/admin` | AUTOMATED VERIFIED | `npm run smoke`; boundary tests |
| Pending migrations applied to hosted | MANUAL CHECK REQUIRED | 10 of 14 applied. Step 1 |
| `database.types.ts` regenerated | BLOCKED | needs step 1. Step 2 |
| Integration test against the **hosted** project | BLOCKED | needs step 1. Today 31 tests fail there, all because `people.slug` and `submit_correction` do not exist yet |
| Leaked-password protection | MANUAL CHECK REQUIRED | Supabase security advisor reports it **off** (2026-10-12). Step 3 |
| Public sign-up disabled | MANUAL CHECK REQUIRED | not visible to the advisor. Step 3 |
| MFA for editorial accounts | MANUAL CHECK REQUIRED | not set up. Step 3 |
| REVIEWER, APPROVER, ADMIN accounts | MANUAL CHECK REQUIRED | Step 4 |
| Editorial acceptance test | BLOCKED | needs steps 1 and 4. Step 5 |
| Vercel deployment | BLOCKED | needs step 1 (the directory breaks without `people.slug`). Step 6 |
| Deployed smoke test | BLOCKED | needs step 6. Step 7 |
| Browser pass: phone, tablet, desktop, keyboard | MANUAL CHECK REQUIRED | Step 7 |
| Archive `mobile/` | BLOCKED | needs every step above. Step 8 |

## Step 1. Apply the pending migrations

Pending, in order:

1. `20261008150050_editorial_evidence_and_queue`
2. `20261008150100_corrections_and_staff`
3. `20261012070000_person_slugs`
4. `20261012090000_grant_editorial_table_helpers`

From the repository root (the CLI asks for the database password once, at `link`):

```bash
npx supabase login
npx supabase link --project-ref gqplutvabfnxakpmqofv
npx supabase migration list          # 10 rows have both Local and Remote; 4 have Local only
npx supabase db push --dry-run       # must list exactly the four files above
npx supabase db push
npx supabase migration list          # every row now has both Local and Remote
```

- [ ] `db push --dry-run` listed exactly those four
- [ ] `db push` finished without an error
- [ ] `migration list` shows 14 rows, each with Local and Remote

If a migration fails: stop, keep the error text, and do not edit `schema_migrations` or an applied
file. Files after the failing one are not applied; run `npx supabase migration list` to see exactly
where it stopped before doing anything else.

What these change on hosted: the evidence functions and the work queue view; correction requests
and role management (after this, role rows change only through `/admin/roles`); `people.slug`
(existing people get their slug; expected result: the ten fictional people get exactly the slugs in
the fixtures); and the grant without which no editor can save or move a record.

## Step 2. Regenerate types and verify the web app

```bash
cd web
npm run db:types            # rewrites src/data/supabase/database.types.ts from the linked project
npm run verify              # typecheck (includes the schema drift check), lint, tests
npm run test:integration    # against the hosted project; reads web/.env.local
npm run build
```

- [ ] `db:types` wrote the file (it refuses to overwrite it with an error)
- [ ] `verify` passes
- [ ] `test:integration` passes: all tests, no skips
- [ ] `build` passes
- [ ] commit the regenerated `database.types.ts`

If `typecheck` fails in `schemaDrift.ts` after regeneration, that is real drift between the
database and the Zod contracts: fix the cause. Do not loosen a Zod schema to make it compile.

## Step 3. Supabase dashboard security settings

These live in the dashboard, not in SQL. None of them can be confirmed from the repository.

- [ ] **Leaked-password protection ON.** Authentication → Sign In / Providers → Email (or
      Authentication → Policies, depending on dashboard version) → "Prevent use of leaked
      passwords". Currently off.
- [ ] **Public sign-up OFF.** Authentication → Sign In / Providers → "Allow new users to sign up"
      disabled. Confirm by trying: `/admin/login` has no sign-up path, and the Auth API should
      refuse a sign-up request.
- [ ] **MFA for editorial users.** Authentication → Multi-Factor → enable TOTP. Note: the web app
      has no MFA enrolment or challenge screen yet, so enabling it here does not enforce it at
      sign-in. Treat MFA as an open item before real data (see "Before real data").
- [ ] **Site URL.** Authentication → URL configuration → Site URL = the deployed origin (step 6).
- [ ] API settings: exposed schemas are `public` and `graphql_public` only. `private` stays hidden.

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

Run it locally (`cd web && npm run dev`, `DATA_SOURCE=supabase`) or on the deployment. Every
record is fictional; put "(fictional)" in names so nothing can be mistaken for a real record.

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
safe source links, the report page, three 404s, the `noindex` header and metadata, `robots.txt`,
the empty sitemap, that five `/admin` routes redirect a signed-out visitor, and that the sign-in
page is uncached, unindexed and has no sign-up. Vercel preview URLs may sit behind Vercel's own
login; test the production URL.

- [ ] `npm run smoke` reports 0 failed

Manual part:

- [ ] public pages at phone (about 375 px), tablet (about 768 px) and desktop widths: no sideways
      scrolling, filters usable, tables in `/admin` scroll inside their card
- [ ] keyboard only: Tab reaches "Skip to main content" first, every control shows a focus outline,
      the filter form and pagination work without a mouse
- [ ] a source link opens the original document in a new tab
- [ ] submit one correction from the deployed site; it arrives in `/admin/corrections`
- [ ] sign in to `/admin` on the deployment as each role; the role-less case shows "No editorial access"
- [ ] publish one fictional record in `/admin`; it appears publicly straight away
- [ ] retract it; it disappears publicly straight away
- [ ] `curl -sI https://<production-url>/ | grep -i x-robots-tag` prints `noindex, nofollow`

## Step 8. Archive `mobile/`

Only when every box above is ticked:

1. migrations applied; 2. types regenerated; 3. `npm run verify` passes; 4. hosted integration
test passes; 5. database and RLS tests pass (CI); 6. editorial acceptance passed; 7. Vercel
deployment succeeded; 8. deployed public and admin smoke tests passed.

Then: `git mv mobile archive/mobile-react-native`, remove the `mobile` CI job and the mobile half of
`scripts/check-enum-drift.mjs`, and update `README.md`, `AGENTS.md` and `docs/WEB_MIGRATION.md`.

## Before real data

Passing this checklist makes the site deployable with fictional data. Before any real political
record is entered, these are still open:

- MFA enforced at editorial sign-in (the app has no MFA screen yet)
- `allow_self_approval` confirmed `false`, with at least two real people in the approval path
- a decision on indexing (`SITE_INDEXABLE=true`) taken deliberately, after the fictional seed is gone:
  it lives in a database that must then be replaced or cleaned, because published rows cannot be deleted
- stronger abuse protection for the report form if it is abused (the cooldown is per server instance)
- photos remain placeholders (`docs/WEB_MIGRATION.md`, "Deferred")
