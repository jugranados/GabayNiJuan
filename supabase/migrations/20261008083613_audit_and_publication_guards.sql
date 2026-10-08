-- Gabay ni Juan — audit trail and publication guards (Milestone 1)
--
-- Enforces docs/DATA_TRUST_GOVERNANCE.md in the database itself:
--   * every insert/update/delete is recorded in an append-only `revisions` log
--   * published (or retracted) rows cannot be deleted; retract instead
--   * changing a published row needs an APPROVER and a stated reason:
--       select set_config('gnj.change_reason', 'Corrected term end date per ...', true);
--   * only APPROVERs can move a row to APPROVED or PUBLISHED
--   * a row can only be PUBLISHED when everything it references is PUBLISHED,
--     and a published claim needs evidence (unless UNVERIFIED) from published sources
--   * a row cannot be unpublished while published rows still depend on it
--
-- Writes made without an authenticated user (SQL editor, service role,
-- migrations) skip the role checks but still need a reason and are logged
-- with editor "system:<db role>".

-- ---------------------------------------------------------------------------
-- Revisions (append-only audit log)
-- ---------------------------------------------------------------------------

create type public.revision_entity_type as enum (
  'PERSON', 'ELECTION', 'OFFICE', 'POLITICAL_ORGANIZATION', 'ELECTION_PARTICIPATION',
  'OFFICE_TERM', 'AFFILIATION', 'EDUCATION', 'AWARD', 'POLICY_POSITION', 'LEGAL_CASE',
  'ASSET_DISCLOSURE', 'SOURCE', 'CLAIM', 'CLAIM_EVIDENCE'
);

create table public.revisions (
  id uuid primary key default gen_random_uuid(),
  entity_type public.revision_entity_type not null,
  entity_id text not null,
  old_value jsonb,
  new_value jsonb,
  editor_id text not null,
  approver_id text,
  reason text not null check (btrim(reason) <> ''),
  created_at timestamptz not null default now(),
  approval_state public.publication_status not null
);
create index revisions_entity_idx on public.revisions (entity_type, entity_id, created_at desc);
comment on table public.revisions is 'Append-only audit log written by triggers. Never updated or deleted.';

alter table public.revisions enable row level security;

create policy "Staff can read revisions" on public.revisions
  for select to authenticated
  using ((select private.is_staff()));

revoke insert, update, delete, truncate on public.revisions from anon, authenticated;

create or replace function private.forbid_revision_changes()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  raise exception 'revisions are append-only' using errcode = 'insufficient_privilege';
end;
$$;

create trigger revisions_append_only
  before update or delete on public.revisions
  for each row execute function private.forbid_revision_changes();

create trigger revisions_no_truncate
  before truncate on public.revisions
  for each statement execute function private.forbid_revision_changes();

-- ---------------------------------------------------------------------------
-- Helpers
-- ---------------------------------------------------------------------------

create or replace function private.change_reason()
returns text
language sql
stable
set search_path = ''
as $$
  select nullif(btrim(current_setting('gnj.change_reason', true)), '');
$$;

create or replace function private.claim_subject_table(t public.claim_subject_record_type)
returns text
language sql
immutable
set search_path = ''
as $$
  select case t
    when 'PERSON' then 'people'
    when 'ELECTION_PARTICIPATION' then 'election_participations'
    when 'OFFICE_TERM' then 'office_terms'
    when 'AFFILIATION' then 'affiliation_records'
    when 'EDUCATION' then 'education_records'
    when 'AWARD' then 'award_records'
    when 'POLICY_POSITION' then 'policy_position_records'
    when 'LEGAL_CASE' then 'legal_case_records'
    when 'ASSET_DISCLOSURE' then 'asset_disclosure_records'
  end;
$$;

create or replace function private.assert_published(p_table text, p_id uuid, p_context text)
returns void
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_status public.publication_status;
begin
  if p_id is null then
    return;
  end if;
  execute format('select publication_status from public.%I where id = $1', p_table)
    into v_status using p_id;
  if v_status is null then
    raise exception '% references missing %.%', p_context, p_table, p_id
      using errcode = 'foreign_key_violation';
  end if;
  if v_status <> 'PUBLISHED' then
    raise exception '% cannot be published: referenced % % is %', p_context, p_table, p_id, v_status
      using errcode = 'check_violation';
  end if;
end;
$$;

-- Refuses to unpublish a row while published rows still reference it.
create or replace function private.assert_no_published_dependents(p_table regclass, p_table_name text, p_id uuid)
returns void
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  r record;
  v_found boolean;
