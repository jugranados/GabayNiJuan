import {
  activeFilterKeys,
  cleanSearchText,
  compactFilters,
  countActiveFilters,
  DEFAULT_PAGE_SIZE,
  directoryQueryKey,
  effectiveSearchText,
  isSearchTooShort,
  MAX_PAGE_SIZE,
  normalizeDirectoryQuery,
} from '@/domain/directory';
import { compareMostRecentFirst } from '@/domain/timeline';

describe('search text rules', () => {
  it('trims and collapses whitespace', () => {
    expect(cleanSearchText('  juan   dela  cruz ')).toBe('juan dela cruz');
    expect(cleanSearchText(undefined)).toBe('');
  });

  it('ignores text shorter than two characters, and says when it is too short', () => {
    expect(effectiveSearchText(' j ')).toBeUndefined();
    expect(effectiveSearchText('ju')).toBe('ju');
    expect(isSearchTooShort('j')).toBe(true);
    expect(isSearchTooShort('')).toBe(false);
    expect(isSearchTooShort('ju')).toBe(false);
  });
});

describe('filter helpers', () => {
  it('drops empty values and counts only real filters', () => {
    const filters = {
      electionId: 'e1',
      officeId: '',
      officeLevel: undefined,
      organizationId: 'o1',
    };
    expect(compactFilters(filters)).toEqual({ electionId: 'e1', organizationId: 'o1' });
    expect(countActiveFilters(filters)).toBe(2);
    expect(activeFilterKeys(filters)).toEqual(['electionId', 'organizationId']);
    expect(countActiveFilters(undefined)).toBe(0);
  });
});

describe('normalizeDirectoryQuery', () => {
  it('applies defaults', () => {
    expect(normalizeDirectoryQuery()).toEqual({
      query: undefined,
      filters: {},
      sort: 'NAME_ASC',
      limit: DEFAULT_PAGE_SIZE,
      offset: 0,
    });
  });

  it('clamps paging and always sorts alphabetically', () => {
    expect(normalizeDirectoryQuery({ page: { limit: 9999, offset: -3 } })).toMatchObject({
      limit: MAX_PAGE_SIZE,
      offset: 0,
      sort: 'NAME_ASC',
    });
    expect(normalizeDirectoryQuery({ page: { limit: 0 } }).limit).toBe(1);
  });

  it('builds equal cache keys for equivalent queries, regardless of paging or case', () => {
    expect(directoryQueryKey({ query: ' Juan ', page: { offset: 20 } })).toBe(
      directoryQueryKey({ query: 'juan', filters: { officeId: '' } }),
    );
    expect(directoryQueryKey({ query: 'juan' })).not.toBe(
      directoryQueryKey({ query: 'juan', filters: { officeLevel: 'CITY' } }),
    );
  });
});

describe('timeline ordering', () => {
  const sorted = (items: { key: string; startDate?: string; endDate?: string }[]) =>
    [...items].sort(compareMostRecentFirst).map((item) => item.key);

  it('puts the most recent start first', () => {
    expect(
      sorted([
        { key: 'old', startDate: '2013-06-30', endDate: '2022-06-30' },
        { key: 'new', startDate: '2022-06-30' },
        { key: 'mid', startDate: '2019-01-01', endDate: '2020-01-01' },
      ]),
    ).toEqual(['new', 'mid', 'old']);
  });

  it('puts records with no start date last', () => {
    expect(sorted([{ key: 'undated' }, { key: 'dated', startDate: '2001-01-01' }])).toEqual([
      'dated',
      'undated',
    ]);
  });

  it('breaks ties by later end (no end recorded counts as latest), then by key', () => {
    expect(
      sorted([
        { key: 'b', startDate: '2020-01-01', endDate: '2021-01-01' },
        { key: 'a', startDate: '2020-01-01', endDate: '2022-01-01' },
        { key: 'open', startDate: '2020-01-01' },
        { key: 'c', startDate: '2020-01-01', endDate: '2021-01-01' },
      ]),
    ).toEqual(['open', 'a', 'b', 'c']);
  });
});
