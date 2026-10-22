-- Gabay ni Juan — editorial roles and Row Level Security (Milestone 1)
--
-- Access model (docs/ARCHITECTURE.md):
--   anon / voters  : read PUBLISHED rows only, never write
--   REVIEWER       : read everything, create/edit records
--   APPROVER       : REVIEWER + approve/publish/retract (enforced by triggers)
--   ADMIN          : APPROVER + manage editorial roles
-- Rows are never deleted through the API (no DELETE policies); published
-- rows are RETRACTED instead.

create type public.editorial_role as enum ('REVIEWER', 'APPROVER', 'ADMIN');

create table public.editorial_roles (
  user_id uuid not null references auth.users (id) on delete cascade,
  role public.editorial_role not null,
  granted_by uuid references auth.users (id) on delete set null,
  granted_at timestamptz not null default now(),
  primary key (user_id, role)
);
create index editorial_roles_granted_by_idx on public.editorial_roles (granted_by);
comment on table public.editorial_roles is 'Internal staff roles. Voters have no account and no role.';

-- Helper functions live in a schema that PostgREST does not expose.
create schema if not exists private;
grant usage on schema private to anon, authenticated;

-- Role hierarchy: REVIEWER < APPROVER < ADMIN.
create or replace function private.role_rank(r public.editorial_role)
returns integer
language sql
immutable
set search_path = ''
as $$
  select case r when 'REVIEWER' then 1 when 'APPROVER' then 2 when 'ADMIN' then 3 end;
$$;

create or replace function private.has_min_role(required public.editorial_role)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.editorial_roles er
    where er.user_id = (select auth.uid())
      and private.role_rank(er.role) >= private.role_rank(required)
  );
$$;

create or replace function private.is_staff()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select private.has_min_role('REVIEWER');
$$;

revoke all on function private.has_min_role(public.editorial_role) from public;
revoke all on function private.is_staff() from public;
grant execute on function private.role_rank(public.editorial_role) to anon, authenticated;
grant execute on function private.has_min_role(public.editorial_role) to anon, authenticated;
grant execute on function private.is_staff() to anon, authenticated;

-- ---------------------------------------------------------------------------
-- RLS on publishable tables
-- ---------------------------------------------------------------------------

do $$
declare
  t text;
begin
  foreach t in array array[
    'people', 'elections', 'offices', 'political_organizations', 'election_participations',
    'office_terms', 'affiliation_records', 'education_records', 'award_records',
    'policy_position_records', 'legal_case_records', 'asset_disclosure_records', 'sources',
    'claims'
  ] loop
    execute format('alter table public.%I enable row level security', t);

    execute format(
      $p$create policy "Published rows are public; staff read all" on public.%I
         for select to anon, authenticated
         using (publication_status = 'PUBLISHED' or (select private.is_staff()))$p$, t);

    execute format(
      $p$create policy "Reviewers can create records" on public.%I
         for insert to authenticated
         with check ((select private.has_min_role('REVIEWER')))$p$, t);

    execute format(
      $p$create policy "Reviewers can edit records" on public.%I
         for update to authenticated
         using ((select private.has_min_role('REVIEWER')))
         with check ((select private.has_min_role('REVIEWER')))$p$, t);
  end loop;
end
$$;

-- Evidence links are public only when both the claim and the source are published.
alter table public.claim_evidence enable row level security;

create policy "Evidence of published claims is public; staff read all" on public.claim_evidence
  for select to anon, authenticated
  using (
    (
      exists (
        select 1 from public.claims c
        where c.id = claim_evidence.claim_id and c.publication_status = 'PUBLISHED'
      )
      and exists (
        select 1 from public.sources s
        where s.id = claim_evidence.source_id and s.publication_status = 'PUBLISHED'
      )
    )
    or (select private.is_staff())
  );

create policy "Reviewers can attach evidence" on public.claim_evidence
  for insert to authenticated
  with check ((select private.has_min_role('REVIEWER')));

create policy "Reviewers can edit evidence" on public.claim_evidence
  for update to authenticated
  using ((select private.has_min_role('REVIEWER')))
  with check ((select private.has_min_role('REVIEWER')));

-- Editorial roles: staff see their own roles; admins manage everyone's.
alter table public.editorial_roles enable row level security;

create policy "Users see own roles; admins see all" on public.editorial_roles
  for select to authenticated
  using (user_id = (select auth.uid()) or (select private.has_min_role('ADMIN')));

create policy "Admins grant roles" on public.editorial_roles
  for insert to authenticated
  with check ((select private.has_min_role('ADMIN')));

create policy "Admins revoke roles" on public.editorial_roles
  for delete to authenticated
  using ((select private.has_min_role('ADMIN')));

-- Defence in depth: anonymous clients can never write, whatever the policies say.
revoke insert, update, delete, truncate on all tables in schema public from anon;
revoke truncate on all tables in schema public from authenticated;
revoke delete on all tables in schema public from authenticated;
grant delete on public.editorial_roles to authenticated;
