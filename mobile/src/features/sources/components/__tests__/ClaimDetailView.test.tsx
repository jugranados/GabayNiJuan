import { fireEvent, render, screen } from '@testing-library/react-native';

import { devFixtureTables } from '@/data/fixtures/devFixtures';
import { createInMemoryRowSource } from '@/data/repositories/inMemoryRowSource';
import { createRepositories } from '@/data/repositories/tableRepositories';
import { ClaimDetailView } from '@/features/sources/components/ClaimDetailView';

const repos = createRepositories(createInMemoryRowSource(devFixtureTables));

async function detailOf(claimId: string) {
  const detail = await repos.claims.getClaimDetail(claimId);
  if (!detail) throw new Error(`missing claim ${claimId}`);
  return detail;
}

describe('ClaimDetailView', () => {
  it('shows the claim, status meaning, dates and both supporting and conflicting sources', async () => {
    await render(<ClaimDetailView detail={await detailOf('claim-maria-councilor-term')} />);

    expect(
      screen.getByText('Served as City Councilor from 30 June 2022 to 30 June 2025.'),
    ).toBeOnTheScreen();
    expect(screen.getByText('Disputed')).toBeOnTheScreen();
    expect(screen.getByText(/Credible sources disagree/)).toBeOnTheScreen();
    expect(screen.getByText('Applies: 30 Jun 2022 – 30 Jun 2025')).toBeOnTheScreen();
    expect(screen.getByText('Last reviewed 1 Oct 2026')).toBeOnTheScreen();

    expect(screen.getByText('Supporting sources (1)')).toBeOnTheScreen();
    expect(screen.getByText('Conflicting sources (1)')).toBeOnTheScreen();
    expect(
      screen.getByText('Roster of Elected City Officials 2022–2025 (fictional)'),
    ).toBeOnTheScreen();
    expect(screen.getByText('New city council sworn in (fictional)')).toBeOnTheScreen();
    expect(
      screen.getByText('Note: Reports that the council was sworn in on 1 July 2022.'),
    ).toBeOnTheScreen();
    expect(screen.getAllByText('Open source')).toHaveLength(2);
    expect(screen.getAllByText(/Retrieved 30 Sep 2026/).length).toBe(2);
  });

  it('shows source type and publisher for each source', async () => {
    await render(<ClaimDetailView detail={await detailOf('claim-juan-barangay-term')} />);
    expect(screen.getByText('Barangay Uno Secretariat (fictional)')).toBeOnTheScreen();
    expect(screen.getByText('Official government record · Tier 1')).toBeOnTheScreen();
    expect(screen.getByText('News report · Tier 3')).toBeOnTheScreen();
    expect(screen.queryByText(/Conflicting sources/)).toBeNull();
  });

  it('says so plainly when a claim has no source, and never invents one', async () => {
    await render(<ClaimDetailView detail={await detailOf('claim-pedro-councilor-term')} />);
    expect(screen.getByText('Unverified')).toBeOnTheScreen();
    expect(screen.getByText('No source is attached to this claim.')).toBeOnTheScreen();
    expect(screen.queryByText('This record is under review')).toBeNull();
  });

  it('flags inconsistent evidence instead of hiding it', async () => {
    const detail = await detailOf('claim-juan-official-candidate');
    await render(
      <ClaimDetailView
        detail={{ ...detail, claim: { ...detail.claim, verificationStatus: 'CORROBORATED' } }}
      />,
    );
    expect(screen.getByText('This record is under review')).toBeOnTheScreen();
    expect(screen.getByText(/at least two distinct publishers/)).toBeOnTheScreen();
  });

  it('links to the person the claim is about', async () => {
    const onOpenSubject = jest.fn();
    await render(
      <ClaimDetailView
        detail={await detailOf('claim-maria-filed-coc')}
        onOpenSubject={onOpenSubject}
      />,
    );
    await fireEvent.press(screen.getByText('About Maria Luntian Makabayan'));
    expect(onOpenSubject).toHaveBeenCalledWith('person-maria-makabayan');
  });

  it('shows no score or rating', async () => {
    await render(<ClaimDetailView detail={await detailOf('claim-maria-councilor-term')} />);
    expect(screen.queryByText(/score|rating|rank|trust/i)).toBeNull();
  });
});
