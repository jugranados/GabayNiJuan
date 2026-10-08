import type { SupabaseClient } from '@supabase/supabase-js';

import { BackendRequestError } from '@/data/supabase/supabaseRowSource';
import type { CorrectionRepository } from '@/domain/repositories';

/** Arguments of the `submit_correction` database function. */
export type SubmitCorrectionArgs = {
  p_record_type: string;
  p_record_id: string;
  p_description: string;
  p_source_url: string | null;
  p_contact_email: string | null;
  p_claim_id: string | null;
};

/**
 * The only write the public app can make: one narrowly scoped RPC. The function validates
 * its input, requires the target to be a PUBLISHED record, applies abuse limits, and inserts
 * into a table anonymous users cannot read. No service-role key is involved.
 */
export function createSupabaseCorrectionRepository(client: SupabaseClient): CorrectionRepository {
  return {
    async submit(submission) {
      const args: SubmitCorrectionArgs = {
        p_record_type: submission.recordType,
        p_record_id: submission.recordId,
        p_description: submission.description,
        p_source_url: submission.sourceUrl ?? null,
        p_contact_email: submission.contactEmail ?? null,
        p_claim_id: submission.claimId ?? null,
      };
      const { error } = await client.rpc('submit_correction', args);
      if (error) {
        throw new BackendRequestError(`Failed to submit the correction: ${error.message}`);
      }
    },
  };
}
