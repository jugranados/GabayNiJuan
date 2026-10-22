-- Gabay ni Juan — corrections and staff management (Milestone 3)
--
-- Voters (anonymous) can submit a correction request through ONE narrow RPC. They cannot read,
-- list or change any request. Requests contain private data (contact email, explanation, source
-- URL) and are readable by staff only. Accepting a request never edits or publishes a record:
-- the editor makes a normal draft change that goes through review, approval and publication.
--
-- Staff roles can only be changed through admin RPCs that refuse to remove the last admin.

-- ---------------------------------------------------------------------------
-- Correction requests
-- ---------------------------------------------------------------------------

create type public.correction_target_type as enum (
  'PERSON', 'CLAIM', 'SOURCE', 'ELECTION_PARTICIPATION', 'OFFICE_TERM', 'AFFILIATION', 'EDUCATION',
  'POLICY_POSITION'
);
create type public.correction_status as enum ('SUBMITTED', 'UNDER_REVIEW', 'ACCEPTED', 'REJECTED', 'RESOLVED');

create table public.correction_requests (
  id uuid primary key default gen_random_uuid(),
  record_type public.correction_target_type not null,
  record_id uuid not null,
  claim_id uuid references public.claims (id) on delete restrict,
  description text not null check (char_length(btrim(description)) between 10 and 2000),
  source_url text check (char_length(source_url) <= 2000 and source_url ~* '^https?://[^[:space:]]+$'),
  contact_email text check (char_length(contact_email) <= 254 and contact_email ~ '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$'),
  status public.correction_status not null default 'SUBMITTED',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  reviewed_at timestamptz,
  reviewed_by uuid references auth.users (id) on delete set null,
  resolution_note text check (char_length(btrim(resolution_note)) between 1 and 2000),
  version integer not null default 1
);
create index correction_requests_status_idx on public.correction_requests (status, created_at desc);
create index correction_requests_target_idx on public.correction_requests (record_type, record_id);
create index correction_requests_claim_id_idx on public.correction_requests (claim_id);
create index correction_requests_reviewed_by_idx on public.correction_requests (reviewed_by);
comment on table public.correction_requests is
  'Private. Voter-submitted error reports. Never publicly readable; never edits published data by itself.';

alter table public.correction_requests enable row level security;
create policy "Staff read correction requests" on public.correction_requests
  for select to authenticated
  using ((select private.is_staff()));

-- No direct writes for anyone through the API; changes go through the RPCs below.
revoke all on public.correction_requests from public, anon, authenticated;
grant select on public.correction_requests to authenticated;

