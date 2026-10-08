import { fireEvent, screen, waitFor } from '@testing-library/react-native';

import { createInMemoryCorrectionRepository } from '@/data/repositories/inMemoryCorrectionRepository';
import { createMockRepositories } from '@/data/repositories/mockRepositories';
import { createRepositories } from '@/data/repositories/tableRepositories';
import { createInMemoryRowSource } from '@/data/repositories/inMemoryRowSource';
import { createInMemoryDirectorySource } from '@/data/repositories/inMemoryDirectorySource';
import { devFixtureTables } from '@/data/fixtures/devFixtures';
import { CORRECTION_NOTICE, validateCorrectionForm } from '@/domain/corrections';
import { renderWithProviders } from '@/shared/testing/renderWithProviders';

import { ReportErrorView } from '../components/ReportErrorView';

const PERSON_ID = '11111111-1111-4111-8111-111111111111';

function setup() {
  const corrections = createInMemoryCorrectionRepository();
  const repositories = createRepositories(
    createInMemoryRowSource(devFixtureTables),
    createInMemoryDirectorySource(devFixtureTables),
    corrections,
  );
  return { corrections, repositories };
}

describe('validateCorrectionForm', () => {
  it('requires a meaningful description', () => {
    const result = validateCorrectionForm({
      description: 'short',
      sourceUrl: '',
      contactEmail: '',
    });
    expect(result.ok).toBe(false);
  });
  it('accepts a description alone and trims optional fields', () => {
    const result = validateCorrectionForm({
      description: '  The end date looks wrong.  ',
      sourceUrl: '',
      contactEmail: ' ',
    });
    expect(result).toEqual({ ok: true, value: { description: 'The end date looks wrong.' } });
  });
  it('rejects non-http links and malformed emails', () => {
    const result = validateCorrectionForm({
      description: 'The end date looks wrong.',
      sourceUrl: 'javascript:alert(1)',
      contactEmail: 'nope',
    });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(Object.keys(result.errors).sort()).toEqual(['contactEmail', 'sourceUrl']);
    }
  });
});

describe('ReportErrorView', () => {
  it('explains that a report does not change the record', async () => {
    await renderWithProviders(<ReportErrorView recordType="PERSON" recordId={PERSON_ID} />);
    expect(screen.getByText(CORRECTION_NOTICE)).toBeTruthy();
  });

  it('shows validation errors and does not submit an empty report', async () => {
    const { corrections, repositories } = setup();
    await renderWithProviders(
      <ReportErrorView recordType="PERSON" recordId={PERSON_ID} />,
      repositories,
    );
    await fireEvent.press(screen.getByRole('button', { name: 'Send report' }));
    expect(screen.getByText(/at least 10 characters/)).toBeTruthy();
    expect(corrections.submissions).toHaveLength(0);
  });

  it('submits only what the voter entered, then confirms', async () => {
    const { corrections, repositories } = setup();
    await renderWithProviders(
      <ReportErrorView recordType="CLAIM" recordId={PERSON_ID} claimId={PERSON_ID} />,
      repositories,
    );
    await fireEvent.changeText(
      screen.getByLabelText('What appears incorrect?'),
      'The end date does not match the cited document.',
    );
    await fireEvent.changeText(
      screen.getByLabelText('Source URL (optional but encouraged)'),
      'https://example.org/doc',
    );
    await fireEvent.press(screen.getByRole('button', { name: 'Send report' }));
    await waitFor(() => expect(screen.getByText('Thank you')).toBeTruthy());
    expect(corrections.submissions).toEqual([
      {
        recordType: 'CLAIM',
        recordId: PERSON_ID,
        claimId: PERSON_ID,
        description: 'The end date does not match the cited document.',
        sourceUrl: 'https://example.org/doc',
      },
    ]);
  });

  it('shows a retryable error when sending fails', async () => {
    const repositories = createMockRepositories();
    const failing = {
      ...repositories,
      corrections: { submit: () => Promise.reject(new Error('offline')) },
    };
    await renderWithProviders(
      <ReportErrorView recordType="PERSON" recordId={PERSON_ID} />,
      failing,
    );
    await fireEvent.changeText(
      screen.getByLabelText('What appears incorrect?'),
      'The birth date looks wrong to me.',
    );
    await fireEvent.press(screen.getByRole('button', { name: 'Send report' }));
    await waitFor(() => expect(screen.getByText(/could not be sent/)).toBeTruthy());
    expect(screen.getByRole('button', { name: 'Send report' })).toBeTruthy();
  });
});
