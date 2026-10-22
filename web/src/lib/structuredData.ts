/**
 * schema.org structured data, only where the mapping is exact.
 *
 * - Election pages: `Event` with the election's name, date, URL and country (elections store
 *   `country_code = 'PH'`). No organizer, performer, offers or status are emitted: the data
 *   does not record them in schema.org's sense.
 * - Election and office pages: `BreadcrumbList` (election → office), which is navigation only.
 * - Not emitted: `Person` (it would restate claims without their verification status, see
 *   docs/WEB_MIGRATION.md) and `GovernmentOrganization` (an office is a position, not an
 *   organization; schema.org has no exact type for an elected office).
 */
import type { Election } from '@/domain/models';

type JsonLd = Record<string, unknown>;

export function electionEventJsonLd(election: Election, url: string): JsonLd {
  return {
    '@context': 'https://schema.org',
    '@type': 'Event',
    name: election.name,
    startDate: election.electionDate,
    url,
    location: { '@type': 'Country', name: 'Philippines' },
  };
}

export function breadcrumbJsonLd(items: readonly { name: string; url: string }[]): JsonLd {
  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: items.map((item, index) => ({
      '@type': 'ListItem',
      position: index + 1,
      name: item.name,
      item: item.url,
    })),
  };
}

/** Serialises for a <script type="application/ld+json">, so no value can close the tag. */
export function serializeJsonLd(data: JsonLd | JsonLd[]): string {
  return JSON.stringify(data).replace(/</g, '\\u003c');
}