create or replace function public.submit_correction(
  p_record_type public.correction_target_type,
  p_record_id uuid,
  p_description text,
  p_source_url text default null,
  p_contact_email text default null,
  p_claim_id uuid default null
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_table text;
  v_ok boolean;
  v_description text := btrim(p_description);
  v_url text := nullif(btrim(p_source_url), '');
  v_email text := nullif(btrim(p_contact_email), '');
begin
  -- Deliberately uniform, non-informative errors: this endpoint is open to the internet.
  if p_record_id is null
     or v_description is null or char_length(v_description) not between 10 and 2000
     or (v_url is not null and (char_length(v_url) > 2000 or v_url !~* '^https?://[^[:space:]]+$'))
     or (v_email is not null and (char_length(v_email) > 254 or v_email !~ '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$')) then
    raise exception 'Please check the details and try again' using errcode = 'invalid_parameter_value';
  end if;

  v_table := case p_record_type
    when 'PERSON' then 'people'
    when 'CLAIM' then 'claims'
    when 'SOURCE' then 'sources'
    when 'ELECTION_PARTICIPATION' then 'election_participations'
    when 'OFFICE_TERM' then 'office_terms'
    when 'AFFILIATION' then 'affiliation_records'
    when 'EDUCATION' then 'education_records'
    when 'POLICY_POSITION' then 'policy_position_records'
  end;

  -- Only PUBLISHED records can be reported; a request never reveals unpublished data.
  execute format('select exists (select 1 from public.%I where id = $1 and publication_status = ''PUBLISHED'')', v_table)
    into v_ok using p_record_id;
  if v_ok is not true then
    raise exception 'Please check the details and try again' using errcode = 'invalid_parameter_value';
  end if;
  if p_claim_id is not null and not exists (
    select 1 from public.claims c where c.id = p_claim_id and c.publication_status = 'PUBLISHED'
  ) then
    raise exception 'Please check the details and try again' using errcode = 'invalid_parameter_value';
  end if;

  -- Abuse limits (anonymous callers have no stable identity to rate-limit on):
  -- a cap on open reports per record and a global hourly cap.
  if (select count(*) from public.correction_requests r
       where r.record_type = p_record_type and r.record_id = p_record_id
         and r.status in ('SUBMITTED', 'UNDER_REVIEW')) >= 10
     or (select count(*) from public.correction_requests r
          where r.created_at > now() - interval '1 hour') >= 300 then
    raise exception 'Reports are temporarily unavailable. Please try again later' using errcode = 'insufficient_resources';
  end if;

  insert into public.correction_requests (record_type, record_id, claim_id, description, source_url, contact_email)
  values (p_record_type, p_record_id, p_claim_id, v_description, v_url, v_email);
end;
$$;

-- Staff: UNDER_REVIEW / ACCEPTED / REJECTED / RESOLVED with a note. Does not touch any record.
create or replace function public.review_correction(
  p_id uuid,
  p_status public.correction_status,
  p_expected_version integer,
  p_note text default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := (select auth.uid());
  v_current public.correction_status;
  v_note text := nullif(btrim(p_note), '');
  v_row jsonb;
begin
  if not private.is_staff() then
    raise exception 'Editorial access required' using errcode = 'insufficient_privilege';
  end if;
  select r.status into v_current from public.correction_requests r where r.id = p_id;
  if v_current is null then
    raise exception 'Request not found' using errcode = 'P0002';
  end if;
  if (v_current, p_status) not in (
    ('SUBMITTED', 'UNDER_REVIEW'), ('SUBMITTED', 'REJECTED'),
    ('UNDER_REVIEW', 'ACCEPTED'), ('UNDER_REVIEW', 'REJECTED'),
    ('ACCEPTED', 'RESOLVED')
  ) then
    raise exception 'A request cannot move from % to %', v_current, p_status using errcode = 'check_violation';
  end if;
  if p_status in ('ACCEPTED', 'REJECTED', 'RESOLVED') and v_note is null then
    raise exception 'A resolution note is required' using errcode = 'check_violation';
  end if;

  update public.correction_requests r
     set status = p_status,
         resolution_note = coalesce(v_note, r.resolution_note),
         reviewed_by = v_uid,
         reviewed_at = now(),
         updated_at = now(),
         version = r.version + 1
   where r.id = p_id and r.version = p_expected_version
   returning to_jsonb(r) into v_row;

  if v_row is null then
    raise exception 'STALE_RECORD: this request was changed by someone else; reload and try again'
      using errcode = '40001';
  end if;
  return v_row;
end;
$$;

-- ---------------------------------------------------------------------------
-- Staff directory and role management
-- ---------------------------------------------------------------------------

create table public.editorial_role_events (
  id uuid primary key default gen_random_uuid(),
  target_user_id uuid,
  target_email text not null,
  old_role public.editorial_role,
  new_role public.editorial_role,
  changed_by uuid,
  changed_at timestamptz not null default now()
);
comment on table public.editorial_role_events is 'Append-only log of staff role changes, written by set_staff_role().';
alter table public.editorial_role_events enable row level security;
create policy "Admins read role events" on public.editorial_role_events
  for select to authenticated using ((select private.has_min_role('ADMIN')));
revoke all on public.editorial_role_events from public, anon, authenticated;
grant select on public.editorial_role_events to authenticated;

create or replace function private.forbid_role_event_changes()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  raise exception 'editorial_role_events is append-only' using errcode = 'insufficient_privilege';
end;
$$;
create trigger role_events_append_only before update or delete on public.editorial_role_events
  for each row execute function private.forbid_role_event_changes();
create trigger role_events_no_truncate before truncate on public.editorial_role_events
  for each statement execute function private.forbid_role_event_changes();

-- Staff only: id/email/role of staff members, so the app can show editor names and the admin page.
create or replace function public.staff_directory()
returns table (user_id uuid, email text, role public.editorial_role)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not private.is_staff() then
    raise exception 'Editorial access required' using errcode = 'insufficient_privilege';
  end if;
  return query
    select u.id, u.email::text,
           (select er.role from public.editorial_roles er
             where er.user_id = u.id order by private.role_rank(er.role) desc limit 1)
      from auth.users u
     where exists (select 1 from public.editorial_roles er where er.user_id = u.id)
     order by u.email;
end;
$$;

-- Admin only. Sets the user's single role; a null role removes all roles.
create or replace function public.set_staff_role(p_email text, p_role public.editorial_role)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := (select auth.uid());
  v_target uuid;
  v_email text;
  v_old public.editorial_role;
begin
  if not private.has_min_role('ADMIN') then
    raise exception 'Only administrators can manage roles' using errcode = 'insufficient_privilege';
  end if;
  select u.id, u.email::text into v_target, v_email
    from auth.users u where lower(u.email) = lower(btrim(p_email));
  if v_target is null then
    raise exception 'No account with that email. Create or invite the user in the Supabase dashboard first'
      using errcode = 'P0002';
  end if;

  select er.role into v_old from public.editorial_roles er
   where er.user_id = v_target order by private.role_rank(er.role) desc limit 1;

  if v_old = 'ADMIN' and p_role is distinct from 'ADMIN'
     and not exists (
       select 1 from public.editorial_roles er where er.role = 'ADMIN' and er.user_id <> v_target) then
    raise exception 'Cannot remove the last administrator' using errcode = 'check_violation';
  end if;

  delete from public.editorial_roles where user_id = v_target;
  if p_role is not null then
    insert into public.editorial_roles (user_id, role, granted_by) values (v_target, p_role, v_uid);
  end if;
  insert into public.editorial_role_events (target_user_id, target_email, old_role, new_role, changed_by)
  values (v_target, v_email, v_old, p_role, v_uid);
end;
$$;

-- Role rows change only through set_staff_role().
drop policy "Admins grant roles" on public.editorial_roles;
drop policy "Admins revoke roles" on public.editorial_roles;
revoke insert, update, delete, truncate on public.editorial_roles from anon, authenticated;

-- ---------------------------------------------------------------------------
-- Grants
-- ---------------------------------------------------------------------------

revoke all on function public.submit_correction(public.correction_target_type, uuid, text, text, text, uuid) from public;
grant execute on function public.submit_correction(public.correction_target_type, uuid, text, text, text, uuid) to anon, authenticated;

revoke all on function public.review_correction(uuid, public.correction_status, integer, text) from public, anon;
revoke all on function public.staff_directory() from public, anon;
revoke all on function public.set_staff_role(text, public.editorial_role) from public, anon;
grant execute on function public.review_correction(uuid, public.correction_status, integer, text) to authenticated;
grant execute on function public.staff_directory() to authenticated;
grant execute on function public.set_staff_role(text, public.editorial_role) to authenticated;

revoke all on all functions in schema private from public;
grant execute on function private.role_rank(public.editorial_role) to anon, authenticated;
grant execute on function private.has_min_role(public.editorial_role) to anon, authenticated;
grant execute on function private.is_staff() to anon, authenticated;
