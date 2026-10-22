import { devFixtureTables } from '@/data/fixtures/devFixtures';
import { createMockRepositories } from '@/data/repositories/mockRepositories';
import { personRowSchema } from '@/data/schemas/rows';
import { parseRows } from '@/data/schemas/parse';
import { isUuid, isValidSlug, personSlugBase, slugify } from '@/domain/slug';

const repos = createMockRepositories();
const people = parseRows(personRowSchema, 'person', devFixtureTables.people ?? []);

describe('slug rule', () => {
  it('produces lowercase, URL-safe, hyphen-separated text', () => {
    expect(slugify('  Juan   Dela Cruz ')).toBe('juan-dela-cruz');
    expect(slugify('Peña-Niño, Jr.')).toBe('pena-nino-jr');
    expect(slugify('***')).toBe('');
  });

  it('builds a person slug from first name, last name and suffix only', () => {
    expect(personSlugBase({ firstName: 'Pedro', lastName: 'Santos', suffix: 'Jr.' })).toBe(
      'pedro-santos-jr',
    );
    expect(personSlugBase({ firstName: '***', lastName: '---' })).toBe('person');
  });

  it('rejects anything that is not a well-formed slug', () => {
    expect(isValidSlug('juan-dela-cruz')).toBe(true);
    for (const bad of ['Juan', 'juan--cruz', '-juan', 'juan-', 'juan cruz', '', 'a/b', "x'--"]) {
      expect(isValidSlug(bad)).toBe(false);
    }
    expect(isUuid('b199c7a8-0b7b-6503-6c07-698bc72d87f3')).toBe(true);
    expect(isUuid('juan-dela-cruz')).toBe(false);
  });
});

describe('fixture slugs', () => {
  it('are unique, valid and exactly what the database rule generates', () => {
    const slugs = people.map((p) => p.slug);
    expect(new Set(slugs).size).toBe(slugs.length);
    for (const person of people) {
      expect(isValidSlug(person.slug)).toBe(true);
      expect(person.slug).toBe(
        personSlugBase({
          firstName: person.first_name,
          lastName: person.last_name,
          suffix: person.suffix,
        }),
      );
    }
  });
});

describe('slug lookup', () => {
  it('finds a profile by slug, identical to the lookup by id', async () => {
    const bySlug = await repos.people.getPersonProfileBySlug('juan-dela-cruz');
    expect(bySlug?.person.id).toBe('person-juan-dela-cruz');
    expect(bySlug).toEqual(await repos.people.getPersonProfile('person-juan-dela-cruz'));
  });

  it('returns null for an unknown or malformed slug', async () => {
    expect(await repos.people.getPersonProfileBySlug('nobody-here')).toBeNull();
    expect(await repos.people.getPersonProfileBySlug('Juan Dela Cruz')).toBeNull();
    expect(await repos.people.getPersonBySlug('../admin')).toBeNull();
  });

  it('carries the slug on directory cards and claim subjects', async () => {
    const page = await repos.people.searchDirectory({ query: 'dela cruz' });
    expect(page.items.map((entry) => entry.slug)).toEqual(['juan-dela-cruz']);
    const profile = await repos.people.getPersonProfileBySlug('juan-dela-cruz');
    const claimId = profile?.electionParticipations[0]?.claims[0]?.claim.id;
    expect(claimId).toBeDefined();
    const detail = await repos.claims.getClaimDetail(claimId as string);
    expect(detail?.subject).toMatchObject({ slug: 'juan-dela-cruz', displayName: 'Juan Dela Cruz' });
  });

  it('lists every slug in directory order, across pages', async () => {
    const slugs = await repos.people.listPersonSlugs();
    const page = await repos.people.searchDirectory({ page: { limit: 50 } });
    expect(slugs).toEqual(page.items.map((entry) => entry.slug));
    expect(slugs).toHaveLength(10);
  });
});
