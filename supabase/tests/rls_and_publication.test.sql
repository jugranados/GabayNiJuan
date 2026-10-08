-- Gabay ni Juan — database tests: RLS, publication lifecycle, audit, consistency.
--
-- Plain SQL so it runs anywhere:
--   psql "$DB_URL" -v ON_ERROR_STOP=1 -f supabase/tests/rls_and_publication.test.sql
-- Local stack: DB_URL=postgresql://postgres:postgres@127.0.0.1:54322/postgres
--
-- Everything runs in one transaction that is rolled back, so it leaves no data
-- behind and can run on a seeded database. Test rows use the last name
-- 'RlsTest' and fictional users @example.org. Any failure aborts with
-- "FAILED: <what>".

begin;

create function pg_temp.check(cond boolean, label text) returns void
language plpgsql as $fn$
begin
  if cond is not true then
    raise exception 'FAILED: %', label;
  end if;
  raise notice 'ok - %', label;
end
$fn$;

-- Runs `stmt` as a database role (optionally as a signed-in user) and returns
-- the first column of its first row as text.
create function pg_temp.scalar_as(db_role text, uid uuid, stmt text) returns text
language plpgsql as $fn$
declare
  v text;
begin
  if uid is not null then
    perform set_config('request.jwt.claims', json_build_object('sub', uid, 'role', db_role)::text, true);
  end if;
  execute format('set local role %I', db_role);
  execute stmt into v;
  execute 'reset role';
  perform set_config('request.jwt.claims', '', true);
  return v;
end
$fn$;

-- Asserts that `stmt` fails with a message containing `expected`.
create function pg_temp.expect_error(stmt text, expected text, label text,
                                     uid uuid default null, db_role text default 'postgres') returns void
language plpgsql as $fn$
declare
  v_msg text;
begin
  begin
    if uid is not null then
      perform set_config('request.jwt.claims', json_build_object('sub', uid, 'role', db_role)::text, true);
    end if;
    if db_role <> 'postgres' then
      execute format('set local role %I', db_role);
    end if;
    execute stmt;
    execute 'reset role';
    perform set_config('request.jwt.claims', '', true);
  exception when others then
    get stacked diagnostics v_msg = message_text;
    if position(lower(expected) in lower(v_msg)) = 0 then
      raise exception 'FAILED: % (expected an error containing "%", got "%")', label, expected, v_msg;
    end if;
    raise notice 'ok - %', label;
    return;
  end;
  raise exception 'FAILED: % (statement succeeded but should have failed)', label;
end
$fn$;

do $test$
declare
  reviewer uuid := gen_random_uuid();
  approver uuid := gen_random_uuid();
  outsider uuid := gen_random_uuid();
  p_pub uuid; p_draft uuid; p_rejected uuid; p_retracted uuid; p_work uuid;
  s_gov uuid; s_news1 uuid; s_news2 uuid;
  c uuid; r record; v text;
  public_tables text[] := array[
    'people', 'elections', 'offices', 'political_organizations', 'election_participations',
    'office_terms', 'affiliation_records', 'education_records', 'award_records',
    'policy_position_records', 'legal_case_records', 'asset_disclosure_records', 'sources',
    'claims', 'claim_evidence'];
