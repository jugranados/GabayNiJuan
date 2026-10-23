import { act, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh: vi.fn() }) }));
vi.mock('@/features/admin/actions', () => ({ loadRefOptions: vi.fn(async () => []) }));

import type { RevisionEntry } from '@/domain/editorial/models';
import { recordTypeBySlug } from '@/domain/editorial/records';
import type { ActionState } from '@/features/admin/actionState';
import { RecordForm } from '@/features/admin/components/RecordForm';
import { RevisionList, staffLabeler } from '@/features/admin/components/RevisionList';
import { WorkflowBar } from '@/features/admin/components/WorkflowBar';

const action = async () => ({});

describe('WorkflowBar', () => {
  it('does not offer a reviewer approve or publish', () => {
    render(<WorkflowBar status="REVIEWED" role="REVIEWER" version={1} action={action} />);
    expect(screen.queryByRole('button', { name: 'Approve' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Publish' })).toBeNull();
    expect(screen.getByRole('button', { name: 'Return to draft' })).toBeInTheDocument();
  });

  it('offers an approver approve, then publish', () => {
    const { unmount } = render(<WorkflowBar status="REVIEWED" role="APPROVER" version={1} action={action} />);
    expect(screen.getByRole('button', { name: 'Approve' })).toBeInTheDocument();
    unmount();
    render(<WorkflowBar status="APPROVED" role="APPROVER" version={1} action={action} />);
    expect(screen.getByRole('button', { name: 'Publish' })).toBeInTheDocument();
  });

  it('requires a reason before retracting and sends the version it was shown', () => {
    const { container } = render(<WorkflowBar status="PUBLISHED" role="APPROVER" version={9} action={action} />);
    expect(screen.getByLabelText('Reason for change (required)')).toBeRequired();
    expect(screen.getByRole('button', { name: 'Confirm: Retract', hidden: true })).toBeInTheDocument();
    expect(container.querySelector('input[name="version"]')).toHaveValue('9');
    expect(container.querySelector('input[name="to"]')).toHaveValue('RETRACTED');
  });

  it('offers nothing to a reviewer on a published record, and nothing once retracted', () => {
    const { unmount } = render(<WorkflowBar status="PUBLISHED" role="REVIEWER" version={1} action={action} />);
    expect(screen.queryAllByRole('button', { hidden: true })).toHaveLength(0);
    unmount();
    render(<WorkflowBar status="RETRACTED" role="ADMIN" version={1} action={action} />);
    expect(screen.queryAllByRole('button', { hidden: true })).toHaveLength(0);
    expect(screen.getByText(/this is final/)).toBeInTheDocument();
  });
});

describe('RecordForm', () => {
  const def = recordTypeBySlug('sources')!;
  const source = (title: string) => ({
    title,
    publisher: 'Fictional Records Office (fictional)',
    source_type: 'NEWS',
    url: 'https://example.org/fictional',
    retrieved_at: '2026-10-20',
  });
  const props = { def, refOptions: {}, submitLabel: 'Save draft' };

  it('keeps "Saved." after the saved version reloads the form, and drops it when the record moves on', async () => {
    let finish: (state: ActionState) => void = () => {};
    const save = vi.fn(() => new Promise<ActionState>((resolve) => (finish = resolve)));
    const { rerender } = render(<RecordForm {...props} action={save} initial={source('Old title (fictional)')} version={1} />);
    const status = screen.getByRole('status');
    expect(status).toHaveTextContent('');

    await userEvent.click(screen.getByRole('button', { name: 'Save draft' }));
    expect(save).toHaveBeenCalledTimes(1);
    // The action returns, and the page re-renders the form with the new version and stored values.
    await act(async () => finish({ ok: true, version: 2 }));
    rerender(<RecordForm {...props} action={save} initial={source('New title (fictional)')} version={2} />);
    expect(screen.getByRole('status')).toBe(status);
    expect(status).toHaveTextContent('Saved.');
    expect(screen.getByLabelText(/^Title/)).toHaveValue('New title (fictional)');

    // A workflow step bumps the version: the confirmation belonged to version 2.
    rerender(<RecordForm {...props} action={save} initial={source('New title (fictional)')} version={3} />);
    expect(status).toHaveTextContent('');
  });

  it('keeps what was typed and the error while the refused version is on screen', async () => {
    const refuse = vi.fn(async () => ({ error: 'This record is locked.', values: source('Typed title (fictional)'), version: 4 }));
    const { rerender } = render(<RecordForm {...props} action={refuse} initial={source('Stored title (fictional)')} version={4} />);
    await userEvent.click(screen.getByRole('button', { name: 'Save draft' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('This record is locked.');
    expect(screen.getByLabelText(/^Title/)).toHaveValue('Typed title (fictional)');
    rerender(<RecordForm {...props} action={refuse} initial={source('Stored title (fictional)')} version={5} />);
    expect(screen.queryByRole('alert')).toBeNull();
    expect(screen.getByLabelText(/^Title/)).toHaveValue('Stored title (fictional)');
  });
});

describe('RevisionList', () => {
  const revision: RevisionEntry = {
    id: 'r-1',
    entityType: 'OFFICE_TERM',
    entityId: 'x',
    oldValue: { end_date: null, status: 'HELD', updated_at: 'a', version: 1 },
    newValue: { end_date: '2025-06-30', status: 'HELD', updated_at: 'b', version: 2 },
    editorId: 'u-1',
    approverId: undefined,
    reason: 'Corrected office end date based on official source',
    createdAt: '2026-10-12T08:15:30+00:00',
    approvalState: 'PUBLISHED',
  };
  const nameOf = staffLabeler([{ userId: 'u-1', email: 'editor@example.org' }]);

  it('shows a field-level diff, who, when and why', () => {
    const { container } = render(<RevisionList revisions={[revision]} nameOf={nameOf} />);
    expect(screen.getByRole('rowheader', { name: 'end_date' })).toBeInTheDocument();
    expect(screen.queryByRole('rowheader', { name: 'version' })).toBeNull();
    expect(container).toHaveTextContent('2026-10-12 08:15 UTC');
    expect(container).toHaveTextContent('Editor: editor@example.org');
    expect(container).toHaveTextContent('Reason: Corrected office end date based on official source');
  });

  it('offers raw data only when allowed', () => {
    const { rerender } = render(<RevisionList revisions={[revision]} nameOf={nameOf} />);
    expect(screen.queryByText('Show raw data')).toBeNull();
    rerender(<RevisionList revisions={[revision]} nameOf={nameOf} allowRaw />);
    expect(screen.getByText('Show raw data')).toBeInTheDocument();
  });

  it('labels system writes and unknown users without inventing a name', () => {
    expect(nameOf('system:postgres')).toBe('system:postgres');
    expect(nameOf('abcdef12-0000-0000-0000-000000000000')).toBe('abcdef12…');
    expect(nameOf(undefined)).toBe('—');
  });
});
