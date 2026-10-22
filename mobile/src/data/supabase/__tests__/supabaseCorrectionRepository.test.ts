import type { SupabaseClient } from '@supabase/supabase-js';

import { createSupabaseCorrectionRepository } from '@/data/supabase/supabaseCorrectionRepository';

function clientReturning(error: { message: string } | null) {
  const rpc = jest.fn().mockResolvedValue({ data: null, error });
  return { client: { rpc } as unknown as SupabaseClient, rpc };
}

const submission = {
  recordType: 'CLAIM' as const,
  recordId: '11111111-1111-4111-8111-111111111111',
  claimId: '11111111-1111-4111-8111-111111111111',
  description: 'The end date does not match the cited document.',
};

describe('createSupabaseCorrectionRepository', () => {
  it('calls only the narrow submit_correction function with explicit arguments', async () => {
    const { client, rpc } = clientReturning(null);
    await createSupabaseCorrectionRepository(client).submit(submission);
    expect(rpc).toHaveBeenCalledTimes(1);
    expect(rpc).toHaveBeenCalledWith('submit_correction', {
      p_record_type: 'CLAIM',
      p_record_id: submission.recordId,
      p_description: submission.description,
      p_source_url: null,
      p_contact_email: null,
      p_claim_id: submission.claimId,
    });
  });

  it('rejects when the backend refuses the report', async () => {
    const { client } = clientReturning({ message: 'Please check the details and try again' });
    await expect(createSupabaseCorrectionRepository(client).submit(submission)).rejects.toThrow(
      /Failed to submit the correction/,
    );
  });
});
