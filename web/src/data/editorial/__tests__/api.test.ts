import type { SupabaseClient } from '@supabase/supabase-js';

import * as api from '@/data/editorial/api';
import { EditorialError } from '@/data/editorial/errors';
import { recordTypeByType } from '@/domain/editorial/records';

const ID = '11111111-1111-4111-8111-111111111111';
const USER = '22222222-2222-4222-8222-222222222222';
const claims = recordTypeByType('CLAIM')!;
const people = recordTypeByType('PERSON')!;

const row = {
  id: ID,
  publication_status: 'DRAFT',
  version: 3,
  created_by: USER,
  reviewed_by: null,
  approved_by: null,
  created_at: '2026-10-12T00:00:00Z',
  updated_at: '2026-10-12T01:00:00Z',
  first_name: 'Juan',
  last_name: 'Halimbawa',
  middle_name: null,
  slug: 'juan-halimbawa',
  has_criminal_record: true,
};

/** A stand-in for the signed-in editor's client: records calls, returns one canned result. */
function fakeClient(result: { data?: unknown; error?: { message: string; code?: string } | null }) {
  const calls: unknown[][] = [];
  const response = { data: result.data ?? null, error: result.error ?? null };
  const builder: Record<string, unknown> = {
    then: (resolve: (value: typeof response) => unknown) => Promise.resolve(response).then(resolve),
  };
  for (const method of ['select', 'insert', 'eq', 'gte', 'or', 'order', 'limit', 'maybeSingle', 'single']) {
    builder[method] = (...args: unknown[]) => {
      calls.push([method, ...args]);
      return builder;
    };
  }
  const client = {
    from: (table: string) => {
      calls.push(['from', table]);
      return builder;
    },
    rpc: (name: string, args: unknown) => {
      calls.push(['rpc', name, args]);
      return Promise.resolve(response);
    },
  };
  return { client: client as unknown as SupabaseClient, calls };
}

