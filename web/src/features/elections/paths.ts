import type { ElectionStatus } from '@/domain/enums';

export const ELECTIONS_PATH = '/elections';
export const electionPath = (slug: string): string => `${ELECTIONS_PATH}/${slug}`;
export const electionOfficePath = (electionSlug: string, officeSlug: string): string =>
  `${ELECTIONS_PATH}/${electionSlug}/${officeSlug}`;

export const ELECTION_STATUS_LABELS: Readonly<Record<ElectionStatus, string>> = {
  UPCOMING: 'Upcoming',
  ONGOING: 'Ongoing',
  COMPLETED: 'Completed',
};
