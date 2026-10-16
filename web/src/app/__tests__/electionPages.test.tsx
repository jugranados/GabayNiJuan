/**
 * Election pages and readable directory filters, rendered end to end over the fictional
 * fixtures: page -> repositories -> Zod -> domain -> components.
 */
import { render, screen, within } from '@testing-library/react';

import ElectionsPage, { metadata as electionsMetadata } from '@/app/(public)/elections/page';
import ElectionPage, { generateMetadata as electionMetadata } from '@/app/(public)/elections/[slug]/page';
import ElectionOfficePage, {
  generateMetadata as officeMetadata,
} from '@/app/(public)/elections/[slug]/[office]/page';
import PoliticiansPage, { generateMetadata as directoryMetadata } from '@/app/(public)/politicians/page';
import { MISSING_RECORDS_MESSAGE } from '@/components/ui';
import { CANDIDACY_NOTE } from '@/features/elections/participationLabels';

const E2028 = 'national-and-district-election-2028-fictional';
const E2027 = 'halimbawa-city-local-election-2027-fictional';
const MAYOR_2027 = 'mayor-city-of-halimbawa-fictional';

type Query = Record<string, string | string[] | undefined>;
const election = async (slug: string) =>
  render(await ElectionPage({ params: Promise.resolve({ slug }), searchParams: Promise.resolve({}) }));
const office = async (slug: string, officeSlug: string) =>
  render(
    await ElectionOfficePage({
      params: Promise.resolve({ slug, office: officeSlug }),
      searchParams: Promise.resolve({}),
    }),
  );
const directory = async (query: Query) =>
  render(await PoliticiansPage({ params: Promise.resolve({}), searchParams: Promise.resolve(query) }));
const NOT_FOUND = /NEXT_HTTP_ERROR_FALLBACK;404|NEXT_NOT_FOUND/;

const FORBIDDEN =
  /\b(best|worst|top candidate|trending|most (viewed|trusted|popular)|recommended|frontrunner|favou?rite|leading|trust score|rating:)\b/i;

describe('/elections', () => {
  it('lists elections by recorded status, each section in date order, never by popularity', async () => {
    const { container } = render(await ElectionsPage());
    const sections = screen.getAllByRole('heading', { level: 2 }).map((h) => h.textContent);
    expect(sections).toEqual(['Upcoming', 'Completed']);
    const titles = screen.getAllByRole('heading', { level: 3 }).map((h) => h.textContent);
    expect(titles).toEqual([
      'Halimbawa City Local Election 2027 (fictional)',
      'National and District Election 2028 (fictional)',
      'Halimbawa Provincial and Municipal Election 2022 (fictional)',
    ]);
    expect(screen.getByRole('link', { name: 'National and District Election 2028 (fictional)' })).toHaveAttribute(
      'href',
      `/elections/${E2028}`,
    );
    expect(container).toHaveTextContent('6 offices documented');
    expect(container).toHaveTextContent('Order does not imply importance or ranking.');
    expect(container.textContent).not.toMatch(FORBIDDEN);
  });

  it('has neutral, descriptive metadata', () => {
    expect(electionsMetadata.title).toBe('Elections');
    expect(electionsMetadata.alternates?.canonical).toBe('/elections');
    expect(String(electionsMetadata.description)).not.toMatch(FORBIDDEN);
  });
});

