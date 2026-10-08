import { fireEvent, screen, waitFor } from '@testing-library/react-native';

import { createMockRepositories } from '@/data/repositories/mockRepositories';
import type { Repositories } from '@/domain/repositories';
import { HomeView } from '@/features/politicians/components/HomeView';
import { renderWithProviders } from '@/shared/testing/renderWithProviders';

async function renderHome(repos?: Repositories) {
  const onBrowse = jest.fn();
  const onOpenAbout = jest.fn();
  await renderWithProviders(<HomeView onBrowse={onBrowse} onOpenAbout={onOpenAbout} />, repos);
  // Let the elections query settle so no update lands after the test ends.
  await waitFor(() => expect(screen.queryByText('Loading elections…')).toBeNull());
  return { onBrowse, onOpenAbout };
}

describe('HomeView', () => {
  it('states the philosophy and that nobody is endorsed or ranked', async () => {
    await renderHome();
    expect(screen.getByText(/Know the record\./)).toBeOnTheScreen();
    expect(screen.getByText(/Check the sources\./)).toBeOnTheScreen();
    expect(screen.getByText(/Decide for yourself\./)).toBeOnTheScreen();
    expect(
      screen.getByText('Gabay ni Juan does not endorse, rank, score, or recommend any candidate.'),
    ).toBeOnTheScreen();
  });

  it('has no feeds, rankings, trending lists or popularity metrics', async () => {
    await renderHome();
    await screen.findByText(/Halimbawa City Local Election 2027/);
    expect(screen.queryByText(/trending|popular|top |best|leading|poll|news/i)).toBeNull();
  });

  it('lists elections from the repository and opens the directory filtered to one', async () => {
    const { onBrowse } = await renderHome();
    const election = await screen.findByRole('button', {
      name: /National and District Election 2028 \(fictional\)/,
    });
    await fireEvent.press(election);
    expect(onBrowse).toHaveBeenCalledWith({ filters: { electionId: 'election-pambansa-2028' } });
  });

  it('offers office-level shortcuts', async () => {
    const { onBrowse } = await renderHome();
    await fireEvent.press(screen.getByRole('button', { name: 'National offices' }));
    expect(onBrowse).toHaveBeenLastCalledWith({ filters: { officeLevel: 'NATIONAL' } });
    await fireEvent.press(screen.getByRole('button', { name: 'Barangay offices' }));
    expect(onBrowse).toHaveBeenLastCalledWith({ filters: { officeLevel: 'BARANGAY' } });
  });

  it('searches from Home and opens the full directory', async () => {
    const { onBrowse } = await renderHome();
    await fireEvent.changeText(screen.getByLabelText('Search politicians by name'), 'gawa');
    await fireEvent.press(screen.getByRole('button', { name: 'Search' }));
    expect(onBrowse).toHaveBeenLastCalledWith({ searchText: 'gawa' });

    await fireEvent.press(screen.getByRole('button', { name: 'Browse all politicians' }));
    expect(onBrowse).toHaveBeenLastCalledWith({});
  });

  it('links to how verification works', async () => {
    const { onOpenAbout } = await renderHome();
    await fireEvent.press(screen.getByRole('button', { name: 'How verification works' }));
    expect(onOpenAbout).toHaveBeenCalled();
  });

  it('says plainly when no elections have been added', async () => {
    await renderHome(createMockRepositories({}));
    expect(await screen.findByText('No elections have been added yet.')).toBeOnTheScreen();
  });

  it('shows a retryable error if elections cannot be loaded', async () => {
    const base = createMockRepositories();
    const broken: Repositories = {
      ...base,
      people: {
        ...base.people,
        getDirectoryFilterOptions: () => Promise.reject(new TypeError('Network request failed')),
      },
    };
    await renderHome(broken);
    expect(await screen.findByText('You seem to be offline')).toBeOnTheScreen();
    expect(screen.getByRole('button', { name: 'Try again' })).toBeOnTheScreen();
  });
});
