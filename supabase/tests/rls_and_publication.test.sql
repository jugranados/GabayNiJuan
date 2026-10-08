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
          and col.column_name not in ('created_by', 'approved_by', 'reviewed_by', 'published_by')) as cols
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

  perform pg_temp.expect_error(format($q$update public.people set publication_status = 'PUBLISHED' where id = %L$q$, p_work),
    'Only approvers', 'a reviewer cannot publish', reviewer, 'authenticated');
  perform pg_temp.expect_error(format($q$update public.people set publication_status = 'APPROVED' where id = %L$q$, p_work),
    'Only approvers', 'a reviewer cannot approve', reviewer, 'authenticated');

  perform pg_temp.scalar_as('authenticated', reviewer,
    format($q$update public.people set publication_status = 'REVIEWED', approved_by = %L, published_by = %L where id = %L returning 1$q$, outsider, outsider, p_work));
  select * into r from public.people where id = p_work;
  perform pg_temp.check(r.reviewed_by = reviewer and r.reviewed_at is not null, 'review stamps reviewed_by and reviewed_at');
  perform pg_temp.check(r.approved_by is null and r.published_by is null, 'a reviewer cannot forge approved_by or published_by');

  perform pg_temp.scalar_as('authenticated', approver,
    format($q$update public.people set publication_status = 'PUBLISHED' where id = %L returning 1$q$, p_work));
  select * into r from public.people where id = p_work;
  perform pg_temp.check(r.publication_status = 'PUBLISHED' and r.published_at is not null, 'an approver can publish and published_at is set');
  perform pg_temp.check(r.approved_by = approver and r.published_by = approver and r.reviewed_by = reviewer,
    'created/reviewed/approved/published identities are recorded');
  perform pg_temp.check(
    pg_temp.scalar_as('anon', null, format('select count(*) from public.people where id = %L', p_work)) = '1',
    'anon sees the person once published');
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

  raise notice 'ALL DATABASE TESTS PASSED';
end
$test$;

rollback;
