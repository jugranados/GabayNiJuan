/**
 * The public pages rendered end to end over the fictional fixtures (the default
 * mock data source): server page -> repositories -> Zod -> domain -> components.
 */
import { render, screen, within } from '@testing-library/react';

import HomePage from '@/app/(public)/page';
import ClaimPage, { generateMetadata as claimMetadata } from '@/app/(public)/claims/[id]/page';
import ReportErrorPage from '@/app/(public)/corrections/report/page';
import PoliticiansPage, { generateMetadata as directoryMetadata } from '@/app/(public)/politicians/page';
import PoliticianPage, {
  generateMetadata as profileMetadata,
} from '@/app/(public)/politicians/[slug]/page';
import { MISSING_RECORDS_MESSAGE } from '@/components/ui';
import { Pagination } from '@/features/politicians/components/Pagination';
import { ProfileView } from '@/features/politicians/components/ProfileView';
import { getRepositories } from '@/server/repositories';

type Query = Record<string, string | string[] | undefined>;
const directory = async (query: Query = {}) =>
  render(await PoliticiansPage({ params: Promise.resolve({}), searchParams: Promise.resolve(query) }));
const profile = async (slug: string) =>
  render(await PoliticianPage({ params: Promise.resolve({ slug }), searchParams: Promise.resolve({}) }));
const claim = async (id: string) =>
  render(await ClaimPage({ params: Promise.resolve({ id }), searchParams: Promise.resolve({}) }));
const cardNames = () =>
  screen
    .getAllByRole('heading', { level: 2 })
    .map((heading) => heading.textContent);

/** Wording that would rank, judge or recommend a person. None may appear on a public page. */
const FORBIDDEN =
  /\b(best|worst|top candidate|trending|most (viewed|trusted|popular)|recommended|trust score|rating:|clean record|no (cases|controversies|corruption|political experience)|corrupt|criminal record)\b/i;

describe('home', () => {
  it('offers search and browsing, states neutrality, and promotes nobody', async () => {
    const { container } = render(await HomePage());
    expect(screen.getByRole('heading', { level: 1, name: 'Gabay ni Juan' })).toBeInTheDocument();
    expect(screen.getByRole('searchbox', { name: /search politicians by name/i })).toHaveAttribute('name', 'q');
    expect(screen.getByRole('link', { name: 'Browse all politicians' })).toHaveAttribute('href', '/politicians');
    expect(screen.getByRole('link', { name: 'National offices' })).toHaveAttribute(
      'href',
      '/politicians?level=national',
    );
    expect(container).toHaveTextContent('does not endorse, rank, score, or recommend any candidate');
    expect(container.textContent).not.toMatch(FORBIDDEN);
    // No person is featured on the home page.
    expect(container.querySelector('a[href^="/politicians/"]')).toBeNull();
  });
});

