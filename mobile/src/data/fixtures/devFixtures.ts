/**
 * FICTIONAL development fixtures.
 *
 * Every person, place, organization, election, and source below is invented.
 * None describes a real Philippine politician, party, election, or agency.
 * URLs use the reserved `example.org` domain.
 *
 * Rows are written in raw backend shape (snake_case) so they pass through the
 * same Zod validation and mappers as Supabase data will.
 */
import type { FixtureTables } from '@/data/repositories/inMemoryRowSource';
import {
  extraAffiliations,
  extraClaimEvidence,
  extraClaims,
  extraEducation,
  extraElections,
  extraOfficeTerms,
  extraOffices,
  extraOrganizations,
  extraParticipations,
  extraPeople,
  extraPolicyPositions,
  extraSources,
} from './devFixturesExtra.ts'; // relative + .ts: the seed script runs this file under plain Node

const REVIEWED = '2026-10-01';
const RETRIEVED = '2026-09-30';
const FIXTURE_URL = 'https://example.org/gabay-ni-juan-fixtures';

const people = [
  {
    id: 'person-juan-dela-cruz',
    first_name: 'Juan',
    middle_name: null,
    last_name: 'Dela Cruz',
    suffix: null,
    preferred_name: null,
    birth_date: '1980-06-12',
    photo_asset_id: null,
  },
  {
    id: 'person-maria-makabayan',
    first_name: 'Maria',
    middle_name: 'Luntian',
    last_name: 'Makabayan',
    suffix: null,
    preferred_name: null,
    birth_date: null,
    photo_asset_id: null,
  },
  {
    id: 'person-pedro-santos',
    first_name: 'Pedro',
    middle_name: null,
    last_name: 'Santos',
    suffix: 'Jr.',
    preferred_name: null,
    birth_date: null,
    photo_asset_id: null,
  },
];

const elections = [
  {
    id: 'election-halimbawa-2027',
    name: 'Halimbawa City Local Election 2027 (fictional)',
    election_date: '2027-05-10',
    country_code: 'PH',
    status: 'UPCOMING',
  },
];

const offices = [
  {
    id: 'office-halimbawa-mayor',
    name: 'Mayor, City of Halimbawa (fictional)',
    level: 'CITY',
    jurisdiction_id: 'jurisdiction-halimbawa-city',
  },
  {
    id: 'office-halimbawa-councilor',
    name: 'City Councilor, City of Halimbawa (fictional)',
    level: 'CITY',
    jurisdiction_id: 'jurisdiction-halimbawa-city',
  },
  {
    id: 'office-barangay-uno-captain',
    name: 'Punong Barangay, Barangay Uno, Halimbawa (fictional)',
    level: 'BARANGAY',
    jurisdiction_id: 'jurisdiction-barangay-uno',
  },
];

const political_organizations = [
  {
    id: 'org-partido-halimbawa',
    name: 'Partido Halimbawa (fictional)',
    abbreviation: 'PHal',
    organization_type: 'POLITICAL_PARTY',
  },
  {
    id: 'org-samahang-kathang-isip',
    name: 'Samahang Kathang-Isip (fictional)',
    abbreviation: 'SKI',
    organization_type: 'OTHER',
  },
];

const election_participations = [
  {
    id: 'ep-maria-2027-mayor',
    person_id: 'person-maria-makabayan',
    election_id: 'election-halimbawa-2027',
    office_id: 'office-halimbawa-mayor',
    ballot_number: null,
    status: 'FILED_COC',
    effective_from: '2026-08-15',
    effective_to: null,
  },
  {
    id: 'ep-juan-2027-mayor',
    person_id: 'person-juan-dela-cruz',
    election_id: 'election-halimbawa-2027',
    office_id: 'office-halimbawa-mayor',
    ballot_number: '2',
    status: 'OFFICIAL_CANDIDATE',
    effective_from: '2026-09-15',
    effective_to: null,
  },
  {
    // Discussed as a possible contender only. NOT a candidate.
    id: 'ep-pedro-2027-mayor',
    person_id: 'person-pedro-santos',
    election_id: 'election-halimbawa-2027',
    office_id: 'office-halimbawa-mayor',
    ballot_number: null,
    status: 'POTENTIAL_ASPIRANT',
    effective_from: '2026-09-20',
    effective_to: null,
  },
];

