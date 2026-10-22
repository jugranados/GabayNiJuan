import type { IsoDate } from '@/domain/models';

export type TimelineSortable = {
  key: string;
  startDate?: IsoDate;
  endDate?: IsoDate;
};

/**
 * Most recent first: later start dates before earlier ones; records with no
 * known start date last; ties by later end date (no end date recorded counts
 * as latest), then by key so the order is always deterministic.
 */
export function compareMostRecentFirst(a: TimelineSortable, b: TimelineSortable): number {
  if (a.startDate && !b.startDate) return -1;
  if (!a.startDate && b.startDate) return 1;
  if (a.startDate && b.startDate && a.startDate !== b.startDate) {
    return a.startDate < b.startDate ? 1 : -1;
  }
  const endA = a.endDate ?? '9999-12-31';
  const endB = b.endDate ?? '9999-12-31';
  if (endA !== endB) return endA < endB ? 1 : -1;
  return a.key < b.key ? -1 : a.key > b.key ? 1 : 0;
}
