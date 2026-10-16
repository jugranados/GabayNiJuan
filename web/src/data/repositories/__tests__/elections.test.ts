import { devFixtureTables } from '@/data/fixtures/devFixtures';
import { createInMemoryRowSource, type FixtureTables } from '@/data/repositories/inMemoryRowSource';
import { createMockRepositories } from '@/data/repositories/mockRepositories';
import { createElectionRepository } from '@/data/repositories/tableRepositories';
import {
  electionOfficeRowSchema,
  electionParticipationRowSchema,
  electionRowSchema,
  officeRowSchema,
  politicalOrganizationRowSchema,
} from '@/data/schemas/rows';
import { parseRows } from '@/data/schemas/parse';
import { DataValidationError } from '@/domain/validation/errors';
import { isValidSlug, recordSlugBase } from '@/domain/slug';

const repos = createMockRepositories();
const E2028 = 'national-and-district-election-2028-fictional';
const E2027 = 'halimbawa-city-local-election-2027-fictional';

describe('fixture slugs for elections, offices and organizations', () => {
  it.each([
    ['elections', electionRowSchema, 'election'],
    ['offices', officeRowSchema, 'office'],
    ['political_organizations', politicalOrganizationRowSchema, 'organization'],
  ] as const)('%s: unique, valid and what the database backfill generates from the name', (table, schema, fallback) => {
    const rows = parseRows(schema, table, devFixtureTables[table] ?? []);
    const slugs = rows.map((row) => row.slug);
    expect(new Set(slugs).size).toBe(slugs.length);
    for (const row of rows) {
      expect(isValidSlug(row.slug)).toBe(true);
      // Equal to the generated slug, so a database upgraded by the backfill and a fresh seed agree.
      expect(row.slug).toBe(recordSlugBase(row.name, fallback));
      // Fictional records keep "fictional" in their address, so no real address is ever occupied.
      expect(row.slug).toMatch(/fictional/);
    }
  });

  it('every participation belongs to an election office (the database enforces this with a foreign key)', () => {
    const contests = parseRows(electionOfficeRowSchema, 'election office', devFixtureTables.election_offices ?? []);
    const pairs = new Set(contests.map((c) => `${c.election_id}|${c.office_id}`));
    expect(pairs.size).toBe(contests.length);
    for (const p of parseRows(electionParticipationRowSchema, 'participation', devFixtureTables.election_participations ?? [])) {
      expect(pairs.has(`${p.election_id}|${p.office_id}`)).toBe(true);
    }
  });

  it('no fixture election is COMPLETED before its date', () => {
    for (const e of parseRows(electionRowSchema, 'election', devFixtureTables.elections ?? [])) {
      if (e.status === 'COMPLETED') expect(e.election_date <= '2026-10-16').toBe(true);
    }
  });
});

describe('election lookup', () => {
  it('lists every election with its number of election offices', async () => {
    const list = await repos.elections.listElections();
    expect(list.map(({ election, officeCount }) => [election.slug, officeCount])).toEqual([
      ['halimbawa-provincial-and-municipal-election-2022-fictional', 2],
      [E2027, 2],
      [E2028, 6],
    ]);
  });

  it('finds an election by slug, and nothing for an unknown or malformed slug', async () => {
    expect((await repos.elections.getElectionDetail(E2028))?.election.id).toBe('election-pambansa-2028');
    expect(await repos.elections.getElectionDetail('no-such-election')).toBeNull();
    expect(await repos.elections.getElectionDetail('2028 Election')).toBeNull();
  });

  it('keeps ids working for backward compatibility: id lookups return the slug to redirect to', async () => {
    expect((await repos.elections.getElectionById('election-pambansa-2028'))?.slug).toBe(E2028);
    expect((await repos.elections.getOfficeById('office-senator'))?.slug).toBe('senator-fictional-seat');
  });

  it('returns the 2028 structure in ballot order with exact per-status counts', async () => {
    const detail = await repos.elections.getElectionDetail(E2028);
    expect(detail?.offices.map((o) => [o.office.slug, o.participantCount, o.statusCounts])).toEqual([
      ['president-fictional-seat', 0, {}],
      ['vice-president-fictional-seat', 0, {}],
      [
        'senator-fictional-seat',
        3,
        { PUBLICLY_DECLARED_ASPIRANT: 1, WITHDRAWN: 1, POTENTIAL_ASPIRANT: 1 },
      ],
      ['district-representative-halimbawa-1st-district-fictional', 1, { FILED_COC: 1 }],
      ['governor-province-of-kathang-isip-fictional', 0, {}],
      ['municipal-mayor-bayan-ng-ejemplo-fictional', 0, {}],
    ]);
  });

  it('finds an office page only when the office is contested in that election', async () => {
    expect(await repos.elections.getElectionOfficeDetail(E2027, 'mayor-city-of-halimbawa-fictional')).not.toBeNull();
    expect(await repos.elections.getElectionOfficeDetail(E2027, 'senator-fictional-seat')).toBeNull();
    expect(await repos.elections.getElectionOfficeDetail('nope', 'senator-fictional-seat')).toBeNull();
  });

  it('lists the address of every election office page', async () => {
    const paths = await repos.elections.listElectionOfficePaths();
    expect(paths).toHaveLength(10);
    expect(paths).toContainEqual({ electionSlug: E2028, officeSlug: 'president-fictional-seat' });
  });
});

