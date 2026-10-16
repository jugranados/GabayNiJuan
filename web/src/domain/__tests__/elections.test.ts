import {
  compareElections,
  electionDateStatusProblem,
  groupElectionsByStatus,
  isElectionStatusStale,
  participationSuccessionProblem,
  PARTICIPATION_SUCCESSORS,
  philippineDate,
} from '@/domain/elections';
import { ELECTION_PARTICIPATION_STATUSES } from '@/domain/enums';
import type { Election } from '@/domain/models';

const election = (id: string, electionDate: string, status: Election['status'], name = id): Election => ({
  id,
  slug: id,
  name,
  electionDate,
  countryCode: 'PH',
  status,
});

describe('election ordering', () => {
  it('groups by recorded status: upcoming and ongoing soonest first, completed most recent first', () => {
    const items = [
      election('c-2019', '2019-05-13', 'COMPLETED'),
      election('u-2028', '2028-05-08', 'UPCOMING'),
      election('c-2022', '2022-05-09', 'COMPLETED'),
      election('u-2027', '2027-05-10', 'UPCOMING'),
      election('o-2026', '2026-10-20', 'ONGOING'),
    ].map((e) => ({ election: e }));
    expect(groupElectionsByStatus(items).map((s) => [s.status, s.items.map((i) => i.election.id)])).toEqual([
      ['UPCOMING', ['u-2027', 'u-2028']],
      ['ONGOING', ['o-2026']],
      ['COMPLETED', ['c-2022', 'c-2019']],
    ]);
  });

  it('breaks ties by name, then id, so the order is the same everywhere', () => {
    const a = election('b', '2028-05-08', 'UPCOMING', 'Alpha');
    const b = election('a', '2028-05-08', 'UPCOMING', 'Beta');
    expect([b, a].sort(compareElections).map((e) => e.name)).toEqual(['Alpha', 'Beta']);
  });
});

describe('election date and status', () => {
  it('never allows COMPLETED before the election date', () => {
    expect(electionDateStatusProblem('2028-05-08', 'COMPLETED', '2026-10-16')).toMatch(/cannot be completed/);
    expect(electionDateStatusProblem('2022-05-09', 'COMPLETED', '2026-10-16')).toBeUndefined();
    expect(electionDateStatusProblem('2026-10-16', 'COMPLETED', '2026-10-16')).toBeUndefined();
  });

  it('refuses to record UPCOMING once the date has passed; ONGOING is allowed either side', () => {
    expect(electionDateStatusProblem('2022-05-09', 'UPCOMING', '2026-10-16')).toMatch(/has passed/);
    expect(electionDateStatusProblem('2026-10-16', 'UPCOMING', '2026-10-16')).toBeUndefined();
    expect(electionDateStatusProblem('2026-12-01', 'ONGOING', '2026-10-16')).toBeUndefined();
    expect(electionDateStatusProblem('2026-01-01', 'ONGOING', '2026-10-16')).toBeUndefined();
  });

  it('flags a recorded UPCOMING election whose date has passed instead of changing it', () => {
    expect(isElectionStatusStale(election('x', '2027-05-10', 'UPCOMING'), '2027-05-11')).toBe(true);
    expect(isElectionStatusStale(election('x', '2027-05-10', 'UPCOMING'), '2027-05-10')).toBe(false);
    expect(isElectionStatusStale(election('x', '2022-05-09', 'COMPLETED'), '2027-05-11')).toBe(false);
  });

  it('uses the Philippine calendar date (UTC+8)', () => {
    expect(philippineDate(new Date('2028-05-07T16:30:00Z'))).toBe('2028-05-08');
    expect(philippineDate(new Date('2028-05-07T15:59:00Z'))).toBe('2028-05-07');
  });
});

describe('participation succession', () => {
  const record = (id: string, status: (typeof ELECTION_PARTICIPATION_STATUSES)[number], effectiveFrom: string) => ({
    id,
    status,
    effectiveFrom,
  });

  it('allows a first record of any status', () => {
    for (const status of ELECTION_PARTICIPATION_STATUSES) {
      expect(participationSuccessionProblem([], { status, effectiveFrom: '2027-10-01' })).toBeUndefined();
    }
  });

  it('allows forward steps, including skipped ones, as new dated records', () => {
    const existing = [record('a', 'PUBLICLY_DECLARED_ASPIRANT', '2027-06-01')];
    expect(participationSuccessionProblem(existing, { status: 'FILED_COC', effectiveFrom: '2027-10-01' })).toBeUndefined();
    expect(participationSuccessionProblem(existing, { status: 'OFFICIAL_CANDIDATE', effectiveFrom: '2027-12-01' })).toBeUndefined();
  });

  it('refuses steps backwards, after a final state, and duplicates', () => {
    const filed = [record('a', 'FILED_COC', '2027-10-01')];
    expect(participationSuccessionProblem(filed, { status: 'POTENTIAL_ASPIRANT', effectiveFrom: '2027-11-01' })).toMatch(
      /cannot follow "filed coc"/,
    );
    expect(participationSuccessionProblem(filed, { status: 'FILED_COC', effectiveFrom: '2027-11-01' })).toMatch(/already exists/);
    const elected = [record('b', 'ELECTED', '2028-05-12')];
    expect(participationSuccessionProblem(elected, { status: 'NOT_ELECTED', effectiveFrom: '2028-05-13' })).toBeDefined();
  });

  it('lets an earlier record be added later, as long as the dated order still holds', () => {
    const filed = [record('a', 'FILED_COC', '2027-10-01')];
    expect(
      participationSuccessionProblem(filed, { status: 'PUBLICLY_DECLARED_ASPIRANT', effectiveFrom: '2027-06-01' }),
    ).toBeUndefined();
    expect(participationSuccessionProblem(filed, { status: 'ELECTED', effectiveFrom: '2027-06-01' })).toMatch(
      /cannot follow "elected"/,
    );
  });

  it('never lets a declaration or filing turn into an election result without official candidacy', () => {
    expect(PARTICIPATION_SUCCESSORS.POTENTIAL_ASPIRANT).not.toContain('ELECTED');
    expect(PARTICIPATION_SUCCESSORS.PUBLICLY_DECLARED_ASPIRANT).not.toContain('ELECTED');
    expect(PARTICIPATION_SUCCESSORS.FILED_COC).not.toContain('ELECTED');
    expect(PARTICIPATION_SUCCESSORS.ELECTED).toEqual([]);
    expect(PARTICIPATION_SUCCESSORS.NOT_ELECTED).toEqual([]);
  });
});
