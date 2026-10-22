export const adminPaths = {
  home: '/admin',
  login: '/admin/login',
  queue: '/admin/queue',
  corrections: '/admin/corrections',
  revisions: '/admin/revisions',
  roles: '/admin/roles',
  correction: (id: string) => `/admin/corrections/${id}`,
  record: (typeSlug: string, id: string) => `/admin/records/${typeSlug}/${id}`,
  newRecord: (typeSlug: string, personId?: string) =>
    `/admin/records/${typeSlug}/new${personId ? `?person=${personId}` : ''}`,
  /** A new election office or participation with the election already chosen. */
  newForElection: (typeSlug: string, electionId: string) =>
    `/admin/records/${typeSlug}/new?election=${electionId}`,
} as const;

/** `2026-10-12T08:15:30+00:00` -> `2026-10-12 08:15 UTC`. Fixed format: no server-locale surprises. */
export function formatTimestamp(value: string): string {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : `${date.toISOString().slice(0, 16).replace('T', ' ')} UTC`;
}
