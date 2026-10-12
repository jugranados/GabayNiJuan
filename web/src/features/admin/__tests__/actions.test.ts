const revalidatePath = vi.fn();
vi.mock('next/cache', () => ({ revalidatePath: (...args: unknown[]) => revalidatePath(...args) }));
vi.mock('next/navigation', () => ({
  redirect: (url: string) => {
    throw new Error(`REDIRECT:${url}`);
  },
}));

const { EditorialError, EditorialAccessError } = vi.hoisted(() => ({
  EditorialError: class extends Error {
    constructor(message: string, readonly stale = false) {
      super(message);
    }
  },
  EditorialAccessError: class extends Error {},
}));

const editorial = {
  role: 'APPROVER',
  createRecord: vi.fn(),
  updateRecord: vi.fn(),
  transitionRecord: vi.fn(),
  setEvidence: vi.fn(),
  removeEvidence: vi.fn(),
  reviewCorrection: vi.fn(),
  setStaffRole: vi.fn(),
  queue: vi.fn(),
};
const getEditorial = vi.fn();
vi.mock('@/server/editorial', () => ({
  EditorialError,
  EditorialAccessError,
  getEditorial: (...args: unknown[]) => getEditorial(...args),
  signInEditor: vi.fn(),
  signOutEditor: vi.fn(),
}));

import {
  createRecordAction,
  loadRefOptions,
  removeEvidenceAction,
  reviewCorrectionAction,
  saveRecordAction,
  setEvidenceAction,
  setStaffRoleAction,
  transitionAction,
} from '@/features/admin/actions';

const ID = '11111111-1111-4111-8111-111111111111';
const SOURCE = '22222222-2222-4222-8222-222222222222';
const form = (entries: Record<string, string>) => {
  const data = new FormData();
  for (const [key, value] of Object.entries(entries)) data.set(key, value);
  return data;
};
const publicPurges = () => revalidatePath.mock.calls.filter(([path, kind]) => path === '/' && kind === 'layout');

beforeEach(() => {
  vi.clearAllMocks();
  getEditorial.mockResolvedValue(editorial);
});

describe('transitions', () => {
  const move = (to: string, from: string, reason = '') =>
    transitionAction('claims', ID, {}, form({ to, from, version: '4', reason }));

  it.each([
    ['APPROVED', 'PUBLISHED'],
    ['PUBLISHED', 'RETRACTED'],
  ])('revalidates the public site when a record goes %s -> %s', async (from, to) => {
    editorial.transitionRecord.mockResolvedValue({});
    expect(await move(to, from, 'Source found invalid')).toEqual({ ok: true });
    expect(editorial.transitionRecord).toHaveBeenCalledWith(
      expect.objectContaining({ recordType: 'CLAIM' }),
      { id: ID, to, expectedVersion: 4, reason: 'Source found invalid' },
    );
    expect(publicPurges()).toHaveLength(1);
  });

  it('does not touch public pages for unpublished steps', async () => {
    editorial.transitionRecord.mockResolvedValue({});
    await move('REVIEWED', 'SOURCE_ATTACHED');
    await move('APPROVED', 'REVIEWED');
    expect(publicPurges()).toHaveLength(0);
  });

  it('refuses to retract without a reason, before calling the database', async () => {
    expect(await move('RETRACTED', 'PUBLISHED')).toEqual({ error: 'A reason is required for this change.' });
    expect(editorial.transitionRecord).not.toHaveBeenCalled();
  });

  it('shows the database refusal (two-person rule, state machine) and purges nothing', async () => {
    editorial.transitionRecord.mockRejectedValue(new EditorialError('An approver cannot approve a record they created'));
    expect(await move('APPROVED', 'REVIEWED')).toEqual({
      error: 'An approver cannot approve a record they created',
      stale: false,
    });
    expect(publicPurges()).toHaveLength(0);
  });

  it('rejects an unknown target state', async () => {
    expect((await move('LIVE', 'DRAFT')).error).toBeDefined();
    expect(editorial.transitionRecord).not.toHaveBeenCalled();
  });
});

