# Editorial workflow

The public site is read-only. All research, entry, review, approval, correction and publication
happens in the authenticated editorial area of the same web app, under `/admin`, against the same
Supabase project.

```text
Public pages ──read PUBLISHED rows only (anonymous client)──▶ Supabase ◀── /admin (editor's own session)
     └── submit_correction() (one narrow RPC)──▶                              ▲
                                                               Reviewer / Approver / Admin
```

PostgreSQL is the authority. The editorial pages hide actions a role cannot take, but every action
is re-checked by RLS, triggers and RPC guards. No part of the app holds a service-role key: public
reads use the anon key with no session, and editorial requests use the anon key with the signed-in
editor's session, on the server.

The workflow was first built as a standalone Vite app (`admin/`, Milestone 3). It was ported into
`web/src/app/admin` and the standalone app was removed; it remains in git history.

## Screens

| Route | Purpose |
|---|---|
| `/admin/login` | Email and password sign-in for invited staff. No sign-up. |
| `/admin` | Dashboard: counts by publication state, new correction requests, records by type, recent revisions |
| `/admin/queue` | Work queue, filtered by status, record type, creator and date (filters are URL parameters) |
| `/admin/records/<type>/new`, `/admin/records/<type>/<id>` | Record editor: workflow bar, linked records, details form, verification readiness and evidence (claims), related records (people), correction requests, revision history |
| `/admin/corrections`, `/admin/corrections/<id>` | Correction queue and one request with its context and decision |
| `/admin/revisions` | Append-only history with field-level diff |
| `/admin/roles` | Administrators only: staff list, assign or remove a role, role change log |

`<type>` is one of `people`, `participations`, `office-terms`, `affiliations`, `education`,
`policy-positions`, `sources`, `claims`, `elections`, `offices`, `organizations`.

## Roles

One role per person (stored in `editorial_roles`, hierarchy REVIEWER < APPROVER < ADMIN).

| Role | Can |
|---|---|
| REVIEWER | create drafts, edit unpublished records, attach sources and evidence, move records to `SOURCE_ATTACHED` / `REVIEWED`, reject or return to draft, review correction requests |
| APPROVER | everything above, plus approve, publish, retract, and edit published records **with a reason** |
| ADMIN | everything above, plus assign and remove roles (`set_staff_role`) |

Accounts are created or invited by an administrator in the Supabase dashboard. Public sign-up is
disabled. There is no voter account.

## Publication state machine (enforced by `private.guard_transition`)

```text
DRAFT ─▶ SOURCE_ATTACHED ─▶ REVIEWED ─▶ APPROVED ─▶ PUBLISHED ─▶ RETRACTED (final)
  DRAFT | SOURCE_ATTACHED | REVIEWED | APPROVED ─▶ REJECTED
  REVIEWED | APPROVED ─▶ DRAFT      (returned for changes)
  REJECTED ─▶ DRAFT                 (reopened)
```

- New rows start as `DRAFT`. No jumping (`DRAFT → PUBLISHED` is refused).
- `APPROVED`, `PUBLISHED`, `RETRACTED` need an APPROVER (existing triggers).
- Content is **frozen** while `REVIEWED` or `APPROVED`: edit by returning to `DRAFT` first, so an
  approver always approves exactly what was reviewed. The evidence of a claim is frozen the same way.
- A claim must have a source to reach `SOURCE_ATTACHED` (unless `UNVERIFIED`) and must satisfy the
  verification rules to reach `REVIEWED`, `APPROVED` and `PUBLISHED` (`claim_consistency_error`).
- Publishing still requires every referenced record to be published, and published rows cannot be
  deleted or unpublished while dependents are published (Milestone 1 rules).
- Writes without a signed-in user (SQL editor, migrations, seed) are exempt from the state machine
  and two-person rule but are still audited as `system:<db role>`.

`web/src/domain/editorial/workflow.ts` mirrors the transition table to choose which buttons to show;
`scripts/check-enum-drift.mjs` (CI job `drift`) fails if it differs from the SQL.

## Two-person rule

An approver cannot move a record to `APPROVED` if they created it (`created_by`) or submitted it for
approval (`reviewed_by`). Publishing the record afterwards may be done by the same approver who
approved it; the editor ≠ approver rule applies to approval.

Development exception: `private.editorial_settings.allow_self_approval` (default `'false'`). A solo
administrator can set it to `'true'` in the SQL editor. Each approval made under the exception is
stamped `[self-approval permitted by editorial_settings.allow_self_approval]` in the revision reason.
Keep it `false` in production. It cannot be changed through the API (the table is in the unexposed
`private` schema).

## Change reasons

Published records can only be changed by an APPROVER and only with a reason. The editorial area asks for
a plain-language reason; RPCs (`editorial_update`, `editorial_transition`, `editorial_set_evidence`,
`editorial_remove_evidence`) set the transaction setting `gnj.change_reason` themselves and clear it
afterwards, so editors never see the mechanism. Retracting always requires a reason.

## Concurrency

Every publishable table has `version integer` (starts at 1). A trigger increments it whenever
content or workflow columns actually change (no-op updates do not). `editorial_update` and
`editorial_transition` take `expected_version`; if the row has moved on they fail with
`STALE_RECORD`, and the page shows "changed by someone else" with a **Reload record** button.
This is optimistic concurrency, not locking. Limits: a user who calls PostgREST directly with
`UPDATE` can skip the version check (they still cannot skip the state machine, roles, reasons or
audit). Evidence edits are not version-checked; they are frozen under review and audited.

## Corrections

