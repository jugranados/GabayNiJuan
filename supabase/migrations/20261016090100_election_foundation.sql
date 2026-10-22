-- Gabay ni Juan — Milestone 5, part 2 of 2: election information foundation.
--
-- 1. Stable public slugs for elections, offices and political organizations, with the same
--    generate-and-freeze rule as people (20261012070000_person_slugs.sql):
--      * lowercase ASCII words joined by single hyphens, at most 120 characters, unique per table;
--      * generated on insert from the name when none is supplied; a collision gets "-2", "-3", …;
--      * NOT regenerated when the name changes, so correcting a name never breaks a URL;
--      * frozen once the record has ever been published.
--    The UUID stays the identity. A slug is never a foreign key.
--    Elections and offices have public pages (/elections/<slug>/<office slug>); organizations
--    get a slug only so directory filter URLs are readable (?organization=<slug>).
--
-- 2. `election_offices`: an office that is contested in an election (the "contest"). It is a
--    publishable record under the same workflow, RLS, audit and two-person rule as every other
--    table. An election page lists its published election offices, so an office can be shown
--    before anyone has a documented participation in it.
--
-- 3. Integrity:
--      * every election participation belongs to an election office (composite foreign key;
--        existing pairs are backfilled);
--      * a participation can be published only when its election office is published, and an
--        election office cannot be unpublished while published participations depend on it;
--      * once a participation has been published, its status, person, election and office are
--        frozen. A later status (for example FILED_COC after PUBLICLY_DECLARED_ASPIRANT) is a
--        different claim with different evidence, so it is recorded as a new, dated
--        participation. A wrong record is retracted, not rewritten;
--      * election date and status must agree: an election cannot be COMPLETED before its date,
--        and an editor cannot mark an election whose date has passed as UPCOMING.
--
-- search_directory is unchanged: the web app resolves slugs to ids before it calls it.

-- ---------------------------------------------------------------------------
-- 1. Generic slug helpers
-- ---------------------------------------------------------------------------

-- First free slug in `p_table`: the base, then base-2, base-3, …
create or replace function private.unique_record_slug(p_table text, p_text text, p_fallback text, p_id uuid)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_base text := private.slugify(p_text);
  v_candidate text;
  v_n integer := 1;
  v_taken boolean;
begin
  if v_base = '' then
    v_base := p_fallback;
  end if;
  v_base := btrim(left(v_base, 100), '-');
  v_candidate := v_base;
  loop
    execute format('select exists (select 1 from public.%I t where t.slug = $1 and t.id is distinct from $2)', p_table)
      into v_taken using v_candidate, p_id;
    exit when not v_taken;
    v_n := v_n + 1;
    v_candidate := v_base || '-' || v_n;
  end loop;
  return v_candidate;
end;
$$;

-- BEFORE INSERT OR UPDATE. tg_argv[0] = column the slug is generated from, tg_argv[1] = fallback.
create or replace function private.manage_record_slug()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    if new.slug is null or btrim(new.slug) = '' then
      new.slug := private.unique_record_slug(tg_table_name, to_jsonb(new) ->> tg_argv[0], tg_argv[1], new.id);
    end if;
    return new;
  end if;

  if new.slug is null or btrim(new.slug) = '' then
    new.slug := old.slug;
  end if;
  if new.slug is distinct from old.slug
     and (old.published_at is not null or old.publication_status in ('PUBLISHED', 'RETRACTED')) then
    raise exception 'The slug of a published % record cannot be changed (it is a public URL)', tg_table_name
      using errcode = 'check_violation';
  end if;
  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- 2. Slug columns, backfill, constraints, triggers
-- ---------------------------------------------------------------------------

do $$
declare
  spec record;
  r record;
