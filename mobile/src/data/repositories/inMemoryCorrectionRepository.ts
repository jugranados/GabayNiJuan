import { validateCorrectionForm } from '@/domain/corrections';
import type { CorrectionSubmission } from '@/domain/models/correction';
import type { CorrectionRepository } from '@/domain/repositories';

/** Development/test double: validates like the real endpoint and keeps submissions in memory only. */
export function createInMemoryCorrectionRepository(): CorrectionRepository & {
  readonly submissions: readonly CorrectionSubmission[];
} {
  const submissions: CorrectionSubmission[] = [];
  return {
    submissions,
    submit(submission) {
      const result = validateCorrectionForm({
        description: submission.description,
        sourceUrl: submission.sourceUrl ?? '',
        contactEmail: submission.contactEmail ?? '',
      });
      if (!result.ok) return Promise.reject(new Error('Please check the details and try again'));
      submissions.push(submission);
      return Promise.resolve();
    },
  };
}