const office_terms = [
  {
    id: 'ot-maria-councilor-2022',
    person_id: 'person-maria-makabayan',
    office_id: 'office-halimbawa-councilor',
    start_date: '2022-06-30',
    end_date: '2025-06-30',
    status: 'ELECTED',
  },
  {
    id: 'ot-juan-barangay-2018',
    person_id: 'person-juan-dela-cruz',
    office_id: 'office-barangay-uno-captain',
    start_date: '2018-06-30',
    end_date: '2023-11-30',
    status: 'ELECTED',
  },
  {
    id: 'ot-pedro-councilor-2022',
    person_id: 'person-pedro-santos',
    office_id: 'office-halimbawa-councilor',
    start_date: '2022-06-30',
    end_date: null,
    status: 'ELECTED',
  },
];

const affiliation_records = [
  {
    id: 'af-maria-phal-2026',
    person_id: 'person-maria-makabayan',
    organization_id: 'org-partido-halimbawa',
    affiliation_type: 'CANDIDATE',
    start_date: '2026-08-15',
    end_date: null,
  },
  {
    id: 'af-juan-ski-2016',
    person_id: 'person-juan-dela-cruz',
    organization_id: 'org-samahang-kathang-isip',
    affiliation_type: 'MEMBER',
    start_date: '2016-01-10',
    end_date: null,
  },
];

const education_records = [
  {
    id: 'ed-juan-pamantasan',
    person_id: 'person-juan-dela-cruz',
    institution: 'Pamantasan ng Halimbawa (fictional)',
    program: 'Civil Engineering',
    credential: 'Bachelor of Science',
    start_date: null,
    end_date: '2002-04-15',
  },
];

const policy_position_records = [
  {
    id: 'pp-maria-transport',
    person_id: 'person-maria-makabayan',
    topic: 'Public transport',
    position_text: 'Proposes dedicated bus lanes on Halimbawa Avenue.',
    attribution_type: 'OFFICIAL_PLATFORM',
    stated_at: '2026-08-20',
  },
  {
    id: 'pp-juan-flood-control',
    person_id: 'person-juan-dela-cruz',
    topic: 'Flood control',
    position_text: 'Stated that drainage upgrades in low-lying barangays would be a priority.',
    attribution_type: 'SPEECH',
    stated_at: '2026-09-02',
  },
];

