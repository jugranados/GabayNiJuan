import { render, screen } from '@testing-library/react-native';

import { devFixtureTables } from '@/data/fixtures/devFixtures';
import { createInMemoryRowSource } from '@/data/repositories/inMemoryRowSource';
import { createRepositories } from '@/data/repositories/tableRepositories';
import { PersonProfileView } from '@/features/politicians/components/PersonProfileView';

async function loadProfile(id: string) {
  const repos = createRepositories(createInMemoryRowSource(devFixtureTables));
  const profile = await repos.people.getPersonProfile(id);
  if (!profile) throw new Error('fixture missing');
  return profile;
}

describe('PersonProfileView', () => {
  it('renders every section with source-backed fictional records', async () => {
    await render(<PersonProfileView profile={await loadProfile('person-maria-makabayan')} />);

    for (const section of [
      'Profile',
      'Election Status',
      'Political Experience',
      'Affiliations',
      'Policy Positions',
      'Sources',
    ]) {
      expect(screen.getByRole('header', { name: section })).toBeOnTheScreen();
    }
    expect(
      screen.getByText(/every person, office, and source shown is fictional/),
    ).toBeOnTheScreen();
    expect(screen.getByText('Filed a certificate of candidacy')).toBeOnTheScreen();
    expect(screen.getByText('Conflicting source')).toBeOnTheScreen();
    expect(screen.getAllByText('Primary source').length).toBeGreaterThan(0);
  });

  it('labels a potential aspirant as not a candidate', async () => {
    await render(<PersonProfileView profile={await loadProfile('person-pedro-santos')} />);

    expect(
      screen.getByText('Reported as a potential aspirant (not a candidate)'),
    ).toBeOnTheScreen();
    expect(screen.queryByText('Official candidate')).toBeNull();
    expect(screen.getByText('No source attached.')).toBeOnTheScreen();
  });
});
