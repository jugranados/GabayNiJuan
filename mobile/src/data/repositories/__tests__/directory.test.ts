import { devFixtureTables } from '@/data/fixtures/devFixtures';
import { createMockRepositories } from '@/data/repositories/mockRepositories';
import type { DirectoryQuery } from '@/domain/models/directory';
import { DataValidationError } from '@/domain/validation/errors';

/** Fixed clock so "current by dates" rules are deterministic. */
const TODAY = new Date('2026-10-08T00:00:00Z');
const repos = createMockRepositories(devFixtureTables, () => TODAY);

const names = async (query: DirectoryQuery) =>
  (await repos.people.searchDirectory({ page: { limit: 50 }, ...query })).items.map(
    (entry) => entry.displayName,
  );

describe('directory ordering', () => {
  it('is alphabetical by last name, then first name, and nothing else', async () => {
    const all = await names({});
    expect(all).toEqual([...all].sort((a, b) => lastFirst(a).localeCompare(lastFirst(b))));
    // Same last name: ordered by first name.
    expect(all.indexOf('Luz Tala Ejemplo')).toBeLessThan(all.indexOf('Tomas Ilog Ejemplo'));
    expect(all.indexOf('Dante Bundok Gawa-Gawa')).toBeLessThan(
      all.indexOf('Ramon Bayani Gawa-Gawa'),
    );
  });

  it('returns the same order every time', async () => {
    expect(await names({})).toEqual(await names({}));
  });

  it('keeps alphabetical order when a search or filters are applied', async () => {
    const result = await names({ query: 'a', filters: {} }); // too short: ignored
    expect(result).toEqual(await names({}));
    const gawa = await names({ query: 'gawa' });
    expect(gawa).toEqual(['Dante Bundok Gawa-Gawa', 'Ramon Bayani Gawa-Gawa']);
  });
});

function lastFirst(displayName: string): string {
  // "First Middle Last [Suffix]" -> "last first" for comparison in the tests
  const parts = displayName.replace(/ Jr\.$/, '').split(' ');
  return `${parts[parts.length - 1]} ${parts[0]}`.toLowerCase();
}

describe('directory search', () => {
  it('matches names case-insensitively and ignores surrounding or repeated spaces', async () => {
    expect(await names({ query: '  MAKAB  ' })).toEqual(['Maria Luntian Makabayan']);
    expect(await names({ query: 'maria   luntian' })).toEqual(['Maria Luntian Makabayan']);
  });

  it('requires every word to match, in any name field', async () => {
    expect(await names({ query: 'dela cruz juan' })).toEqual(['Juan Dela Cruz']);
    expect(await names({ query: 'juan makabayan' })).toEqual([]);
    expect(await names({ query: 'jr' })).toEqual(['Pedro Santos Jr.']);
  });

  it('ignores queries shorter than two characters', async () => {
    expect((await repos.people.searchDirectory({ query: 'm' })).total).toBe(10);
    expect((await repos.people.searchDirectory({ query: ' ' })).total).toBe(10);
  });

  it('returns an empty page, not an error, when nothing matches', async () => {
    const page = await repos.people.searchDirectory({ query: 'zzzzzz' });
    expect(page).toEqual({ items: [], total: 0, nextOffset: undefined });
  });
});