const sources = [
  {
    id: 'src-coc-maria',
    title: 'Certificate of Candidacy for Mayor: Maria L. Makabayan (fictional)',
    publisher: 'Halimbawa City Election Office (fictional)',
    url: `${FIXTURE_URL}/election-office/coc/maria-makabayan`,
    document_identifier: 'HCEO-COC-2027-0041 (fictional)',
    source_type: 'OFFICIAL_GOVERNMENT',
    published_at: '2026-08-15',
    retrieved_at: RETRIEVED,
    archived_url: null,
  },
  {
    id: 'src-certified-list-2027',
    title: 'Certified List of Candidates, Halimbawa City 2027 (fictional)',
    publisher: 'Halimbawa City Election Office (fictional)',
    url: `${FIXTURE_URL}/election-office/certified-list-2027`,
    document_identifier: null,
    source_type: 'OFFICIAL_GOVERNMENT',
    published_at: '2026-09-15',
    retrieved_at: RETRIEVED,
    archived_url: null,
  },
  {
    id: 'src-city-roster-2022',
    title: 'Roster of Elected City Officials 2022–2025 (fictional)',
    publisher: "Halimbawa City Secretary's Office (fictional)",
    url: `${FIXTURE_URL}/city-secretary/roster-2022`,
    document_identifier: null,
    source_type: 'OFFICIAL_GOVERNMENT',
    published_at: '2022-07-05',
    retrieved_at: RETRIEVED,
    archived_url: `${FIXTURE_URL}/archive/city-secretary/roster-2022`,
  },
  {
    id: 'src-barangay-uno-roster',
    title: 'Barangay Uno Officials, 2018–2023 (fictional)',
    publisher: 'Barangay Uno Secretariat (fictional)',
    url: `${FIXTURE_URL}/barangay-uno/officials-2018`,
    document_identifier: null,
    source_type: 'OFFICIAL_GOVERNMENT',
    published_at: '2018-07-02',
    retrieved_at: RETRIEVED,
    archived_url: null,
  },
  {
    id: 'src-news-pahayagan-barangay',
    title: 'Barangay Uno turns over leadership after five-year term (fictional)',
    publisher: 'Pahayagang Halimbawa (fictional newspaper)',
    url: `${FIXTURE_URL}/pahayagang-halimbawa/barangay-uno-turnover`,
    document_identifier: null,
    source_type: 'NEWS',
    published_at: '2023-12-01',
    retrieved_at: RETRIEVED,
    archived_url: null,
  },
  {
    id: 'src-news-pahayagan-pedro',
    title: 'Councilor Santos weighing mayoral bid, sources say (fictional)',
    publisher: 'Pahayagang Halimbawa (fictional newspaper)',
    url: `${FIXTURE_URL}/pahayagang-halimbawa/santos-weighing-bid`,
    document_identifier: null,
    source_type: 'NEWS',
    published_at: '2026-09-20',
    retrieved_at: RETRIEVED,
    archived_url: null,
  },
  {
    id: 'src-news-balita-maria-term',
    title: 'New city council sworn in (fictional)',
    publisher: 'Balitang Kathang-Isip (fictional newspaper)',
    url: `${FIXTURE_URL}/balitang-kathang-isip/council-sworn-in`,
    document_identifier: null,
    source_type: 'NEWS',
    published_at: '2022-07-02',
    retrieved_at: RETRIEVED,
    archived_url: null,
  },
  {
    id: 'src-maria-platform',
    title: 'Maria Makabayan for Mayor: Platform (fictional)',
    publisher: 'Maria Makabayan campaign (fictional)',
    url: `${FIXTURE_URL}/campaigns/maria-makabayan/platform`,
    document_identifier: null,
    source_type: 'OFFICIAL_CANDIDATE',
    published_at: '2026-08-20',
    retrieved_at: RETRIEVED,
    archived_url: null,
  },
  {
    id: 'src-juan-campaign',
    title: 'About Juan Dela Cruz (fictional campaign page)',
    publisher: 'Juan Dela Cruz campaign (fictional)',
    url: `${FIXTURE_URL}/campaigns/juan-dela-cruz/about`,
    document_identifier: null,
    source_type: 'OFFICIAL_CANDIDATE',
    published_at: '2026-09-02',
    retrieved_at: RETRIEVED,
    archived_url: null,
  },
  {
    id: 'src-ski-roster-2019',
    title: 'Samahang Kathang-Isip membership roster, 2019 (fictional)',
    publisher: 'Samahang Kathang-Isip (fictional)',
    url: null,
    document_identifier: 'SKI-ROSTER-2019 (fictional)',
    source_type: 'OTHER',
    published_at: '2019-03-01',
    retrieved_at: RETRIEVED,
    archived_url: null,
  },
];

