import { act, fireEvent, screen, waitFor, within } from '@testing-library/react-native';

import { createMockRepositories } from '@/data/repositories/mockRepositories';
import type { Repositories } from '@/domain/repositories';
import { DataValidationError } from '@/domain/validation/errors';
import { DirectoryView } from '@/features/politicians/components/DirectoryView';
import { useDirectoryUiStore } from '@/features/politicians/directoryStore';
import { renderWithProviders } from '@/shared/testing/renderWithProviders';

const NOW = () => new Date('2026-10-08T00:00:00Z');

function repositories(): Repositories {
  return createMockRepositories(undefined, NOW);
}

async function renderDirectory(repos: Repositories = repositories(), onOpenPerson = jest.fn()) {
  await renderWithProviders(<DirectoryView onOpenPerson={onOpenPerson} debounceMs={0} />, repos);
  return onOpenPerson;
}

/** Names in list order, read from each card's accessibility label ("Name. Status, office, election."). */
const cardNames = () =>
  screen
    .getAllByTestId(/^politician-card-/)
    .map((card) => String(card.props.accessibilityLabel).split('. ')[0] as string);

async function applyFilterChoice(choice: string) {
  await fireEvent.press(await screen.findByRole('radio', { name: choice }));
}

async function openFilters() {
  await fireEvent.press(screen.getByRole('button', { name: /^Filters/ }));
}

beforeEach(() => {
  useDirectoryUiStore.getState().reset();
});

// FlatList schedules batched renders on timers; let them finish inside act().
afterEach(async () => {
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 25));
  });
});

