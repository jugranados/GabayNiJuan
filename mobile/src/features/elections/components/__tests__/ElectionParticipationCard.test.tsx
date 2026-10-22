import { fireEvent, screen } from '@testing-library/react-native';

import { createMockRepositories } from '@/data/repositories/mockRepositories';
import { ELECTION_PARTICIPATION_STATUSES } from '@/domain/enums';
import { ElectionParticipationCard } from '@/features/elections/components/ElectionParticipationCard';
import { PARTICIPATION_STATUS_INFO } from '@/features/elections/participationLabels';
import { renderWithProviders } from '@/shared/testing/renderWithProviders';

async function participationOf(personId: string, index = 0) {
  const profile = await createMockRepositories().people.getPersonProfile(personId);
  const item = profile?.electionParticipations[index];
  if (!item) throw new Error('missing participation');
  return item;
}

describe('ElectionParticipationCard', () => {
  it('shows office, election, status, date, ballot number and evidence for an official candidate', async () => {
    await renderWithProviders(
      <ElectionParticipationCard item={await participationOf('person-juan-dela-cruz')} />,
    );
    expect(screen.getByText('Mayor, City of Halimbawa (fictional)')).toBeOnTheScreen();
    expect(
      screen.getByText(/Halimbawa City Local Election 2027 \(fictional\) · 10 May 2027/),
    ).toBeOnTheScreen();
    expect(screen.getByLabelText(/Participation status: Official candidate/)).toBeOnTheScreen();
    expect(screen.getByText('As of 15 Sep 2026')).toBeOnTheScreen();
    expect(screen.getByText('Ballot number 2')).toBeOnTheScreen();
    expect(screen.getByText('Primary source')).toBeOnTheScreen();
  });

  it('never shows a ballot number that is not documented', async () => {
    await renderWithProviders(
      <ElectionParticipationCard item={await participationOf('person-maria-makabayan')} />,
    );
    expect(screen.queryByText(/Ballot number/)).toBeNull();
  });

  it('says aspirants are not candidates', async () => {
    await renderWithProviders(
      <ElectionParticipationCard item={await participationOf('person-pedro-santos')} />,
    );
    expect(screen.getByLabelText(/Participation status: Potential aspirant/)).toBeOnTheScreen();
    expect(
      screen.getByText('Reported as possibly running. This is not a candidacy.'),
    ).toBeOnTheScreen();
    expect(screen.queryByText('Official candidate')).toBeNull();
  });

  it('opens the claim behind the participation', async () => {
    const onOpenClaim = jest.fn();
    await renderWithProviders(
      <ElectionParticipationCard
        item={await participationOf('person-dante-gawa-gawa')}
        onOpenClaim={onOpenClaim}
      />,
    );
    await fireEvent.press(screen.getByRole('link', { name: 'View evidence and sources' }));
    expect(onOpenClaim).toHaveBeenCalledWith('claim-dante-disqualified');
  });
});

describe('participation status wording', () => {
  it('gives every status its own label and description, with no status called plain "Candidate"', () => {
    const labels = ELECTION_PARTICIPATION_STATUSES.map((s) => PARTICIPATION_STATUS_INFO[s].label);
    expect(new Set(labels).size).toBe(ELECTION_PARTICIPATION_STATUSES.length);
    expect(labels).not.toContain('Candidate');
    for (const status of ELECTION_PARTICIPATION_STATUSES) {
      expect(PARTICIPATION_STATUS_INFO[status].description.length).toBeGreaterThan(10);
    }
    expect(PARTICIPATION_STATUS_INFO.POTENTIAL_ASPIRANT.description).toMatch(/not a candidacy/i);
    expect(PARTICIPATION_STATUS_INFO.PUBLICLY_DECLARED_ASPIRANT.description).toMatch(
      /not yet a candidate/i,
    );
    expect(PARTICIPATION_STATUS_INFO.FILED_COC.description).toMatch(/not yet confirmed/i);
  });
});
