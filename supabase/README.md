# Supabase

Database schema for Gabay ni Juan. The project ref is in `/.mcp.json`.

## Layout

| Path | Contents |
|---|---|
| `migrations/` | Ordered SQL migrations. Filenames match the versions recorded in the remote project. |
| `seed.sql` | **Fictional** development data, generated from `mobile/src/data/fixtures/devFixtures.ts`. For local or branch databases only. |

## Migrations

| Version | Name | Contents |
|---|---|---|
| `20261008083503` | `core_schema` | Enums, tables, constraints, indexes. Mirrors `mobile/src/data/schemas/rows.ts`. |
| `20261008083527` | `editorial_roles_and_rls` | `editorial_roles`, role helpers in the `private` schema, Row Level Security policies, anon write revokes. |
| `20261008083613` | `audit_and_publication_guards` | Append-only `revisions` log, publish gate, published-change guard, unpublish guard. |

Migrations are applied to the remote project through the Supabase MCP server (`apply_migration`). The Supabase CLI equivalent is `supabase db push`. Never edit an applied migration; add a new one.

After every migration:

1. Regenerate types into `mobile/src/data/supabase/database.types.ts` (MCP `generate_typescript_types`, or `npx supabase gen types typescript --project-id <ref>`).
2. Run `cd mobile && npm run typecheck`. `src/data/supabase/schemaDrift.ts` fails if a table or enum no longer matches the app's Zod contracts.
3. Run the security and performance advisors.

## Access model

| Who | Can |
|---|---|
| anon (voters) | read `PUBLISHED` rows only, and evidence only when both the claim and the source are published. No writes. |
| `REVIEWER` | read everything, create and edit records |
| `APPROVER` | everything a reviewer can do, plus approve, publish, retract, and change published records |
| `ADMIN` | everything an approver can do, plus grant and revoke editorial roles |

Rows are never deleted through the API. Published or retracted rows cannot be deleted at all; set `publication_status = 'RETRACTED'` instead.

### Bootstrapping the first admin

There is no admin UI yet (Milestone 3). After creating your user in Supabase Auth, run this in the SQL editor:

```sql
insert into public.editorial_roles (user_id, role)
select id, 'ADMIN' from auth.users where email = '<your email>';
```

## Changing published data

The database enforces `docs/DATA_TRUST_GOVERNANCE.md`:

- Changing a published or retracted row requires an `APPROVER` and a reason, set in the same transaction:

  ```sql
  begin;
  select set_config('gnj.change_reason', 'Corrected end date per <source>', true);
  update public.office_terms set end_date = '2025-06-30' where id = '...';
  commit;
  ```

- A row can only become `PUBLISHED` once every row it references is `PUBLISHED`.
- A claim can only be published with at least one attached source (unless it is `UNVERIFIED`), and every cited source must be published.
- A row cannot be unpublished while published rows still reference it.
- Every insert, update and delete is written to `public.revisions` with before/after snapshots, editor, approver and reason. `revisions` cannot be updated, deleted or truncated.

## Seed (fictional)

```bash
cd mobile && npm run seed:generate   # regenerate supabase/seed.sql from the app fixtures
```

`seed.sql` refuses to run if the database already has published people that are not fixtures. Use it on a local stack (`supabase start` then `supabase db reset`) or a Supabase branch. Do **not** run it against the production project.
