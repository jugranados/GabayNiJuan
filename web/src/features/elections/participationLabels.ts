import type { ElectionParticipationStatus } from '@/domain/enums';

export type ParticipationStatusInfo = {
  /** Short label for cards and chips. */
  label: string;
  /** Heading for a group of people who share this status on an office page. */
  groupHeading: string;
  /** One neutral sentence saying what the state does and does not mean. */
  description: string;
  /** What kind of record normally documents this state (source guidance for voters). */
  evidence: string;
  /**
   * True only for OFFICIAL_CANDIDATE: the one state in which a person is an official candidate.
   * Aspirants and people who filed a certificate are not, and are never labelled so.
   */
  isOfficialCandidate: boolean;
};

/**
 * Neutral wording for candidacy lifecycle states. Each state is written out exactly; none is
 * collapsed into "candidate". Declaring and filing are not the same as being an official
 * candidate, and the wording says so.
 */
export const PARTICIPATION_STATUS_INFO: Readonly<
  Record<ElectionParticipationStatus, ParticipationStatusInfo>
> = {
  POTENTIAL_ASPIRANT: {
    label: 'Potential aspirant',
    groupHeading: 'Potential aspirants',
    description: 'Reported as possibly running. This is not a candidacy.',
    evidence: 'Usually documented by news reporting. The person may not have said anything.',
    isOfficialCandidate: false,
  },
  PUBLICLY_DECLARED_ASPIRANT: {
    label: 'Publicly declared aspirant',
    groupHeading: 'Publicly declared aspirants',
    description: 'Has said publicly that they intend to run. Not a candidate.',
    evidence: 'Usually documented by the person’s own statement or reporting of it.',
    isOfficialCandidate: false,
  },
  FILED_COC: {
    label: 'Filed certificate of candidacy',
    groupHeading: 'Filed a certificate of candidacy',
    description:
      'A certificate of candidacy was filed. Not yet confirmed as an official candidate.',
    evidence: 'Documented by a filing record from COMELEC or the filing office.',
    isOfficialCandidate: false,
  },
  OFFICIAL_CANDIDATE: {
    label: 'Official candidate',
    groupHeading: 'Official candidates',
    description: 'Listed as a candidate in official election records.',
    evidence: 'Documented by an official COMELEC list of candidates.',
    isOfficialCandidate: true,
  },
  WITHDRAWN: {
    label: 'Withdrawn',
    groupHeading: 'Withdrawn',
    description: 'Withdrew from this election for this office.',
    evidence: 'Documented by a withdrawal record or the person’s statement.',
    isOfficialCandidate: false,
  },
  DISQUALIFIED: {
    label: 'Disqualified',
    groupHeading: 'Disqualified',
    description: 'Listed as disqualified in an official record.',
    evidence: 'Documented by a COMELEC or court resolution.',
    isOfficialCandidate: false,
  },
  ELECTED: {
    label: 'Elected',
    groupHeading: 'Elected',
    description: 'Recorded as having won the election.',
    evidence: 'Documented by an official proclamation or canvass record.',
    isOfficialCandidate: false,
  },
  NOT_ELECTED: {
    label: 'Not elected',
    groupHeading: 'Not elected',
    description: 'Recorded as not having won the election.',
    evidence: 'Documented by official canvass results.',
    isOfficialCandidate: false,
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

/** The plain-language note shown wherever participation statuses are explained. */
export const CANDIDACY_NOTE =
  'Saying you will run, or filing a certificate of candidacy, does not make someone an official candidate. Only people listed in official election records are shown as official candidates.';

