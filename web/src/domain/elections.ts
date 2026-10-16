/**
 * Pure rules for elections, election offices and participation records. Shared by the
 * repositories, the public pages and the editorial area; the database enforces the same
 * date/status rule (supabase/migrations/*_election_foundation.sql).
 */
import { ELECTION_PARTICIPATION_STATUSES } from '@/domain/enums';
import type { ElectionParticipationStatus, ElectionStatus } from '@/domain/enums';
import type { Election, ElectionParticipation, IsoDate, Office, Person } from '@/domain/models';

const byCodePoint = (a: string, b: string) => (a < b ? -1 : a > b ? 1 : 0);

/** Philippine calendar date (UTC+8, no daylight saving time). Election dates are Philippine dates. */
export function philippineDate(now: Date): IsoDate {
  return new Date(now.getTime() + 8 * 60 * 60 * 1000).toISOString().slice(0, 10);
}

// ---------------------------------------------------------------------------
// Election lists
// ---------------------------------------------------------------------------

/** Sections of /elections, in this order. Status as recorded; never inferred from the date. */
export const ELECTION_SECTIONS: readonly ElectionStatus[] = ['UPCOMING', 'ONGOING', 'COMPLETED'];

/**
 * Deterministic, neutral order within a section: upcoming and ongoing elections soonest
 * first, completed elections most recent first; ties by name, then id. Never by popularity.
 */
export function compareElections(a: Election, b: Election): number {
  const byDate =
    a.status === 'COMPLETED' && b.status === 'COMPLETED'
      ? byCodePoint(b.electionDate, a.electionDate)
      : byCodePoint(a.electionDate, b.electionDate);
  return byDate || byCodePoint(a.name, b.name) || byCodePoint(a.id, b.id);
}

export function groupElectionsByStatus<T extends { election: Election }>(
  items: readonly T[],
): { status: ElectionStatus; items: T[] }[] {
  return ELECTION_SECTIONS.map((status) => ({
    status,
    items: items
      .filter((item) => item.election.status === status)
      .sort((a, b) => compareElections(a.election, b.election)),
  })).filter((section) => section.items.length > 0);
}

/**
 * Why a date/status pair is inconsistent, or undefined. COMPLETED before the date is never
 * valid; UPCOMING after the date is refused when an editor records it. Same rule as
 * private.check_election_date_status().
 */
export function electionDateStatusProblem(
  electionDate: IsoDate,
  status: ElectionStatus,
  today: IsoDate,
): string | undefined {
  if (status === 'COMPLETED' && electionDate > today) {
    return 'An election cannot be completed before its date.';
  }
  if (status === 'UPCOMING' && electionDate < today) {
    return 'This election date has passed. Record the election as ongoing or completed.';
  }
  return undefined;
}

/**
 * True when a recorded UPCOMING election's date has passed. The status is shown as recorded,
 * with a note; it is never silently changed.
 */
export function isElectionStatusStale(election: Election, today: IsoDate): boolean {
  return election.status === 'UPCOMING' && election.electionDate < today;
}

// ---------------------------------------------------------------------------
// Offices within an election
// ---------------------------------------------------------------------------

/** Election page order: the editorial sort order (ballot order), then office name, then id. */
export function compareElectionOffices(
  a: { electionOffice: { sortOrder: number }; office: Office },
  b: { electionOffice: { sortOrder: number }; office: Office },
): number {
  return (
    a.electionOffice.sortOrder - b.electionOffice.sortOrder ||
    byCodePoint(a.office.name, b.office.name) ||
    byCodePoint(a.office.id, b.office.id)
  );
}

// ---------------------------------------------------------------------------
// Participation records
// ---------------------------------------------------------------------------

/** Most recent record first: effective date, then id. */
export function compareParticipationsMostRecentFirst(
  a: ElectionParticipation,
  b: ElectionParticipation,
): number {
  return byCodePoint(b.effectiveFrom, a.effectiveFrom) || byCodePoint(a.id, b.id);
}

