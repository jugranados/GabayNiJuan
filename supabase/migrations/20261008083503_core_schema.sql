-- Gabay ni Juan — core schema (Milestone 1)
--
-- Mirrors the app's Zod row contracts in mobile/src/data/schemas/rows.ts.
-- Change both together. See docs/DATA_MODEL.md.
--
-- Deliberately absent: any boolean criminal-record flag, scores, ratings,
-- rankings, endorsements, predictions, or "political color".

-- ---------------------------------------------------------------------------
-- Enumerations
-- ---------------------------------------------------------------------------

create type public.election_status as enum ('UPCOMING', 'ONGOING', 'COMPLETED');

create type public.office_level as enum (
  'NATIONAL', 'PROVINCIAL', 'CITY', 'MUNICIPAL', 'DISTRICT', 'BARANGAY'
);

-- Aspirant states are NOT candidacies.
create type public.election_participation_status as enum (
  'POTENTIAL_ASPIRANT', 'PUBLICLY_DECLARED_ASPIRANT', 'FILED_COC', 'OFFICIAL_CANDIDATE',
  'WITHDRAWN', 'DISQUALIFIED', 'ELECTED', 'NOT_ELECTED'
);

create type public.office_term_status as enum ('HELD', 'ACTING', 'APPOINTED', 'ELECTED');

create type public.political_organization_type as enum (
  'POLITICAL_PARTY', 'PARTY_LIST', 'COALITION', 'OTHER'
);

create type public.affiliation_type as enum (
  'MEMBER', 'CANDIDATE', 'LEADER', 'ENDORSED_BY', 'COALITION'
);

create type public.policy_attribution_type as enum (
  'SELF_DECLARED', 'OFFICIAL_PLATFORM', 'LEGISLATIVE_ACTION', 'INTERVIEW', 'SPEECH'
);

-- Procedural status only. Never collapse into a single boolean.
create type public.legal_case_status as enum (
  'COMPLAINT', 'UNDER_INVESTIGATION', 'CASE_FILED', 'CHARGED', 'PENDING', 'DISMISSED',
  'ACQUITTED', 'CONVICTED', 'ON_APPEAL', 'FINAL_JUDGMENT', 'OTHER'
);

create type public.currency_code as enum ('PHP');

create type public.source_type as enum (
  'OFFICIAL_GOVERNMENT', 'COURT_OR_TRIBUNAL', 'OFFICIAL_CANDIDATE', 'LEGISLATIVE_RECORD',
  'NEWS', 'ACADEMIC', 'OTHER'
);

-- Applies to individual claims, never to a person.
create type public.verification_status as enum (
  'PRIMARY_SOURCE', 'CORROBORATED', 'SELF_DECLARED', 'REPORTED', 'DISPUTED', 'UNVERIFIED',
  'OUTDATED'
);

create type public.claim_subject_record_type as enum (
  'PERSON', 'ELECTION_PARTICIPATION', 'OFFICE_TERM', 'AFFILIATION', 'EDUCATION', 'AWARD',
  'POLICY_POSITION', 'LEGAL_CASE', 'ASSET_DISCLOSURE'
);

-- Editorial workflow (docs/DATA_TRUST_GOVERNANCE.md). Only PUBLISHED rows are public.
create type public.publication_status as enum (
  'DRAFT', 'SOURCE_ATTACHED', 'REVIEWED', 'APPROVED', 'PUBLISHED', 'RETRACTED'
);

-- ---------------------------------------------------------------------------
-- Tables
--
-- Every publishable table carries the same workflow columns:
--   publication_status, published_at, created_by, approved_by, created_at, updated_at
-- Rows are never deleted once published; they are RETRACTED (see audit migration).
-- ---------------------------------------------------------------------------

