/**
 * A small fixed-window limiter held in server memory. It is a brake, not a guarantee: on
 * serverless hosting each instance has its own memory, so a determined sender can exceed
 * it. The database caps in submit_correction() are the limit that always holds.
 * Keys are kept in memory only, for the length of the window, and are never logged.
 */
export function createRateLimiter(options: {
  limit: number;
  windowMs: number;
  now?: () => number;
  /** Upper bound on tracked keys, so the map cannot grow without limit. */
  maxKeys?: number;
}) {
  const { limit, windowMs, now = Date.now, maxKeys = 5000 } = options;
  const hits = new Map<string, { count: number; resetAt: number }>();

  return {
    /** Records one attempt. Returns false when the key has used up its allowance. */
    allow(key: string): boolean {
      const time = now();
      const entry = hits.get(key);
      if (!entry || entry.resetAt <= time) {
        if (hits.size >= maxKeys) {
          for (const [other, value] of hits) if (value.resetAt <= time) hits.delete(other);
          if (hits.size >= maxKeys) hits.clear();
        }
        hits.set(key, { count: 1, resetAt: time + windowMs });
        return true;
      }
      entry.count += 1;
      return entry.count <= limit;
    },
  };
}
