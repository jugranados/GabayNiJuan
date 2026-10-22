/**
 * Public URL slugs for people (`/politicians/<slug>`), elections and offices
 * (`/elections/<slug>/<office slug>`) and political organizations (`?organization=<slug>`).
 *
 * The database is the authority: `private.slugify` and the `people` slug trigger in
 * supabase/migrations/*_person_slugs.sql generate and freeze slugs. This file mirrors the
 * same rule so fixtures and tests agree with it. A slug is an address, never an identity:
 * relationships always use the person's id.
 */
const TRANSLITERATE_FROM = 'àáâãäåèéêëìíîïñòóôõöùúûüýÿç';
const TRANSLITERATE_TO = 'aaaaaaeeeeiiiinooooouuuuyyc';

export const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
export const SLUG_MAX_LENGTH = 120;

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function isUuid(value: string): boolean {
  return UUID_PATTERN.test(value);
}

export function isValidSlug(value: string): boolean {
  return value.length <= SLUG_MAX_LENGTH && SLUG_PATTERN.test(value);
}

/** Lowercase, ASCII, hyphen-separated. Returns '' when nothing usable remains. */
export function slugify(text: string): string {
  const lowered = [...text.toLowerCase()]
    .map((char) => {
      const index = TRANSLITERATE_FROM.indexOf(char);
      return index === -1 ? char : TRANSLITERATE_TO[index];
    })
    .join('');
  return lowered.replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
}

/** Base slug for a person: first name, last name and suffix. Collisions get `-2`, `-3`, … in the database. */
export function personSlugBase(person: {
  firstName: string;
  lastName: string;
  suffix?: string | null;
}): string {
  const slug = slugify([person.firstName, person.lastName, person.suffix].filter(Boolean).join(' '));
  return slug === '' ? 'person' : slug.slice(0, 100).replace(/-+$/, '');
}

/**
 * Base slug for an election, office or political organization: its name. Mirrors
 * private.unique_record_slug (supabase/migrations/*_election_foundation.sql); collisions get
 * `-2`, `-3`, … in the database. Editors may set a shorter slug before first publication.
 */
export function recordSlugBase(name: string, fallback: 'election' | 'office' | 'organization'): string {
  const slug = slugify(name);
  return (slug === '' ? fallback : slug).slice(0, 100).replace(/-+$/, '');
}
