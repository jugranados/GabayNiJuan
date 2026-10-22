-- Gabay ni Juan — evidence RPCs, claim readiness report and staff work queue (Milestone 3).


create or replace function public.editorial_set_evidence(
  p_claim_id uuid,
  p_source_id uuid,
  p_supports boolean,
  p_note text default null,
  p_reason text default null
)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_status public.publication_status;
  v_reason text := nullif(btrim(p_reason), '');
  v_row jsonb;
begin
  if not private.is_staff() then
    raise exception 'Editorial access required' using errcode = 'insufficient_privilege';
  end if;
  select c.publication_status into v_status from public.claims c where c.id = p_claim_id;
  if v_status is null then
    raise exception 'Claim not found' using errcode = 'P0002';
  end if;
  if v_status in ('PUBLISHED', 'RETRACTED') and v_reason is null then
    raise exception 'A reason is required to change the evidence of a published claim' using errcode = 'check_violation';
  end if;

  if v_reason is not null then
    perform set_config('gnj.change_reason', v_reason, true);
  end if;
  insert into public.claim_evidence as ce (claim_id, source_id, supports, note)
  values (p_claim_id, p_source_id, p_supports, nullif(btrim(p_note), ''))
  on conflict (claim_id, source_id) do update set supports = excluded.supports, note = excluded.note
  returning to_jsonb(ce) into v_row;
  perform set_config('gnj.change_reason', '', true);
  return v_row;
end;
$$;

-- SECURITY DEFINER only because the API role has no DELETE grant; the checks and
-- guard_claim_evidence still apply, and auth.uid() is still the caller.
create or replace function public.editorial_remove_evidence(
  p_claim_id uuid,
  p_source_id uuid,
  p_reason text default null
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_status public.publication_status;
  v_reason text := nullif(btrim(p_reason), '');
begin
  if not private.is_staff() then
    raise exception 'Editorial access required' using errcode = 'insufficient_privilege';
  end if;
  select c.publication_status into v_status from public.claims c where c.id = p_claim_id;
  if v_status is null then
    raise exception 'Claim not found' using errcode = 'P0002';
  end if;
  if v_status in ('PUBLISHED', 'RETRACTED') and v_reason is null then
    raise exception 'A reason is required to change the evidence of a published claim' using errcode = 'check_violation';
  end if;

  if v_reason is not null then
    perform set_config('gnj.change_reason', v_reason, true);
  end if;
  delete from public.claim_evidence where claim_id = p_claim_id and source_id = p_source_id;
  if not found then
    raise exception 'Evidence not found' using errcode = 'P0002';
  end if;
  perform set_config('gnj.change_reason', '', true);
end;
$$;

-- Read-only readiness report. The verdict comes from the same function the triggers use,
-- so the admin app never re-implements the verification rules.
create or replace function public.claim_readiness(p_claim_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_claim public.claims;
  v_counts record;
begin
  if not private.is_staff() then
    raise exception 'Editorial access required' using errcode = 'insufficient_privilege';
  end if;
  select * into v_claim from public.claims c where c.id = p_claim_id;
  if not found then
    raise exception 'Claim not found' using errcode = 'P0002';
  end if;

  select
    count(*) as total,
    count(*) filter (where ce.supports) as supporting,
    count(*) filter (where not ce.supports) as contradicting,
    count(*) filter (where ce.supports
      and s.source_type in ('OFFICIAL_GOVERNMENT', 'COURT_OR_TRIBUNAL', 'LEGISLATIVE_RECORD')) as tier1,
    count(distinct lower(btrim(s.publisher))) filter (where ce.supports) as publishers,
    count(*) filter (where s.publication_status <> 'PUBLISHED') as unpublished_sources
  into v_counts
  from public.claim_evidence ce
  join public.sources s on s.id = ce.source_id
  where ce.claim_id = p_claim_id;

  return jsonb_build_object(
    'verification_status', v_claim.verification_status,
    'total', v_counts.total,
    'supporting', v_counts.supporting,
    'contradicting', v_counts.contradicting,
    'tier1_supporting', v_counts.tier1,
    'distinct_publishers', v_counts.publishers,
    'unpublished_sources', v_counts.unpublished_sources,
    'error', private.claim_consistency_error(p_claim_id, v_claim.verification_status)
  );
end;
$$;

-- ---------------------------------------------------------------------------
-- Work queue (staff only; RLS of the underlying tables applies)
-- ---------------------------------------------------------------------------

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
    from public.policy_position_records pp;

-- ---------------------------------------------------------------------------
-- Grants: editorial functions are for signed-in staff only, never anon.
-- ---------------------------------------------------------------------------

revoke all on public.editorial_queue from public, anon;
grant select on public.editorial_queue to authenticated;

revoke all on function public.editorial_transition(text, uuid, public.publication_status, integer, text) from public, anon;
revoke all on function public.editorial_update(text, uuid, integer, jsonb, text) from public, anon;
revoke all on function public.editorial_set_evidence(uuid, uuid, boolean, text, text) from public, anon;
revoke all on function public.editorial_remove_evidence(uuid, uuid, text) from public, anon;
revoke all on function public.claim_readiness(uuid) from public, anon;
grant execute on function public.editorial_transition(text, uuid, public.publication_status, integer, text) to authenticated;
grant execute on function public.editorial_update(text, uuid, integer, jsonb, text) to authenticated;
grant execute on function public.editorial_set_evidence(uuid, uuid, boolean, text, text) to authenticated;
grant execute on function public.editorial_remove_evidence(uuid, uuid, text) to authenticated;
grant execute on function public.claim_readiness(uuid) to authenticated;

revoke all on all functions in schema private from public;
grant execute on function private.role_rank(public.editorial_role) to anon, authenticated;
grant execute on function private.has_min_role(public.editorial_role) to anon, authenticated;
grant execute on function private.is_staff() to anon, authenticated;
