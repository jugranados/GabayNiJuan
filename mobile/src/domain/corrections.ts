import type { CorrectionSubmission } from '@/domain/models/correction';

export const CORRECTION_DESCRIPTION_MIN = 10;
export const CORRECTION_DESCRIPTION_MAX = 2000;

export const CORRECTION_NOTICE =
  'Submitting a correction does not immediately change the public record. It will be reviewed against available evidence.';

export type CorrectionFormInput = {
  description: string;
  sourceUrl: string;
  contactEmail: string;
};

export type CorrectionFormErrors = Partial<Record<keyof CorrectionFormInput, string>>;

const URL_PATTERN = /^https?:\/\/\S+$/i;
const EMAIL_PATTERN = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

/**
 * Same limits as the database function submit_correction (which is the real gate); validating
 * here only gives voters immediate, readable feedback.
 */
export function validateCorrectionForm(
  input: CorrectionFormInput,
):
  | { ok: true; value: Pick<CorrectionSubmission, 'description' | 'sourceUrl' | 'contactEmail'> }
  | { ok: false; errors: CorrectionFormErrors } {
  const description = input.description.trim();
  const sourceUrl = input.sourceUrl.trim();
  const contactEmail = input.contactEmail.trim();
  const errors: CorrectionFormErrors = {};

  if (description.length < CORRECTION_DESCRIPTION_MIN) {
    errors.description = `Please describe what appears incorrect (at least ${CORRECTION_DESCRIPTION_MIN} characters).`;
  } else if (description.length > CORRECTION_DESCRIPTION_MAX) {
    errors.description = `Please keep this under ${CORRECTION_DESCRIPTION_MAX} characters.`;
  }
  if (sourceUrl && (sourceUrl.length > 2000 || !URL_PATTERN.test(sourceUrl))) {
    errors.sourceUrl = 'Enter a link that starts with http:// or https://, or leave it empty.';
  }
  if (contactEmail && (contactEmail.length > 254 || !EMAIL_PATTERN.test(contactEmail))) {
    errors.contactEmail = 'Enter a valid email address, or leave it empty.';
  }
  if (Object.keys(errors).length > 0) return { ok: false, errors };

  return {
    ok: true,
    value: {
      description,
      ...(sourceUrl ? { sourceUrl } : {}),
      ...(contactEmail ? { contactEmail } : {}),
    },
  };
}
