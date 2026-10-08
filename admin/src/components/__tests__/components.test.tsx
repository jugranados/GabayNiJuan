import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { RevisionList } from '../RevisionList';
import { WorkflowBar } from '../WorkflowBar';

describe('WorkflowBar', () => {
  it('does not offer a reviewer approve or publish', () => {
    render(<WorkflowBar status="REVIEWED" role="REVIEWER" onTransition={vi.fn()} />);
    expect(screen.queryByRole('button', { name: 'Approve' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Publish' })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Reject' })).toBeInTheDocument();
  });
  it('offers an approver approve and publish', () => {
    const { rerender } = render(<WorkflowBar status="REVIEWED" role="APPROVER" onTransition={vi.fn()} />);
    expect(screen.getByRole('button', { name: 'Approve' })).toBeInTheDocument();
    rerender(<WorkflowBar status="APPROVED" role="APPROVER" onTransition={vi.fn()} />);
    expect(screen.getByRole('button', { name: 'Publish' })).toBeInTheDocument();
  });
  it('requires a reason before retracting', async () => {
    const onTransition = vi.fn();
    render(<WorkflowBar status="PUBLISHED" role="APPROVER" onTransition={onTransition} />);
    await userEvent.click(screen.getByRole('button', { name: 'Retract' }));
    const confirm = screen.getByRole('button', { name: /confirm: retract/i });
    expect(confirm).toBeDisabled();
    await userEvent.type(screen.getByLabelText(/reason for change/i), 'Source found invalid');
    await userEvent.click(confirm);
    expect(onTransition).toHaveBeenCalledWith('RETRACTED', 'Source found invalid');
  });
  it('moves forward without a reason when nothing is published', async () => {
    const onTransition = vi.fn();
    render(<WorkflowBar status="DRAFT" role="REVIEWER" onTransition={onTransition} />);
    await userEvent.click(screen.getByRole('button', { name: 'Mark sources attached' }));
    expect(onTransition).toHaveBeenCalledWith('SOURCE_ATTACHED');
  });
});

describe('RevisionList', () => {
  const revision = {
    id: '11111111-1111-4111-8111-111111111111',
    entity_type: 'OFFICE_TERM',
    entity_id: 'x',
    old_value: { end_date: '2025-01-01', updated_at: 'a' },
    new_value: { end_date: '2025-06-30', updated_at: 'b' },
    editor_id: 'u1',
    approver_id: 'u2',
    reason: 'Corrected end date per official source',
    created_at: '2026-10-08T00:00:00Z',
    approval_state: 'PUBLISHED' as const,
  };
  it('shows a field-level diff, names and reason', () => {
    render(<RevisionList revisions={[revision]} nameOf={(id) => (id === 'u1' ? 'editor@example.org' : 'approver@example.org')} />);
    expect(screen.getByText('end_date')).toBeInTheDocument();
    expect(screen.getByText('2025-06-30')).toBeInTheDocument();
    expect(screen.getByText(/Editor: editor@example.org/)).toBeInTheDocument();
    expect(screen.getByText(/Corrected end date per official source/)).toBeInTheDocument();
    expect(screen.queryByText(/raw data/i)).not.toBeInTheDocument();
  });
  it('offers raw data only when allowed', () => {
    render(<RevisionList revisions={[revision]} nameOf={String} allowRaw />);
    expect(screen.getByRole('button', { name: /show raw data/i })).toBeInTheDocument();
  });
});
