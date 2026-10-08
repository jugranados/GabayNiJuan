-- Gabay ni Juan — directory search (Milestone 2)
--
-- One function does the voter directory query in the database: name search,
-- filters, deterministic ordering and offset pagination, returning a page of
-- lightweight "card" rows plus the total. The device never loads the whole
-- table and never sends long id lists.
--
-- Security: SECURITY INVOKER, so every table it reads is filtered by Row Level
-- Security and the anon column grants exactly as a direct query would be. It
-- can only ever see PUBLISHED rows and non-identity columns when called by anon.
--
-- Semantics (mirrored in mobile/src/data/repositories/inMemoryDirectorySource.ts;
-- supabase.integration.test.ts checks both return the same results):
--   * name search: each whitespace-separated token must appear (case-insensitive)
--     in "first middle last suffix preferred". Queries shorter than 2 characters
--     are ignored.
--   * participation filters (election, office, office level, status,
--     jurisdiction) must all be satisfied by ONE participation of the person.
--   * organization filter: the person has any affiliation record with it.
--   * order: lower(last_name), lower(first_name), id, by code point ("C").
--     Nothing else. No relevance, popularity or other ranking.
--   * card context: participations newest election first; ONE affiliation only
--     if it is current by its dates AND attested by a claim that is
--     PRIMARY_SOURCE, CORROBORATED, SELF_DECLARED or REPORTED.

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
      p.id, p.first_name, p.middle_name, p.last_name, p.suffix, p.preferred_name, p.photo_asset_id,
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

-- Indexes. Foreign keys on election_participations (person, election, office),
-- affiliation_records (person, organization) and claims (subject record) already
-- exist from the core schema.
create index if not exists offices_level_idx on public.offices (level);
create index if not exists offices_jurisdiction_id_idx on public.offices (jurisdiction_id);
create index if not exists election_participations_status_idx on public.election_participations (status);
-- Matches the directory ORDER BY so the first pages can be read in index order.
create index if not exists people_directory_order_idx
  on public.people ((lower(last_name) collate "C"), (lower(first_name) collate "C"), id);
