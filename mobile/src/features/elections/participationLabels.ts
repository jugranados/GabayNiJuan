import type { ElectionParticipationStatus } from '@/domain/enums';

/**
 * Neutral wording for candidacy lifecycle states. Aspirant states state
 * explicitly that they are not candidacies.
 */
export const PARTICIPATION_STATUS_LABELS: Readonly<Record<ElectionParticipationStatus, string>> = {
  POTENTIAL_ASPIRANT: 'Reported as a potential aspirant (not a candidate)',
  PUBLICLY_DECLARED_ASPIRANT: 'Publicly declared intention to run (not yet a candidate)',
  FILED_COC: 'Filed a certificate of candidacy',
  OFFICIAL_CANDIDATE: 'Official candidate',
  WITHDRAWN: 'Withdrew candidacy',
  DISQUALIFIED: 'Disqualified',
  ELECTED: 'Elected',
  NOT_ELECTED: 'Not elected',
};
