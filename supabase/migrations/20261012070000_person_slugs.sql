-- Gabay ni Juan — stable public URL slugs for people (web migration)
--
-- The web app addresses a person as /politicians/<slug>. The UUID stays the identity:
-- every relationship still uses people.id, and a slug is never used as a foreign key.
--
-- Rules:
--   * lowercase ASCII words joined by single hyphens, at most 120 characters, unique;
--   * generated on insert from first name, last name and suffix when none is supplied;
--     a collision gets "-2", "-3", …;
--   * NOT regenerated when a name changes, so correcting a name never breaks a URL;
--   * frozen once the person has ever been published. Changing a public URL afterwards
--     needs a new migration that also keeps the old address working (docs/WEB_MIGRATION.md,
--     "Slug-change policy").
--
-- The rule is mirrored in web/src/domain/slug.ts; web tests check the fixtures against it.
-- This migration also re-creates search_directory so directory cards carry the slug.
-- Ordering, filters and security (SECURITY INVOKER) are unchanged.

alter table public.people add column slug text;
comment on column public.people.slug is
  'Stable public URL slug (/politicians/<slug>). An address, never an identity or a foreign key. Frozen once published.';

create or replace function private.slugify(p_text text)
returns text
language sql
immutable
set search_path = ''
as $$
  select btrim(
    regexp_replace(
      translate(
        lower(coalesce(p_text, '')),
        'àáâãäåèéêëìíîïñòóôõöùúûüýÿçÀÁÂÃÄÅÈÉÊËÌÍÎÏÑÒÓÔÕÖÙÚÛÜÝÇ',
        'aaaaaaeeeeiiiinooooouuuuyycaaaaaaeeeeiiiinooooouuuuyc'
      ),
      '[^a-z0-9]+', '-', 'g'
    ),
    '-'
  );
$$;

-- First free slug for a person: the base, then base-2, base-3, …
create or replace function private.unique_person_slug(p_first text, p_last text, p_suffix text, p_id uuid)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_base text := private.slugify(concat_ws(' ', p_first, p_last, p_suffix));
  v_candidate text;
  v_n integer := 1;
begin
  if v_base = '' then
    v_base := 'person';
  end if;
  v_base := btrim(left(v_base, 100), '-');
  v_candidate := v_base;
  while exists (select 1 from public.people p where p.slug = v_candidate and p.id is distinct from p_id) loop
    v_n := v_n + 1;
    v_candidate := v_base || '-' || v_n;
  end loop;
  return v_candidate;
end;
$$;

-- Backfill existing rows, oldest first so the earliest record keeps the plain slug.
-- One statement, so the change reason required for published rows stays in scope.
do $$
declare
  r record;
begin
  perform set_config('gnj.change_reason', 'Web migration: assign public URL slug', true);
  for r in select id, first_name, last_name, suffix from public.people where slug is null order by created_at, id loop
    update public.people
      set slug = private.unique_person_slug(r.first_name, r.last_name, r.suffix, r.id)
      where id = r.id;
  end loop;
  perform set_config('gnj.change_reason', '', true);
end
$$;

alter table public.people alter column slug set not null;
alter table public.people add constraint people_slug_key unique (slug);
alter table public.people add constraint people_slug_format
  check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$' and length(slug) <= 120);

-- BEFORE INSERT OR UPDATE on people.
create or replace function private.manage_person_slug()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    if new.slug is null or btrim(new.slug) = '' then
      new.slug := private.unique_person_slug(new.first_name, new.last_name, new.suffix, new.id);
    end if;
    return new;
  end if;

  if new.slug is null then
    new.slug := old.slug;
  end if;
  if new.slug is distinct from old.slug
     and (old.published_at is not null or old.publication_status in ('PUBLISHED', 'RETRACTED')) then
    raise exception 'The slug of a published person cannot be changed (it is a public URL)'
      using errcode = 'check_violation';
  end if;
  return new;
end;
$$;

create trigger "05_person_slug" before insert or update on public.people
  for each row execute function private.manage_person_slug();

revoke all on function private.slugify(text) from public;
revoke all on function private.unique_person_slug(text, text, text, uuid) from public;
revoke all on function private.manage_person_slug() from public;

-- anon has column-level SELECT only (restrict_public_access); a new public column needs its own grant.
grant select (slug) on public.people to anon;

-- ---------------------------------------------------------------------------
-- search_directory: identical to 20261008132502_directory_search.sql, plus `slug` on each card.
-- ---------------------------------------------------------------------------

