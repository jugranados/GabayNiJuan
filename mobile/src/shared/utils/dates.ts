const MONTHS = [
  'Jan',
  'Feb',
  'Mar',
  'Apr',
  'May',
  'Jun',
  'Jul',
  'Aug',
  'Sep',
  'Oct',
  'Nov',
  'Dec',
] as const;

/** Formats an ISO calendar date (YYYY-MM-DD) as "15 Aug 2026" without timezone shifts. */
export function formatIsoDate(date: string): string {
  const [year, month, day] = date.split('-');
  const monthName = MONTHS[Number(month) - 1];
  if (!year || !monthName || !day) {
    return date;
  }
  return `${Number(day)} ${monthName} ${year}`;
}

/** "15 Aug 2026 – 3 Sep 2026", "From 15 Aug 2026", "Until …", or undefined when both ends are unknown. */
export function formatDateRange(start?: string, end?: string): string | undefined {
  if (start && end) return `${formatIsoDate(start)} – ${formatIsoDate(end)}`;
  if (start) return `From ${formatIsoDate(start)}`;
  if (end) return `Until ${formatIsoDate(end)}`;
  return undefined;
}

/**
 * "2019 – 2022", "From 2019", "Until 2022", or "2019" for a single year.
 * Returns undefined when neither end is known. Never says "present": a
 * missing end date means "none recorded", not "still ongoing".
 */
export function formatYearRange(start?: string, end?: string): string | undefined {
  const startYear = start?.slice(0, 4);
  const endYear = end?.slice(0, 4);
  if (startYear && endYear) return startYear === endYear ? startYear : `${startYear} – ${endYear}`;
  if (startYear) return `From ${startYear}`;
  if (endYear) return `Until ${endYear}`;
  return undefined;
}
