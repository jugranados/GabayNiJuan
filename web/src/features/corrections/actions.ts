'use server';

import { headers } from 'next/headers';

import { validateCorrectionForm, type CorrectionFormErrors } from '@/domain/corrections';
import {
  clientKey,
  HONEYPOT_FIELD,
  inspectSubmission,
  REPORT_WINDOW_MS,
  REPORTS_PER_WINDOW,
  STARTED_AT_FIELD,
} from '@/features/corrections/guard';
import { resolveCorrectionTarget } from '@/features/corrections/target';
import { createRateLimiter } from '@/lib/rateLimit';
import { correctionsAvailable, getRepositories } from '@/server/repositories';

export type CorrectionFormState =
  | { status: 'idle' }
  | { status: 'invalid'; errors: CorrectionFormErrors }
  | { status: 'failed' }
  | { status: 'slow-down' }
  | { status: 'sent' };

const limiter = createRateLimiter({ limit: REPORTS_PER_WINDOW, windowMs: REPORT_WINDOW_MS });

const text = (data: FormData, key: string): string => {
  const value = data.get(key);
  return typeof value === 'string' ? value : '';
};

/**
 * The only write a visitor can make. It sends a request for editorial review
 * through the anonymous `submit_correction` database function (validated,
 * abuse-capped, stored where the public cannot read it). It never changes a
 * published record, and no privileged key is involved.
 *
 * Abuse protection, in order: a honeypot field, a minimum fill time, a per-address
 * cooldown, server-side validation, then the database's own validation and caps.
 */
export async function submitCorrection(
  _previous: CorrectionFormState,
  data: FormData,
): Promise<CorrectionFormState> {
  if (!correctionsAvailable()) return { status: 'failed' };

  const verdict = inspectSubmission(
    { honeypot: text(data, HONEYPOT_FIELD), startedAt: text(data, STARTED_AT_FIELD) },
    Date.now(),
  );
  // An automated sender is told it worked, so it has no reason to adapt. Nothing is stored.
  if (verdict === 'bot') return { status: 'sent' };
  if (verdict !== 'ok') return { status: 'failed' };

  const result = validateCorrectionForm({
    description: text(data, 'description'),
    sourceUrl: text(data, 'sourceUrl'),
    contactEmail: text(data, 'contactEmail'),
  });
  if (!result.ok) return { status: 'invalid', errors: result.errors };

  const requestHeaders = await headers();
  const key = clientKey(requestHeaders.get('x-forwarded-for'), requestHeaders.get('x-real-ip'));
  if (!limiter.allow(key)) return { status: 'slow-down' };

  try {
    // Re-resolved on the server: the target must be a published record, whatever the form says.
    const target = await resolveCorrectionTarget(text(data, 'type'), text(data, 'id'));
    if (!target) return { status: 'failed' };
    await getRepositories().corrections.submit({
      recordType: target.recordType,
      recordId: target.recordId,
      claimId: target.claimId,
      ...result.value,
    });
    return { status: 'sent' };
  } catch (error) {
    console.error('Correction submission failed', error);
    return { status: 'failed' };
  }
}
