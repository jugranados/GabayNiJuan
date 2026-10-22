import type { Person } from '@/domain/models';

/** Display name built only from recorded name fields; nothing is inferred. */
export function formatPersonName(person: Person): string {
  const first = person.preferredName ?? person.firstName;
  return [first, person.middleName, person.lastName, person.suffix]
    .filter((part): part is string => Boolean(part))
    .join(' ');
}
