import { z } from 'zod';

/** Calendar date `YYYY-MM-DD`; rejects impossible dates such as 2027-02-30. */
export const isoDateSchema = z.iso.date();

export const isoDateTimeSchema = z.iso.datetime({ offset: true });

/** Opaque, non-empty identifier. Never a person's name. */
export const idSchema = z.string().trim().min(1);

export const nonEmptyTextSchema = z.string().trim().min(1);

/** Evidence links must be web links; other schemes (javascript:, file:) are rejected. */
export const httpUrlSchema = z.url({ protocol: /^https?$/ });

/** True when both dates are known and the end precedes the start. */
export function isReversedRange(start?: string | null, end?: string | null): boolean {
  return Boolean(start && end && end < start);
}