describe('directory filters', () => {
  it('filters by election', async () => {
    expect(await names({ filters: { electionId: 'election-halimbawa-2027' } })).toEqual([
      'Juan Dela Cruz',
      'Dante Bundok Gawa-Gawa',
      'Maria Luntian Makabayan',
      'Pedro Santos Jr.',
    ]);
  });

  it('filters by office', async () => {
    expect(await names({ filters: { officeId: 'office-senator' } })).toEqual([
      'Carlo Dagat Haka-haka',
      'Elena Bukid Kathang-Isip',
      'Ana Liwanag Pangarap',
    ]);
  });

  it.each([
    ['NATIONAL', ['Carlo Dagat Haka-haka', 'Elena Bukid Kathang-Isip', 'Ana Liwanag Pangarap']],
    ['PROVINCIAL', ['Ramon Bayani Gawa-Gawa']],
    ['DISTRICT', ['Luz Tala Ejemplo']],
    ['MUNICIPAL', ['Tomas Ilog Ejemplo']],
  ] as const)('filters by office level %s', async (officeLevel, expected) => {
    expect(await names({ filters: { officeLevel } })).toEqual(expected);
  });

  it('filters by participation status without collapsing aspirant states', async () => {
    expect(await names({ filters: { participationStatus: 'POTENTIAL_ASPIRANT' } })).toEqual([
      'Elena Bukid Kathang-Isip',
      'Pedro Santos Jr.',
    ]);
    expect(await names({ filters: { participationStatus: 'PUBLICLY_DECLARED_ASPIRANT' } })).toEqual(
      ['Ana Liwanag Pangarap'],
    );
    expect(await names({ filters: { participationStatus: 'OFFICIAL_CANDIDATE' } })).toEqual([
      'Juan Dela Cruz',
    ]);
    expect(await names({ filters: { participationStatus: 'WITHDRAWN' } })).toEqual([
      'Carlo Dagat Haka-haka',
    ]);
    expect(await names({ filters: { participationStatus: 'DISQUALIFIED' } })).toEqual([
      'Dante Bundok Gawa-Gawa',
    ]);
  });

  it('filters by political organization using any dated affiliation record', async () => {
    expect(await names({ filters: { organizationId: 'org-partido-halimbawa' } })).toEqual([
      'Luz Tala Ejemplo',
      'Dante Bundok Gawa-Gawa',
      'Ramon Bayani Gawa-Gawa', // earlier, ended membership still counts as a record
      'Maria Luntian Makabayan',
    ]);
  });

  it('supports jurisdiction ids even though the UI does not expose them yet', async () => {
    expect(
      await names({ filters: { jurisdictionId: 'jurisdiction-halimbawa-district-1' } }),
    ).toEqual(['Luz Tala Ejemplo']);
  });

  it('combines filters with AND', async () => {
    expect(
      await names({
        filters: {
          electionId: 'election-pambansa-2028',
          participationStatus: 'POTENTIAL_ASPIRANT',
        },
      }),
    ).toEqual(['Elena Bukid Kathang-Isip']);
    expect(
      await names({ filters: { officeLevel: 'NATIONAL', organizationId: 'org-partido-pag-asa' } }),
    ).toEqual(['Elena Bukid Kathang-Isip', 'Ana Liwanag Pangarap']);
  });

  it('requires ONE participation to satisfy all participation filters', async () => {
    // Ramon was ELECTED (2022, provincial) but never a potential aspirant for a provincial office.
    expect(
      await names({
        filters: { officeLevel: 'PROVINCIAL', participationStatus: 'POTENTIAL_ASPIRANT' },
      }),
    ).toEqual([]);
    // Pedro is a potential aspirant (city) and Ramon was a city mayor (term, not participation).
    expect(
      await names({ filters: { officeLevel: 'CITY', participationStatus: 'POTENTIAL_ASPIRANT' } }),
    ).toEqual(['Pedro Santos Jr.']);
  });

  it('combines search and filters', async () => {
    expect(
      await names({ query: 'gawa', filters: { participationStatus: 'DISQUALIFIED' } }),
    ).toEqual(['Dante Bundok Gawa-Gawa']);
    expect(await names({ query: 'makabayan', filters: { officeLevel: 'NATIONAL' } })).toEqual([]);
  });

  it('treats empty filter values as no filter', async () => {
    expect(
      (await repos.people.searchDirectory({ filters: { electionId: '', officeId: undefined } }))
        .total,
    ).toBe(10);
  });
});

describe('directory pagination', () => {
  it('pages through every row exactly once, in order', async () => {
    const seen: string[] = [];
    let offset: number | undefined = 0;
    let pages = 0;
    while (offset !== undefined) {
      const page = await repos.people.searchDirectory({ page: { limit: 4, offset } });
      expect(page.total).toBe(10);
      seen.push(...page.items.map((entry) => entry.id));
      offset = page.nextOffset;
      pages += 1;
    }
    expect(pages).toBe(3);
    expect(new Set(seen).size).toBe(10);
    expect(seen).toEqual(
      (await repos.people.searchDirectory({ page: { limit: 50 } })).items.map((e) => e.id),
    );
  });

  it('reports no next page on the last page and for offsets past the end', async () => {
    expect(
      (await repos.people.searchDirectory({ page: { limit: 4, offset: 8 } })).nextOffset,
    ).toBeUndefined();
    const past = await repos.people.searchDirectory({ page: { limit: 4, offset: 100 } });
    expect(past.items).toEqual([]);
    expect(past.total).toBe(10);
    expect(past.nextOffset).toBeUndefined();
  });

  it('clamps unreasonable page sizes', async () => {
    expect((await repos.people.searchDirectory({ page: { limit: 0 } })).items).toHaveLength(1);
    expect((await repos.people.searchDirectory({ page: { limit: 5000 } })).items).toHaveLength(10);
    expect(
      (await repos.people.searchDirectory({ page: { offset: -5, limit: 2 } })).items,
    ).toHaveLength(2);
  });
});

