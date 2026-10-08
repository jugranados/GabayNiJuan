import { fireEvent, render, screen } from '@testing-library/react-native';

import type { DirectoryEntry } from '@/domain/models/directory';
import {
  PoliticianCard,
  describeAffiliation,
} from '@/features/politicians/components/PoliticianCard';

const entry: DirectoryEntry = {
  id: 'p1',
  displayName: 'Maria Luntian Makabayan',
  participations: [
    {
      officeName: 'Mayor, City of Halimbawa (fictional)',
      electionName: 'Halimbawa City Local Election 2027 (fictional)',
      electionDate: '2027-05-10',
      status: 'FILED_COC',
      effectiveFrom: '2026-08-15',
    },
    {
      officeName: 'Senator (fictional seat)',
      electionName: 'National Election 2028 (fictional)',
      electionDate: '2028-05-08',
      status: 'POTENTIAL_ASPIRANT',
      effectiveFrom: '2026-09-01',
    },
    {
      officeName: 'Councilor (fictional)',
      electionName: 'Local Election 2022 (fictional)',
      electionDate: '2022-05-09',
      status: 'ELECTED',
      effectiveFrom: '2022-05-12',
    },
  ],
  affiliation: {
    organizationName: 'Partido Halimbawa (fictional)',
    affiliationType: 'CANDIDATE',
    startDate: '2026-08-15',
  },
};

describe('PoliticianCard', () => {
  it('shows name, election and office context, status wording and a dated affiliation', async () => {
    await render(<PoliticianCard entry={entry} onPress={jest.fn()} />);
    expect(screen.getByText('Maria Luntian Makabayan')).toBeOnTheScreen();
    expect(screen.getByText('Mayor, City of Halimbawa (fictional)')).toBeOnTheScreen();
    expect(
      screen.getByText(
        'Halimbawa City Local Election 2027 (fictional) · Filed certificate of candidacy',
      ),
    ).toBeOnTheScreen();
    expect(screen.getByText(/Potential aspirant/)).toBeOnTheScreen();
    expect(
      screen.getByText('Affiliation: Partido Halimbawa (fictional) (candidate) · From 2026'),
    ).toBeOnTheScreen();
  });

  it('limits the context shown and says how many more there are', async () => {
    await render(<PoliticianCard entry={entry} onPress={jest.fn()} />);
    expect(screen.queryByText('Councilor (fictional)')).toBeNull();
    expect(screen.getByText('+1 more election participation')).toBeOnTheScreen();
  });

  it('is one accessible button that opens the profile', async () => {
    const onPress = jest.fn();
    await render(<PoliticianCard entry={entry} onPress={onPress} />);
    const card = screen.getByRole('button', { name: /Maria Luntian Makabayan/ });
    expect(card.props.accessibilityHint).toBe('Opens the profile');
    await fireEvent.press(card);
    expect(onPress).toHaveBeenCalledWith('p1');
  });

  it('shows only documented fields: no counts, scores or invented details', async () => {
    await render(
      <PoliticianCard
        entry={{ id: 'p2', displayName: 'Pedro Santos Jr.', participations: [] }}
        onPress={jest.fn()}
      />,
    );
    expect(screen.getByText('Pedro Santos Jr.')).toBeOnTheScreen();
    expect(screen.queryByText(/Affiliation/)).toBeNull();
    expect(screen.queryByText(/score|rating|rank|claims|sources|%|verified/i)).toBeNull();
  });

  it('describes an affiliation by its dates without implying it is current', () => {
    expect(describeAffiliation(entry)).toBe(
      'Partido Halimbawa (fictional) (candidate) · From 2026',
    );
    expect(describeAffiliation({ ...entry, affiliation: undefined })).toBeUndefined();
  });
});