describe('every action requires an editorial session', () => {
  it('does nothing and asks to sign in again when the session is gone', async () => {
    getEditorial.mockRejectedValue(new EditorialAccessError('Editorial access required'));
    const results = await Promise.all([
      transitionAction('claims', ID, {}, form({ to: 'REVIEWED', from: 'SOURCE_ATTACHED', version: '1' })),
      setEvidenceAction(ID, {}, form({ sourceId: SOURCE, supports: 'yes' })),
      reviewCorrectionAction(ID, {}, form({ to: 'UNDER_REVIEW', version: '1' })),
      setStaffRoleAction({}, form({ email: 'staff@example.org', role: 'ADMIN' })),
    ]);
    for (const result of results) expect(result.error).toMatch(/sign in again/i);
    expect(editorial.transitionRecord).not.toHaveBeenCalled();
    expect(editorial.setStaffRole).not.toHaveBeenCalled();
    await expect(loadRefOptions('PERSON')).rejects.toBeInstanceOf(EditorialAccessError);
  });

  it('asks for the ADMIN role before changing roles', async () => {
    await setStaffRoleAction({}, form({ email: 'staff@example.org', role: '' }));
    expect(getEditorial).toHaveBeenCalledWith('ADMIN');
    expect(editorial.setStaffRole).toHaveBeenCalledWith('staff@example.org', null);
  });
});

describe('records', () => {
  const person = { first_name: 'Juan', last_name: 'Halimbawa' };

  it('validates on the server and keeps what was typed', async () => {
    const result = await createRecordAction('people', {}, form({ first_name: 'Juan' }));
    expect(result.fieldErrors).toMatchObject({ last_name: 'Last name is required' });
    expect(result.values).toMatchObject({ first_name: 'Juan' });
    expect(editorial.createRecord).not.toHaveBeenCalled();
  });

  it('rejects a judgment as a claim statement', async () => {
    const result = await createRecordAction(
      'claims',
      {},
      form({ claim_type: 'OFFICE_TERM', statement: 'Juan Halimbawa is a corrupt mayor.', verification_status: 'REPORTED' }),
    );
    expect(result.fieldErrors?.statement).toMatch(/judgment/);
  });

  it('creates a draft with empty optional fields as null and opens it', async () => {
    editorial.createRecord.mockResolvedValue({ id: ID });
    await expect(createRecordAction('people', {}, form(person))).rejects.toThrow(`REDIRECT:/admin/records/people/${ID}`);
    expect(editorial.createRecord).toHaveBeenCalledWith(
      expect.objectContaining({ recordType: 'PERSON' }),
      expect.objectContaining({ first_name: 'Juan', middle_name: null, slug: null }),
    );
  });

  it('saves with the expected version, and revalidates the public site only for a published record', async () => {
    editorial.updateRecord.mockResolvedValueOnce({ status: 'DRAFT' }).mockResolvedValueOnce({ status: 'PUBLISHED' });
    await saveRecordAction('people', ID, {}, form({ ...person, version: '2' }));
    expect(publicPurges()).toHaveLength(0);
    await saveRecordAction('people', ID, {}, form({ ...person, version: '3', reason: 'Corrected spelling per source' }));
    expect(editorial.updateRecord).toHaveBeenLastCalledWith(
      expect.anything(),
      expect.objectContaining({ id: ID, expectedVersion: 3, reason: 'Corrected spelling per source' }),
    );
    expect(publicPurges()).toHaveLength(1);
  });

  it('reports a concurrent change as stale so the form can offer a reload', async () => {
    editorial.updateRecord.mockRejectedValue(new EditorialError('changed by someone else', true));
    expect(await saveRecordAction('people', ID, {}, form({ ...person, version: '2' }))).toMatchObject({
      stale: true,
      values: expect.objectContaining({ first_name: 'Juan' }),
    });
  });
});

describe('evidence and corrections', () => {
  it('records whether a source supports or contradicts the claim', async () => {
    await setEvidenceAction(ID, {}, form({ sourceId: SOURCE, supports: 'no', note: 'States a different date' }));
    expect(editorial.setEvidence).toHaveBeenCalledWith({
      claimId: ID, sourceId: SOURCE, supports: false, note: 'States a different date', reason: undefined,
    });
    expect(publicPurges()).toHaveLength(0);
  });

  it('revalidates the public site when evidence of a published claim changes', async () => {
    await removeEvidenceAction(ID, {}, form({ sourceId: SOURCE, reason: 'Source withdrawn by publisher' }));
    expect(publicPurges()).toHaveLength(1);
  });

  it('requires a note to accept, reject or resolve a correction, but not to start review', async () => {
    expect((await reviewCorrectionAction(ID, {}, form({ to: 'ACCEPTED', version: '1' }))).error).toMatch(/note is required/);
    expect(editorial.reviewCorrection).not.toHaveBeenCalled();
    expect(await reviewCorrectionAction(ID, {}, form({ to: 'UNDER_REVIEW', version: '1' }))).toEqual({ ok: true });
    expect(editorial.reviewCorrection).toHaveBeenCalledWith({ id: ID, status: 'UNDER_REVIEW', expectedVersion: 1, note: undefined });
    // Reviewing a request never changes public data, so nothing public is revalidated.
    expect(publicPurges()).toHaveLength(0);
  });
});
