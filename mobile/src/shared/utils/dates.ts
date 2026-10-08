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

/** "15 Aug 2026 – present", "from 15 Aug 2026", "until …", or undefined when both ends are unknown. */
export function formatDateRange(start?: string, end?: string): string | undefined {
  if (start && end) return `${formatIsoDate(start)} – ${formatIsoDate(end)}`;
  if (start) return `From ${formatIsoDate(start)}`;
  if (end) return `Until ${formatIsoDate(end)}`;
  return undefined;
}