/** Alphabetical, as in the directory: lowercase last name, first name, id, by code point. */
export function comparePeopleByName(a: Person, b: Person): number {
  return (
    byCodePoint(a.lastName.toLowerCase(), b.lastName.toLowerCase()) ||
    byCodePoint(a.firstName.toLowerCase(), b.firstName.toLowerCase()) ||
    byCodePoint(a.id, b.id)
  );
}

/** Status grouping order on office pages: the lifecycle order of the enum. Not a ranking. */
export const PARTICIPATION_GROUP_ORDER: readonly ElectionParticipationStatus[] =
  ELECTION_PARTICIPATION_STATUSES;

/**
 * Statuses that may follow each status as a NEW, dated record for the same person, election
 * and office. Each status is its own claim with its own evidence; none is inferred from
 * another. Skipping a step is allowed (a filing may be the first documented event), going
 * back is not, and ELECTED / NOT_ELECTED are final. A disqualification can be reversed
 * (OFFICIAL_CANDIDATE) or the name can stay on the ballot (ELECTED / NOT_ELECTED).
 */
export const PARTICIPATION_SUCCESSORS: Readonly<
  Record<ElectionParticipationStatus, readonly ElectionParticipationStatus[]>
> = {
  POTENTIAL_ASPIRANT: ['PUBLICLY_DECLARED_ASPIRANT', 'FILED_COC', 'OFFICIAL_CANDIDATE', 'WITHDRAWN'],
  PUBLICLY_DECLARED_ASPIRANT: ['FILED_COC', 'OFFICIAL_CANDIDATE', 'WITHDRAWN'],
  FILED_COC: ['OFFICIAL_CANDIDATE', 'WITHDRAWN', 'DISQUALIFIED'],
  OFFICIAL_CANDIDATE: ['WITHDRAWN', 'DISQUALIFIED', 'ELECTED', 'NOT_ELECTED'],
  WITHDRAWN: [],
  DISQUALIFIED: ['OFFICIAL_CANDIDATE', 'ELECTED', 'NOT_ELECTED'],
  ELECTED: [],
  NOT_ELECTED: [],
};

const readableStatus = (status: ElectionParticipationStatus) =>
  status.toLowerCase().replace(/_/g, ' ');

/**
 * Checks a participation record against the person's other records for the same election and
 * office, ordered by date. `existing` must exclude the record itself and anything retracted or
 * rejected. The record must be a valid successor of the record dated just before it, and the
 * record dated just after it must be a valid successor of this one. Earlier history can be
 * added later (a declaration found after the filing was recorded), as long as the order holds.
 * Returns why the record does not fit, or undefined.
 */
export function participationSuccessionProblem(
  existing: readonly Pick<ElectionParticipation, 'id' | 'status' | 'effectiveFrom'>[],
  next: Pick<ElectionParticipation, 'status' | 'effectiveFrom'>,
): string | undefined {
  const oldestFirst = [...existing].sort(
    (a, b) => byCodePoint(a.effectiveFrom, b.effectiveFrom) || byCodePoint(a.id, b.id),
  );
  const before = oldestFirst.filter((record) => record.effectiveFrom <= next.effectiveFrom).at(-1);
  const after = oldestFirst.find((record) => record.effectiveFrom > next.effectiveFrom);
  if (before && before.status === next.status) {
    return `A record with the status "${readableStatus(next.status)}" already exists (from ${before.effectiveFrom}). Correct that record instead of adding a duplicate.`;
  }
  if (before && !PARTICIPATION_SUCCESSORS[before.status].includes(next.status)) {
    return `"${readableStatus(next.status)}" cannot follow "${readableStatus(before.status)}" (recorded from ${before.effectiveFrom}). If that record is wrong, retract it.`;
  }
  if (after && !PARTICIPATION_SUCCESSORS[next.status].includes(after.status)) {
    return `"${readableStatus(after.status)}" (recorded from ${after.effectiveFrom}) cannot follow "${readableStatus(next.status)}". Check the date and status.`;
  }
  return undefined;
}