describe('/elections/[slug]', () => {
  it('shows the header and the offices in ballot order, each linking to its office page', async () => {
    const { container } = await election(E2028);
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('National and District Election 2028 (fictional)');
    expect(container).toHaveTextContent('8 May 2028');
    expect(container).toHaveTextContent('Upcoming');
    expect(container).toHaveTextContent('Philippines');
    const offices = within(screen.getByRole('region', { name: 'Offices' }));
    expect(offices.getAllByRole('heading', { level: 3 }).map((h) => h.textContent)).toEqual([
      'President (fictional seat)',
      'Vice President (fictional seat)',
      'Senator (fictional seat)',
      'District Representative, Halimbawa 1st District (fictional)',
      'Governor, Province of Kathang-Isip (fictional)',
      'Municipal Mayor, Bayan ng Ejemplo (fictional)',
    ]);
    expect(offices.getByRole('link', { name: 'President (fictional seat)' })).toHaveAttribute(
      'href',
      `/elections/${E2028}/president-fictional-seat`,
    );
    // An office with no documented participants uses the one neutral sentence.
    const president = offices.getByRole('link', { name: 'President (fictional seat)' }).closest('li')!;
    expect(president).toHaveTextContent(MISSING_RECORDS_MESSAGE);
    expect(container.textContent).not.toMatch(FORBIDDEN);
  });

  it('summarises participation by exact status and never calls an aspirant a candidate', async () => {
    await election(E2028);
    const senator = within(
      screen.getByRole('link', { name: 'Senator (fictional seat)' }).closest('li')!,
    );
    expect(senator.getByText('Potential aspirants')).toBeInTheDocument();
    expect(senator.getByText('Publicly declared aspirants')).toBeInTheDocument();
    expect(senator.getByText('Withdrawn')).toBeInTheDocument();
    expect(senator.queryByText(/official candidate/i)).toBeNull();
    // Nobody in the fictional 2028 election is an official candidate, so the page never says so.
    expect(within(screen.getByRole('region', { name: 'Participation summary' })).queryByText(/Official candidates/)).toBeNull();
  });

  it('links into the directory with readable filters that keep the exact status', async () => {
    await election(E2028);
    expect(screen.getByRole('link', { name: 'View all participants in the directory' })).toHaveAttribute(
      'href',
      `/politicians?election=${E2028}`,
    );
    expect(screen.getByRole('link', { name: 'Filed a certificate of candidacy: 1' })).toHaveAttribute(
      'href',
      `/politicians?election=${E2028}&status=filed-coc`,
    );
  });

  it('emits Event and breadcrumb structured data with only recorded facts', async () => {
    const { container } = await election(E2028);
    const script = container.querySelector('script[type="application/ld+json"]');
    const data = JSON.parse(script?.textContent ?? '[]') as Record<string, unknown>[];
    expect(data[0]).toEqual({
      '@context': 'https://schema.org',
      '@type': 'Event',
      name: 'National and District Election 2028 (fictional)',
      startDate: '2028-05-08',
      url: expect.stringMatching(new RegExp(`/elections/${E2028}$`)),
      location: { '@type': 'Country', name: 'Philippines' },
    });
    expect(data[1]?.['@type']).toBe('BreadcrumbList');
    expect(script?.textContent).not.toMatch(/Person|candidate/i);
  });

  it('has a descriptive title and a slug canonical', async () => {
    const meta = await electionMetadata({ params: Promise.resolve({ slug: E2028 }), searchParams: Promise.resolve({}) });
    expect(meta.title).toBe('National and District Election 2028 (fictional)');
    expect(meta.alternates?.canonical).toBe(`/elections/${E2028}`);
    expect(String(meta.description)).not.toMatch(FORBIDDEN);
  });

  it('is not found for an unknown or malformed slug', async () => {
    await expect(election('no-such-election')).rejects.toThrow(NOT_FOUND);
    await expect(election('Not A Slug')).rejects.toThrow(NOT_FOUND);
  });
});

