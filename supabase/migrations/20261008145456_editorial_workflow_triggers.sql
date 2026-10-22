-- Gabay ni Juan — editorial workflow triggers (Milestone 3): state machine, two-person rule, version, frozen review content.

-- ---------------------------------------------------------------------------
-- Triggers
-- ---------------------------------------------------------------------------

-- BEFORE INSERT OR UPDATE: ordered state machine and frozen review content.
create or replace function private.guard_transition()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := (select auth.uid());
  v_error text;
begin
  if v_uid is null then
    return new;
  end if;

  if tg_op = 'INSERT' then
    if new.publication_status <> 'DRAFT' then
      raise exception 'New % records must start as DRAFT', tg_table_name
        using errcode = 'check_violation';
    end if;
    return new;
  end if;

  -- Reviewed or approved content must not change under the approver's feet.
  if old.publication_status in ('REVIEWED', 'APPROVED')
     and new.publication_status <> 'DRAFT'
     and private.content_of(to_jsonb(new)) is distinct from private.content_of(to_jsonb(old)) then
    raise exception 'A % record under review cannot be edited; return it to DRAFT first', tg_table_name
      using errcode = 'check_violation';
  end if;

  if new.publication_status is not distinct from old.publication_status then
    return new;
  end if;

  if not private.is_allowed_transition(old.publication_status, new.publication_status) then
    raise exception 'A % record cannot move from % to %', tg_table_name, old.publication_status, new.publication_status
      using errcode = 'check_violation';
  end if;

  if tg_table_name = 'claims' then
    if new.publication_status = 'SOURCE_ATTACHED' then
      if new.verification_status <> 'UNVERIFIED'
         and not exists (select 1 from public.claim_evidence ce where ce.claim_id = new.id) then
        raise exception 'Attach at least one source before moving this claim to SOURCE_ATTACHED'
          using errcode = 'check_violation';
      end if;
    elsif new.publication_status in ('REVIEWED', 'APPROVED') then
      v_error := private.claim_consistency_error(new.id, new.verification_status);
      if v_error is not null then
        raise exception 'claim % is not ready for %: %', new.id, new.publication_status, v_error
          using errcode = 'check_violation';
      end if;
    end if;
  end if;

  return new;
end;
$$;

-- BEFORE UPDATE: editor != approver.
create or replace function private.enforce_two_person_rule()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := (select auth.uid());
  v_allow boolean;
begin
  if v_uid is null
     or new.publication_status <> 'APPROVED'
     or old.publication_status = 'APPROVED' then
    return new;
  end if;

  if v_uid = old.created_by or v_uid = old.reviewed_by then
    select coalesce((select s.value = 'true' from private.editorial_settings s where s.key = 'allow_self_approval'), false)
      into v_allow;
    if not v_allow then
      raise exception 'Two-person rule: you created or submitted this % record for review, so another approver must approve it', tg_table_name
        using errcode = 'insufficient_privilege';
    end if;
    perform set_config(
      'gnj.change_reason',
      coalesce(private.change_reason() || ' ', '') || '[self-approval permitted by editorial_settings.allow_self_approval]',
      true);
  end if;
  return new;
end;
$$;

-- BEFORE UPDATE: version counts content/workflow changes (no-op updates do not bump it).
create or replace function private.bump_version()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if (to_jsonb(new) - 'updated_at' - 'version') is distinct from (to_jsonb(old) - 'updated_at' - 'version') then
    new.version := old.version + 1;
  else
    new.version := old.version;
  end if;
  return new;
end;
$$;

do $$
declare
  t text;
begin
  foreach t in array private.editorial_tables() loop
    execute format('alter table public.%I add column version integer not null default 1', t);
    execute format(
      'create trigger "15_guard_transition" before insert or update on public.%I
         for each row execute function private.guard_transition()', t);
    execute format(
      'create trigger "22_two_person_rule" before update on public.%I
         for each row execute function private.enforce_two_person_rule()', t);
    execute format(
      'create trigger "35_bump_version" before update on public.%I
         for each row execute function private.bump_version()', t);
  end loop;
end
$$;

-- Evidence of a claim under review is frozen too (same function body as before + one rule).
create or replace function private.guard_claim_evidence()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_claim public.claims;
begin
  select * into v_claim from public.claims c
  where c.id = case when tg_op = 'DELETE' then old.claim_id else new.claim_id end;

  if tg_op = 'UPDATE' and old.claim_id <> new.claim_id then
    raise exception 'claim_evidence cannot be moved to another claim; remove and re-attach'
      using errcode = 'check_violation';
  end if;

  if v_claim.publication_status in ('REVIEWED', 'APPROVED') and (select auth.uid()) is not null then
    raise exception 'Evidence of a claim under review cannot change; return the claim to DRAFT first'
      using errcode = 'check_violation';
  end if;

  if v_claim.publication_status in ('PUBLISHED', 'RETRACTED') then
    if (select auth.uid()) is not null and not private.has_min_role('APPROVER') then
      raise exception 'Only approvers can change evidence of a published claim'
        using errcode = 'insufficient_privilege';
    end if;
    if private.change_reason() is null then
      raise exception 'Changing evidence of a published claim requires a reason: select set_config(''gnj.change_reason'', ''...'', true)'
        using errcode = 'check_violation';
    end if;
    if tg_op <> 'DELETE' then
      perform private.assert_published('sources', new.source_id, 'evidence for claim ' || v_claim.id);
    elsif v_claim.verification_status <> 'UNVERIFIED' and not exists (
      select 1 from public.claim_evidence ce
      where ce.claim_id = old.claim_id and ce.source_id <> old.source_id
    ) then
      raise exception 'Cannot remove the last source of published claim %; change its status first', v_claim.id
        using errcode = 'check_violation';
    end if;
  end if;

  if tg_op = 'DELETE' then
    return old;
  end if;
  return new;
end;
$$;


revoke all on all functions in schema private from public;
grant execute on function private.role_rank(public.editorial_role) to anon, authenticated;
grant execute on function private.has_min_role(public.editorial_role) to anon, authenticated;
grant execute on function private.is_staff() to anon, authenticated;