create or replace function public.search_directory(
  p_query text default null,
  p_election_id uuid default null,
  p_office_id uuid default null,
  p_office_level public.office_level default null,
  p_participation_status public.election_participation_status default null,
  p_organization_id uuid default null,
  p_jurisdiction_id text default null,
  p_limit integer default 20,
  p_offset integer default 0
)
returns jsonb
language sql
stable
security invoker
set search_path = ''
as $$
  with params as (
    select
      least(greatest(coalesce(p_limit, 20), 1), 50) as lim,
      greatest(coalesce(p_offset, 0), 0) as off,
      case
        when length(btrim(regexp_replace(coalesce(p_query, ''), '\s+', ' ', 'g'))) >= 2
          then string_to_array(lower(btrim(regexp_replace(p_query, '\s+', ' ', 'g'))), ' ')
        else array[]::text[]
      end as tokens,
      (p_election_id is not null or p_office_id is not null or p_office_level is not null
        or p_participation_status is not null or p_jurisdiction_id is not null) as has_participation_filter
  ),
  matched as (
    select
      p.id, p.slug, p.first_name, p.middle_name, p.last_name, p.suffix, p.preferred_name, p.photo_asset_id,
      (lower(p.last_name) collate "C") as k_last,
      (lower(p.first_name) collate "C") as k_first
    from public.people p
    cross join params
    where not exists (
        select 1
        from unnest(params.tokens) as t(token)
        where strpos(
          lower(concat_ws(' ', p.first_name, p.middle_name, p.last_name, p.suffix, p.preferred_name)),
          t.token
        ) = 0
      )
      and (
        not params.has_participation_filter
        or exists (
          select 1
          from public.election_participations ep
          join public.offices o on o.id = ep.office_id
          where ep.person_id = p.id
            and (p_election_id is null or ep.election_id = p_election_id)
            and (p_office_id is null or ep.office_id = p_office_id)
            and (p_participation_status is null or ep.status = p_participation_status)
            and (p_office_level is null or o.level = p_office_level)
            and (p_jurisdiction_id is null or o.jurisdiction_id = p_jurisdiction_id)
        )
      )
      and (
        p_organization_id is null
        or exists (
          select 1
          from public.affiliation_records a
          where a.person_id = p.id and a.organization_id = p_organization_id
        )
      )
  ),
  page as (
    select m.*
    from matched m
    order by m.k_last, m.k_first, m.id
    limit (select lim from params) offset (select off from params)
  )
  select jsonb_build_object(
    'total', (select count(*) from matched),
    'items', coalesce((
      select jsonb_agg(card.item order by card.k_last, card.k_first, card.id)
      from (
        select
          pg.id, pg.k_last, pg.k_first,
          jsonb_build_object(
            'id', pg.id,
            'slug', pg.slug,
            'first_name', pg.first_name,
            'middle_name', pg.middle_name,
            'last_name', pg.last_name,
            'suffix', pg.suffix,
            'preferred_name', pg.preferred_name,
            'photo_asset_id', pg.photo_asset_id,
            'participations', coalesce((
              select jsonb_agg(
                jsonb_build_object(
                  'office_name', o.name,
                  'election_name', e.name,
                  'election_date', e.election_date,
                  'status', ep.status,
                  'effective_from', ep.effective_from
                )
                order by e.election_date desc, (o.name collate "C"), ep.id
              )
              from public.election_participations ep
              join public.offices o on o.id = ep.office_id
              join public.elections e on e.id = ep.election_id
              where ep.person_id = pg.id
            ), '[]'::jsonb),
            'affiliation', (
              select jsonb_build_object(
                'organization_name', org.name,
                'affiliation_type', a.affiliation_type,
                'start_date', a.start_date
              )
              from public.affiliation_records a
              join public.political_organizations org on org.id = a.organization_id
              where a.person_id = pg.id
                and a.start_date is not null
                and a.start_date <= current_date
                and (a.end_date is null or a.end_date >= current_date)
                and exists (
                  select 1
                  from public.claims c
                  where c.subject_record_type = 'AFFILIATION'
                    and c.subject_record_id = a.id
                    and c.verification_status in ('PRIMARY_SOURCE', 'CORROBORATED', 'SELF_DECLARED', 'REPORTED')
                )
              order by a.start_date desc, (org.name collate "C"), a.id
              limit 1
            )
          ) as item
        from page pg
      ) card
    ), '[]'::jsonb)
  );
$$;

comment on function public.search_directory(text, uuid, uuid, public.office_level, public.election_participation_status, uuid, text, integer, integer)
  is 'Voter directory: name search + filters + alphabetical offset pagination. Security invoker; never ranks.';

revoke all on function public.search_directory(text, uuid, uuid, public.office_level, public.election_participation_status, uuid, text, integer, integer) from public;
grant execute on function public.search_directory(text, uuid, uuid, public.office_level, public.election_participation_status, uuid, text, integer, integer) to anon, authenticated;
