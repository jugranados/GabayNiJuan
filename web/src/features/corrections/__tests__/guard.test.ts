import { clientKey, inspectSubmission, MAX_FILL_MS, MIN_FILL_MS } from '@/features/corrections/guard';
import { createRateLimiter } from '@/lib/rateLimit';

const NOW = 1_800_000_000_000;

describe('report form guard', () => {
  it('accepts a form a person took a few seconds to fill', () => {
    expect(inspectSubmission({ honeypot: '', startedAt: String(NOW - MIN_FILL_MS) }, NOW)).toBe('ok');
  });

  it('flags a filled honeypot, whatever else is true', () => {
    expect(inspectSubmission({ honeypot: 'http://spam', startedAt: String(NOW - 60_000) }, NOW)).toBe('bot');
  });

  it('rejects instant, missing, forged-future and day-old submissions', () => {
    expect(inspectSubmission({ honeypot: '', startedAt: String(NOW - 500) }, NOW)).toBe('too-fast');
    expect(inspectSubmission({ honeypot: '', startedAt: '' }, NOW)).toBe('too-fast');
    expect(inspectSubmission({ honeypot: '', startedAt: 'abc' }, NOW)).toBe('too-fast');
    expect(inspectSubmission({ honeypot: '', startedAt: String(NOW + 60_000) }, NOW)).toBe('too-fast');
    expect(inspectSubmission({ honeypot: '', startedAt: String(NOW - MAX_FILL_MS - 1) }, NOW)).toBe('expired');
  });

  it('keys the limiter on the first forwarded address', () => {
    expect(clientKey('203.0.113.7, 10.0.0.1', null)).toBe('203.0.113.7');
    expect(clientKey(null, '203.0.113.9')).toBe('203.0.113.9');
    expect(clientKey(null, null)).toBe('unknown');
  });
});

describe('rate limiter', () => {
  it('allows the limit per window per key, then recovers', () => {
    let time = 0;
    const limiter = createRateLimiter({ limit: 2, windowMs: 1000, now: () => time });
    expect([limiter.allow('a'), limiter.allow('a'), limiter.allow('a')]).toEqual([true, true, false]);
    expect(limiter.allow('b')).toBe(true);
    time = 1000;
    expect(limiter.allow('a')).toBe(true);
  });

  it('never tracks more keys than its bound', () => {
    let time = 0;
    const limiter = createRateLimiter({ limit: 1, windowMs: 1000, now: () => time, maxKeys: 3 });
    for (const key of ['a', 'b', 'c', 'd', 'e']) expect(limiter.allow(key)).toBe(true);
    time = 5000;
    expect(limiter.allow('a')).toBe(true);
  });
});
