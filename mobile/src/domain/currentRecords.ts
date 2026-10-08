/**
 * What may be called "current". Derived only from dated records and their
 * evidence; never guessed. If a record cannot be shown to be current, it is
 * simply not described as current.
 */
import type { VerificationStatus } from '@/domain/enums';
import type { IsoDate } from '@/domain/models';

/**
 * Statuses with at least some supporting evidence that still stands. A record
 * attested only by UNVERIFIED, DISPUTED or OUTDATED claims is never promoted
 * to a headline "current" fact (it still appears, with its badge, in its section).
 */
export const HEADLINE_ELIGIBLE_STATUSES: readonly VerificationStatus[] = [
  'PRIMARY_SOURCE',
  'CORROBORATED',
  'SELF_DECLARED',
  'REPORTED',
];

export function isHeadlineEligible(statuses: readonly VerificationStatus[]): boolean {
  return statuses.some((status) => HEADLINE_ELIGIBLE_STATUSES.includes(status));
}

/** Today as `YYYY-MM-DD` in UTC (the database uses UTC too). */
export function toIsoDate(date: Date): IsoDate {
  return date.toISOString().slice(0, 10);
}

/**
 * A record is current on `today` only when its start date is known and not in
 * the future, and its end date is absent or not in the past. A missing start
 * date means "cannot tell", not "current".
 */
export function isCurrentOn(
  today: IsoDate,
  startDate: IsoDate | undefined,
  endDate: IsoDate | undefined,
): boolean {
  if (!startDate || startDate > today) return false;
  return endDate === undefined || endDate >= today;
}