describe('participants on an office page', () => {
  it('keeps each status exact and attaches each record’s own claims', async () => {
    const detail = await repos.elections.getElectionOfficeDetail(E2027, 'mayor-city-of-halimbawa-fictional');
    expect(detail?.groups.map((g) => [g.status, g.participants.map((p) => p.person.slug)])).toEqual([
      ['POTENTIAL_ASPIRANT', ['pedro-santos-jr']],
      ['FILED_COC', ['maria-makabayan']],
      ['OFFICIAL_CANDIDATE', ['juan-dela-cruz']],
      ['DISQUALIFIED', ['dante-gawa-gawa']],
    ]);
    for (const group of detail?.groups ?? []) {
      for (const participant of group.participants) {
        for (const { record, claims } of participant.records) {
          expect(record.status).toBe(group.status);
          for (const { claim } of claims) {
            expect(claim.subjectRecord).toEqual({ type: 'ELECTION_PARTICIPATION', id: record.id });
          }
        }
      }
    }
  });

  it('groups a person with several dated records by the most recent one, and keeps the earlier record', async () => {
    const extra = {
      id: 'ep-pedro-2027-mayor-declared',
      person_id: 'person-pedro-santos',
      election_id: 'election-halimbawa-2027',
      office_id: 'office-halimbawa-mayor',
      ballot_number: null,
      status: 'PUBLICLY_DECLARED_ASPIRANT',
      effective_from: '2026-10-05',
      effective_to: null,
    };
    const tables: FixtureTables = {
      ...devFixtureTables,
      election_participations: [...(devFixtureTables.election_participations ?? []), extra],
    };
    const elections = createElectionRepository(createInMemoryRowSource(tables));
    const detail = await elections.getElectionOfficeDetail(E2027, 'mayor-city-of-halimbawa-fictional');
    const declared = detail?.groups.find((g) => g.status === 'PUBLICLY_DECLARED_ASPIRANT');
    expect(declared?.participants.map((p) => p.person.slug)).toEqual(['pedro-santos-jr']);
    expect(declared?.participants[0]?.records.map((r) => r.record.status)).toEqual([
      'PUBLICLY_DECLARED_ASPIRANT',
      'POTENTIAL_ASPIRANT',
    ]);
    // The earlier record keeps its own claim; nothing is inferred onto the new one.
    expect(declared?.participants[0]?.records[0]?.claims).toEqual([]);
    expect(declared?.participants[0]?.records[1]?.claims.length).toBeGreaterThan(0);
    expect(detail?.groups.find((g) => g.status === 'POTENTIAL_ASPIRANT')).toBeUndefined();
    expect(detail?.participantCount).toBe(4);
  });

  it('rejects an invalid row instead of rendering part of the page', async () => {
    const tables: FixtureTables = {
      ...devFixtureTables,
      election_offices: [{ id: 'eo-bad', election_id: 'election-pambansa-2028', office_id: 'office-senator', sort_order: -1 }],
    };
    const elections = createElectionRepository(createInMemoryRowSource(tables));
    await expect(elections.getElectionDetail(E2028)).rejects.toThrow(DataValidationError);
  });
});
