import { fireEvent, render, screen } from '@testing-library/react-native';

import { PersonPhoto } from '@/components/PersonPhoto';
import { ErrorState, MISSING_RECORDS_MESSAGE, MissingRecords } from '@/components/states';
import { Timeline } from '@/components/Timeline';
import { DataValidationError } from '@/domain/validation/errors';

describe('PersonPhoto', () => {
  it('shows an accessible initials placeholder when there is no photo', async () => {
    await render(<PersonPhoto name="Juan Dela Cruz" />);
    expect(screen.getByLabelText('No photo available for Juan Dela Cruz')).toBeOnTheScreen();
    expect(screen.getByText('JC')).toBeOnTheScreen();
    expect(screen.queryByTestId('person-photo-image')).toBeNull();
  });

  it('describes the photo when there is one, and falls back if it fails to load', async () => {
    await render(<PersonPhoto name="Juan Dela Cruz" uri="https://example.org/p.jpg" />);
    expect(screen.getByLabelText('Photo of Juan Dela Cruz')).toBeOnTheScreen();

    await fireEvent(screen.getByTestId('person-photo-image'), 'error');
    expect(screen.getByLabelText('No photo available for Juan Dela Cruz')).toBeOnTheScreen();
    expect(screen.queryByTestId('person-photo-image')).toBeNull();
  });
});

describe('MissingRecords', () => {
  it('uses one neutral sentence and never asserts absence in the real world', async () => {
    await render(<MissingRecords />);
    expect(screen.getByText(MISSING_RECORDS_MESSAGE)).toBeOnTheScreen();
    expect(MISSING_RECORDS_MESSAGE).toBe('No records have been added for this section yet.');
    expect(MISSING_RECORDS_MESSAGE).not.toMatch(
      /no (cases|issues|controversies|corruption|education|experience)/i,
    );
  });
});

describe('ErrorState', () => {
  it('speaks plainly about being offline and offers a retry', async () => {
    const onRetry = jest.fn();
    await render(<ErrorState error={new TypeError('Network request failed')} onRetry={onRetry} />);
    expect(screen.getByText('You seem to be offline')).toBeOnTheScreen();
    await fireEvent.press(screen.getByRole('button', { name: 'Try again' }));
    expect(onRetry).toHaveBeenCalled();
  });

  it('says records failed checks for validation errors', async () => {
    await render(<ErrorState error={new DataValidationError('claim', [], 'c1')} />);
    expect(screen.getByText('Some records could not be shown')).toBeOnTheScreen();
  });
});

describe('Timeline', () => {
  it('renders entries in the order given, with a clear fallback for missing dates', async () => {
    await render(
      <Timeline
        entries={[
          { key: 'a', period: 'From 2022', title: 'Governor', note: 'No end date recorded' },
          { key: 'b', title: 'Councilor' },
        ]}
      />,
    );
    expect(screen.getByText('From 2022')).toBeOnTheScreen();
    expect(screen.getByText('No end date recorded')).toBeOnTheScreen();
    expect(screen.getByText('Dates not recorded')).toBeOnTheScreen();
    const titles = screen.getAllByText(/Governor|Councilor/).map((node) => node.props.children);
    expect(titles).toEqual(['Governor', 'Councilor']);
  });
});
