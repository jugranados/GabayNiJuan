-- Throwaway editorial accounts for browser acceptance tests on a LOCAL Supabase stack only
-- (`supabase start`, as in CI). Never run this against a hosted project: accounts there are
-- created by an administrator in the dashboard (docs/VERIFICATION_CHECKLIST.md, step 4).
--
--   psql "postgresql://postgres:postgres@127.0.0.1:54322/postgres" -v ON_ERROR_STOP=1 \
--     -v password="$E2E_PASSWORD" -f web/e2e/local/create-test-accounts.sql
--
-- It refuses to run if the database holds any account other than these four, so it cannot
-- touch a database that real people use. The password comes from a psql variable (CI generates
-- a random one per run); nothing secret is stored in the repository.
--
-- Roles are inserted directly, as the documented first-admin bootstrap does; after that every
-- change in the tests goes through the app as the signed-in editor, under RLS.

\set ON_ERROR_STOP on

begin;

create temporary table e2e_accounts (email text primary key, role public.editorial_role) on commit drop;
insert into e2e_accounts values
  ('e2e-reviewer@example.test', 'REVIEWER'),
  ('e2e-approver@example.test', 'APPROVER'),
  ('e2e-admin@example.test', 'ADMIN'),
  ('e2e-norole@example.test', null);

do $$
begin
  if exists (select 1 from auth.users u where u.email not in (select email from e2e_accounts)) then
    raise exception 'Refusing: this database has accounts other than the E2E test accounts. Use a fresh local stack.';
  end if;
end
$$;

insert into auth.users (
  instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
  confirmation_token, recovery_token, email_change_token_new, email_change,
  email_change_token_current, phone_change, phone_change_token, reauthentication_token
)
select '00000000-0000-0000-0000-000000000000', gen_random_uuid(), 'authenticated', 'authenticated', a.email,
       extensions.crypt(:'password', extensions.gen_salt('bf')), now(),
       '{"provider":"email","providers":["email"]}', '{}', now(), now(),
       '', '', '', '', '', '', '', ''
  from e2e_accounts a
 where not exists (select 1 from auth.users u where u.email = a.email);

-- Keep the password in step with this run's value when the accounts already exist.
update auth.users u set encrypted_password = extensions.crypt(:'password', extensions.gen_salt('bf'))
  from e2e_accounts a where u.email = a.email;

insert into auth.identities (provider_id, user_id, identity_data, provider, last_sign_in_at, created_at, updated_at)
select u.id::text, u.id, jsonb_build_object('sub', u.id::text, 'email', u.email, 'email_verified', true),
       'email', now(), now(), now()
  from auth.users u join e2e_accounts a on a.email = u.email
 where not exists (select 1 from auth.identities i where i.user_id = u.id and i.provider = 'email');

insert into public.editorial_roles (user_id, role)
select u.id, a.role
  from auth.users u join e2e_accounts a on a.email = u.email
 where a.role is not null
   and not exists (select 1 from public.editorial_roles r where r.user_id = u.id);

commit;

select u.email, coalesce(r.role::text, 'none') as role
  from auth.users u left join public.editorial_roles r on r.user_id = u.id
 order by u.email;