const claims = [
  // --- Maria Makabayan ---
  {
    id: 'claim-maria-filed-coc',
    subject_person_id: 'person-maria-makabayan',
    subject_record_type: 'ELECTION_PARTICIPATION',
    subject_record_id: 'ep-maria-2027-mayor',
    claim_type: 'CANDIDACY_STATUS',
    statement: 'Filed a certificate of candidacy for Mayor on 15 August 2026.',
    effective_from: '2026-08-15',
    effective_to: null,
    verification_status: 'PRIMARY_SOURCE',
    last_reviewed_at: REVIEWED,
  },
  {
    id: 'claim-maria-councilor-term',
    subject_person_id: 'person-maria-makabayan',
    subject_record_type: 'OFFICE_TERM',
    subject_record_id: 'ot-maria-councilor-2022',
    claim_type: 'OFFICE_TERM',
    statement: 'Served as City Councilor from 30 June 2022 to 30 June 2025.',
    effective_from: '2022-06-30',
    effective_to: '2025-06-30',
    verification_status: 'DISPUTED',
    last_reviewed_at: REVIEWED,
  },
  {
    id: 'claim-maria-party-on-coc',
    subject_person_id: 'person-maria-makabayan',
    subject_record_type: 'AFFILIATION',
    subject_record_id: 'af-maria-phal-2026',
    claim_type: 'AFFILIATION',
    statement: 'Partido Halimbawa is named as her party on her certificate of candidacy.',
    effective_from: '2026-08-15',
    effective_to: null,
    verification_status: 'PRIMARY_SOURCE',
    last_reviewed_at: REVIEWED,
  },
  {
    id: 'claim-maria-transport-position',
    subject_person_id: 'person-maria-makabayan',
    subject_record_type: 'POLICY_POSITION',
    subject_record_id: 'pp-maria-transport',
    claim_type: 'POLICY_POSITION',
    statement: 'Her published campaign platform proposes dedicated bus lanes on Halimbawa Avenue.',
    effective_from: '2026-08-20',
    effective_to: null,
    verification_status: 'SELF_DECLARED',
    last_reviewed_at: REVIEWED,
  },
  // --- Juan Dela Cruz ---
  {
    id: 'claim-juan-birth-date',
    subject_person_id: 'person-juan-dela-cruz',
    subject_record_type: 'PERSON',
    subject_record_id: 'person-juan-dela-cruz',
    claim_type: 'BIRTH_DATE',
    statement: 'Born on 12 June 1980, according to his campaign page.',
    effective_from: null,
    effective_to: null,
    verification_status: 'SELF_DECLARED',
    last_reviewed_at: REVIEWED,
  },
  {
    id: 'claim-juan-official-candidate',
    subject_person_id: 'person-juan-dela-cruz',
    subject_record_type: 'ELECTION_PARTICIPATION',
    subject_record_id: 'ep-juan-2027-mayor',
    claim_type: 'CANDIDACY_STATUS',
    statement:
      'Listed as a candidate for Mayor, ballot number 2, on the certified list of candidates.',
    effective_from: '2026-09-15',
    effective_to: null,
    verification_status: 'PRIMARY_SOURCE',
    last_reviewed_at: REVIEWED,
  },
  {
    id: 'claim-juan-barangay-term',
    subject_person_id: 'person-juan-dela-cruz',
    subject_record_type: 'OFFICE_TERM',
    subject_record_id: 'ot-juan-barangay-2018',
    claim_type: 'OFFICE_TERM',
    statement: 'Served as Punong Barangay of Barangay Uno from 30 June 2018 to 30 November 2023.',
    effective_from: '2018-06-30',
    effective_to: '2023-11-30',
    verification_status: 'CORROBORATED',
    last_reviewed_at: REVIEWED,
  },
  {
    id: 'claim-juan-ski-membership',
    subject_person_id: 'person-juan-dela-cruz',
    subject_record_type: 'AFFILIATION',
    subject_record_id: 'af-juan-ski-2016',
    claim_type: 'AFFILIATION',
    statement:
      "Listed as a member in Samahang Kathang-Isip's 2019 roster. No later roster has been located.",
    effective_from: '2016-01-10',
    effective_to: null,
    verification_status: 'OUTDATED',
    last_reviewed_at: REVIEWED,
  },
  {
    id: 'claim-juan-education',
    subject_person_id: 'person-juan-dela-cruz',
    subject_record_type: 'EDUCATION',
    subject_record_id: 'ed-juan-pamantasan',
    claim_type: 'EDUCATION',
    statement: 'States he completed a BS in Civil Engineering at Pamantasan ng Halimbawa in 2002.',
    effective_from: null,
    effective_to: null,
    verification_status: 'SELF_DECLARED',
    last_reviewed_at: REVIEWED,
  },
  {
    id: 'claim-juan-flood-position',
    subject_person_id: 'person-juan-dela-cruz',
    subject_record_type: 'POLICY_POSITION',
    subject_record_id: 'pp-juan-flood-control',
    claim_type: 'POLICY_POSITION',
    statement:
      'In a 2 September 2026 speech, he stated that drainage upgrades in low-lying barangays would be a priority.',
    effective_from: '2026-09-02',
    effective_to: null,
    verification_status: 'SELF_DECLARED',
    last_reviewed_at: REVIEWED,
  },
  // --- Pedro Santos Jr. ---
  {
    id: 'claim-pedro-potential-aspirant',
    subject_person_id: 'person-pedro-santos',
    subject_record_type: 'ELECTION_PARTICIPATION',
    subject_record_id: 'ep-pedro-2027-mayor',
    claim_type: 'CANDIDACY_STATUS',
    statement:
      'Reported as considering a run for Mayor. No certificate of candidacy has been located.',
    effective_from: '2026-09-20',
    effective_to: null,
    verification_status: 'REPORTED',
    last_reviewed_at: REVIEWED,
  },
  {
    id: 'claim-pedro-councilor-term',
    subject_person_id: 'person-pedro-santos',
    subject_record_type: 'OFFICE_TERM',
    subject_record_id: 'ot-pedro-councilor-2022',
    claim_type: 'OFFICE_TERM',
    statement:
      'Described as a City Councilor since 30 June 2022. No document has been attached yet.',
    effective_from: '2022-06-30',
    effective_to: null,
    verification_status: 'UNVERIFIED',
    last_reviewed_at: REVIEWED,
  },
];