begin
  insert into auth.users (id, aud, role, email) values
    (reviewer, 'authenticated', 'authenticated', 'reviewer-rls@example.org'),
    (approver, 'authenticated', 'authenticated', 'approver-rls@example.org'),
    (outsider, 'authenticated', 'authenticated', 'outsider-rls@example.org');
  insert into public.editorial_roles (user_id, role) values (reviewer, 'REVIEWER'), (approver, 'APPROVER');

  ---------------------------------------------------------------------------
  -- 1. Anonymous reads: only PUBLISHED rows
  ---------------------------------------------------------------------------
  insert into public.people (first_name, last_name) values ('Published', 'RlsTest') returning id into p_pub;
  insert into public.people (first_name, last_name) values ('Draft', 'RlsTest') returning id into p_draft;
  insert into public.people (first_name, last_name, publication_status) values ('Rejected', 'RlsTest', 'REJECTED') returning id into p_rejected;
  insert into public.people (first_name, last_name) values ('Retracted', 'RlsTest') returning id into p_retracted;

  update public.people set publication_status = 'PUBLISHED' where id in (p_pub, p_retracted);
  perform set_config('gnj.change_reason', 'test: retract', true);
  update public.people set publication_status = 'RETRACTED' where id = p_retracted;
  perform set_config('gnj.change_reason', '', true);

  perform pg_temp.check(
    pg_temp.scalar_as('anon', null, $q$select count(*) from public.people where last_name = 'RlsTest'$q$) = '1',
    'anon sees only the PUBLISHED person (not draft, rejected or retracted)');
  perform pg_temp.check(
    pg_temp.scalar_as('anon', null, format('select first_name from public.people where id = %L', p_pub)) = 'Published',
    'anon can read a published row');
  perform pg_temp.check(
    pg_temp.scalar_as('anon', null, format('select count(*) from public.people where id = %L', p_draft)) = '0',
    'anon cannot read a draft by id');

  -- Milestone 2: the directory function runs as the caller, so it inherits RLS.
  perform pg_temp.check(
    not (select prosecdef from pg_proc where proname = 'search_directory' and pronamespace = 'public'::regnamespace),
    'search_directory is SECURITY INVOKER');
  perform pg_temp.check(
    pg_temp.scalar_as('anon', null, $q$select (public.search_directory('rlstest') ->> 'total')$q$) = '1',
    'search_directory (anon) counts only the PUBLISHED person, not drafts, rejected or retracted');
  perform pg_temp.check(
    pg_temp.scalar_as('anon', null, $q$select (public.search_directory('rlstest') -> 'items' -> 0 ->> 'first_name')$q$) = 'Published',
    'search_directory (anon) returns the published person');

  ---------------------------------------------------------------------------
  -- 2. Anonymous cannot write, and cannot see editorial data
  ---------------------------------------------------------------------------
  perform pg_temp.expect_error($q$insert into public.people (first_name, last_name) values ('Anon', 'RlsTest')$q$,
    'permission denied', 'anon cannot INSERT people', null, 'anon');
  perform pg_temp.expect_error(format('update public.people set first_name = ''Hacked'' where id = %L', p_pub),
    'permission denied', 'anon cannot UPDATE people', null, 'anon');
  perform pg_temp.expect_error(format('delete from public.people where id = %L', p_pub),
    'permission denied', 'anon cannot DELETE people', null, 'anon');
  perform pg_temp.expect_error($q$insert into public.claims (claim_type, statement, verification_status) values ('X', 'Y', 'UNVERIFIED')$q$,
    'permission denied', 'anon cannot INSERT claims', null, 'anon');
  perform pg_temp.expect_error($q$insert into public.claim_evidence (claim_id, source_id, supports) values (gen_random_uuid(), gen_random_uuid(), true)$q$,
    'permission denied', 'anon cannot INSERT claim_evidence', null, 'anon');
  perform pg_temp.expect_error($q$insert into public.editorial_roles (user_id, role) values (gen_random_uuid(), 'ADMIN')$q$,
    'permission denied', 'anon cannot grant roles', null, 'anon');
  perform pg_temp.expect_error($q$select count(*) from public.revisions$q$,
    'permission denied', 'anon cannot read revisions', null, 'anon');
  perform pg_temp.expect_error($q$select count(*) from public.editorial_roles$q$,
    'permission denied', 'anon cannot read editorial_roles', null, 'anon');

  for r in
    select t.name,
      (select string_agg(quote_ident(col.column_name), ', ' order by col.ordinal_position)
         from information_schema.columns col
        where col.table_schema = 'public' and col.table_name = t.name
          and col.column_name not in ('created_by', 'approved_by', 'reviewed_by', 'published_by', 'version')) as cols
    from unnest(public_tables) as t(name)
  loop
    perform pg_temp.scalar_as('anon', null, format('select count(*) from (select %s from public.%I limit 1) x', r.cols, r.name));
    perform pg_temp.expect_error(format('select * from public.%I limit 1', r.name),
      'permission denied', format('anon cannot SELECT * (editorial identity columns) from %s', r.name), null, 'anon');
  end loop;
  perform pg_temp.check(true, 'anon can read every public column of all 15 public tables');
  perform pg_temp.expect_error($q$select created_by from public.people$q$,
    'permission denied', 'anon cannot read people.created_by', null, 'anon');
  perform pg_temp.expect_error($q$select published_by from public.claims$q$,
    'permission denied', 'anon cannot read claims.published_by', null, 'anon');
  perform pg_temp.expect_error($q$select version from public.people$q$,
    'permission denied', 'anon cannot read people.version (editorial concurrency column)', null, 'anon');

  ---------------------------------------------------------------------------
  -- 3. Publish gates and the audit trail (system role)
  ---------------------------------------------------------------------------
  insert into public.elections (name, election_date, status) values ('Test election (fictional)', '2027-05-10', 'UPCOMING');
  perform pg_temp.expect_error(
    format($q$insert into public.education_records (person_id, institution, publication_status) values (%L, 'School', 'PUBLISHED')$q$, p_draft),
    'cannot be published', 'cannot publish a record whose person is a draft');

  insert into public.sources (title, publisher, url, source_type, retrieved_at)
    values ('Gov doc (fictional)', 'Fictional Office', 'https://example.org/gov', 'OFFICIAL_GOVERNMENT', '2026-09-30') returning id into s_gov;
  insert into public.sources (title, publisher, url, source_type, retrieved_at)
    values ('News A (fictional)', 'Paper A', 'https://example.org/a', 'NEWS', '2026-09-30') returning id into s_news1;
  insert into public.sources (title, publisher, url, source_type, retrieved_at)
    values ('News B (fictional)', 'Paper B', 'https://example.org/b', 'NEWS', '2026-09-30') returning id into s_news2;
  update public.sources set publication_status = 'PUBLISHED' where id in (s_gov, s_news1, s_news2);

  insert into public.claims (subject_person_id, claim_type, statement, verification_status)
    values (p_pub, 'TEST', 'A fictional statement.', 'SELF_DECLARED') returning id into c;
  perform pg_temp.expect_error(format('update public.claims set publication_status = ''PUBLISHED'' where id = %L', c),
    'requires at least one attached source', 'claim without evidence cannot be published');

  insert into public.sources (title, publisher, url, source_type, retrieved_at)
    values ('Draft source (fictional)', 'Paper C', 'https://example.org/c', 'NEWS', '2026-09-30') returning id into v;
  insert into public.claim_evidence (claim_id, source_id, supports) values (c, v::uuid, true);
  perform pg_temp.expect_error(format('update public.claims set publication_status = ''PUBLISHED'' where id = %L', c),
    'unpublished source', 'claim citing an unpublished source cannot be published');
  delete from public.claim_evidence where claim_id = c;

  -- PRIMARY_SOURCE needs a tier-1 supporting source
  update public.claims set verification_status = 'PRIMARY_SOURCE' where id = c;
  insert into public.claim_evidence (claim_id, source_id, supports) values (c, s_news1, true);
  perform pg_temp.expect_error(format('update public.claims set publication_status = ''PUBLISHED'' where id = %L', c),
    'tier-1', 'PRIMARY_SOURCE with only a news source is rejected');
  -- CORROBORATED needs two distinct publishers
  update public.claims set verification_status = 'CORROBORATED' where id = c;
  perform pg_temp.expect_error(format('update public.claims set publication_status = ''PUBLISHED'' where id = %L', c),
    'two distinct publishers', 'CORROBORATED with one publisher is rejected');
  -- DISPUTED needs conflict
  update public.claims set verification_status = 'DISPUTED' where id = c;
  perform pg_temp.expect_error(format('update public.claims set publication_status = ''PUBLISHED'' where id = %L', c),
    'one contradicting', 'DISPUTED without contradicting evidence is rejected');
  -- Contradicting source on a non-DISPUTED claim
  update public.claims set verification_status = 'REPORTED' where id = c;
  insert into public.claim_evidence (claim_id, source_id, supports) values (c, s_news2, false);
  perform pg_temp.expect_error(format('update public.claims set publication_status = ''PUBLISHED'' where id = %L', c),
    'mark the claim DISPUTED', 'REPORTED with contradicting evidence is rejected');
  -- Only contradicting evidence
  delete from public.claim_evidence where claim_id = c and source_id = s_news1;
  update public.claims set verification_status = 'SELF_DECLARED' where id = c;
  perform pg_temp.expect_error(format('update public.claims set publication_status = ''PUBLISHED'' where id = %L', c),
    'at least one supporting source', 'claim with only contradicting evidence is rejected');
  -- A consistent DISPUTED claim publishes, with both kinds of evidence retained
  insert into public.claim_evidence (claim_id, source_id, supports) values (c, s_news1, true);
  update public.claims set verification_status = 'DISPUTED', publication_status = 'PUBLISHED' where id = c;
  perform pg_temp.check(
    pg_temp.scalar_as('anon', null, format('select count(*) from public.claim_evidence where claim_id = %L', c)) = '2',
    'anon sees both supporting and contradicting evidence of a published claim');
  perform pg_temp.check(
    pg_temp.scalar_as('anon', null, format('select count(*) from public.claim_evidence where claim_id = %L and not supports', c)) = '1',
    'contradicting evidence (supports = false) is retained and public');

  -- Evidence changes are re-validated at commit
  perform pg_temp.expect_error(
    format($q$select set_config('gnj.change_reason', 'test', true);
              delete from public.claim_evidence where claim_id = %L and not supports;
              set constraints all immediate$q$, c),
    'DISPUTED requires', 'removing the conflict from a DISPUTED published claim is rejected');

  -- Published rows: reason, no delete, no unpublish with dependents
  perform pg_temp.expect_error(format('update public.people set first_name = ''Changed'' where id = %L', p_pub),
    'requires a reason', 'changing a published row without a reason is rejected');
  perform pg_temp.expect_error(format('delete from public.people where id = %L', p_pub),
    'cannot be deleted', 'published rows cannot be deleted');
  perform pg_temp.expect_error(format($q$select set_config('gnj.change_reason', 'test', true); update public.people set publication_status = 'RETRACTED' where id = %L$q$, p_pub),
    'cannot be unpublished', 'a person with published claims cannot be retracted');
  perform set_config('gnj.change_reason', 'test: fix middle name', true);
  update public.people set middle_name = 'Corrected' where id = p_pub;
  perform set_config('gnj.change_reason', '', true);
  select count(*) into r from public.revisions
    where entity_type = 'PERSON' and entity_id = p_pub::text and reason = 'test: fix middle name'
      and jsonb_typeof(old_value) = 'object' and old_value ->> 'middle_name' is null
      and new_value ->> 'middle_name' = 'Corrected';
  perform pg_temp.check(r.count = 1, 'a correction is logged in revisions with JSONB old/new values and the reason');
  -- Scoped to this test's own rows, so even a missing trigger could not touch other audit data.
  perform pg_temp.expect_error(
    format('update public.revisions set reason = ''tampered'' where entity_id = %L', p_pub),
    'append-only', 'revisions cannot be updated');
  perform pg_temp.expect_error(
    format('delete from public.revisions where entity_id = %L', p_pub),
    'append-only', 'revisions cannot be deleted');

  ---------------------------------------------------------------------------
  -- 4. Editorial roles
  ---------------------------------------------------------------------------
  perform pg_temp.expect_error($q$insert into public.people (first_name, last_name) values ('Out', 'RlsTest')$q$,
    'row-level security', 'a signed-in user without a role cannot insert', outsider, 'authenticated');
  perform pg_temp.check(
    pg_temp.scalar_as('authenticated', outsider, format('select count(*) from public.people where id = %L', p_draft)) = '0',
    'a signed-in user without a role cannot see drafts');
  perform pg_temp.check(
    pg_temp.scalar_as('authenticated', outsider, 'select count(*) from public.revisions') = '0',
    'a signed-in user without a role cannot read revisions');

  p_work := pg_temp.scalar_as('authenticated', reviewer,
    format($q$insert into public.people (first_name, last_name, created_by, approved_by, reviewed_by, published_by)
              values ('Work', 'RlsTest', %L, %L, %L, %L) returning id$q$, outsider, outsider, outsider, outsider))::uuid;
  select * into r from public.people where id = p_work;
  perform pg_temp.check(r.created_by = reviewer, 'a reviewer cannot spoof created_by');
  perform pg_temp.check(r.approved_by is null and r.reviewed_by is null and r.published_by is null,
    'a reviewer cannot pre-fill approver, reviewer or publisher');

  -- Milestone 3: ordered state machine for signed-in editors.
  perform pg_temp.expect_error(format($q$update public.people set publication_status = 'PUBLISHED' where id = %L$q$, p_work),
    'cannot move from DRAFT to PUBLISHED', 'a reviewer cannot jump a draft to PUBLISHED', reviewer, 'authenticated');
  perform pg_temp.expect_error(format($q$update public.people set publication_status = 'APPROVED' where id = %L$q$, p_work),
    'cannot move from DRAFT to APPROVED', 'a reviewer cannot jump a draft to APPROVED', reviewer, 'authenticated');
  perform pg_temp.expect_error(format($q$update public.people set publication_status = 'REVIEWED' where id = %L$q$, p_work),
    'cannot move from DRAFT to REVIEWED', 'a draft cannot skip SOURCE_ATTACHED', reviewer, 'authenticated');
  perform pg_temp.scalar_as('authenticated', reviewer,
    format($q$update public.people set publication_status = 'SOURCE_ATTACHED' where id = %L returning 1$q$, p_work));

  perform pg_temp.scalar_as('authenticated', reviewer,
    format($q$update public.people set publication_status = 'REVIEWED', approved_by = %L, published_by = %L where id = %L returning 1$q$, outsider, outsider, p_work));
  select * into r from public.people where id = p_work;
  perform pg_temp.check(r.reviewed_by = reviewer and r.reviewed_at is not null, 'review stamps reviewed_by and reviewed_at');
  perform pg_temp.check(r.approved_by is null and r.published_by is null, 'a reviewer cannot forge approved_by or published_by');

  perform pg_temp.expect_error(format($q$update public.people set publication_status = 'APPROVED' where id = %L$q$, p_work),
    'Only approvers', 'a reviewer cannot approve', reviewer, 'authenticated');
  perform pg_temp.expect_error(format($q$update public.people set publication_status = 'PUBLISHED' where id = %L$q$, p_work),
    'cannot move from REVIEWED to PUBLISHED', 'an approver cannot skip APPROVED', approver, 'authenticated');
  perform pg_temp.scalar_as('authenticated', approver,
    format($q$update public.people set publication_status = 'APPROVED' where id = %L returning 1$q$, p_work));
  perform pg_temp.scalar_as('authenticated', approver,
    format($q$update public.people set publication_status = 'PUBLISHED' where id = %L returning 1$q$, p_work));
  select * into r from public.people where id = p_work;
  perform pg_temp.check(r.publication_status = 'PUBLISHED' and r.published_at is not null, 'an approver can publish and published_at is set');
  perform pg_temp.check(r.approved_by = approver and r.published_by = approver and r.reviewed_by = reviewer,
    'created/reviewed/approved/published identities are recorded');
  perform pg_temp.check(
    pg_temp.scalar_as('anon', null, format('select count(*) from public.people where id = %L', p_work)) = '1',
    'anon sees the person once published');
  perform pg_temp.check(
    pg_temp.scalar_as('anon', null, $q$select (public.search_directory('rlstest') ->> 'total')$q$) = '2',
    'search_directory (anon) includes a person once an approver publishes them');
  perform pg_temp.expect_error(format('delete from public.people where id = %L', p_work),
    'permission denied', 'even an approver cannot delete through the API', approver, 'authenticated');
  perform pg_temp.expect_error(format($q$insert into public.editorial_roles (user_id, role) values (%L, 'ADMIN')$q$, reviewer),
    'row-level security', 'a reviewer cannot grant themselves a role', reviewer, 'authenticated');

  select count(*) into r from public.revisions
    where entity_type = 'PERSON' and entity_id = p_work::text and approval_state = 'PUBLISHED'
      and editor_id = approver::text and approver_id = approver::text;
  perform pg_temp.check(r.count = 1, 'the publish revision records editor and approver');
  perform pg_temp.check(
    pg_temp.scalar_as('authenticated', reviewer, format($q$select count(*) from public.revisions where entity_id = %L$q$, p_work))::int >= 3,
    'staff can read the revision history');


  ---------------------------------------------------------------------------
  -- 5. Milestone 3: editorial workflow, concurrency, corrections, roles
  ---------------------------------------------------------------------------
  declare
    approver2 uuid := gen_random_uuid();
    admin_u uuid := gen_random_uuid();
    pw uuid; cw uuid; tgt uuid; ver text; cid uuid;
  begin
    insert into auth.users (id, aud, role, email) values
      (approver2, 'authenticated', 'authenticated', 'approver2-rls@example.org'),
      (admin_u, 'authenticated', 'authenticated', 'admin-rls@example.org');
    insert into public.editorial_roles (user_id, role) values (approver2, 'APPROVER'), (admin_u, 'ADMIN');

    -- New rows must start as DRAFT, whoever inserts them.
    perform pg_temp.expect_error($q$insert into public.people (first_name, last_name, publication_status) values ('Jump', 'RlsTest', 'PUBLISHED')$q$,
      'must start as DRAFT', 'a reviewer cannot insert a PUBLISHED row', reviewer, 'authenticated');
    perform pg_temp.expect_error($q$insert into public.people (first_name, last_name, publication_status) values ('Jump', 'RlsTest', 'REVIEWED')$q$,
      'must start as DRAFT', 'a signed-in editor cannot insert a non-draft row', reviewer, 'authenticated');

    -- RPCs: concurrency, protected fields, reasons.
    pw := pg_temp.scalar_as('authenticated', reviewer,
      $q$insert into public.people (first_name, last_name) values ('Rpc', 'RlsTest') returning id$q$)::uuid;
    perform pg_temp.check(
      pg_temp.scalar_as('authenticated', reviewer, format($q$select version from public.people where id = %L$q$, pw)) = '1',
      'new rows start at version 1');
    ver := pg_temp.scalar_as('authenticated', reviewer,
      format($q$select (public.editorial_update('people', %L, 1, '{"middle_name":"Rpcmid"}'::jsonb)) ->> 'version'$q$, pw));
    perform pg_temp.check(ver = '2', 'editorial_update bumps the version');
    perform pg_temp.expect_error(
      format($q$select public.editorial_update('people', %L, 1, '{"middle_name":"Stale"}'::jsonb)$q$, pw),
      'changed by someone else', 'a stale editor screen cannot overwrite newer work', reviewer, 'authenticated');
    perform pg_temp.check(
      pg_temp.scalar_as('authenticated', reviewer, format($q$select middle_name from public.people where id = %L$q$, pw)) = 'Rpcmid',
      'the stale write changed nothing');
    perform pg_temp.expect_error(
      format($q$select public.editorial_transition('people', %L, 'SOURCE_ATTACHED', 1)$q$, pw),
      'changed by someone else', 'a stale transition is rejected', reviewer, 'authenticated');
    perform pg_temp.expect_error(
      format($q$select public.editorial_update('people', %L, 2, '{"publication_status":"PUBLISHED"}'::jsonb)$q$, pw),
      'cannot be edited', 'editorial_update refuses workflow columns', reviewer, 'authenticated');
    perform pg_temp.expect_error(
      format($q$select public.editorial_update('people', %L, 2, '{"created_by":null}'::jsonb)$q$, pw),
      'cannot be edited', 'editorial_update refuses identity columns', reviewer, 'authenticated');
    perform pg_temp.expect_error($q$select public.editorial_update('revisions', gen_random_uuid(), 1, '{"reason":"x"}'::jsonb)$q$,
      'Unknown record type', 'editorial_update only works on editorial tables', reviewer, 'authenticated');
    perform pg_temp.expect_error(format($q$select public.editorial_update('people', %L, 2, '{"middle_name":"x"}'::jsonb)$q$, pw),
      'permission denied', 'anon cannot call editorial_update', null, 'anon');
    perform pg_temp.expect_error(format($q$select public.editorial_update('people', %L, 2, '{"middle_name":"x"}'::jsonb)$q$, pw),
      'Editorial access required', 'a user without a role cannot call editorial_update', outsider, 'authenticated');

    -- Reviewed content is frozen; it can be returned to draft.
    perform pg_temp.scalar_as('authenticated', reviewer, format($q$select public.editorial_transition('people', %L, 'SOURCE_ATTACHED', 2)::text$q$, pw));
    perform pg_temp.scalar_as('authenticated', reviewer, format($q$select public.editorial_transition('people', %L, 'REVIEWED', 3)::text$q$, pw));
    perform pg_temp.expect_error(
      format($q$select public.editorial_update('people', %L, 4, '{"middle_name":"Late edit"}'::jsonb)$q$, pw),
      'under review', 'reviewed content cannot be edited', reviewer, 'authenticated');
    perform pg_temp.scalar_as('authenticated', reviewer, format($q$select public.editorial_transition('people', %L, 'DRAFT', 4, 'needs a fix')::text$q$, pw));
    perform pg_temp.check(
      pg_temp.scalar_as('authenticated', reviewer, format($q$select publication_status::text from public.people where id = %L$q$, pw)) = 'DRAFT',
      'a reviewed record can be returned to draft');
    perform pg_temp.scalar_as('authenticated', reviewer, format($q$select public.editorial_transition('people', %L, 'REJECTED', 5, 'duplicate')::text$q$, pw));
    perform pg_temp.scalar_as('authenticated', reviewer, format($q$select public.editorial_transition('people', %L, 'DRAFT', 6)::text$q$, pw));
    perform pg_temp.check(true, 'a rejected record can be reopened as a draft');

    -- Two-person rule.
    pw := pg_temp.scalar_as('authenticated', approver,
      $q$insert into public.people (first_name, last_name) values ('SelfApprove', 'RlsTest') returning id$q$)::uuid;
    perform pg_temp.scalar_as('authenticated', approver, format($q$select public.editorial_transition('people', %L, 'SOURCE_ATTACHED', 1)::text$q$, pw));
    perform pg_temp.scalar_as('authenticated', approver, format($q$select public.editorial_transition('people', %L, 'REVIEWED', 2)::text$q$, pw));
    perform pg_temp.expect_error(format($q$select public.editorial_transition('people', %L, 'APPROVED', 3)$q$, pw),
      'Two-person rule', 'an approver cannot approve a record they created and submitted', approver, 'authenticated');
    perform pg_temp.scalar_as('authenticated', approver2, format($q$select public.editorial_transition('people', %L, 'APPROVED', 3)::text$q$, pw));
    perform pg_temp.scalar_as('authenticated', approver, format($q$select public.editorial_transition('people', %L, 'PUBLISHED', 4)::text$q$, pw));
    perform pg_temp.check(
      (select publication_status from public.people where id = pw) = 'PUBLISHED' and (select approved_by from public.people where id = pw) = approver2,
      'a second approver approves; the record then publishes');

    -- Explicit development exception, off by default, and visible in the audit trail.
    perform pg_temp.check((select value from private.editorial_settings where key = 'allow_self_approval') = 'false',
      'self-approval is disabled by default');
    pw := pg_temp.scalar_as('authenticated', approver,
      $q$insert into public.people (first_name, last_name) values ('SoloDev', 'RlsTest') returning id$q$)::uuid;
    perform pg_temp.scalar_as('authenticated', approver, format($q$select public.editorial_transition('people', %L, 'SOURCE_ATTACHED', 1)::text$q$, pw));
    perform pg_temp.scalar_as('authenticated', approver, format($q$select public.editorial_transition('people', %L, 'REVIEWED', 2)::text$q$, pw));
    update private.editorial_settings set value = 'true' where key = 'allow_self_approval';
    perform pg_temp.scalar_as('authenticated', approver, format($q$select public.editorial_transition('people', %L, 'APPROVED', 3, 'solo dev approval')::text$q$, pw));
    update private.editorial_settings set value = 'false' where key = 'allow_self_approval';
    perform pg_temp.check(
      exists (select 1 from public.revisions where entity_id = pw::text and approval_state = 'APPROVED' and reason like '%self-approval permitted%'),
      'a permitted self-approval is stamped in the revision reason');

    -- Published edits and retraction: reasons, roles, history.
    ver := (select version::text from public.people where id = p_pub);
    perform pg_temp.expect_error(format($q$select public.editorial_update('people', %L, %s, '{"middle_name":"X"}'::jsonb)$q$, p_pub, ver),
      'reason is required', 'editing a published record through the RPC requires a reason', approver, 'authenticated');
    perform pg_temp.expect_error(format($q$select public.editorial_update('people', %L, %s, '{"middle_name":"X"}'::jsonb, 'attempt')$q$, p_pub, ver),
      'Only approvers', 'a reviewer cannot edit a published record even with a reason', reviewer, 'authenticated');
    perform pg_temp.expect_error(format($q$select public.editorial_transition('people', %L, 'RETRACTED', 1)$q$, pw),
      'reason is required', 'retraction requires a reason', approver, 'authenticated');
    perform pg_temp.scalar_as('authenticated', approver2, format($q$select public.editorial_transition('people', %L, 'PUBLISHED', 4)::text$q$, pw));
    perform pg_temp.scalar_as('authenticated', approver, format($q$select public.editorial_transition('people', %L, 'RETRACTED', 5, 'Record attached to wrong person')::text$q$, pw));
    perform pg_temp.check(
      exists (select 1 from public.revisions where entity_id = pw::text and approval_state = 'RETRACTED' and reason = 'Record attached to wrong person'),
      'a retraction creates a revision with its reason');
    perform pg_temp.check((select count(*) from public.people where id = pw) = 1, 'a retracted record is kept, not deleted');
    perform pg_temp.check(
      pg_temp.scalar_as('anon', null, format('select count(*) from public.people where id = %L', pw)) = '0',
      'a retracted record is no longer public');
    perform pg_temp.expect_error(format($q$select public.editorial_transition('people', %L, 'DRAFT', 6, 'undo')$q$, pw),
      'cannot move from RETRACTED', 'RETRACTED is final', approver, 'authenticated');

    -- Claims: readiness gates review; evidence is frozen under review.
    cw := pg_temp.scalar_as('authenticated', reviewer, format(
      $q$insert into public.claims (subject_person_id, claim_type, statement, verification_status)
         values (%L, 'OFFICE_TERM', 'A fictional person served in a fictional office.', 'PRIMARY_SOURCE') returning id$q$, p_pub))::uuid;
    perform pg_temp.expect_error(format($q$select public.editorial_transition('claims', %L, 'SOURCE_ATTACHED', 1)$q$, cw),
      'Attach at least one source', 'a claim needs a source before SOURCE_ATTACHED', reviewer, 'authenticated');
    perform pg_temp.scalar_as('authenticated', reviewer, format($q$select public.editorial_set_evidence(%L, %L, true, 'news only')::text$q$, cw, s_news1));
    perform pg_temp.scalar_as('authenticated', reviewer, format($q$select public.editorial_transition('claims', %L, 'SOURCE_ATTACHED', 1)::text$q$, cw));
    perform pg_temp.expect_error(format($q$select public.editorial_transition('claims', %L, 'REVIEWED', 2)$q$, cw),
      'not ready for REVIEWED', 'PRIMARY_SOURCE with only news evidence cannot be submitted for review', reviewer, 'authenticated');
    perform pg_temp.check(
      (pg_temp.scalar_as('authenticated', reviewer, format($q$select (public.claim_readiness(%L))::text$q$, cw))::jsonb ->> 'error') like '%tier-1%',
      'claim_readiness reports the database verdict');
    perform pg_temp.scalar_as('authenticated', reviewer, format($q$select public.editorial_set_evidence(%L, %L, true)::text$q$, cw, s_gov));
    perform pg_temp.check(
      (pg_temp.scalar_as('authenticated', reviewer, format($q$select (public.claim_readiness(%L))::text$q$, cw))::jsonb ->> 'error') is null,
      'claim_readiness reports no problem once a tier-1 source supports the claim');
    perform pg_temp.scalar_as('authenticated', reviewer, format($q$select public.editorial_transition('claims', %L, 'REVIEWED', 2)::text$q$, cw));
    perform pg_temp.expect_error(format($q$select public.editorial_remove_evidence(%L, %L)$q$, cw, s_gov),
      'under review', 'evidence of a claim under review is frozen', reviewer, 'authenticated');
    perform pg_temp.expect_error(format($q$select public.editorial_remove_evidence(%L, %L)$q$, cw, s_gov),
      'permission denied', 'anon cannot remove evidence', null, 'anon');
    perform pg_temp.scalar_as('authenticated', reviewer, format($q$select public.editorial_transition('claims', %L, 'DRAFT', 3)::text$q$, cw));
    perform pg_temp.scalar_as('authenticated', reviewer, format($q$select public.editorial_remove_evidence(%L, %L)::text$q$, cw, s_news1));
    perform pg_temp.check(
      pg_temp.scalar_as('authenticated', reviewer, format($q$select count(*) from public.claim_evidence where claim_id = %L$q$, cw)) = '1',
      'evidence can be removed from a draft claim');

    -- Work queue and staff-only views.
    perform pg_temp.expect_error($q$select count(*) from public.editorial_queue$q$,
      'permission denied', 'anon cannot read the work queue', null, 'anon');
    perform pg_temp.check(
      pg_temp.scalar_as('authenticated', reviewer, format($q$select count(*) from public.editorial_queue where id = %L$q$, p_draft)) = '1',
      'staff see drafts in the work queue');
    perform pg_temp.check(
      pg_temp.scalar_as('authenticated', outsider, format($q$select count(*) from public.editorial_queue where id = %L$q$, p_draft)) = '0',
      'a signed-in user without a role sees no drafts in the work queue');

    -- Corrections: anonymous can submit, nobody public can read.
    tgt := p_pub;
    perform pg_temp.scalar_as('anon', null, format(
      $q$select public.submit_correction('PERSON', %L, 'The middle name looks wrong.', 'https://example.org/proof', 'voter@example.org')::text$q$, tgt));
    perform pg_temp.check((select count(*) from public.correction_requests where record_id = tgt and status = 'SUBMITTED') = 1,
      'anon can submit a correction request');
    perform pg_temp.expect_error(format($q$select public.submit_correction('PERSON', %L, 'This record is a draft.')$q$, p_draft),
      'check the details', 'a correction cannot target an unpublished record', null, 'anon');
    perform pg_temp.expect_error(format($q$select public.submit_correction('PERSON', %L, 'short')$q$, tgt),
      'check the details', 'a too-short description is rejected', null, 'anon');
    perform pg_temp.expect_error(format($q$select public.submit_correction('PERSON', %L, 'The middle name looks wrong.', 'javascript:alert(1)')$q$, tgt),
      'check the details', 'a non-http source URL is rejected', null, 'anon');
    perform pg_temp.expect_error(format($q$select public.submit_correction('PERSON', %L, 'The middle name looks wrong.', null, 'not-an-email')$q$, tgt),
      'check the details', 'a malformed email is rejected', null, 'anon');
    perform pg_temp.expect_error(format($q$select public.submit_correction('CLAIM', %L, 'Wrong claim reference here.')$q$, tgt),
      'check the details', 'a correction must reference a published record of the stated type', null, 'anon');
    perform pg_temp.expect_error($q$select count(*) from public.correction_requests$q$,
      'permission denied', 'anon cannot read correction requests', null, 'anon');
    perform pg_temp.expect_error($q$insert into public.correction_requests (record_type, record_id, description) values ('PERSON', gen_random_uuid(), 'direct insert attempt')$q$,
      'permission denied', 'anon cannot insert into correction_requests directly', null, 'anon');
    perform pg_temp.expect_error($q$insert into public.correction_requests (record_type, record_id, description) values ('PERSON', gen_random_uuid(), 'direct insert attempt')$q$,
      'permission denied', 'a signed-in reviewer cannot insert directly either', reviewer, 'authenticated');
    perform pg_temp.check(
      pg_temp.scalar_as('authenticated', outsider, 'select count(*) from public.correction_requests') = '0',
      'a signed-in user without a role sees no correction requests');
    perform pg_temp.check(
      pg_temp.scalar_as('authenticated', reviewer, format($q$select count(*) from public.correction_requests where record_id = %L$q$, tgt))::int >= 1,
      'a reviewer can read correction requests');
    perform pg_temp.expect_error(format($q$update public.correction_requests set status = 'RESOLVED' where record_id = %L$q$, tgt),
      'permission denied', 'staff cannot edit correction requests directly', reviewer, 'authenticated');

    -- Abuse cap: at most 10 open requests per record.
    for i in 1 .. 9 loop
      perform pg_temp.scalar_as('anon', null, format($q$select public.submit_correction('PERSON', %L, 'Another report number %s.')::text$q$, tgt, i));
    end loop;
    perform pg_temp.expect_error(format($q$select public.submit_correction('PERSON', %L, 'One report too many here.')$q$, tgt),
      'temporarily unavailable', 'open reports per record are capped', null, 'anon');

    -- Reviewing a request never touches the record.
    cid := (select id from public.correction_requests where record_id = tgt and description = 'The middle name looks wrong.');
    perform pg_temp.expect_error(format($q$select public.review_correction(%L, 'UNDER_REVIEW', 1)$q$, cid),
      'permission denied', 'anon cannot review corrections', null, 'anon');
    perform pg_temp.expect_error(format($q$select public.review_correction(%L, 'UNDER_REVIEW', 1)$q$, cid),
      'Editorial access required', 'a user without a role cannot review corrections', outsider, 'authenticated');
    perform pg_temp.expect_error(format($q$select public.review_correction(%L, 'RESOLVED', 1, 'x')$q$, cid),
      'cannot move from SUBMITTED to RESOLVED', 'corrections follow their own lifecycle', reviewer, 'authenticated');
    perform pg_temp.scalar_as('authenticated', reviewer, format($q$select public.review_correction(%L, 'UNDER_REVIEW', 1)::text$q$, cid));
    perform pg_temp.expect_error(format($q$select public.review_correction(%L, 'ACCEPTED', 2)$q$, cid),
      'resolution note is required', 'accepting needs a note', reviewer, 'authenticated');
    perform pg_temp.expect_error(format($q$select public.review_correction(%L, 'ACCEPTED', 1, 'stale')$q$, cid),
      'changed by someone else', 'a stale correction review is rejected', reviewer, 'authenticated');
    select * into r from public.people where id = tgt;
    perform pg_temp.scalar_as('authenticated', reviewer, format($q$select public.review_correction(%L, 'ACCEPTED', 2, 'Confirmed against the cited source; draft fix to follow.')::text$q$, cid));
    perform pg_temp.check(
      (select status from public.correction_requests where id = cid) = 'ACCEPTED'
      and (select reviewed_by from public.correction_requests where id = cid) = reviewer,
      'accepting records the reviewer and decision');
    perform pg_temp.check(
      (select version from public.people where id = tgt) = r.version
      and (select publication_status from public.people where id = tgt) = 'PUBLISHED'
      and (select middle_name from public.people where id = tgt) is not distinct from r.middle_name,
      'accepting a correction does not change or republish the record');

    -- Staff roles.
    perform pg_temp.expect_error($q$select public.set_staff_role('outsider-rls@example.org', 'REVIEWER')$q$,
      'Only administrators', 'a reviewer cannot manage roles', reviewer, 'authenticated');
    perform pg_temp.expect_error($q$select public.set_staff_role('outsider-rls@example.org', 'REVIEWER')$q$,
      'Only administrators', 'an approver cannot manage roles', approver, 'authenticated');
    perform pg_temp.expect_error($q$select public.set_staff_role('outsider-rls@example.org', 'REVIEWER')$q$,
      'permission denied', 'anon cannot manage roles', null, 'anon');
    perform pg_temp.expect_error(format($q$insert into public.editorial_roles (user_id, role) values (%L, 'ADMIN')$q$, outsider),
      'permission denied', 'even an admin cannot write editorial_roles directly', admin_u, 'authenticated');
    perform pg_temp.expect_error(format($q$delete from public.editorial_roles where user_id = %L$q$, reviewer),
      'permission denied', 'even an admin cannot delete editorial_roles directly', admin_u, 'authenticated');
    perform pg_temp.scalar_as('authenticated', admin_u, $q$select public.set_staff_role('outsider-rls@example.org', 'REVIEWER')::text$q$);
    perform pg_temp.check(exists (select 1 from public.editorial_roles where user_id = outsider and role = 'REVIEWER'),
      'an admin can assign a role');
    perform pg_temp.check(exists (select 1 from public.editorial_role_events where target_email = 'outsider-rls@example.org' and new_role = 'REVIEWER' and changed_by = admin_u),
      'role changes are logged');
    perform pg_temp.scalar_as('authenticated', admin_u, $q$select public.set_staff_role('outsider-rls@example.org', null)::text$q$);
    perform pg_temp.check(not exists (select 1 from public.editorial_roles where user_id = outsider), 'an admin can remove a role');
    perform pg_temp.expect_error($q$update public.editorial_role_events set new_role = 'ADMIN'$q$,
      'append-only', 'the role change log is append-only');
    perform pg_temp.check(
      pg_temp.scalar_as('authenticated', reviewer, 'select count(*) from public.staff_directory()')::int >= 3,
      'staff can list staff (names for the audit trail)');
    perform pg_temp.expect_error('select count(*) from public.staff_directory()',
      'Editorial access required', 'a user without a role cannot list staff', outsider, 'authenticated');
    perform pg_temp.expect_error('select count(*) from public.editorial_role_events',
      'permission denied', 'anon cannot read the role change log', null, 'anon');
    delete from public.editorial_roles where role = 'ADMIN' and user_id <> admin_u;
    perform pg_temp.expect_error($q$select public.set_staff_role('admin-rls@example.org', null)$q$,
      'last administrator', 'the last administrator cannot be removed', admin_u, 'authenticated');

    -- Revision history is append-only and records the editor.
    perform pg_temp.check(
      exists (select 1 from public.revisions where entity_id = pw::text and editor_id = approver::text),
      'revisions record the editor of each change');
  end;

  raise notice 'ALL DATABASE TESTS PASSED';
end
$test$;

rollback;