describe('/elections/[slug]/[office]', () => {
  it('groups participants by exact status, in lifecycle order', async () => {
    const { container } = await office(E2027, MAYOR_2027);
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Mayor, City of Halimbawa (fictional)');
    expect(screen.getAllByRole('heading', { level: 3 }).map((h) => h.textContent)).toEqual([
      'Potential aspirants (1)',
      'Filed a certificate of candidacy (1)',
      'Official candidates (1)',
      'Disqualified (1)',
    ]);
    const group = (name: RegExp) => within(screen.getByRole('region', { name }));
    expect(group(/^Potential aspirants/).getByRole('link', { name: 'Pedro Santos Jr.' })).toBeInTheDocument();
    expect(group(/^Filed a certificate/).getByRole('link', { name: 'Maria Luntian Makabayan' })).toBeInTheDocument();
    expect(group(/^Official candidates/).getByRole('link', { name: 'Juan Dela Cruz' })).toHaveAttribute(
      'href',
      '/politicians/juan-dela-cruz',
    );
    expect(container).toHaveTextContent(CANDIDACY_NOTE);
    expect(container.textContent).not.toMatch(FORBIDDEN);
  });

  it('labels only OFFICIAL_CANDIDATE records as official candidates', async () => {
    await office(E2027, MAYOR_2027);
    const notCandidates = [/^Potential aspirants/, /^Filed a certificate/, /^Disqualified/].map((name) =>
      screen.getByRole('region', { name }),
    );
    for (const region of notCandidates) {
      expect(region.textContent).not.toMatch(/Official candidate\./);
    }
    expect(screen.getByRole('region', { name: /^Official candidates/ })).toHaveTextContent('Official candidate.');
    expect(screen.getByRole('region', { name: /^Filed a certificate/ })).toHaveTextContent(
      'Not yet confirmed as an official candidate.',
    );
  });

  it('keeps every record evidence-backed: each one links to its claim', async () => {
    await office(E2027, MAYOR_2027);
    const links = screen.getAllByRole('link', { name: /View evidence and sources/ });
    expect(links.length).toBeGreaterThanOrEqual(4);
    for (const link of links) expect(link.getAttribute('href')).toMatch(/^\/claims\//);
  });

  it('links to directory views that preserve the exact status', async () => {
    await office(E2027, MAYOR_2027);
    expect(screen.getByRole('link', { name: 'View all participants' })).toHaveAttribute(
      'href',
      `/politicians?election=${E2027}&office=${MAYOR_2027}`,
    );
    expect(screen.getByRole('link', { name: 'View official candidates' })).toHaveAttribute(
      'href',
      `/politicians?election=${E2027}&office=${MAYOR_2027}&status=official-candidate`,
    );
    expect(screen.getByRole('link', { name: 'View people who filed a certificate of candidacy' })).toHaveAttribute(
      'href',
      `/politicians?election=${E2027}&office=${MAYOR_2027}&status=filed-coc`,
    );
  });

  it('shows the neutral sentence for an office with no documented participants', async () => {
    const { container } = await office(E2028, 'president-fictional-seat');
    expect(within(screen.getByRole('region', { name: 'Participants' })).getByText(MISSING_RECORDS_MESSAGE)).toBeInTheDocument();
    expect(container.textContent).not.toMatch(FORBIDDEN);
  });

  it('is not found for an office that is not contested in that election', async () => {
    await expect(office(E2027, 'senator-fictional-seat')).rejects.toThrow(NOT_FOUND);
    await expect(office(E2027, 'no-such-office')).rejects.toThrow(NOT_FOUND);
  });

  it('titles the page "Office — Election" with a slug canonical', async () => {
    const meta = await officeMetadata({
      params: Promise.resolve({ slug: E2028, office: 'president-fictional-seat' }),
      searchParams: Promise.resolve({}),
    });
    expect(meta.title).toBe('President (fictional seat) — National and District Election 2028 (fictional)');
    expect(meta.alternates?.canonical).toBe(`/elections/${E2028}/president-fictional-seat`);
  });
});

describe('readable directory filters', () => {
  it('filters by election slug and exact status, and shows the filter by name', async () => {
    await directory({ election: E2028, status: 'publicly-declared-aspirant' });
    expect(screen.getAllByRole('heading', { level: 2 }).map((h) => h.textContent)).toEqual(['Ana Liwanag Pangarap']);
    const active = within(screen.getByRole('list', { name: 'Active filters' }));
    expect(active.getByRole('link', { name: /Election: National and District Election 2028/ })).toHaveAttribute(
      'href',
      '/politicians?status=publicly-declared-aspirant',
    );
    expect(screen.getByLabelText('Election')).toHaveValue(E2028);
  });

  it('filters by office and organization slugs', async () => {
    await directory({ office: MAYOR_2027 });
    expect(screen.getAllByRole('heading', { level: 2 })).toHaveLength(4);
    await directory({ organization: 'partido-halimbawa-fictional' });
    expect(screen.getAllByRole('heading', { level: 2 }).map((h) => h.textContent)).toContain('Maria Luntian Makabayan');
  });

  it('redirects a legacy id link permanently to the readable URL', async () => {
    await expect(directory({ election: 'election-pambansa-2028', status: 'filed-coc' })).rejects.toMatchObject({
      digest: expect.stringContaining(`/politicians?election=${E2028}&status=filed-coc;308`),
    });
  });

  it('gives a legacy link the readable canonical URL, so the two are one page', async () => {
    const meta = await directoryMetadata({
      params: Promise.resolve({}),
      searchParams: Promise.resolve({ office: 'office-halimbawa-mayor' }),
    });
    expect(meta.alternates?.canonical).toBe(`/politicians?office=${MAYOR_2027}`);
    expect(meta.robots).toEqual({ index: false, follow: true });
  });

  it('shows no results for an unknown slug instead of silently widening the list', async () => {
    const { container } = await directory({ election: 'no-such-election' });
    expect(container).toHaveTextContent('0 results');
    expect(container).toHaveTextContent('No politicians match this search');
    expect(within(screen.getByRole('list', { name: 'Active filters' })).getByRole('link', { name: /Election: Not found/ })).toBeInTheDocument();
  });
});
