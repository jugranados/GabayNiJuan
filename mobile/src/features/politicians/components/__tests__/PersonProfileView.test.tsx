import { fireEvent, screen } from '@testing-library/react-native';

import { MISSING_RECORDS_MESSAGE } from '@/components/states';
import { createMockRepositories } from '@/data/repositories/mockRepositories';
import { PersonProfileView } from '@/features/politicians/components/PersonProfileView';
import { renderWithProviders } from '@/shared/testing/renderWithProviders';

const TODAY = '2026-10-08';

async function renderProfile(id: string, onOpenClaim?: (claimId: string) => void) {
  const profile = await createMockRepositories().people.getPersonProfile(id);
  if (!profile) throw new Error('fixture missing');
  await renderWithProviders(
    <PersonProfileView profile={profile} today={TODAY} onOpenClaim={onOpenClaim} />,
  );
}

const SECTIONS = [
  'Election Participation',
  'Public Office History',
  'Political Affiliations',
  'Education',
  'Policy Positions',
  'Sources',
];

describe('PersonProfileView hierarchy', () => {
  it('shows header, then the sections in order, with source-backed fictional records', async () => {
    await renderProfile('person-maria-makabayan');
    expect(screen.getByRole('header', { name: 'Maria Luntian Makabayan' })).toBeOnTheScreen();
    const headers = screen.getAllByRole('header').map((h) => h.props.children);
    const order = SECTIONS.map((name) => headers.indexOf(name));
    expect(order.every((index) => index >= 0)).toBe(true);
    expect([...order].sort((a, b) => a - b)).toEqual(order);
    expect(
      screen.getByText(/every person, office, and source shown is fictional/),
    ).toBeOnTheScreen();
  });

  it('does not show legal cases or asset disclosures', async () => {
    await renderProfile('person-maria-makabayan');
    expect(screen.queryByText(/legal|case|disclosure|net worth|SALN/i)).toBeNull();
  });

  it('shows no person-level score, verdict or "verified politician" wording', async () => {
    await renderProfile('person-maria-makabayan');
    expect(
      screen.queryByText(
        /trust score|evidence score|transparency|% verified|verified politician|best|clean record|criminal/i,
      ),
    ).toBeNull();
  });
});

describe('profile header', () => {
  it('shows only context that is current by its dates and has standing evidence', async () => {
    await renderProfile('person-ramon-gawa-gawa');
    expect(screen.getByText('Current documented office')).toBeOnTheScreen();
    expect(screen.getByText('Current documented affiliation')).toBeOnTheScreen();
    expect(
      screen.getByText(/Governor, Province of Kathang-Isip \(fictional\) · From 2022/),
    ).toBeOnTheScreen();
    expect(
      screen.getByText('Alyansang Bagong-Umaga (fictional) (member) · From 2019'),
    ).toBeOnTheScreen();
    expect(screen.queryByText(/Partido Halimbawa \(fictional\) \(member\) · From 2012/)).toBeNull();
  });

  it('omits "current" lines when records are ended, outdated or unevidenced', async () => {
    await renderProfile('person-elena-kathang-isip');
    expect(screen.queryByText('Current documented office')).toBeNull();
    expect(screen.queryByText('Current documented affiliation')).toBeNull();
  });

  it('shows the election context with the exact participation state', async () => {
    await renderProfile('person-ana-pangarap');
    expect(
      screen.getByText(
        'Senator (fictional seat): Declared aspirant (National and District Election 2028 (fictional))',
      ),
    ).toBeOnTheScreen();
  });

  it('shows evidence counts as information, not as a rating', async () => {
    await renderProfile('person-maria-makabayan');
    expect(
      screen.getByText(/\d+ claims from \d+ sources · Last reviewed 1 Oct 2026/),
    ).toBeOnTheScreen();
    expect(
      screen.getByText(
        'These counts show how much evidence is on file. They are not a rating of this person.',
      ),
    ).toBeOnTheScreen();
  });

  it('opens the evidence behind a headline fact', async () => {
    const onOpenClaim = jest.fn();
    await renderProfile('person-ramon-gawa-gawa', onOpenClaim);
    await fireEvent.press(
      screen.getByRole('link', { name: 'View evidence for current documented office' }),
    );
    expect(onOpenClaim).toHaveBeenCalledWith('claim-ramon-governor');
  });
});

describe('election participation section', () => {
  it('distinguishes aspirant, filed, withdrawn and disqualified states in plain words', async () => {
    await renderProfile('person-pedro-santos');
    expect(screen.getByLabelText(/Participation status: Potential aspirant/)).toBeOnTheScreen();
    expect(screen.queryByText('Official candidate')).toBeNull();
    expect(screen.getAllByText('No source attached.')).toHaveLength(1); // his UNVERIFIED office term
  });
});

describe('timelines', () => {
  it('lists public office history most recent first', async () => {
    await renderProfile('person-ramon-gawa-gawa');
    const periods = screen.getAllByText(/^(From 2022|2013 – 2022)$/).map((n) => n.props.children);
    expect(periods).toEqual(['From 2022', '2013 – 2022']);
  });

  it('lists affiliations most recent first without judging switches', async () => {
    await renderProfile('person-ramon-gawa-gawa');
    const periods = screen.getAllByText(/^(From 2019|2012 – 2019)$/).map((n) => n.props.children);
    expect(periods).toEqual(['From 2019', '2012 – 2019']);
    expect(screen.queryByText(/switch|defect|loyal|turncoat|flip/i)).toBeNull();
  });

  it('says "no end date recorded" instead of "present"', async () => {
    await renderProfile('person-ramon-gawa-gawa');
    expect(screen.getAllByText('No end date recorded').length).toBeGreaterThanOrEqual(2);
    expect(screen.queryByText(/present/i)).toBeNull();
  });
});

describe('missing data wording', () => {
  it('uses the one neutral sentence for every empty section', async () => {
    await renderProfile('person-carlo-haka-haka'); // no office history, affiliations or education
    expect(screen.getAllByText(MISSING_RECORDS_MESSAGE)).toHaveLength(3);
  });

  it('never states a negative finding', async () => {
    await renderProfile('person-carlo-haka-haka');
    expect(
      screen.queryByText(
        /no political experience|no cases|no issues|no controversies|no corruption|no education|clean/i,
      ),
    ).toBeNull();
  });
});

describe('evidence navigation', () => {
  it('opens the claim for any attested record', async () => {
    const onOpenClaim = jest.fn();
    await renderProfile('person-luz-ejemplo', onOpenClaim);
    const links = screen.getAllByRole('link', { name: 'View evidence and sources' });
    expect(links).toHaveLength(4); // election, office term, party and education claims
    await fireEvent.press(links[0]!);
    expect(onOpenClaim).toHaveBeenCalledTimes(1);
    expect(onOpenClaim.mock.calls[0]?.[0]).toMatch(/^claim-luz-/);
  });

  it('keeps a visible verification badge on every attested record', async () => {
    await renderProfile('person-dante-gawa-gawa');
    expect(screen.getAllByText('Primary source').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Unverified').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Reported').length).toBeGreaterThan(0);
  });
});