begin
  for r in
    select c.conrelid::regclass as child, a.attname as col
    from pg_catalog.pg_constraint c
    join pg_catalog.pg_attribute a on a.attrelid = c.conrelid and a.attnum = c.conkey[1]
    where c.confrelid = p_table
      and c.contype = 'f'
      and exists (
        select 1 from pg_catalog.pg_attribute pa
        where pa.attrelid = c.conrelid and pa.attname = 'publication_status' and not pa.attisdropped
      )
  loop
    execute format('select exists (select 1 from %s where %I = $1 and publication_status = ''PUBLISHED'')', r.child, r.col)
      into v_found using p_id;
    if v_found then
      raise exception '% % cannot be unpublished: published rows in % still reference it', p_table_name, p_id, r.child
        using errcode = 'foreign_key_violation';
    end if;
  end loop;

  -- Polymorphic claim subjects.
  if exists (
    select 1 from public.claims cl
    where cl.subject_record_id = p_id
      and private.claim_subject_table(cl.subject_record_type) = p_table_name
      and cl.publication_status = 'PUBLISHED'
  ) then
    raise exception '% % cannot be unpublished: published claims still describe it', p_table_name, p_id
      using errcode = 'foreign_key_violation';
  end if;

  -- Sources cited by published claims.
  if p_table_name = 'sources' and exists (
    select 1 from public.claim_evidence ce
    join public.claims cl on cl.id = ce.claim_id
    where ce.source_id = p_id and cl.publication_status = 'PUBLISHED'
  ) then
    raise exception 'source % cannot be unpublished: published claims cite it', p_id
      using errcode = 'foreign_key_violation';
  end if;
end;
$$;

-- ---------------------------------------------------------------------------
-- Trigger functions
-- ---------------------------------------------------------------------------

create or replace function private.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

-- BEFORE UPDATE OR DELETE on publishable tables.
create or replace function private.guard_published_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if old.publication_status in ('PUBLISHED', 'RETRACTED') then
    if tg_op = 'DELETE' then
      raise exception 'Published % records cannot be deleted; set publication_status to RETRACTED', tg_table_name
        using errcode = 'insufficient_privilege';
    end if;
    if (select auth.uid()) is not null and not private.has_min_role('APPROVER') then
      raise exception 'Only approvers can change published % records', tg_table_name
        using errcode = 'insufficient_privilege';
    end if;
    if private.change_reason() is null then
      raise exception 'Changing a published % record requires a reason: select set_config(''gnj.change_reason'', ''...'', true)', tg_table_name
        using errcode = 'check_violation';
    end if;
  end if;

  if tg_op = 'UPDATE' and old.publication_status = 'PUBLISHED' and new.publication_status <> 'PUBLISHED' then
    perform private.assert_no_published_dependents(tg_relid, tg_table_name, old.id);
  end if;

  if tg_op = 'DELETE' then
    return old;
  end if;
  return new;
end;
$$;

-- BEFORE INSERT OR UPDATE on publishable tables.
-- tg_argv[0] = workflow published-at column; tg_argv[1..] = 'column:referenced_table'.
create or replace function private.enforce_publication()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := (select auth.uid());
  v_row jsonb;
  v_col text;
  v_table text;
  i integer;
begin
  if new.publication_status in ('APPROVED', 'PUBLISHED')
     and (tg_op = 'INSERT' or old.publication_status is distinct from new.publication_status) then
    if v_uid is not null then
      if not private.has_min_role('APPROVER') then
        raise exception 'Only approvers can approve or publish % records', tg_table_name
          using errcode = 'insufficient_privilege';
      end if;
      new.approved_by := v_uid;
    end if;
  end if;

  if new.publication_status = 'PUBLISHED' then
    if tg_op = 'INSERT' or old.publication_status <> 'PUBLISHED' then
      new := jsonb_populate_record(new, jsonb_build_object(tg_argv[0], now()));
    end if;
    v_row := to_jsonb(new);
    for i in 1 .. tg_nargs - 1 loop
      v_col := split_part(tg_argv[i], ':', 1);
      v_table := split_part(tg_argv[i], ':', 2);
      perform private.assert_published(v_table, (v_row ->> v_col)::uuid, tg_table_name || ' ' || (v_row ->> 'id'));
    end loop;
  end if;

  return new;
end;
$$;

-- BEFORE INSERT OR UPDATE on claims: evidence and subject rules for publication.
create or replace function private.enforce_claim_publication()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_context text := 'claim ' || new.id;
begin
  if new.publication_status <> 'PUBLISHED' then
    return new;
  end if;

  if new.subject_record_type is not null then
    perform private.assert_published(private.claim_subject_table(new.subject_record_type), new.subject_record_id, v_context);
  end if;

  if new.verification_status <> 'UNVERIFIED'
     and not exists (select 1 from public.claim_evidence ce where ce.claim_id = new.id) then
    raise exception '% cannot be published as %: no evidence attached', v_context, new.verification_status
      using errcode = 'check_violation';
  end if;

  if exists (
    select 1 from public.claim_evidence ce
    join public.sources s on s.id = ce.source_id
    where ce.claim_id = new.id and s.publication_status <> 'PUBLISHED'
  ) then
    raise exception '% cannot be published: it cites an unpublished source', v_context
      using errcode = 'check_violation';
  end if;

  return new;