describe('directory cards', () => {
  const entry = async (query: string) => (await repos.people.searchDirectory({ query })).items[0]!;

  it('carries election and office context, newest election first', async () => {
    const ramon = await entry('ramon');
    expect(ramon.participations).toEqual([
      expect.objectContaining({
        officeName: 'Governor, Province of Kathang-Isip (fictional)',
        status: 'ELECTED',
      }),
    ]);
  });

  it('keeps aspirant states distinct on the card', async () => {
    expect((await entry('elena')).participations[0]?.status).toBe('POTENTIAL_ASPIRANT');
    expect((await entry('ana pangarap')).participations[0]?.status).toBe(
      'PUBLICLY_DECLARED_ASPIRANT',
    );
  });

  it('shows an affiliation only when it is current by its dates and has standing evidence', async () => {
    expect((await entry('luz')).affiliation).toEqual({
      organizationName: 'Partido Halimbawa (fictional)',
      affiliationType: 'CANDIDATE',
      startDate: '2026-10-01',
    });
    expect((await entry('ramon')).affiliation?.organizationName).toBe(
      'Alyansang Bagong-Umaga (fictional)',
    ); // the earlier, ended one is not current
    expect((await entry('elena')).affiliation).toBeUndefined(); // record ended 2026-06-30
    expect((await entry('tomas')).affiliation).toBeUndefined(); // only attested by an OUTDATED claim
    expect((await entry('juan')).affiliation).toBeUndefined(); // OUTDATED claim
    expect((await entry('pedro')).affiliation).toBeUndefined(); // no affiliation record
  });

  it('judges "current" by the injected date, never by guessing', async () => {
    const later = createMockRepositories(devFixtureTables, () => new Date('2026-06-15T00:00:00Z'));
    const elena = (await later.people.searchDirectory({ query: 'elena' })).items[0]!;
    expect(elena.affiliation?.organizationName).toBe('Partido Pag-asa ng Bayan (fictional)');
    const luz = (await later.people.searchDirectory({ query: 'luz' })).items[0]!;
    expect(luz.affiliation).toBeUndefined(); // her record starts 2026-10-01, in the future then
  });

  it('is lightweight: no claims, sources or counts', async () => {
    expect(Object.keys(await entry('maria')).sort()).toEqual(
      ['affiliation', 'displayName', 'id', 'participations', 'photoAssetId'].sort(),
    );
  });
});

describe('directory filter options', () => {
  it('lists reference data for the filter UI, newest election first', async () => {
    const options = await repos.people.getDirectoryFilterOptions();
    expect(options.elections.map((e) => e.id)).toEqual([
      'election-pambansa-2028',
      'election-halimbawa-2027',
      'election-local-2022',
    ]);
    expect(options.offices.map((o) => o.level).sort()).toEqual(
      expect.arrayContaining([
        'NATIONAL',
        'PROVINCIAL',
        'CITY',
        'MUNICIPAL',
        'DISTRICT',
        'BARANGAY',
      ]),
    );
    expect(options.organizations.map((o) => o.name)).toContain(
      'Alyansang Bagong-Umaga (fictional)',
    );
  });
});

describe('directory validation', () => {
  it('rejects invalid backend data rather than showing it', async () => {
    const broken = createMockRepositories({
      ...devFixtureTables,
      election_participations: [
        {
          id: 'ep-bad',
          person_id: 'person-juan-dela-cruz',
          election_id: 'election-halimbawa-2027',
          office_id: 'office-halimbawa-mayor',
          status: 'FRONTRUNNER',
          effective_from: '2026-09-15',
        },
      ],
    });
    await expect(broken.people.searchDirectory({})).rejects.toBeInstanceOf(DataValidationError);
  });
});