const claim_evidence = [
  { claim_id: 'claim-maria-filed-coc', source_id: 'src-coc-maria', supports: true, note: null },
  {
    claim_id: 'claim-maria-councilor-term',
    source_id: 'src-city-roster-2022',
    supports: true,
    note: 'Lists the term as 30 June 2022 to 30 June 2025.',
  },
  {
    claim_id: 'claim-maria-councilor-term',
    source_id: 'src-news-balita-maria-term',
    supports: false,
    note: 'Reports that the council was sworn in on 1 July 2022.',
  },
  {
    claim_id: 'claim-maria-party-on-coc',
    source_id: 'src-coc-maria',
    supports: true,
    note: 'Party field of the certificate.',
  },
  {
    claim_id: 'claim-maria-transport-position',
    source_id: 'src-maria-platform',
    supports: true,
    note: null,
  },
  {
    claim_id: 'claim-juan-birth-date',
    source_id: 'src-juan-campaign',
    supports: true,
    note: null,
  },
  {
    claim_id: 'claim-juan-official-candidate',
    source_id: 'src-certified-list-2027',
    supports: true,
    note: null,
  },
  {
    claim_id: 'claim-juan-barangay-term',
    source_id: 'src-barangay-uno-roster',
    supports: true,
    note: null,
  },
  {
    claim_id: 'claim-juan-barangay-term',
    source_id: 'src-news-pahayagan-barangay',
    supports: true,
    note: 'Reports the end of the term in November 2023.',
  },
  {
    claim_id: 'claim-juan-ski-membership',
    source_id: 'src-ski-roster-2019',
    supports: true,
    note: 'Roster dated 2019; current membership is not documented.',
  },
  {
    claim_id: 'claim-juan-education',
    source_id: 'src-juan-campaign',
    supports: true,
    note: null,
  },
  {
    claim_id: 'claim-juan-flood-position',
    source_id: 'src-juan-campaign',
    supports: true,
    note: 'Speech transcript published on the campaign page.',
  },
  {
    claim_id: 'claim-pedro-potential-aspirant',
    source_id: 'src-news-pahayagan-pedro',
    supports: true,
    note: 'Based on unnamed sources; no filing found.',
  },
];

export const devFixtureTables: FixtureTables = {
  people: [...people, ...extraPeople],
  elections: [...elections, ...extraElections],
  offices: [...offices, ...extraOffices],
  political_organizations: [...political_organizations, ...extraOrganizations],
  election_participations: [...election_participations, ...extraParticipations],
  office_terms: [...office_terms, ...extraOfficeTerms],
  affiliation_records: [...affiliation_records, ...extraAffiliations],
  education_records: [...education_records, ...extraEducation],
  policy_position_records: [...policy_position_records, ...extraPolicyPositions],
  sources: [...sources, ...extraSources],
  claims: [...claims, ...extraClaims],
  claim_evidence: [...claim_evidence, ...extraClaimEvidence],
};