describe('directory', () => {
  it('lists everyone alphabetically by last name and says order is not ranking', async () => {
    const { container } = await directory();
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
    expect(container).toHaveTextContent('10 results · alphabetical by name');
    expect(container).toHaveTextContent('Order does not imply ranking.');
    expect(screen.getByRole('link', { name: 'Juan Dela Cruz' })).toHaveAttribute(
      'href',
      '/politicians/juan-dela-cruz',
    );
    expect(container.textContent).not.toMatch(FORBIDDEN);
  });

  it('searches by name from the URL and keeps the text in the box', async () => {
    await directory({ q: 'ejemplo' });
    expect(cardNames()).toEqual(['Luz Tala Ejemplo', 'Tomas Ilog Ejemplo']);
    expect(screen.getByRole('searchbox', { name: 'Search by name' })).toHaveValue('ejemplo');
  });

  it('ignores a one-character search and says so', async () => {
    const { container } = await directory({ q: 'e' });
    expect(cardNames()).toHaveLength(10);
    expect(container).toHaveTextContent('Type at least 2 characters to search by name.');
  });

  it('applies filters from the URL, shows them as removable, and offers no ranking filter', async () => {
    await directory({ level: 'national', q: 'e' });
    const all = (await getRepositories().people.searchDirectory({ filters: { officeLevel: 'NATIONAL' } })).items;
    expect(all.length).toBeGreaterThan(0);
    expect(cardNames()).toEqual(all.map((entry) => entry.displayName));
    const active = screen.getByRole('list', { name: 'Active filters' });
    expect(within(active).getByRole('link', { name: /Office level: National/ })).toHaveAttribute(
      'href',
      '/politicians?q=e',
    );
    expect(screen.getByLabelText('Office level')).toHaveValue('national');
    const labels = screen.getAllByRole('combobox').map((select) => select.getAttribute('name'));
    expect(labels).toEqual(['election', 'level', 'office', 'status', 'organization']);
    expect(screen.queryByLabelText(/sort|rank|popular|trust/i)).toBeNull();
  });

  it('explains an empty result without implying anything about a person', async () => {
    const { container } = await directory({ q: 'zzzz' });
    expect(container).toHaveTextContent('No politicians match this search');
    expect(container).toHaveTextContent('a missing name does not mean a person has no public record');
    expect(screen.getByRole('link', { name: 'Clear search and filters' })).toHaveAttribute('href', '/politicians');
  });

  it('sends a page past the end back to the first page', async () => {
    await expect(directory({ page: '7', q: 'ejemplo' })).rejects.toThrow(/NEXT_REDIRECT/);
  });

  it('paginates with real, shareable links that keep the search and filters', () => {
    render(<Pagination state={{ q: 'a', filters: { officeLevel: 'CITY' }, page: 2 }} total={45} />);
    expect(screen.getByText('Page 2 of 3')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Previous' })).toHaveAttribute('href', '/politicians?q=a&level=city');
    expect(screen.getByRole('link', { name: 'Next' })).toHaveAttribute(
      'href',
      '/politicians?q=a&level=city&page=3',
    );
  });

  it('keeps searches and filtered views out of the index, but not plain pages', async () => {
    const meta = (query: Query) =>
      directoryMetadata({ params: Promise.resolve({}), searchParams: Promise.resolve(query) });
    expect((await meta({})).robots).toBeUndefined();
    expect((await meta({ page: '2' })).alternates?.canonical).toBe('/politicians?page=2');
    expect((await meta({ q: 'juan' })).robots).toEqual({ index: false, follow: true });
  });
});

describe('profile', () => {
  it('shows the sections in the documented order', async () => {
    await profile('juan-dela-cruz');
    expect(screen.getByRole('heading', { level: 1, name: 'Juan Dela Cruz' })).toBeInTheDocument();
    const sections = screen.getAllByRole('heading', { level: 2 }).map((h) => h.textContent);
    expect(sections.filter((title) => title !== 'Personal Details')).toEqual([
      'Election Participation',
      'Public Office History',
      'Political Affiliations',
      'Education',
      'Policy Positions',
      'Sources',
    ]);
    expect(screen.queryByText(/legal case|asset disclosure|net worth/i)).toBeNull();
  });

  it('links every claim to its evidence page and never shows a person-level verdict', async () => {
    const { container } = await profile('juan-dela-cruz');
    const data = await getRepositories().people.getPersonProfileBySlug('juan-dela-cruz');
    const links = screen.getAllByRole('link', { name: /^View evidence/ });
    expect(links.length).toBeGreaterThanOrEqual(data?.evidenceSummary.claimCount ?? Infinity);
    for (const link of links) expect(link.getAttribute('href')).toMatch(/^\/claims\/.+/);
    expect(container).toHaveTextContent('They are not a rating of this person.');
    expect(container.textContent).not.toMatch(FORBIDDEN);
    expect(container.textContent).not.toMatch(/verified (person|politician|profile)/i);
    expect(screen.getByRole('link', { name: 'Report an error' })).toHaveAttribute(
      'href',
      '/corrections/report?type=person&id=person-juan-dela-cruz',
    );
  });

  it('describes missing data with the one neutral sentence', () => {
    const { container } = render(
      <ProfileView
        today="2026-10-12"
        profile={{
          person: { id: 'p', slug: 'test-person', firstName: 'Test', lastName: 'Person' },
          identityClaims: [],
          electionParticipations: [],
          officeTerms: [],
          affiliations: [],
          education: [],
          policyPositions: [],
          sources: [],
          evidenceSummary: { claimCount: 0, sourceCount: 0 },
        }}
      />,
    );
    expect(screen.getAllByText(MISSING_RECORDS_MESSAGE)).toHaveLength(6);
    expect(container.textContent).not.toMatch(FORBIDDEN);
    expect(container.textContent).not.toMatch(/no (education|experience|affiliation)/i);
  });

  it('returns not-found for an unknown slug and for an id that is not a slug', async () => {
    await expect(profile('nobody-here')).rejects.toThrow(/NEXT_HTTP_ERROR_FALLBACK;404|NEXT_NOT_FOUND/);
    await expect(profile('Juan Dela Cruz')).rejects.toThrow(/404|NOT_FOUND/);
  });

  it('has descriptive metadata with a slug canonical and no political conclusion', async () => {
    const meta = await profileMetadata({
      params: Promise.resolve({ slug: 'juan-dela-cruz' }),
      searchParams: Promise.resolve({}),
    });
    expect(meta.title).toBe('Juan Dela Cruz — Public Record');
    expect(meta.alternates?.canonical).toBe('/politicians/juan-dela-cruz');
    expect(`${String(meta.title)} ${meta.description}`).not.toMatch(FORBIDDEN);
    expect(meta.openGraph?.title).toBe(meta.title);
  });
});

describe('claim page', () => {
  it('shows status, dates and each source with publisher, type, dates and a safe link', async () => {
    const { container } = await claim('claim-juan-official-candidate');
    expect(screen.getByRole('heading', { level: 1 })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Juan Dela Cruz' })).toHaveAttribute(
      'href',
      '/politicians/juan-dela-cruz',
    );
    expect(container).toHaveTextContent('Verification: Primary source');
    expect(container).toHaveTextContent('Last reviewed');
    expect(container).toHaveTextContent('Sources that support this claim');
    for (const term of ['Publisher', 'Source type', 'Published', 'Retrieved']) {
      expect(screen.getAllByText(term).length).toBeGreaterThan(0);
    }
    const external = screen.getAllByRole('link', { name: /Open original source/ });
    for (const link of external) {
      expect(link).toHaveAttribute('target', '_blank');
      expect(link.getAttribute('rel')).toContain('noopener');
      expect(link.getAttribute('rel')).toContain('noreferrer');
      expect(link.getAttribute('href')).toMatch(/^https?:\/\//);
      expect(link).toHaveTextContent(/example\.org, opens in a new tab/);
    }
  });

  it('keeps conflicting sources visible beside supporting ones for a disputed claim', async () => {
    const repositories = getRepositories();
    let disputedId: string | undefined;
    for (const slug of await repositories.people.listPersonSlugs()) {
      const data = await repositories.people.getPersonProfileBySlug(slug);
      const groups = [
        ...(data?.identityClaims ?? []),
        ...[
          ...(data?.electionParticipations ?? []),
          ...(data?.officeTerms ?? []),
          ...(data?.affiliations ?? []),
          ...(data?.education ?? []),
          ...(data?.policyPositions ?? []),
        ].flatMap((item) => item.claims),
      ];
      disputedId ??= groups.find((item) => item.claim.verificationStatus === 'DISPUTED')?.claim.id;
    }
    expect(disputedId).toBeDefined();
    const { container } = await claim(disputedId as string);
    expect(container).toHaveTextContent('Verification: Disputed');
    expect(container).toHaveTextContent('Sources that support this claim');
    expect(container).toHaveTextContent('Sources that conflict with this claim');
    // A disputed statement stays public and linkable but is not offered to search engines.
    const meta = await claimMetadata({ params: Promise.resolve({ id: disputedId as string }), searchParams: Promise.resolve({}) });
    expect(meta.robots).toEqual({ index: false, follow: true });
  });

  it('is not found for an unknown id, and keeps the statement out of search metadata', async () => {
    await expect(claim('no-such-claim')).rejects.toThrow(/404|NOT_FOUND/);
    const detail = await getRepositories().claims.getClaimDetail('claim-juan-official-candidate');
    const meta = await claimMetadata({
      params: Promise.resolve({ id: 'claim-juan-official-candidate' }),
      searchParams: Promise.resolve({}),
    });
    expect(meta.title).toBe('Claim about Juan Dela Cruz — Evidence and Sources');
    expect(meta.description).toContain('Verification status: Primary source');
    expect(meta.description).not.toContain(detail?.claim.statement);
    expect(meta.robots).toBeUndefined();
  });
});

describe('report an error', () => {
  const report = async (query: Query) =>
    render(await ReportErrorPage({ params: Promise.resolve({}), searchParams: Promise.resolve(query) }));

  it('takes its subject from the published record, not from the URL', async () => {
    const { container } = await report({ type: 'person', id: 'person-juan-dela-cruz', label: 'INJECTED' });
    expect(screen.getByRole('link', { name: 'Juan Dela Cruz' })).toBeInTheDocument();
    expect(container).not.toHaveTextContent('INJECTED');
    expect(container).toHaveTextContent('does not immediately change the public record');
  });

  it('is clearly unavailable on fictional mock data instead of pretending to send', async () => {
    const { container } = await report({ type: 'person', id: 'person-juan-dela-cruz' });
    expect(container).toHaveTextContent('Reports are not available in this preview');
    expect(screen.queryByRole('button', { name: /send report/i })).toBeNull();
  });

  it('cannot be started without a published target', async () => {
    const { container } = await report({ type: 'person', id: 'nobody' });
    expect(container).toHaveTextContent('This report could not be started');
  });
});
