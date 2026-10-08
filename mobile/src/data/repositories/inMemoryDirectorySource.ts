/**
 * Directory query over fixture tables. Mirrors supabase/migrations/*_directory_search.sql
 * rule for rule, so the mock backend behaves like the real one:
 *
 *  - name search: every whitespace-separated token must appear (case-insensitive)
 *    somewhere in "first middle last suffix preferred"
 *  - participation filters (election, office, level, status, jurisdiction) must
 *    all be satisfied by ONE participation; organization filter matches any
 *    affiliation record
 *  - order: lowercase last name, lowercase first name, id, by code point
 *  - card context: participations newest election first; one affiliation, only
 *    if current by its dates AND attested by a claim that is not merely
 *    UNVERIFIED/DISPUTED/OUTDATED
 */
import type { FixtureTables } from '@/data/repositories/inMemoryRowSource';
import type { DirectorySource } from '@/data/repositories/directorySource';
import { parseRows } from '@/data/schemas/parse';
import {
  affiliationRecordRowSchema,
  claimRowSchema,
  electionParticipationRowSchema,
  electionRowSchema,
  officeRowSchema,
  personRowSchema,
  politicalOrganizationRowSchema,
} from '@/data/schemas/rows';
import { HEADLINE_ELIGIBLE_STATUSES, isCurrentOn, toIsoDate } from '@/domain/currentRecords';

const byCodePoint = (a: string, b: string) => (a < b ? -1 : a > b ? 1 : 0);

export function createInMemoryDirectorySource(
  tables: FixtureTables,
  now: () => Date = () => new Date(),
): DirectorySource {
  return {
    async search(params) {
      const people = parseRows(personRowSchema, 'person', tables.people ?? []);
      const participations = parseRows(
        electionParticipationRowSchema,
        'election participation',
        tables.election_participations ?? [],
      );
      const elections = new Map(
        parseRows(electionRowSchema, 'election', tables.elections ?? []).map((e) => [e.id, e]),
      );
      const offices = new Map(
        parseRows(officeRowSchema, 'office', tables.offices ?? []).map((o) => [o.id, o]),
      );
      const organizations = new Map(
        parseRows(
          politicalOrganizationRowSchema,
          'political organization',
          tables.political_organizations ?? [],
        ).map((o) => [o.id, o]),
      );
      const affiliations = parseRows(
        affiliationRecordRowSchema,
        'affiliation',
        tables.affiliation_records ?? [],
      );
      const claims = parseRows(claimRowSchema, 'claim', tables.claims ?? []);
      const today = toIsoDate(now());
      const { query, filters } = params;

      const tokens = query ? query.toLowerCase().split(' ') : [];
      const hasParticipationFilter = [
        filters.electionId,
        filters.officeId,
        filters.officeLevel,
        filters.participationStatus,
        filters.jurisdictionId,
      ].some((value) => value !== undefined);

      const matched = people.filter((person) => {
        const nameText = [
          person.first_name,
          person.middle_name,
          person.last_name,
          person.suffix,
          person.preferred_name,
        ]
          .filter((part): part is string => Boolean(part))
          .join(' ')
          .toLowerCase();
        if (!tokens.every((token) => nameText.includes(token))) return false;

        if (hasParticipationFilter) {
          const satisfied = participations.some((ep) => {
            if (ep.person_id !== person.id) return false;
            const office = offices.get(ep.office_id);
            if (!office) return false;
            return (
              (filters.electionId === undefined || ep.election_id === filters.electionId) &&
              (filters.officeId === undefined || ep.office_id === filters.officeId) &&
              (filters.participationStatus === undefined ||
                ep.status === filters.participationStatus) &&
              (filters.officeLevel === undefined || office.level === filters.officeLevel) &&
              (filters.jurisdictionId === undefined ||
                office.jurisdiction_id === filters.jurisdictionId)
            );
          });
          if (!satisfied) return false;
        }

        if (filters.organizationId !== undefined) {
          const hasRecord = affiliations.some(
            (a) => a.person_id === person.id && a.organization_id === filters.organizationId,
          );
          if (!hasRecord) return false;
        }
        return true;
      });

      const sortKey = (p: (typeof people)[number]) =>
        [p.last_name.toLowerCase(), p.first_name.toLowerCase(), p.id] as const;
      matched.sort((a, b) => {
        const [al, af, ai] = sortKey(a);
        const [bl, bf, bi] = sortKey(b);
        return byCodePoint(al, bl) || byCodePoint(af, bf) || byCodePoint(ai, bi);
      });

      const items = matched.slice(params.offset, params.offset + params.limit).map((person) => {
        const personParticipations = participations
          .filter((ep) => ep.person_id === person.id)
          .flatMap((ep) => {
            const office = offices.get(ep.office_id);
            const election = elections.get(ep.election_id);
            return office && election ? [{ ep, office, election }] : [];
          })
          .sort(
            (a, b) =>
              byCodePoint(b.election.election_date, a.election.election_date) ||
              byCodePoint(a.office.name, b.office.name) ||
              byCodePoint(a.ep.id, b.ep.id),
          )
          .map(({ ep, office, election }) => ({
            office_name: office.name,
            election_name: election.name,
            election_date: election.election_date,
            status: ep.status,
            effective_from: ep.effective_from,
          }));

        const currentAffiliation = affiliations
          .filter((a) => a.person_id === person.id)
          .filter((a) => isCurrentOn(today, a.start_date ?? undefined, a.end_date ?? undefined))
          .filter((a) =>
            claims.some(
              (c) =>
                c.subject_record_type === 'AFFILIATION' &&
                c.subject_record_id === a.id &&
                HEADLINE_ELIGIBLE_STATUSES.includes(c.verification_status),
            ),
          )
          .flatMap((a) => {
            const organization = organizations.get(a.organization_id);
            return organization ? [{ a, organization }] : [];
          })
          .sort(
            (x, y) =>
              byCodePoint(y.a.start_date ?? '', x.a.start_date ?? '') ||
              byCodePoint(x.organization.name, y.organization.name) ||
              byCodePoint(x.a.id, y.a.id),
          )[0];

        return {
          id: person.id,
          first_name: person.first_name,
          middle_name: person.middle_name ?? null,
          last_name: person.last_name,
          suffix: person.suffix ?? null,
          preferred_name: person.preferred_name ?? null,
          photo_asset_id: person.photo_asset_id ?? null,
          participations: personParticipations,
          affiliation: currentAffiliation
            ? {
                organization_name: currentAffiliation.organization.name,
                affiliation_type: currentAffiliation.a.affiliation_type,
                start_date: currentAffiliation.a.start_date,
              }
            : null,
        };
      });

      return { total: matched.length, items };
    },
  };
}
