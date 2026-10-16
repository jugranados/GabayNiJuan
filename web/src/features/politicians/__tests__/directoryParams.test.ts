import type { DirectoryFilterOptions } from '@/domain/models/directory';
import {
  directoryHref,
  isNarrowed,
  parseDirectoryState,
  resolveDirectoryState,
  toDirectoryQuery,
  totalPages,
} from '@/features/politicians/directoryParams';

const ELECTION_ID = '834551e9-b01b-aaad-629d-7ab177914203';
const OFFICE_ID = '9b99c763-f2e5-5794-74df-9c9d0fe0a4c4';
const ORG_ID = 'f1aff1c0-a639-5b95-2ff8-4a77415f5f86';

const options: DirectoryFilterOptions = {
  elections: [
    {
      id: ELECTION_ID,
      slug: 'national-and-district-election-2028-fictional',
      name: 'National and District Election 2028 (fictional)',
      electionDate: '2028-05-08',
    },
  ],
  offices: [
    { id: OFFICE_ID, slug: 'senator-fictional-seat', name: 'Senator (fictional seat)', level: 'NATIONAL' },
  ],
  organizations: [{ id: ORG_ID, slug: 'partido-halimbawa-fictional', name: 'Partido Halimbawa (fictional)' }],
};

describe('directory URL state', () => {
  it('reads search text, readable filters and page from the URL', () => {
    expect(
      parseDirectoryState({
        q: '  juan   dela ',
        level: 'national',
        status: 'filed-coc',
        election: 'national-and-district-election-2028-fictional',
        office: 'senator-fictional-seat',
        organization: 'partido-halimbawa-fictional',
        page: '3',
      }),
    ).toEqual({
      q: 'juan dela',
      filters: {
        election: 'national-and-district-election-2028-fictional',
        office: 'senator-fictional-seat',
        organization: 'partido-halimbawa-fictional',
        officeLevel: 'NATIONAL',
        participationStatus: 'FILED_COC',
      },
      page: 3,
    });
  });

  it('drops unknown or malformed values instead of passing them on', () => {
    const state = parseDirectoryState({
      level: 'galactic',
      status: 'best-candidate',
      office: "1' or '1'='1",
      election: 'a'.repeat(200),
      page: '-4',
      sort: 'popularity',
    });
    expect(state).toEqual({ q: '', filters: {}, page: 1 });
    expect(isNarrowed(state)).toBe(false);
  });

  it('uses the first value of a repeated parameter and caps the page', () => {
    expect(parseDirectoryState({ q: ['ana', 'luz'], page: '999999' })).toMatchObject({
      q: 'ana',
      page: 10_000,
    });
  });

  it('builds readable, canonical URLs in a fixed parameter order and round-trips them', () => {
    const state = {
      q: 'juan',
      filters: {
        organization: 'partido-halimbawa-fictional',
        participationStatus: 'OFFICIAL_CANDIDATE',
        election: 'national-and-district-election-2028-fictional',
        officeLevel: 'CITY',
      },
      page: 2,
    } as const;
    const href = directoryHref(state);
    expect(href).toBe(
      '/politicians?q=juan&election=national-and-district-election-2028-fictional&level=city&status=official-candidate&organization=partido-halimbawa-fictional&page=2',
    );
    const params = Object.fromEntries(new URL(href, 'http://x').searchParams);
    expect(parseDirectoryState(params)).toEqual(state);
    expect(directoryHref({})).toBe('/politicians');
    expect(directoryHref({ q: '', filters: {}, page: 1 })).toBe('/politicians');
  });

  it('always queries in alphabetical order with offset paging', () => {
    expect(toDirectoryQuery({ q: 'ana', filters: {}, page: 3 }, {})).toEqual({
      query: 'ana',
      filters: {},
      sort: 'NAME_ASC',
      page: { limit: 20, offset: 40 },
    });
    expect(totalPages(0)).toBe(1);
    expect(totalPages(41)).toBe(3);
  });
});

describe('resolving readable filters', () => {
  it('resolves slugs to ids server-side, keeping status and level exact', () => {
    const resolved = resolveDirectoryState(
      parseDirectoryState({
        election: 'national-and-district-election-2028-fictional',
        office: 'senator-fictional-seat',
        organization: 'partido-halimbawa-fictional',
        status: 'publicly-declared-aspirant',
      }),
      options,
    );
    expect(resolved.filters).toEqual({
      electionId: ELECTION_ID,
      officeId: OFFICE_ID,
      organizationId: ORG_ID,
      participationStatus: 'PUBLICLY_DECLARED_ASPIRANT',
    });
    expect(resolved.usedLegacyIds).toBe(false);
    expect(resolved.unresolved).toBe(false);
  });

  it('still accepts legacy UUID links and reports them so the page can redirect to the slug URL', () => {
    const resolved = resolveDirectoryState(
      parseDirectoryState({ election: ELECTION_ID.toUpperCase(), office: OFFICE_ID, status: 'filed-coc', page: '2' }),
      options,
    );
    expect(resolved.usedLegacyIds).toBe(true);
    expect(resolved.filters).toMatchObject({ electionId: ELECTION_ID, officeId: OFFICE_ID });
    expect(directoryHref(resolved.state)).toBe(
      '/politicians?election=national-and-district-election-2028-fictional&office=senator-fictional-seat&status=filed-coc&page=2',
    );
  });

  it('gives a legacy link and its readable form the same canonical URL', () => {
    const legacy = resolveDirectoryState(parseDirectoryState({ organization: ORG_ID }), options);
    const readable = resolveDirectoryState(
      parseDirectoryState({ organization: 'partido-halimbawa-fictional' }),
      options,
    );
    expect(directoryHref(legacy.state)).toBe(directoryHref(readable.state));
  });

  it('keeps an unknown reference as unresolved instead of silently widening the list', () => {
    const resolved = resolveDirectoryState(
      parseDirectoryState({ election: 'no-such-election', level: 'national' }),
      options,
    );
    expect(resolved.unresolved).toBe(true);
    expect(resolved.filters).toEqual({ officeLevel: 'NATIONAL' });
    expect(resolved.state.filters.election).toBe('no-such-election');
    expect(isNarrowed(resolved.state)).toBe(true);
  });
});
