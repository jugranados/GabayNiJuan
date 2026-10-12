import type { ElectionParticipationStatus } from '@/domain/enums';

export type ParticipationStatusInfo = {
  /** Short label for cards and chips. */
  label: string;
  /** One neutral sentence saying what the state does and does not mean. */
  description: string;
};

/**
 * Neutral wording for candidacy lifecycle states. Aspirant states say
 * explicitly that they are not candidacies, and no state is collapsed into
 * "candidate".
 */
export const PARTICIPATION_STATUS_INFO: Readonly<
  Record<ElectionParticipationStatus, ParticipationStatusInfo>
> = {
  POTENTIAL_ASPIRANT: {
    label: 'Potential aspirant',
    description: 'Reported as possibly running. This is not a candidacy.',
  },
  PUBLICLY_DECLARED_ASPIRANT: {
    label: 'Declared aspirant',
    description: 'Has said publicly that they intend to run. Not yet a candidate.',
  },
  FILED_COC: {
    label: 'Filed certificate of candidacy',
    description:
      'A certificate of candidacy was filed. Not yet confirmed as an official candidate.',
  },
  OFFICIAL_CANDIDATE: {
    label: 'Official candidate',
    description: 'Listed as a candidate in official election records.',
  },
  WITHDRAWN: {
    label: 'Withdrawn',
    description: 'Candidacy was withdrawn.',
  },
  DISQUALIFIED: {
    label: 'Disqualified',
    description: 'Listed as disqualified in an official record.',
  },
  ELECTED: {
    label: 'Elected',
    description: 'Recorded as having won the election.',
  },
  NOT_ELECTED: {
    label: 'Not elected',
    description: 'Recorded as not having won the election.',
  },
};

/** Statuses in the order a voter would think of them (not a ranking). */
export const PARTICIPATION_STATUS_ORDER: readonly ElectionParticipationStatus[] = [
  'POTENTIAL_ASPIRANT',
  'PUBLICLY_DECLARED_ASPIRANT',
  'FILED_COC',
  'OFFICIAL_CANDIDATE',
  'WITHDRAWN',
  'DISQUALIFIED',
  'ELECTED',
  'NOT_ELECTED',
];
