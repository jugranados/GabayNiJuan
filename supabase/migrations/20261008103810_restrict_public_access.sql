-- Gabay ni Juan — restrict what the public (anon) role can see (Milestone 1)
--
-- Row Level Security limits anon to PUBLISHED rows. This migration limits the
-- COLUMNS and TABLES as well:
--   * editorial identity (created_by, approved_by, reviewed_by, published_by)
--     is never readable by anon,
--   * anon has no access at all to revisions or editorial_roles,
--   * anon keeps only SELECT; REFERENCES and TRIGGER (granted by Supabase's
--     default ACL) are removed,
--   * tables created in the future start with no anon access.
--
-- Consequence: anon must list columns explicitly (`select=id,name`). A bare
-- `select *` fails with "permission denied". The app does this: see
-- mobile/src/data/supabase/publicColumns.ts.
--
-- If a new column should be public, grant it explicitly in a new migration.

do $$
declare
  t text;
  cols text;
begin
  foreach t in array array[
    'people', 'elections', 'offices', 'political_organizations', 'election_participations',
    'office_terms', 'affiliation_records', 'education_records', 'award_records',
    'policy_position_records', 'legal_case_records', 'asset_disclosure_records', 'sources',
    'claims', 'claim_evidence'
  ] loop
    select string_agg(quote_ident(c.column_name), ', ' order by c.ordinal_position)
      into cols
      from information_schema.columns c
      where c.table_schema = 'public'
        and c.table_name = t
        and c.column_name not in ('created_by', 'approved_by', 'reviewed_by', 'published_by');

    execute format('revoke all on public.%I from anon', t);
    execute format('grant select (%s) on public.%I to anon', cols, t);
  end loop;
end
$$;

revoke all on public.revisions from anon;
revoke all on public.editorial_roles from anon;

-- Secure default: tables created later by the migration role (postgres) are
-- invisible to anon until granted. Tables created in the dashboard by
-- supabase_admin still follow Supabase's defaults, so review those by hand.
alter default privileges in schema public revoke all on tables from anon;
