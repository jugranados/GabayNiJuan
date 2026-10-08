-- Gabay ni Juan — editor-facing RPCs for records (Milestone 3). SECURITY INVOKER: RLS and all triggers still apply.


create or replace function public.editorial_transition(
  p_table text,
  p_id uuid,
  p_to public.publication_status,
  p_expected_version integer,
  p_reason text default null
)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_current public.publication_status;
  v_reason text := nullif(btrim(p_reason), '');
  v_row jsonb;
begin
  if not private.is_staff() then
    raise exception 'Editorial access required' using errcode = 'insufficient_privilege';
  end if;
  perform private.assert_editorial_table(p_table);

  execute format('select publication_status from public.%I where id = $1', p_table) into v_current using p_id;
  if v_current is null then
    raise exception 'Record not found' using errcode = 'P0002';
  end if;
  if (v_current in ('PUBLISHED', 'RETRACTED') or p_to = 'RETRACTED') and v_reason is null then
    raise exception 'A reason is required to change or retract a published record' using errcode = 'check_violation';
  end if;

  if v_reason is not null then
    perform set_config('gnj.change_reason', v_reason, true);
  end if;
  execute format(
    'update public.%1$I set publication_status = $1 where id = $2 and version = $3 returning to_jsonb(%1$I)', p_table)
    into v_row using p_to, p_id, p_expected_version;
  perform set_config('gnj.change_reason', '', true);

  if v_row is null then
    raise exception 'STALE_RECORD: this record was changed by someone else; reload and try again'
      using errcode = '40001';
  end if;
  return v_row;
end;
$$;

create or replace function public.editorial_update(
  p_table text,
  p_id uuid,
  p_expected_version integer,
  p_changes jsonb,
  p_reason text default null
)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_protected constant text[] := array[
    'id', 'publication_status', 'published_at', 'record_published_at', 'created_by', 'approved_by',
    'reviewed_by', 'reviewed_at', 'published_by', 'created_at', 'updated_at', 'version'];
  v_current public.publication_status;
  v_reason text := nullif(btrim(p_reason), '');
  v_key text;
  v_set text;
  v_row jsonb;
begin
  if not private.is_staff() then
    raise exception 'Editorial access required' using errcode = 'insufficient_privilege';
  end if;
  perform private.assert_editorial_table(p_table);
  if p_changes is null or jsonb_typeof(p_changes) <> 'object' or p_changes = '{}'::jsonb then
    raise exception 'No changes supplied' using errcode = 'invalid_parameter_value';
  end if;

  for v_key in select jsonb_object_keys(p_changes) loop
    if v_key = any (v_protected)
       or not exists (
         select 1 from pg_attribute a
         where a.attrelid = format('public.%I', p_table)::regclass
           and a.attname = v_key and a.attnum > 0 and not a.attisdropped) then
      raise exception 'Field "%" cannot be edited', v_key using errcode = 'invalid_parameter_value';
    end if;
  end loop;

  execute format('select publication_status from public.%I where id = $1', p_table) into v_current using p_id;
  if v_current is null then
    raise exception 'Record not found' using errcode = 'P0002';
  end if;
  if v_current in ('PUBLISHED', 'RETRACTED') and v_reason is null then
    raise exception 'A reason is required to change a published record' using errcode = 'check_violation';
  end if;

  select string_agg(format('%I = r.%I', k, k), ', ') into v_set from jsonb_object_keys(p_changes) k;

  if v_reason is not null then
    perform set_config('gnj.change_reason', v_reason, true);
  end if;
  execute format(
    'update public.%1$I t set %2$s from jsonb_populate_record(null::public.%1$I, $1) r
       where t.id = $2 and t.version = $3 returning to_jsonb(t)', p_table, v_set)
    into v_row using p_changes, p_id, p_expected_version;
  perform set_config('gnj.change_reason', '', true);

  if v_row is null then
    raise exception 'STALE_RECORD: this record was changed by someone else; reload and try again'
      using errcode = '40001';
  end if;
  return v_row;
end;

revoke all on function public.editorial_transition(text, uuid, public.publication_status, integer, text) from public, anon;
revoke all on function public.editorial_update(text, uuid, integer, jsonb, text) from public, anon;
grant execute on function public.editorial_transition(text, uuid, public.publication_status, integer, text) to authenticated;
grant execute on function public.editorial_update(text, uuid, integer, jsonb, text) to authenticated;