describe('editorial data access', () => {
  it('maps a stored row to a record with only the fields the editor defines', async () => {
    const { client } = fakeClient({ data: row });
    const record = await api.fetchRecord(client, people, ID);
    expect(record).toMatchObject({ id: ID, status: 'DRAFT', version: 3, createdBy: USER, reviewedBy: undefined });
    expect(record?.values).toMatchObject({ first_name: 'Juan', middle_name: '', slug: 'juan-halimbawa' });
    expect(record?.values).not.toHaveProperty('has_criminal_record');
  });

  it('rejects a row with an unknown publication status instead of displaying it', async () => {
    const { client } = fakeClient({ data: { ...row, publication_status: 'LIVE' } });
    await expect(api.fetchRecord(client, people, ID)).rejects.toThrow();
  });

  it('saves through editorial_update with the expected version and reason', async () => {
    const { client, calls } = fakeClient({ data: { ...row, version: 4 } });
    await api.updateRecord(client, people, {
      id: ID,
      expectedVersion: 3,
      changes: { first_name: 'Juana' },
      reason: 'Corrected per source',
    });
    expect(calls).toEqual([
      [
        'rpc',
        'editorial_update',
        { p_table: 'people', p_id: ID, p_expected_version: 3, p_changes: { first_name: 'Juana' }, p_reason: 'Corrected per source' },
      ],
    ]);
  });

  it('moves a record through editorial_transition, never a direct status update', async () => {
    const { client, calls } = fakeClient({ data: { ...row, publication_status: 'PUBLISHED' } });
    const result = await api.transitionRecord(client, claims, { id: ID, to: 'PUBLISHED', expectedVersion: 7 });
    expect(result.status).toBe('PUBLISHED');
    expect(calls).toEqual([
      ['rpc', 'editorial_transition', { p_table: 'claims', p_id: ID, p_to: 'PUBLISHED', p_expected_version: 7, p_reason: null }],
    ]);
  });

  it('reports a stale record as stale, with a readable message', async () => {
    const { client } = fakeClient({
      error: { code: '40001', message: 'STALE_RECORD: this record was changed by someone else; reload and try again' },
    });
    const error = await api
      .updateRecord(client, people, { id: ID, expectedVersion: 1, changes: {} })
      .catch((caught: unknown) => caught);
    expect(error).toBeInstanceOf(EditorialError);
    expect(error).toMatchObject({ stale: true, message: 'this record was changed by someone else; reload and try again' });
  });

  it('passes database rule violations through as editorial errors', async () => {
    const { client } = fakeClient({ error: { message: 'An approver cannot approve a record they created' } });
    await expect(
      api.transitionRecord(client, claims, { id: ID, to: 'APPROVED', expectedVersion: 1 }),
    ).rejects.toMatchObject({ stale: false, message: 'An approver cannot approve a record they created' });
  });

  it('attaches and removes evidence only through the evidence functions', async () => {
    const { client, calls } = fakeClient({});
    await api.setEvidence(client, { claimId: ID, sourceId: USER, supports: false, note: 'Different date' });
    await api.removeEvidence(client, { claimId: ID, sourceId: USER, reason: 'Wrong source' });
    expect(calls).toEqual([
      ['rpc', 'editorial_set_evidence', { p_claim_id: ID, p_source_id: USER, p_supports: false, p_note: 'Different date', p_reason: null }],
      ['rpc', 'editorial_remove_evidence', { p_claim_id: ID, p_source_id: USER, p_reason: 'Wrong source' }],
    ]);
  });

  it('keeps contradicting evidence and the publication state of each source', async () => {
    const { client } = fakeClient({
      data: [
        {
          claim_id: ID,
          source_id: USER,
          supports: false,
          note: null,
          sources: { title: 'T', publisher: 'P', source_type: 'NEWS', url: null, publication_status: 'DRAFT' },
        },
      ],
    });
    expect(await api.fetchEvidence(client, ID)).toEqual([
      {
        claimId: ID,
        sourceId: USER,
        supports: false,
        note: undefined,
        source: { title: 'T', publisher: 'P', sourceType: 'NEWS', url: undefined, status: 'DRAFT' },
      },
    ]);
  });

  it('filters the queue in the database and maps it', async () => {
    const { client, calls } = fakeClient({
      data: [
        {
          record_type: 'CLAIM', table_name: 'claims', id: ID, label: null, person_id: null,
          publication_status: 'REVIEWED', version: 2, created_by: USER, reviewed_by: USER, approved_by: null,
          updated_at: '2026-10-12T01:00:00Z',
        },
      ],
    });
    const items = await api.fetchQueue(client, { status: 'REVIEWED', recordType: 'CLAIM', editorId: USER });
    expect(items[0]).toMatchObject({ recordType: 'CLAIM', label: ID, status: 'REVIEWED', createdBy: USER });
    expect(calls).toContainEqual(['eq', 'publication_status', 'REVIEWED']);
    expect(calls).toContainEqual(['eq', 'record_type', 'CLAIM']);
    expect(calls).toContainEqual(['eq', 'created_by', USER]);
  });

  it('reviews corrections and manages roles only through their functions', async () => {
    const correction = {
      id: ID, record_type: 'PERSON', record_id: USER, claim_id: null, description: 'The end date is wrong.',
      source_url: 'https://example.org/doc', contact_email: null, status: 'ACCEPTED', created_at: '2026-10-12T00:00:00Z',
      reviewed_at: null, reviewed_by: null, resolution_note: 'Confirmed', version: 2,
    };
    const first = fakeClient({ data: correction });
    const reviewed = await api.reviewCorrection(first.client, { id: ID, status: 'ACCEPTED', expectedVersion: 1, note: 'Confirmed' });
    expect(reviewed).toMatchObject({ status: 'ACCEPTED', sourceUrl: 'https://example.org/doc', contactEmail: undefined });
    expect(first.calls[0]).toEqual(['rpc', 'review_correction', { p_id: ID, p_status: 'ACCEPTED', p_expected_version: 1, p_note: 'Confirmed' }]);

    const second = fakeClient({});
    await api.setStaffRole(second.client, 'staff@example.org', null);
    expect(second.calls[0]).toEqual(['rpc', 'set_staff_role', { p_email: 'staff@example.org', p_role: null }]);
  });
});
