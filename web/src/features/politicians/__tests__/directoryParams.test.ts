import {
  directoryHref,
  isNarrowed,
  parseDirectoryState,
  toDirectoryQuery,
  totalPages,
} from '@/features/politicians/directoryParams';

describe('directory URL state', () => {
  it('reads search text, filters and page from the URL', () => {
    expect(
      parseDirectoryState({
        q: '  juan   dela ',
        level: 'national',
        status: 'filed-coc',
        election: '72b46115-8272-a0fb-b624-405b85bab363',
        page: '3',
      }),
    ).toEqual({
      q: 'juan dela',
      filters: {
        electionId: '72b46115-8272-a0fb-b624-405b85bab363',
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

  it('builds readable, canonical URLs and round-trips them', () => {
    const state = {
      q: 'juan',
      filters: { officeLevel: 'CITY', participationStatus: 'OFFICIAL_CANDIDATE' },
      page: 2,
    } as const;
    const href = directoryHref(state);
    expect(href).toBe('/politicians?q=juan&level=city&status=official-candidate&page=2');
    const params = Object.fromEntries(new URL(href, 'http://x').searchParams);
    expect(parseDirectoryState(params)).toEqual(state);
    expect(directoryHref({})).toBe('/politicians');
    expect(directoryHref({ q: '', filters: {}, page: 1 })).toBe('/politicians');
  });

  it('always queries in alphabetical order with offset paging', () => {
    expect(toDirectoryQuery({ q: 'ana', filters: {}, page: 3 })).toEqual({
      query: 'ana',
      filters: {},
      sort: 'NAME_ASC',
      page: { limit: 20, offset: 40 },
    });
    expect(totalPages(0)).toBe(1);
    expect(totalPages(41)).toBe(3);
  });
});