end;
$$;

-- BEFORE INSERT OR UPDATE OR DELETE on claim_evidence.
-- Changing the evidence of a published claim changes published data.
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

-- AFTER INSERT OR UPDATE OR DELETE: append to revisions. tg_argv[0] = revision_entity_type.
create or replace function private.record_revision()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_old jsonb := case when tg_op <> 'INSERT' then to_jsonb(old) end;
  v_new jsonb := case when tg_op <> 'DELETE' then to_jsonb(new) end;
  v_row jsonb := coalesce(v_new, v_old);
  v_status public.publication_status;
begin
  if tg_op = 'UPDATE' and (v_old - 'updated_at') = (v_new - 'updated_at') then
    return null;
  end if;

  v_status := coalesce(
    (v_row ->> 'publication_status')::public.publication_status,
    (select c.publication_status from public.claims c where c.id = (v_row ->> 'claim_id')::uuid),
    'DRAFT'
  );

  insert into public.revisions (
    entity_type, entity_id, old_value, new_value, editor_id, approver_id, reason, approval_state
  ) values (
    tg_argv[0]::public.revision_entity_type,
    coalesce(v_row ->> 'id', (v_row ->> 'claim_id') || ':' || (v_row ->> 'source_id')),
    v_old,
    v_new,
    coalesce((select auth.uid())::text, 'system:' || session_user),
    v_new ->> 'approved_by',
    coalesce(private.change_reason(), lower(tg_op)),
    v_status
  );
  return null;
end;
$$;

revoke all on all functions in schema private from public;
grant execute on function private.role_rank(public.editorial_role) to anon, authenticated;
grant execute on function private.has_min_role(public.editorial_role) to anon, authenticated;
grant execute on function private.is_staff() to anon, authenticated;

-- ---------------------------------------------------------------------------
-- Attach triggers
-- ---------------------------------------------------------------------------

do $$
declare
  spec record;
begin
  for spec in
    select * from (values
      ('people',                   'PERSON',                 'published_at',        array[]::text[]),
      ('elections',                'ELECTION',               'published_at',        array[]::text[]),
      ('offices',                  'OFFICE',                 'published_at',        array[]::text[]),
      ('political_organizations',  'POLITICAL_ORGANIZATION', 'published_at',        array[]::text[]),
      ('election_participations',  'ELECTION_PARTICIPATION', 'published_at',        array['person_id:people', 'election_id:elections', 'office_id:offices']),
      ('office_terms',             'OFFICE_TERM',            'published_at',        array['person_id:people', 'office_id:offices']),
      ('affiliation_records',      'AFFILIATION',            'published_at',        array['person_id:people', 'organization_id:political_organizations']),
      ('education_records',        'EDUCATION',              'published_at',        array['person_id:people']),
      ('award_records',            'AWARD',                  'published_at',        array['person_id:people']),
      ('policy_position_records',  'POLICY_POSITION',        'published_at',        array['person_id:people']),
      ('legal_case_records',       'LEGAL_CASE',             'published_at',        array['person_id:people']),
      ('asset_disclosure_records', 'ASSET_DISCLOSURE',       'published_at',        array['person_id:people']),
      ('sources',                  'SOURCE',                 'record_published_at', array[]::text[]),
      ('claims',                   'CLAIM',                  'published_at',        array['subject_person_id:people'])
    ) as s(tbl, entity, published_col, refs)
  loop
    execute format(
      'create trigger "10_guard_published_change" before update or delete on public.%I
         for each row execute function private.guard_published_change()', spec.tbl);
    execute format(
      'create trigger "20_enforce_publication" before insert or update on public.%I
         for each row execute function private.enforce_publication(%s)',
      spec.tbl,
      (select string_agg(quote_literal(a), ', ') from unnest(array[spec.published_col] || spec.refs) as a));
    execute format(
      'create trigger "30_set_updated_at" before update on public.%I
         for each row execute function private.set_updated_at()', spec.tbl);
    execute format(
      'create trigger "90_record_revision" after insert or update or delete on public.%I
         for each row execute function private.record_revision(%L)', spec.tbl, spec.entity);
  end loop;
end
$$;

create trigger "25_enforce_claim_publication" before insert or update on public.claims
  for each row execute function private.enforce_claim_publication();

create trigger "10_guard_claim_evidence" before insert or update or delete on public.claim_evidence
  for each row execute function private.guard_claim_evidence();
create trigger "30_set_updated_at" before update on public.claim_evidence
  for each row execute function private.set_updated_at();
create trigger "90_record_revision" after insert or update or delete on public.claim_evidence
  for each row execute function private.record_revision('CLAIM_EVIDENCE');