describe('DirectoryView', () => {
  it('lists politicians as cards in alphabetical order with a neutral ordering note', async () => {
    await renderDirectory();
    expect(await screen.findByText('10 results · alphabetical by name')).toBeOnTheScreen();
    expect(screen.getByText('Order does not imply ranking.')).toBeOnTheScreen();
    expect(cardNames()).toEqual([
      'Juan Dela Cruz',
      'Luz Tala Ejemplo',
      'Tomas Ilog Ejemplo',
      'Dante Bundok Gawa-Gawa',
      'Ramon Bayani Gawa-Gawa',
      'Carlo Dagat Haka-haka',
      'Elena Bukid Kathang-Isip',
      'Maria Luntian Makabayan',
      'Ana Liwanag Pangarap',
      'Pedro Santos Jr.',
    ]);
  });

  it('shows election context and participation status on each card without merging aspirants into candidates', async () => {
    await renderDirectory();
    const elena = await screen.findByTestId(/politician-card-person-elena/);
    expect(within(elena).getByText(/Potential aspirant/)).toBeOnTheScreen();
    expect(within(elena).queryByText(/Official candidate/)).toBeNull();
    const ana = screen.getByTestId(/politician-card-person-ana/);
    expect(within(ana).getByText(/Declared aspirant/)).toBeOnTheScreen();
  });

  it('searches by name after trimming, and shows the results count', async () => {
    await renderDirectory();
    await screen.findByText('10 results · alphabetical by name');
    await fireEvent.changeText(screen.getByLabelText('Search politicians by name'), '  gawa ');
    expect(await screen.findByText('2 results · alphabetical by name')).toBeOnTheScreen();
    expect(cardNames()).toEqual(['Dante Bundok Gawa-Gawa', 'Ramon Bayani Gawa-Gawa']);
  });

  it('asks for at least two characters instead of searching on one', async () => {
    await renderDirectory();
    await screen.findByText('10 results · alphabetical by name');
    await fireEvent.changeText(screen.getByLabelText('Search politicians by name'), 'g');
    expect(screen.getByText('Type at least 2 characters to search by name.')).toBeOnTheScreen();
    expect(cardNames()).toHaveLength(10);
  });

  it('clears the search with the clear control', async () => {
    await renderDirectory();
    await screen.findByText('10 results · alphabetical by name');
    await fireEvent.changeText(screen.getByLabelText('Search politicians by name'), 'gawa');
    await screen.findByText('2 results · alphabetical by name');
    await fireEvent.press(screen.getByRole('button', { name: 'Clear search' }));
    expect(await screen.findByText('10 results · alphabetical by name')).toBeOnTheScreen();
    expect(screen.queryByRole('button', { name: 'Clear search' })).toBeNull();
  });

  it('applies a filter from the sheet and shows it as a removable chip', async () => {
    await renderDirectory();
    await screen.findByText('10 results · alphabetical by name');
    await openFilters();
    await applyFilterChoice('National');
    await fireEvent.press(screen.getByRole('button', { name: /^Show results/ }));

    expect(await screen.findByText('3 results · alphabetical by name')).toBeOnTheScreen();
    expect(cardNames()).toEqual([
      'Carlo Dagat Haka-haka',
      'Elena Bukid Kathang-Isip',
      'Ana Liwanag Pangarap',
    ]);
    expect(
      screen.getByRole('button', { name: 'Remove filter Office level: National' }),
    ).toBeOnTheScreen();
    expect(screen.getByRole('button', { name: 'Filters (1 active)' })).toBeOnTheScreen();
  });

  it('combines several filters and a search', async () => {
    await renderDirectory();
    await screen.findByText('10 results · alphabetical by name');
    await openFilters();
    await applyFilterChoice('National');
    await applyFilterChoice('Potential aspirant');
    await fireEvent.press(screen.getByRole('button', { name: /^Show results/ }));
    expect(await screen.findByText('1 result · alphabetical by name')).toBeOnTheScreen();
    expect(cardNames()).toEqual(['Elena Bukid Kathang-Isip']);

    await fireEvent.changeText(screen.getByLabelText('Search politicians by name'), 'ana');
    expect(await screen.findByText('No politicians match this search')).toBeOnTheScreen();
  });

  it('removes one filter with its chip and all of them with "Clear all filters"', async () => {
    await renderDirectory();
    await screen.findByText('10 results · alphabetical by name');
    await openFilters();
    await applyFilterChoice('National');
    await applyFilterChoice('Potential aspirant');
    await fireEvent.press(screen.getByRole('button', { name: /^Show results/ }));
    await screen.findByText('1 result · alphabetical by name');

    await fireEvent.press(
      screen.getByRole('button', {
        name: 'Remove filter Participation status: Potential aspirant',
      }),
    );
    expect(await screen.findByText('3 results · alphabetical by name')).toBeOnTheScreen();

    await fireEvent.press(screen.getByRole('button', { name: 'Clear all filters' }));
    expect(await screen.findByText('10 results · alphabetical by name')).toBeOnTheScreen();
    expect(screen.queryByRole('button', { name: 'Clear all filters' })).toBeNull();
  });

  it('offers no ranking or judging filters', async () => {
    await renderDirectory();
    await screen.findByText('10 results · alphabetical by name');
    await openFilters();
    await screen.findByRole('radio', { name: 'National' });
    expect(screen.queryByText(/best|trusted|clean|popular|experienced|controvers/i)).toBeNull();
  });

  it('shows a helpful empty state and recovers with one tap', async () => {
    await renderDirectory();
    await screen.findByText('10 results · alphabetical by name');
    await fireEvent.changeText(screen.getByLabelText('Search politicians by name'), 'zzzzzz');
    expect(await screen.findByText('No politicians match this search')).toBeOnTheScreen();
    expect(screen.getByText(/does not mean a person has no public record/)).toBeOnTheScreen();
    await fireEvent.press(screen.getByRole('button', { name: 'Clear search and filters' }));
    expect(await screen.findByText('10 results · alphabetical by name')).toBeOnTheScreen();
  });

  it('keeps the search text and filters when the voter returns from a profile', async () => {
    const first = await renderDirectory();
    await screen.findByText('10 results · alphabetical by name');
    await fireEvent.changeText(screen.getByLabelText('Search politicians by name'), 'gawa');
    await screen.findByText('2 results · alphabetical by name');
    await fireEvent.press(screen.getByTestId(/politician-card-person-ramon/));
    expect(first).toHaveBeenCalledWith('person-ramon-gawa-gawa');

    await act(async () => {
      screen.unmount();
    });
    await renderDirectory();
    expect(screen.getByLabelText('Search politicians by name').props.value).toBe('gawa');
    expect(await screen.findByText('2 results · alphabetical by name')).toBeOnTheScreen();
  });

  it('loads more results page by page', async () => {
    const base = repositories();
    const small: Repositories = {
      ...base,
      people: {
        ...base.people,
        searchDirectory: (query) =>
          base.people.searchDirectory({ ...query, page: { ...query.page, limit: 4 } }),
      },
    };
    await renderDirectory(small);
    await screen.findByText('10 results · alphabetical by name');
    expect(cardNames()).toHaveLength(4);

    await fireEvent.press(screen.getByRole('button', { name: 'Show more' }));
    await waitFor(() => expect(cardNames()).toHaveLength(8));
    await fireEvent.press(screen.getByRole('button', { name: 'Show more' }));
    await waitFor(() => expect(cardNames()).toHaveLength(10));
    expect(screen.queryByRole('button', { name: 'Show more' })).toBeNull();
    expect(new Set(cardNames()).size).toBe(10);
  });

  it('shows an offline message with retry instead of a stack trace', async () => {
    const base = repositories();
    let fail = true;
    const flaky: Repositories = {
      ...base,
      people: {
        ...base.people,
        searchDirectory: (query) =>
          fail
            ? Promise.reject(new TypeError('Network request failed'))
            : base.people.searchDirectory(query),
      },
    };
    await renderDirectory(flaky);
    expect(await screen.findByText('You seem to be offline')).toBeOnTheScreen();
    fail = false;
    await fireEvent.press(screen.getByRole('button', { name: 'Try again' }));
    expect(await screen.findByText('10 results · alphabetical by name')).toBeOnTheScreen();
  });

  it('explains invalid data without exposing technical detail to voters', async () => {
    const base = repositories();
    const invalid: Repositories = {
      ...base,
      people: {
        ...base.people,
        searchDirectory: () => Promise.reject(new DataValidationError('person', [], 'p1')),
      },
    };
    await renderDirectory(invalid);
    expect(await screen.findByText('Some records could not be shown')).toBeOnTheScreen();
  });

  it('has an accessible search field, filter button and cards', async () => {
    await renderDirectory();
    await screen.findByText('10 results · alphabetical by name');
    expect(screen.getByLabelText('Search politicians by name')).toBeOnTheScreen();
    expect(screen.getByRole('button', { name: 'Filters' })).toBeOnTheScreen();
    const card = screen.getByTestId(/politician-card-person-luz/);
    expect(card.props.accessibilityRole).toBe('button');
    expect(card.props.accessibilityLabel).toMatch(
      /Luz Tala Ejemplo\. Filed certificate of candidacy, District Representative/,
    );
    expect(card.props.accessibilityHint).toBe('Opens the profile');
  });
});