begin
  perform set_config('gnj.change_reason', 'Milestone 5: assign public URL slug', true);
  for spec in
    select * from (values
      ('elections', 'election'),
      ('offices', 'office'),
      ('political_organizations', 'organization')
    ) as s(tbl, fallback)
  loop
    execute format('alter table public.%I add column slug text', spec.tbl);
    -- Oldest first, so the earliest record keeps the plain slug.
    for r in execute format('select id, name from public.%I where slug is null order by created_at, id', spec.tbl) loop
      execute format('update public.%I set slug = private.unique_record_slug(%L, $1, %L, $2) where id = $2',
        spec.tbl, spec.tbl, spec.fallback)
        using r.name, r.id;
    end loop;
    execute format('alter table public.%I alter column slug set not null', spec.tbl);
    execute format('alter table public.%I add constraint %I unique (slug)', spec.tbl, spec.tbl || '_slug_key');
    execute format($c$alter table public.%I add constraint %I
      check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$' and length(slug) <= 120)$c$, spec.tbl, spec.tbl || '_slug_format');
    execute format(
      'create trigger "05_record_slug" before insert or update on public.%I
         for each row execute function private.manage_record_slug(%L, %L)', spec.tbl, 'name', spec.fallback);
    execute format('grant select (slug) on public.%I to anon', spec.tbl);
    execute format('comment on column public.%I.slug is %L', spec.tbl,
      'Stable public URL slug. An address, never an identity or a foreign key. Frozen once published.');
  end loop;
  perform set_config('gnj.change_reason', '', true);
end
$$;

-- ---------------------------------------------------------------------------
-- 3. Election date / status consistency
-- ---------------------------------------------------------------------------

-- BEFORE INSERT OR UPDATE on elections. Dates are Philippine calendar dates.
-- COMPLETED before the election date is never valid. UPCOMING after the date is refused when an
-- editor sets it; system writes (seed, migrations) are not refused, because an election that was
-- correctly UPCOMING when it was recorded becomes stale with time, not wrong. The public pages say
-- so when that happens.
create or replace function private.check_election_date_status()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  v_today date := (now() at time zone 'Asia/Manila')::date;
begin
  if tg_op = 'UPDATE' and new.status = old.status and new.election_date = old.election_date then
    return new;
  end if;
  if new.status = 'COMPLETED' and new.election_date > v_today then
    raise exception 'An election dated % cannot be COMPLETED before its date', new.election_date
      using errcode = 'check_violation';
  end if;
  if new.status = 'UPCOMING' and new.election_date < v_today and (select auth.uid()) is not null then
    raise exception 'An election dated % has already taken place; record it as ONGOING or COMPLETED, not UPCOMING', new.election_date
      using errcode = 'check_violation';
  end if;
  return new;
end;
$$;

create trigger "07_election_date_status" before insert or update on public.elections
  for each row execute function private.check_election_date_status();

-- ---------------------------------------------------------------------------
-- 4. election_offices: an office contested in an election
-- ---------------------------------------------------------------------------

create table public.election_offices (
  id uuid primary key default gen_random_uuid(),
  election_id uuid not null references public.elections (id) on delete restrict,
  office_id uuid not null references public.offices (id) on delete restrict,
  -- Presentation order of offices on the election page (lower first; ties by office name).
  -- Editorial, typically the order of the official ballot. It orders offices, never people.
  sort_order integer not null default 100 check (sort_order between 0 and 9999),
  publication_status public.publication_status not null default 'DRAFT',
  published_at timestamptz,
  created_by uuid default auth.uid() references auth.users (id) on delete set null,
  approved_by uuid references auth.users (id) on delete set null,
  reviewed_by uuid references auth.users (id) on delete set null,
  reviewed_at timestamptz,
  published_by uuid references auth.users (id) on delete set null,
  version integer not null default 1,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint election_offices_election_office_key unique (election_id, office_id)
);
comment on table public.election_offices is
  'An office contested in an election. Election pages list these; every election participation belongs to one.';

create index election_offices_office_id_idx on public.election_offices (office_id);
create index election_offices_publication_status_idx on public.election_offices (publication_status);
create index election_offices_created_by_idx on public.election_offices (created_by);
create index election_offices_approved_by_idx on public.election_offices (approved_by);
create index election_offices_reviewed_by_idx on public.election_offices (reviewed_by);
create index election_offices_published_by_idx on public.election_offices (published_by);

-- The same triggers, in the same order, as every other publishable table.
create trigger "10_guard_published_change" before update or delete on public.election_offices
  for each row execute function private.guard_published_change();
create trigger "15_guard_transition" before insert or update on public.election_offices
  for each row execute function private.guard_transition();
create trigger "20_enforce_publication" before insert or update on public.election_offices
  for each row execute function private.enforce_publication('published_at', 'election_id:elections', 'office_id:offices');
create trigger "22_two_person_rule" before update on public.election_offices
  for each row execute function private.enforce_two_person_rule();
create trigger "30_set_updated_at" before update on public.election_offices
  for each row execute function private.set_updated_at();
create trigger "35_bump_version" before update on public.election_offices
  for each row execute function private.bump_version();
create trigger "90_record_revision" after insert or update or delete on public.election_offices
  for each row execute function private.record_revision('ELECTION_OFFICE');

-- BEFORE UPDATE on election_offices. The pair is the record's identity once published, and a
-- published election office keeps its published participations public.
-- (assert_no_published_dependents only follows single-column foreign keys, so the composite
-- key from election_participations is checked here.)
create or replace function private.guard_election_office()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if (old.published_at is not null or old.publication_status in ('PUBLISHED', 'RETRACTED'))
     and (new.election_id, new.office_id) is distinct from (old.election_id, old.office_id) then
    raise exception 'The election and office of a published election office cannot be changed; retract it and add a new one'
      using errcode = 'check_violation';
  end if;
  if old.publication_status = 'PUBLISHED' and new.publication_status <> 'PUBLISHED' and exists (
    select 1 from public.election_participations ep
    where ep.election_id = old.election_id and ep.office_id = old.office_id
      and ep.publication_status = 'PUBLISHED'
  ) then
    raise exception 'election office % cannot be unpublished: published election participations still belong to it', old.id
      using errcode = 'foreign_key_violation';
  end if;
  return new;
end;
$$;

create trigger "11_guard_election_office" before update on public.election_offices
  for each row execute function private.guard_election_office();

-- Row Level Security: the same three policies as every publishable table.
alter table public.election_offices enable row level security;

create policy "Published rows are public; staff read all" on public.election_offices
  for select to anon, authenticated
  using (publication_status = 'PUBLISHED' or (select private.is_staff()));

create policy "Reviewers can create records" on public.election_offices
  for insert to authenticated
  with check ((select private.has_min_role('REVIEWER')));

create policy "Reviewers can edit records" on public.election_offices
  for update to authenticated
  using ((select private.has_min_role('REVIEWER')))
  with check ((select private.has_min_role('REVIEWER')));

-- anon: SELECT on non-identity columns only (as restrict_public_access); never writes or deletes.
revoke all on public.election_offices from anon;
grant select (id, election_id, office_id, sort_order, publication_status, published_at, reviewed_at, created_at, updated_at)
  on public.election_offices to anon;
grant select, insert, update on public.election_offices to authenticated;
revoke delete, truncate on public.election_offices from authenticated;

-- ---------------------------------------------------------------------------
-- 5. Backfill election offices from existing participations, then link them
-- ---------------------------------------------------------------------------

do $$
begin
  perform set_config('gnj.change_reason', 'Milestone 5: election office backfilled from existing participations', true);
  insert into public.election_offices (election_id, office_id, publication_status)
  select pairs.election_id, pairs.office_id,
         case when e.publication_status = 'PUBLISHED' and o.publication_status = 'PUBLISHED'
              then 'PUBLISHED'::public.publication_status
              else 'DRAFT'::public.publication_status end
  from (select distinct ep.election_id, ep.office_id from public.election_participations ep) pairs
  join public.elections e on e.id = pairs.election_id
  join public.offices o on o.id = pairs.office_id
  order by pairs.election_id, pairs.office_id;
  perform set_config('gnj.change_reason', '', true);
end
$$;

create index election_participations_election_office_idx
  on public.election_participations (election_id, office_id);
alter table public.election_participations
  add constraint election_participations_election_office_fkey
  foreign key (election_id, office_id) references public.election_offices (election_id, office_id)
  on delete restrict;

-- BEFORE INSERT OR UPDATE on election_participations.
create or replace function private.guard_participation()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_contest_status public.publication_status;
begin
  if tg_op = 'UPDATE'
     and (old.published_at is not null or old.publication_status in ('PUBLISHED', 'RETRACTED'))
     and (new.status, new.person_id, new.election_id, new.office_id)
         is distinct from (old.status, old.person_id, old.election_id, old.office_id) then
    raise exception 'The status, person, election and office of a published participation cannot be changed. Record a new status as a new, dated participation; retract a wrong record'
      using errcode = 'check_violation';
  end if;

  select eo.publication_status into v_contest_status
  from public.election_offices eo
  where eo.election_id = new.election_id and eo.office_id = new.office_id;

  -- A clearer message than the foreign key violation that would follow.
  if v_contest_status is null then
    raise exception 'This office is not recorded as contested in this election; add it as an election office first'
      using errcode = 'foreign_key_violation';
  end if;

  if new.publication_status = 'PUBLISHED' and v_contest_status <> 'PUBLISHED' then
    raise exception 'election participation % cannot be published: its election office is %', new.id, v_contest_status
      using errcode = 'check_violation';
  end if;
  return new;
end;
$$;

create trigger "26_guard_participation" before insert or update on public.election_participations
  for each row execute function private.guard_participation();

-- ---------------------------------------------------------------------------
-- 6. Editorial workflow: table list and work queue
-- ---------------------------------------------------------------------------

create or replace function private.editorial_tables()
returns text[]
language sql
immutable
set search_path = ''
as $$
  select array[
    'people', 'elections', 'offices', 'political_organizations', 'election_participations',
    'office_terms', 'affiliation_records', 'education_records', 'award_records',
    'policy_position_records', 'legal_case_records', 'asset_disclosure_records', 'sources',
    'claims', 'election_offices'
  ];
$$;

-- Identical to 20261008150050_editorial_evidence_and_queue.sql plus ELECTION_OFFICE (last).
create or replace view public.editorial_queue with (security_invoker = true) as
  select 'PERSON'::text as record_type, 'people'::text as table_name, p.id,
         concat_ws(' ', p.first_name, p.middle_name, p.last_name, p.suffix) as label,
         p.id as person_id, p.publication_status, p.version, p.created_by, p.reviewed_by, p.approved_by, p.updated_at
    from public.people p
  union all
  select 'CLAIM', 'claims', c.id, left(c.statement, 160), c.subject_person_id, c.publication_status, c.version,
         c.created_by, c.reviewed_by, c.approved_by, c.updated_at
    from public.claims c
  union all
  select 'SOURCE', 'sources', s.id, s.title || ' — ' || s.publisher, null, s.publication_status, s.version,
         s.created_by, s.reviewed_by, s.approved_by, s.updated_at
    from public.sources s
  union all
  select 'ELECTION', 'elections', e.id, e.name, null, e.publication_status, e.version,
         e.created_by, e.reviewed_by, e.approved_by, e.updated_at
    from public.elections e
  union all
  select 'OFFICE', 'offices', o.id, o.name || ' (' || o.level || ')', null, o.publication_status, o.version,
         o.created_by, o.reviewed_by, o.approved_by, o.updated_at
    from public.offices o
  union all
  select 'POLITICAL_ORGANIZATION', 'political_organizations', g.id, g.name, null, g.publication_status, g.version,
         g.created_by, g.reviewed_by, g.approved_by, g.updated_at
    from public.political_organizations g
  union all
  select 'ELECTION_PARTICIPATION', 'election_participations', ep.id,
         (select concat_ws(' ', p.first_name, p.last_name) from public.people p where p.id = ep.person_id)
           || ' — ' || ep.status || ' (' || (select e.name from public.elections e where e.id = ep.election_id) || ')',
         ep.person_id, ep.publication_status, ep.version, ep.created_by, ep.reviewed_by, ep.approved_by, ep.updated_at
    from public.election_participations ep
  union all
  select 'OFFICE_TERM', 'office_terms', ot.id,
         (select concat_ws(' ', p.first_name, p.last_name) from public.people p where p.id = ot.person_id)
           || ' — ' || (select o.name from public.offices o where o.id = ot.office_id),
         ot.person_id, ot.publication_status, ot.version, ot.created_by, ot.reviewed_by, ot.approved_by, ot.updated_at
    from public.office_terms ot
  union all
  select 'AFFILIATION', 'affiliation_records', a.id,
         (select concat_ws(' ', p.first_name, p.last_name) from public.people p where p.id = a.person_id)
           || ' — ' || (select g.name from public.political_organizations g where g.id = a.organization_id),
         a.person_id, a.publication_status, a.version, a.created_by, a.reviewed_by, a.approved_by, a.updated_at
    from public.affiliation_records a
  union all
  select 'EDUCATION', 'education_records', ed.id,
         (select concat_ws(' ', p.first_name, p.last_name) from public.people p where p.id = ed.person_id)
           || ' — ' || ed.institution,
         ed.person_id, ed.publication_status, ed.version, ed.created_by, ed.reviewed_by, ed.approved_by, ed.updated_at
    from public.education_records ed
  union all
  select 'POLICY_POSITION', 'policy_position_records', pp.id,
         (select concat_ws(' ', p.first_name, p.last_name) from public.people p where p.id = pp.person_id)
           || ' — ' || pp.topic,
         pp.person_id, pp.publication_status, pp.version, pp.created_by, pp.reviewed_by, pp.approved_by, pp.updated_at
    from public.policy_position_records pp
  union all
  select 'ELECTION_OFFICE', 'election_offices', eo.id,
         (select e.name from public.elections e where e.id = eo.election_id)
           || ' — ' || (select o.name from public.offices o where o.id = eo.office_id),
         null, eo.publication_status, eo.version, eo.created_by, eo.reviewed_by, eo.approved_by, eo.updated_at
    from public.election_offices eo;

revoke all on public.editorial_queue from public, anon;
grant select on public.editorial_queue to authenticated;

-- ---------------------------------------------------------------------------
-- Function privileges (same closing block as every earlier migration)
-- ---------------------------------------------------------------------------

revoke all on all functions in schema private from public;
grant execute on function private.role_rank(public.editorial_role) to anon, authenticated;
grant execute on function private.has_min_role(public.editorial_role) to anon, authenticated;
grant execute on function private.is_staff() to anon, authenticated;
grant execute on function private.editorial_tables() to authenticated;
grant execute on function private.assert_editorial_table(text) to authenticated;
