import type { AffiliationType } from '@/domain/enums';

export const AFFILIATION_TYPE_LABELS: Readonly<Record<AffiliationType, string>> = {
  MEMBER: 'Member',
  CANDIDATE: 'Candidate of',
  LEADER: 'Leader',
  ENDORSED_BY: 'Endorsed by',
  COALITION: 'Coalition',
};
