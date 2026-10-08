-- Gabay ni Juan — publication lifecycle metadata (Milestone 1)
--
-- Decision: publication metadata lives directly on each publishable table
-- (option A), not in a shared "publication" table. The data set is small, the
-- columns are the same everywhere, RLS stays a simple column test, and every
-- change is already captured by the revisions log. A shared table would add a
-- join to every public read and a second place to keep consistent.
--
-- Lifecycle:  DRAFT -> SOURCE_ATTACHED -> REVIEWED -> APPROVED -> PUBLISHED
--             any pre-published state -> REJECTED (kept for the audit trail)
--             PUBLISHED -> RETRACTED (never deleted)
--
-- New columns: reviewed_by, reviewed_at, published_by. They are maintained by
-- the enforce_publication trigger. A signed-in user cannot set or change any
-- editorial identity column directly.

alter type public.publication_status add value if not exists 'REJECTED';

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
    execute format('alter table public.%I add column reviewed_by uuid references auth.users (id) on delete set null', t);
    execute format('alter table public.%I add column reviewed_at timestamptz', t);
    execute format('alter table public.%I add column published_by uuid references auth.users (id) on delete set null', t);
    execute format('create index %I on public.%I (reviewed_by)', t || '_reviewed_by_idx', t);
    execute format('create index %I on public.%I (published_by)', t || '_published_by_idx', t);
  end loop;
end
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
  v_published_col text := tg_argv[0];
  v_changed boolean := tg_op = 'INSERT' or old.publication_status is distinct from new.publication_status;
  v_row jsonb;
  v_col text;
  v_table text;
  i integer;
begin
  -- Editorial identity is system-maintained for signed-in users: they cannot
  -- forge who created, reviewed, approved or published a record.
  if v_uid is not null then
    if tg_op = 'INSERT' then
      new := jsonb_populate_record(new, jsonb_build_object(
        'created_by', v_uid, 'approved_by', null, 'reviewed_by', null,
        'reviewed_at', null, 'published_by', null, v_published_col, null));
    else
      new := jsonb_populate_record(new, jsonb_build_object(
        'created_by', old.created_by, 'approved_by', old.approved_by,
        'reviewed_by', old.reviewed_by, 'reviewed_at', old.reviewed_at,
        'published_by', old.published_by, v_published_col, to_jsonb(old) -> v_published_col));
    end if;
  end if;

  if v_changed then
    if new.publication_status = 'REVIEWED' then
      new.reviewed_by := v_uid;
      new.reviewed_at := now();
    end if;

    if new.publication_status in ('APPROVED', 'PUBLISHED') then
      if v_uid is not null and not private.has_min_role('APPROVER') then
        raise exception 'Only approvers can approve or publish % records', tg_table_name
          using errcode = 'insufficient_privilege';
      end if;
      if new.publication_status = 'APPROVED' then
        new.approved_by := v_uid;
      else
        -- Keep an earlier approver; a direct jump to PUBLISHED approves implicitly.
        new.approved_by := coalesce(new.approved_by, v_uid);
        new.published_by := v_uid;
      end if;
    end if;
  end if;

  if new.publication_status = 'PUBLISHED' then
    if tg_op = 'INSERT' or old.publication_status <> 'PUBLISHED' then
      new := jsonb_populate_record(new, jsonb_build_object(v_published_col, now()));
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

-- The revision log records the reviewer/approver/publisher from the row itself.
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
    coalesce(v_new ->> 'published_by', v_new ->> 'approved_by'),
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
