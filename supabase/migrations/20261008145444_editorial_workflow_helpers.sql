-- Gabay ni Juan — editorial workflow (Milestone 3)
--
-- For signed-in editors (system writes such as seed/migrations stay exempt and are logged):
--   * an ordered publication state machine
--   * the two-person rule (an approver cannot approve what they created or submitted for review)
--   * optimistic concurrency (`version`) plus editor-facing RPCs that take a plain-language
--     reason, so editors never touch the `gnj.change_reason` transaction setting
--   * claim readiness checks before REVIEWED / APPROVED, and a read-only readiness report
--   * reviewed/approved content is frozen until it is returned to DRAFT
--   * a staff-only work queue view
--
-- Allowed transitions (for signed-in users):
--   DRAFT -> SOURCE_ATTACHED -> REVIEWED -> APPROVED -> PUBLISHED -> RETRACTED
--   DRAFT | SOURCE_ATTACHED | REVIEWED | APPROVED -> REJECTED
--   REVIEWED | APPROVED -> DRAFT   (returned for changes)
--   REJECTED -> DRAFT              (reopened)
--   New rows start as DRAFT. RETRACTED is final.

-- ---------------------------------------------------------------------------
-- Settings (private schema, never exposed through the API)
-- ---------------------------------------------------------------------------

create table private.editorial_settings (
  key text primary key,
  value text not null,
  description text not null
);
alter table private.editorial_settings enable row level security;
revoke all on private.editorial_settings from anon, authenticated;
insert into private.editorial_settings (key, value, description) values (
  'allow_self_approval', 'false',
  'Development only. When ''true'' a solo administrator may approve records they created or submitted for review; each such approval is stamped in the revision reason. Keep ''false'' in production.'
);

-- ---------------------------------------------------------------------------
-- Helpers
-- ---------------------------------------------------------------------------

create or replace function private.editorial_tables()
returns text[]
language sql
immutable
set search_path = ''
as $$
  select array[
    'people', 'elections', 'offices', 'political_organizations', 'election_participations',
    'office_terms', 'affiliation_records', 'education_records', 'award_records',
    'policy_position_records', 'legal_case_records', 'asset_disclosure_records', 'sources',
    'claims'
  ];
$$;

create or replace function private.assert_editorial_table(p_table text)
returns void
language plpgsql
immutable
set search_path = ''
as $$
begin
  if p_table is null or not (p_table = any (private.editorial_tables())) then
    raise exception 'Unknown record type' using errcode = 'invalid_parameter_value';
  end if;
end;
$$;

create or replace function private.is_allowed_transition(p_from public.publication_status, p_to public.publication_status)
returns boolean
language sql
immutable
set search_path = ''
as $$
  select (p_from, p_to) in (
    ('DRAFT', 'SOURCE_ATTACHED'),
    ('SOURCE_ATTACHED', 'REVIEWED'),
    ('REVIEWED', 'APPROVED'),
    ('APPROVED', 'PUBLISHED'),
    ('PUBLISHED', 'RETRACTED'),
    ('DRAFT', 'REJECTED'),
    ('SOURCE_ATTACHED', 'REJECTED'),
    ('REVIEWED', 'REJECTED'),
    ('APPROVED', 'REJECTED'),
    ('REVIEWED', 'DRAFT'),
    ('APPROVED', 'DRAFT'),
    ('REJECTED', 'DRAFT')
  );
$$;

-- Columns that describe workflow, not content.
create or replace function private.content_of(p_row jsonb)
returns jsonb
language sql
immutable
set search_path = ''
as $$
  select p_row - 'publication_status' - 'published_at' - 'record_published_at' - 'created_by'
    - 'approved_by' - 'reviewed_by' - 'reviewed_at' - 'published_by' - 'created_at'
    - 'updated_at' - 'version';
$$;


revoke all on all functions in schema private from public;
grant execute on function private.role_rank(public.editorial_role) to anon, authenticated;
grant execute on function private.has_min_role(public.editorial_role) to anon, authenticated;
grant execute on function private.is_staff() to anon, authenticated;