create table public.people (
  id uuid primary key default gen_random_uuid(),
  first_name text not null check (btrim(first_name) <> ''),
  middle_name text check (btrim(middle_name) <> ''),
  last_name text not null check (btrim(last_name) <> ''),
  suffix text check (btrim(suffix) <> ''),
  preferred_name text check (btrim(preferred_name) <> ''),
  birth_date date,
  photo_asset_id text check (btrim(photo_asset_id) <> ''),
  publication_status public.publication_status not null default 'DRAFT',
  published_at timestamptz,
  created_by uuid default auth.uid() references auth.users (id) on delete set null,
  approved_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
comment on table public.people is 'Stable identity of a public/political figure. Age is derived from birth_date, never stored.';

create table public.elections (
  id uuid primary key default gen_random_uuid(),
  name text not null check (btrim(name) <> ''),
  election_date date not null,
  country_code text not null default 'PH' check (country_code = 'PH'),
  status public.election_status not null,
  publication_status public.publication_status not null default 'DRAFT',
  published_at timestamptz,
  created_by uuid default auth.uid() references auth.users (id) on delete set null,
  approved_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.offices (
  id uuid primary key default gen_random_uuid(),
  name text not null check (btrim(name) <> ''),
  level public.office_level not null,
  jurisdiction_id text check (btrim(jurisdiction_id) <> ''),
  publication_status public.publication_status not null default 'DRAFT',
  published_at timestamptz,
  created_by uuid default auth.uid() references auth.users (id) on delete set null,
  approved_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.political_organizations (
  id uuid primary key default gen_random_uuid(),
  name text not null check (btrim(name) <> ''),
  abbreviation text check (btrim(abbreviation) <> ''),
  organization_type public.political_organization_type not null,
  publication_status public.publication_status not null default 'DRAFT',
  published_at timestamptz,
  created_by uuid default auth.uid() references auth.users (id) on delete set null,
  approved_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.election_participations (
  id uuid primary key default gen_random_uuid(),
  person_id uuid not null references public.people (id) on delete restrict,
  election_id uuid not null references public.elections (id) on delete restrict,
  office_id uuid not null references public.offices (id) on delete restrict,
  ballot_number text check (btrim(ballot_number) <> ''),
  status public.election_participation_status not null,
  effective_from date not null,
  effective_to date,
  publication_status public.publication_status not null default 'DRAFT',
  published_at timestamptz,
  created_by uuid default auth.uid() references auth.users (id) on delete set null,
  approved_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint election_participations_date_range check (effective_to is null or effective_to >= effective_from)
);
comment on column public.election_participations.status is 'Must be supported by evidence (claims). Aspirant states are not candidacies.';

create table public.office_terms (
  id uuid primary key default gen_random_uuid(),
  person_id uuid not null references public.people (id) on delete restrict,
  office_id uuid not null references public.offices (id) on delete restrict,
  start_date date,
  end_date date,
  status public.office_term_status not null,
  publication_status public.publication_status not null default 'DRAFT',
  published_at timestamptz,
  created_by uuid default auth.uid() references auth.users (id) on delete set null,
  approved_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint office_terms_date_range check (start_date is null or end_date is null or end_date >= start_date)
);

create table public.affiliation_records (
  id uuid primary key default gen_random_uuid(),
  person_id uuid not null references public.people (id) on delete restrict,
  organization_id uuid not null references public.political_organizations (id) on delete restrict,
  affiliation_type public.affiliation_type not null,
  start_date date,
  end_date date,
  publication_status public.publication_status not null default 'DRAFT',
  published_at timestamptz,
  created_by uuid default auth.uid() references auth.users (id) on delete set null,
  approved_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint affiliation_records_date_range check (start_date is null or end_date is null or end_date >= start_date)
);

create table public.education_records (
  id uuid primary key default gen_random_uuid(),
  person_id uuid not null references public.people (id) on delete restrict,
  institution text not null check (btrim(institution) <> ''),
  program text check (btrim(program) <> ''),
  credential text check (btrim(credential) <> ''),
  start_date date,
  end_date date,
  publication_status public.publication_status not null default 'DRAFT',
  published_at timestamptz,
  created_by uuid default auth.uid() references auth.users (id) on delete set null,
  approved_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint education_records_date_range check (start_date is null or end_date is null or end_date >= start_date)
);

create table public.award_records (
  id uuid primary key default gen_random_uuid(),
  person_id uuid not null references public.people (id) on delete restrict,
  title text not null check (btrim(title) <> ''),
  issuer text not null check (btrim(issuer) <> ''),
  awarded_at date,
  publication_status public.publication_status not null default 'DRAFT',
  published_at timestamptz,
  created_by uuid default auth.uid() references auth.users (id) on delete set null,
  approved_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.policy_position_records (
  id uuid primary key default gen_random_uuid(),
  person_id uuid not null references public.people (id) on delete restrict,
  topic text not null check (btrim(topic) <> ''),
  position_text text not null check (btrim(position_text) <> ''),
  attribution_type public.policy_attribution_type not null,
  stated_at date,
  publication_status public.publication_status not null default 'DRAFT',
  published_at timestamptz,
  created_by uuid default auth.uid() references auth.users (id) on delete set null,
  approved_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
comment on column public.policy_position_records.position_text is 'The attributed position as stated. Never strengthened or summarized beyond the evidence.';

create table public.legal_case_records (
  id uuid primary key default gen_random_uuid(),
  person_id uuid not null references public.people (id) on delete restrict,
  authority text not null check (btrim(authority) <> ''),
  case_number text check (btrim(case_number) <> ''),
  title text check (btrim(title) <> ''),
  proceeding_type text check (btrim(proceeding_type) <> ''),
  status public.legal_case_status not null,
  filing_date date,
  status_date date,
  neutral_summary text check (btrim(neutral_summary) <> ''),
  publication_status public.publication_status not null default 'DRAFT',
  published_at timestamptz,
  created_by uuid default auth.uid() references auth.users (id) on delete set null,
  approved_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
comment on table public.legal_case_records is 'Procedural records only. An allegation is never a finding of guilt. Milestone 4.';

create table public.asset_disclosure_records (
  id uuid primary key default gen_random_uuid(),
  person_id uuid not null references public.people (id) on delete restrict,
  disclosure_type text not null check (btrim(disclosure_type) <> ''),
  reporting_date date,
  net_worth_amount numeric(18, 2),
  currency public.currency_code,
  publication_status public.publication_status not null default 'DRAFT',
  published_at timestamptz,
  created_by uuid default auth.uid() references auth.users (id) on delete set null,
  approved_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint asset_disclosure_records_currency check (net_worth_amount is null or currency is not null)
);

create table public.sources (
  id uuid primary key default gen_random_uuid(),
  title text not null check (btrim(title) <> ''),
  publisher text not null check (btrim(publisher) <> ''),
  url text check (url ~* '^https?://'),
  document_identifier text check (btrim(document_identifier) <> ''),
  source_type public.source_type not null,
  published_at date,
  retrieved_at date not null,
  archived_url text check (archived_url ~* '^https?://'),
  publication_status public.publication_status not null default 'DRAFT',
  -- NOTE: `published_at` above is the source's own publication date; the
  -- workflow timestamp for this row is `record_published_at`.
  record_published_at timestamptz,
  created_by uuid default auth.uid() references auth.users (id) on delete set null,
  approved_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint sources_locator check (url is not null or document_identifier is not null)
);
comment on table public.sources is 'Evidence. A broken URL never deletes a source; keep metadata and archive link and flag for review.';

create table public.claims (
  id uuid primary key default gen_random_uuid(),
  subject_person_id uuid references public.people (id) on delete restrict,
  subject_record_type public.claim_subject_record_type,
  subject_record_id uuid,
  claim_type text not null check (btrim(claim_type) <> ''),
  statement text not null check (btrim(statement) <> ''),
  effective_from date,
  effective_to date,
  verification_status public.verification_status not null,
  last_reviewed_at date,
  publication_status public.publication_status not null default 'DRAFT',
  published_at timestamptz,
  created_by uuid default auth.uid() references auth.users (id) on delete set null,
  approved_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint claims_subject_pair check ((subject_record_type is null) = (subject_record_id is null)),
  constraint claims_date_range check (effective_from is null or effective_to is null or effective_to >= effective_from)
);
comment on table public.claims is 'A precise proposition displayed to voters. Verification status describes evidence, not the person.';

create table public.claim_evidence (
  claim_id uuid not null references public.claims (id) on delete restrict,
  source_id uuid not null references public.sources (id) on delete restrict,
  supports boolean not null,
  note text check (btrim(note) <> ''),
  created_by uuid default auth.uid() references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (claim_id, source_id)
);
comment on column public.claim_evidence.supports is 'false = the source contradicts the claim. Contradictions are preserved, never dropped.';

-- ---------------------------------------------------------------------------
-- Indexes (foreign keys and common read paths)
-- ---------------------------------------------------------------------------

create index election_participations_person_id_idx on public.election_participations (person_id);
create index election_participations_election_id_idx on public.election_participations (election_id);
create index election_participations_office_id_idx on public.election_participations (office_id);
create index office_terms_person_id_idx on public.office_terms (person_id);
create index office_terms_office_id_idx on public.office_terms (office_id);
create index affiliation_records_person_id_idx on public.affiliation_records (person_id);
create index affiliation_records_organization_id_idx on public.affiliation_records (organization_id);
create index education_records_person_id_idx on public.education_records (person_id);
create index award_records_person_id_idx on public.award_records (person_id);
create index policy_position_records_person_id_idx on public.policy_position_records (person_id);
create index legal_case_records_person_id_idx on public.legal_case_records (person_id);
create index asset_disclosure_records_person_id_idx on public.asset_disclosure_records (person_id);
create index claims_subject_person_id_idx on public.claims (subject_person_id);
create index claims_subject_record_idx on public.claims (subject_record_type, subject_record_id);
create index claim_evidence_source_id_idx on public.claim_evidence (source_id);
create index people_last_first_name_idx on public.people (last_name, first_name);

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
    execute format('create index %I on public.%I (publication_status)', t || '_publication_status_idx', t);
    execute format('create index %I on public.%I (created_by)', t || '_created_by_idx', t);
    execute format('create index %I on public.%I (approved_by)', t || '_approved_by_idx', t);
  end loop;
end
$$;
create index claim_evidence_created_by_idx on public.claim_evidence (created_by);
