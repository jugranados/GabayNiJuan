/**
 * Election read models: election → office → participants → person → claims → evidence.
 * Views over domain records, not table designs. Nothing here ranks, scores or predicts.
 */
import type { ElectionParticipationStatus } from '@/domain/enums';
import type { Election, ElectionOffice, ElectionParticipation, Office } from '@/domain/models';
import type { Attested, PersonSummary } from '@/domain/models/personProfile';

/** An election as listed on /elections. `officeCount` counts published election offices only. */
export type ElectionSummary = {
  election: Election;
  officeCount: number;
};

/** One office on an election page, with how many people have a record in each exact status. */
export type ElectionOfficeSummary = {
  electionOffice: ElectionOffice;
  office: Office;
  /** People with a documented participation, counted once, by their most recent record. */
  participantCount: number;
  statusCounts: Partial<Record<ElectionParticipationStatus, number>>;
};

export type ElectionDetail = {
  election: Election;
  /** In presentation order (sort order, then office name). */
  offices: ElectionOfficeSummary[];
};

/**
 * One person's documented participation for one office in one election. A later status is a
 * separate, dated record with its own evidence, so a person can have more than one.
 */
export type ContestParticipant = {
  person: PersonSummary;
  /** Most recent first (effective date, then id). The first one decides the group. */
  records: Attested<ElectionParticipation>[];
};

/** Participants who share the same exact most recent status. Never merged across statuses. */
export type ParticipantGroup = {
  status: ElectionParticipationStatus;
  participants: ContestParticipant[];
};

export type ElectionOfficeDetail = {
  election: Election;
  office: Office;
  electionOffice: ElectionOffice;
  /** In status order; empty groups are omitted. */
  groups: ParticipantGroup[];
  participantCount: number;
};

/** Public address of one election office page. */
export type ElectionOfficePath = { electionSlug: string; officeSlug: string };
