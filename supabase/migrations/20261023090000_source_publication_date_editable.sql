-- Gabay ni Juan — a source's own publication date is content, not workflow.
--
-- On `sources`, `published_at` is the date the source document was published (an editable field,
-- "Source published on"); the workflow timestamp is `record_published_at` (see core_schema and
-- enforce_publication, which is given 'record_published_at' for this table). Two helpers treated
-- `published_at` as a workflow column on every table, so:
--   * editorial_update refused every edit of a source ("Field "published_at" cannot be edited"),
--     because the editor's form always sends the field; found by the editorial browser tests;
--   * content_of ignored a source's publication date, so changing it would not count as a content
--     change of a record under review.
-- Both now treat `record_published_at` as the workflow column of `sources` and `published_at` as
-- the workflow column of every other table. Nothing else changes.

create or replace function private.content_of(p_row jsonb)
returns jsonb
language sql
immutable
set search_path = ''
as $$
  -- Only `sources` rows carry `record_published_at`; there `published_at` is content.
  select (case when p_row ? 'record_published_at' then p_row - 'record_published_at' else p_row - 'published_at' end)
    - 'publication_status' - 'created_by' - 'approved_by' - 'reviewed_by' - 'reviewed_at'
    - 'published_by' - 'created_at' - 'updated_at' - 'version';
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
    'id', 'publication_status', 'record_published_at', 'created_by', 'approved_by',
    'reviewed_by', 'reviewed_at', 'published_by', 'created_at', 'updated_at', 'version']
    -- The workflow timestamp; on `sources` it is `record_published_at` and `published_at` is content.
    || case when p_table = 'sources' then array[]::text[] else array['published_at'] end;
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
$$;

revoke all on function public.editorial_update(text, uuid, integer, jsonb, text) from public, anon;
grant execute on function public.editorial_update(text, uuid, integer, jsonb, text) to authenticated;