```text
Voter ─▶ "Report an error" (person profile, claim detail)
      ─▶ submit_correction()  [anon-callable, validated, abuse-capped]
      ─▶ correction_requests (private)  status SUBMITTED
Reviewer ─▶ UNDER_REVIEW ─▶ ACCEPTED | REJECTED   (resolution note required)
          ─▶ edits a normal DRAFT of the affected record (or an approver edits the published record with a reason)
          ─▶ review ─▶ approval ─▶ publish ─▶ revision retained
          ─▶ request marked RESOLVED
```

- `submit_correction` accepts only a PUBLISHED target, validates lengths, `http(s)` URL and email
  shape, and returns uniform non-informative errors. Open requests per record are capped at 10 and a
  global cap of 300 requests per hour applies. This is a coarse brake, not real rate limiting.
  Stronger protection (captcha, an Edge Function with IP limits) is deferred.
- `correction_requests` has no grants for `anon` and only `SELECT` for signed-in users, filtered by
  RLS to staff. Email, explanation and URL are private. Staff change requests only through
  `review_correction`, which enforces the lifecycle `SUBMITTED → UNDER_REVIEW | REJECTED`,
  `UNDER_REVIEW → ACCEPTED | REJECTED`, `ACCEPTED → RESOLVED`.
- **Accepting a request changes nothing else.** Published data changes only through the normal
  workflow, which leaves a revision.
- Submitted URLs are untrusted; the request page opens them with `rel="noopener noreferrer nofollow"`
  and labels them as unverified.
- Before a report reaches the database the web app applies its own free-tier protection: a honeypot
  field, a minimum fill time, and a per-address cooldown (5 reports per 10 minutes, held in server
  memory only). Input is validated on the server with the same limits as the database function.
  No CAPTCHA, no account and no tracking. The in-memory cooldown is per server instance, so the
  database caps above remain the limit that always holds.

## Retraction

A PUBLISHED record moves to RETRACTED (approver + reason). The row and its history remain; it is
removed from public views because RLS only exposes PUBLISHED rows, and it cannot be re-published.
Examples of reasons: source found invalid, record attached to wrong person, publication error,
information superseded.

## Revisions

Triggers append a row to `revisions` for every insert/update/delete (old and new JSONB, editor,
approver, reason, resulting state). The table is append-only. The revisions pages show a field-level diff
(ignoring `updated_at` and `version`), the editor/approver emails (via `staff_directory()`), and, for
ADMIN only, the raw JSON. Staff role changes are logged separately in `editorial_role_events`.

## Security boundaries

| Actor | Can | Cannot |
|---|---|---|
| anonymous visitor | read PUBLISHED voter columns; call `submit_correction` | read correction requests, revisions, roles, the queue; write anything else |
| signed-in, no role | same as anonymous for rows | any editorial read or write |
| REVIEWER / APPROVER / ADMIN | see "Roles" | skip the state machine, forge identity columns, delete rows, edit revisions |

No service-role key exists anywhere in the repository's apps; CI greps the web browser bundle for
`service_role` and `sb_secret_`.
All new SQL functions revoke `PUBLIC`/`anon` and grant `authenticated` (except `submit_correction`).

## Storage decision

Deferred. The editorial workflow needs no uploads: sources are linked (URL, identifier, archived
URL), not mirrored, and photos are stored only as `photo_asset_id` references. When photos are
needed, add a public `public-profile-images` bucket with editor-only writes; never mirror government
or copyrighted documents when a link to the authoritative source is enough.

## Publishing and the public site

Public pages are cached. When an editorial action publishes or retracts a record, changes a
published record, or changes the evidence of a published claim, the same server action revalidates
every public route (`revalidatePath('/', 'layout')`). It runs only after the database accepted the
change and only inside an authenticated action; there is no cache-purge endpoint. Changes made
outside the app (SQL editor) appear within the 60-second page revalidation.

## Domain rules in one place

`web/src/domain` is the only active TypeScript copy of the enums, the transition table, the
correction lifecycle, the record field definitions, the readiness checklist and the wording guard.
`scripts/check-enum-drift.mjs` compares the enums and both state machines with the SQL in CI.

## Setup

1. Apply the migrations (`supabase db push`, or the SQL editor in order).
2. In Auth settings: keep **public sign-up disabled**, enable **leaked-password protection**.
3. Create your editorial users in the Supabase dashboard (Authentication → Users → Add/Invite).
4. Bootstrap the first admin once, in the SQL editor:
   ```sql
   insert into public.editorial_roles (user_id, role)
   select id, 'ADMIN' from auth.users where email = '<your email>';
   ```
   After that, assign roles at `/admin/roles` (**Users / roles**).
5. In `web/.env.local` set `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY`, then
   `npm install && npm run dev` and open `http://localhost:3000/admin`.
6. Deploy `web/` (see `docs/WEB_MIGRATION.md`, "Deployment") and add the deployed origin to
   Auth → URL configuration.

## Known limitations

- Legal-case and asset-disclosure editors are Milestone 4.
- The work queue loads up to 200 rows; the dashboard counts up to 1000. Server-side counts and
  pagination come with real data volume.
- Correction abuse protection is coarse (see above).
- A reviewer cannot edit a published record; they flag it (via correction/comment in the accepted
  request) and an approver edits it with a reason. There is no separate "proposed change" object yet.
- Email/password only; no MFA yet (recommended before real data).
- The port has unit and component tests for every action and screen rule, but has not yet been
  exercised end to end against a real editor account (see `docs/ROADMAP.md`).
