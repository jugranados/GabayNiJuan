-- Gabay ni Juan — claim verification consistency (Milestone 1)
--
-- Database mirror of mobile/src/domain/validation/verification.ts. A claim
-- cannot be PUBLISHED, and the evidence of a published claim cannot be changed
-- into a state, that contradicts its verification status. Nothing is
-- corrected automatically: the write fails with an explanation.
--
--   UNVERIFIED     no requirement
--   any other      at least one attached source, and at least one SUPPORTING source
--   PRIMARY_SOURCE a supporting tier-1 source (official government, court, legislative record)
--   CORROBORATED   supporting sources from at least two distinct publishers
--   DISPUTED       at least one supporting AND one contradicting source
--   all but DISPUTED/OUTDATED   no contradicting source attached (mark it DISPUTED instead)
--   SELF_DECLARED / REPORTED    no extra source-type rule beyond the above
--
-- Keep the source-type list in sync with SOURCE_TIER_BY_TYPE in
-- mobile/src/domain/enums/index.ts.

create or replace function private.claim_consistency_error(p_claim_id uuid, p_status public.verification_status)
returns text
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_total integer;
  v_supporting integer;
  v_contradicting integer;
  v_primary integer;
  v_publishers integer;
begin
  if p_status = 'UNVERIFIED' then
    return null;
  end if;

  select
    count(*),
    count(*) filter (where ce.supports),
    count(*) filter (where not ce.supports),
    count(*) filter (where ce.supports
      and s.source_type in ('OFFICIAL_GOVERNMENT', 'COURT_OR_TRIBUNAL', 'LEGISLATIVE_RECORD')),
    count(distinct lower(btrim(s.publisher))) filter (where ce.supports)
  into v_total, v_supporting, v_contradicting, v_primary, v_publishers
  from public.claim_evidence ce
  join public.sources s on s.id = ce.source_id
  where ce.claim_id = p_claim_id;

  if v_total = 0 then
    return format('%s requires at least one attached source', p_status);
  end if;

  if p_status = 'DISPUTED' then
    if v_supporting = 0 or v_contradicting = 0 then
      return 'DISPUTED requires at least one supporting and one contradicting source';
    end if;
    return null;
  end if;

  if v_supporting = 0 then
    return format('%s requires at least one supporting source', p_status);
  end if;
  if p_status = 'PRIMARY_SOURCE' and v_primary = 0 then
    return 'PRIMARY_SOURCE requires a supporting tier-1 (official government, court, or legislative) source';
  end if;
  if p_status = 'CORROBORATED' and v_publishers < 2 then
    return 'CORROBORATED requires supporting sources from at least two distinct publishers';
  end if;
  if p_status <> 'OUTDATED' and v_contradicting > 0 then
    return 'a contradicting source is attached; mark the claim DISPUTED';
  end if;

  return null;
end;
$$;

-- BEFORE INSERT OR UPDATE on claims: publication rules.
create or replace function private.enforce_claim_publication()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_context text := 'claim ' || new.id;
  v_error text;
begin
  if new.publication_status <> 'PUBLISHED' then
    return new;
  end if;

  if new.subject_record_type is not null then
    perform private.assert_published(private.claim_subject_table(new.subject_record_type), new.subject_record_id, v_context);
  end if;

  if exists (
    select 1 from public.claim_evidence ce
    join public.sources s on s.id = ce.source_id
    where ce.claim_id = new.id and s.publication_status <> 'PUBLISHED'
  ) then
    raise exception '% cannot be published: it cites an unpublished source', v_context
      using errcode = 'check_violation';
  end if;

  v_error := private.claim_consistency_error(new.id, new.verification_status);
  if v_error is not null then
    raise exception '% cannot be published: %', v_context, v_error
      using errcode = 'check_violation';
  end if;

  return new;
end;
$$;

-- AFTER ROW, deferred to commit: re-validates a published claim whenever its
-- evidence is added, changed or removed, so a transaction may reshuffle
-- evidence as long as the final state is consistent.
create or replace function private.recheck_claim_consistency()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_claim public.claims;
  v_error text;
begin
  select * into v_claim from public.claims c
  where c.id = case when tg_op = 'DELETE' then old.claim_id else new.claim_id end;

  if found and v_claim.publication_status = 'PUBLISHED' then
    v_error := private.claim_consistency_error(v_claim.id, v_claim.verification_status);
    if v_error is not null then
      raise exception 'claim % evidence is inconsistent: %', v_claim.id, v_error
        using errcode = 'check_violation';
    end if;
  end if;
  return null;
end;
$$;

create constraint trigger "95_recheck_claim_consistency"
  after insert or update or delete on public.claim_evidence
  deferrable initially deferred
  for each row execute function private.recheck_claim_consistency();

revoke all on all functions in schema private from public;
grant execute on function private.role_rank(public.editorial_role) to anon, authenticated;
grant execute on function private.has_min_role(public.editorial_role) to anon, authenticated;
grant execute on function private.is_staff() to anon, authenticated;
