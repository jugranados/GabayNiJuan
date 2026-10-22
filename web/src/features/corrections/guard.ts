/**
 * Abuse checks for the public report form that need no account, no CAPTCHA and no
 * tracking. They run before the request reaches the database, which has its own caps.
 */
export const HONEYPOT_FIELD = 'website';
export const STARTED_AT_FIELD = 'startedAt';

/** A person needs a few seconds to describe a problem; a script does not. */
export const MIN_FILL_MS = 3_000;
/** A form left open longer than this is re-opened rather than trusted. */
export const MAX_FILL_MS = 24 * 60 * 60 * 1000;

export const REPORTS_PER_WINDOW = 5;
export const REPORT_WINDOW_MS = 10 * 60 * 1000;

export type GuardVerdict = 'ok' | 'bot' | 'too-fast' | 'expired';

export function inspectSubmission(
  input: { honeypot: string; startedAt: string },
  now: number,
): GuardVerdict {
  // The field is invisible to people; only automated senders fill it.
  if (input.honeypot.trim() !== '') return 'bot';
  const started = Number(input.startedAt);
  if (!Number.isFinite(started) || started <= 0) return 'too-fast';
  const elapsed = now - started;
  if (elapsed < MIN_FILL_MS) return 'too-fast';
  if (elapsed > MAX_FILL_MS) return 'expired';
  return 'ok';
}

/** First address in X-Forwarded-For (set by the hosting proxy), used only as a limiter key. */
export function clientKey(forwardedFor: string | null, realIp: string | null): string {
  return forwardedFor?.split(',')[0]?.trim() || realIp?.trim() || 'unknown';
}
