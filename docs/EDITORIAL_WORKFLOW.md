# Editorial workflow (Milestone 3)

The voter app is read-only. All research, entry, review, approval, correction and publication
happens in a separate authenticated web tool (`admin/`) against the same Supabase project.

```text
Public mobile app ──reads PUBLISHED rows only──▶ Supabase ◀── Editorial web app (admin/)
        └── submit_correction() (one narrow RPC)──▶            ▲
                                                  Reviewer / Approver / Admin
```

PostgreSQL is the authority. The admin UI hides actions a role cannot take, but every action is
re-checked by RLS, triggers and RPC guards. Neither browser (mobile or admin) holds a service-role
key; both use only the public anon/publishable key.

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

`admin/src/domain/workflow.ts` mirrors the transition table to choose which buttons to show;
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

Published records can only be changed by an APPROVER and only with a reason. The admin app asks for
a plain-language reason; RPCs (`editorial_update`, `editorial_transition`, `editorial_set_evidence`,
`editorial_remove_evidence`) set the transaction setting `gnj.change_reason` themselves and clear it
afterwards, so editors never see the mechanism. Retracting always requires a reason.

## Concurrency

Every publishable table has `version integer` (starts at 1). A trigger increments it whenever
content or workflow columns actually change (no-op updates do not). `editorial_update` and
`editorial_transition` take `expected_version`; if the row has moved on they fail with
`STALE_RECORD`, and the admin app shows "changed by someone else" with a **Reload record** button.
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
- Submitted URLs are untrusted; the admin app opens them with `rel="noopener noreferrer"` and labels
  them as unverified.

## Retraction

A PUBLISHED record moves to RETRACTED (approver + reason). The row and its history remain; it is
removed from public views because RLS only exposes PUBLISHED rows, and it cannot be re-published.
Examples of reasons: source found invalid, record attached to wrong person, publication error,
information superseded.

## Revisions

Triggers append a row to `revisions` for every insert/update/delete (old and new JSONB, editor,
approver, reason, resulting state). The table is append-only. The admin app shows a field-level diff
(ignoring `updated_at` and `version`), the editor/approver emails (via `staff_directory()`), and, for
ADMIN only, the raw JSON. Staff role changes are logged separately in `editorial_role_events`.

## Security boundaries

| Actor | Can | Cannot |
|---|---|---|
| anonymous mobile user | read PUBLISHED voter columns; call `submit_correction` | read correction requests, revisions, roles, the queue; write anything else |
| signed-in, no role | same as anonymous for rows | any editorial read or write |
| REVIEWER / APPROVER / ADMIN | see "Roles" | skip the state machine, forge identity columns, delete rows, edit revisions |

No service-role key exists in `mobile/` or `admin/`; CI greps the admin bundle for `service_role`.
All new SQL functions revoke `PUBLIC`/`anon` and grant `authenticated` (except `submit_correction`).

## Storage decision

Deferred. The editorial workflow needs no uploads: sources are linked (URL, identifier, archived
URL), not mirrored, and photos are stored only as `photo_asset_id` references. When photos are
needed, add a public `public-profile-images` bucket with editor-only writes; never mirror government
or copyrighted documents when a link to the authoritative source is enough.

## Shared types

`admin/src/domain/enums.ts` duplicates the small set of shared enums and labels instead of adding a
`packages/domain` workspace. Metro, Vite and two Jest/Vitest setups make a shared package costlier
than a few enum lists. `scripts/check-enum-drift.mjs` compares admin ↔ mobile ↔ SQL enums in CI.
Revisit if the duplicated surface grows.

## Setup

1. Apply the migrations (`supabase db push`, or the SQL editor in order).
2. In Auth settings: keep **public sign-up disabled**, enable **leaked-password protection**.
3. Create your editorial users in the Supabase dashboard (Authentication → Users → Add/Invite).
4. Bootstrap the first admin once, in the SQL editor:
   ```sql
   insert into public.editorial_roles (user_id, role)
   select id, 'ADMIN' from auth.users where email = '<your email>';
   ```
   After that, assign roles in the admin app (**Users / roles**).
5. `cd admin && cp .env.example .env.local`, set `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`, then
   `npm install && npm run dev`.
6. Deploy `admin/` as a static site (Cloudflare Pages or Vercel free tier: build `npm run build`,
   output `dist`, set the two `VITE_` variables). Add the deployed URL to Auth → URL configuration.

## Known limitations

- Legal-case and asset-disclosure editors are Milestone 4.
- The work queue loads up to 200 rows; the dashboard counts up to 1000. Server-side counts and
  pagination come with real data volume.
- Correction abuse protection is coarse (see above).
- A reviewer cannot edit a published record; they flag it (via correction/comment in the accepted
  request) and an approver edits it with a reason. There is no separate "proposed change" object yet.
- Email/password only; no MFA yet (recommended before real data).
