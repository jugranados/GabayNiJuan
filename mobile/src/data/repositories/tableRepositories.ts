/**
 * Repository implementations over any RowSource. Every row is validated with
 * Zod and mapped to a domain model before it leaves this module.
 */
import type { DirectorySource } from '@/data/repositories/directorySource';
import { directoryPageRowSchema } from '@/data/schemas/directory';
import { normalizeDirectoryQuery } from '@/domain/directory';
import type { DirectoryFilterOptions } from '@/domain/models/directory';
import {
  toDirectoryEntry,
  toAffiliationRecord,
  toClaim,
  toClaimEvidence,
  toEducationRecord,
  toElection,
  toElectionParticipation,
  toOffice,
  toOfficeTerm,
  toPerson,
  toPolicyPositionRecord,
  toPoliticalOrganization,
  toSource,
} from '@/data/mappers/rowMappers';
import { assemblePersonProfile, buildEvidenceItems } from '@/data/mappers/profileAssembler';
import { parseRow, parseRows } from '@/data/schemas/parse';
import {
  affiliationRecordRowSchema,
  claimEvidenceRowSchema,
  claimRowSchema,
  educationRecordRowSchema,
  electionParticipationRowSchema,
  electionRowSchema,
  officeRowSchema,
  officeTermRowSchema,
  personRowSchema,
  policyPositionRecordRowSchema,
  politicalOrganizationRowSchema,
  sourceRowSchema,
} from '@/data/schemas/rows';
import type { RowSource } from '@/data/repositories/rowSource';
import { formatPersonName } from '@/domain/models/person';
import type { Person } from '@/domain/models';
import type { PersonSummary } from '@/domain/models/personProfile';
import type {
  ClaimRepository,
  ElectionRepository,
  PersonRepository,
  Repositories,
  SourceRepository,
} from '@/domain/repositories';

function toSummary(person: Person): PersonSummary {
  return { id: person.id, displayName: formatPersonName(person) };
}

function unique(values: readonly string[]): string[] {
  return [...new Set(values)];
}

async function findOne<T>(rows: Promise<unknown[]>, parse: (row: unknown) => T): Promise<T | null> {
  const [first] = await rows;
  return first === undefined ? null : parse(first);
}

const byCodePoint = (a: string, b: string) => (a < b ? -1 : a > b ? 1 : 0);

export function createPersonRepository(
  source: RowSource,
  directory: DirectorySource,
): PersonRepository {
  const getPersonById = (id: string) =>
    findOne(source.select('people', { eq: { id } }), (row) =>
      toPerson(parseRow(personRowSchema, 'person', row)),
    );

  return {
    async searchDirectory(input) {
      const params = normalizeDirectoryQuery(input);
      const page = parseRow(
        directoryPageRowSchema,
        'directory page',
        await directory.search(params),
      );
      const items = page.items.map(toDirectoryEntry);
      const end = params.offset + items.length;
      return {
        items,
        total: page.total,
        nextOffset: items.length > 0 && end < page.total ? end : undefined,
      };
    },

    async getDirectoryFilterOptions(): Promise<DirectoryFilterOptions> {
      const [electionRows, officeRows, organizationRows] = await Promise.all([
        source.select('elections'),
        source.select('offices'),
        source.select('political_organizations'),
      ]);
      return {
        elections: parseRows(electionRowSchema, 'election', electionRows)
          .map(toElection)
          .map(({ id, name, electionDate }) => ({ id, name, electionDate }))
          .sort(
            (a, b) => byCodePoint(b.electionDate, a.electionDate) || byCodePoint(a.name, b.name),
          ),
        offices: parseRows(officeRowSchema, 'office', officeRows)
          .map(toOffice)
          .map(({ id, name, level, jurisdictionId }) => ({ id, name, level, jurisdictionId }))
          .sort((a, b) => byCodePoint(a.name, b.name) || byCodePoint(a.id, b.id)),
        organizations: parseRows(
          politicalOrganizationRowSchema,
          'political organization',
          organizationRows,
        )
          .map(toPoliticalOrganization)
          .map(({ id, name, abbreviation }) => ({ id, name, abbreviation }))
          .sort((a, b) => byCodePoint(a.name, b.name) || byCodePoint(a.id, b.id)),
      };
    },

    getPersonById,

    async getPersonProfile(id: string) {
      const person = await getPersonById(id);
      if (!person) {
        return null;
      }
      const byPerson = { eq: { person_id: id } };

      const [participationRows, termRows, affiliationRows, educationRows, policyRows, claimRows] =
        await Promise.all([
          source.select('election_participations', byPerson),
          source.select('office_terms', byPerson),
          source.select('affiliation_records', byPerson),
          source.select('education_records', byPerson),
          source.select('policy_position_records', byPerson),
          source.select('claims', { eq: { subject_person_id: id } }),
        ]);

      const electionParticipations = parseRows(
        electionParticipationRowSchema,
        'election participation',
        participationRows,
      ).map(toElectionParticipation);
      const officeTerms = parseRows(officeTermRowSchema, 'office term', termRows).map(toOfficeTerm);
      const affiliations = parseRows(
        affiliationRecordRowSchema,
        'affiliation',
        affiliationRows,
      ).map(toAffiliationRecord);
      const education = parseRows(educationRecordRowSchema, 'education', educationRows).map(
        toEducationRecord,
      );
      const policyPositions = parseRows(
        policyPositionRecordRowSchema,
        'policy position',
        policyRows,
      ).map(toPolicyPositionRecord);
      const claims = parseRows(claimRowSchema, 'claim', claimRows).map(toClaim);

      const evidenceRows = await source.select('claim_evidence', {
        in: { column: 'claim_id', values: claims.map((claim) => claim.id) },
      });
      const evidence = parseRows(claimEvidenceRowSchema, 'claim evidence', evidenceRows).map(
        toClaimEvidence,
      );

      const officeIds = unique([
        ...electionParticipations.map((p) => p.officeId),
        ...officeTerms.map((t) => t.officeId),
      ]);
      const [electionRows, officeRows, organizationRows, sourceRows] = await Promise.all([
        source.select('elections', {
          in: { column: 'id', values: unique(electionParticipations.map((p) => p.electionId)) },
        }),
        source.select('offices', { in: { column: 'id', values: officeIds } }),
        source.select('political_organizations', {
          in: { column: 'id', values: unique(affiliations.map((a) => a.organizationId)) },
        }),
        source.select('sources', {
          in: { column: 'id', values: unique(evidence.map((e) => e.sourceId)) },
        }),
      ]);

      return assemblePersonProfile({
        person,
        electionParticipations,
        officeTerms,
        affiliations,
        education,
        policyPositions,
        claims,
        evidence,
        elections: parseRows(electionRowSchema, 'election', electionRows).map(toElection),
        offices: parseRows(officeRowSchema, 'office', officeRows).map(toOffice),
        organizations: parseRows(
          politicalOrganizationRowSchema,
          'political organization',
          organizationRows,
        ).map(toPoliticalOrganization),
        sources: parseRows(sourceRowSchema, 'source', sourceRows).map(toSource),
      });
    },
  };
}

export function createElectionRepository(source: RowSource): ElectionRepository {
  return {
    getElectionById(id: string) {
      return findOne(source.select('elections', { eq: { id } }), (row) =>
        toElection(parseRow(electionRowSchema, 'election', row)),
      );
    },

    async getElectionParticipation(personId: string) {
      const rows = await source.select('election_participations', {
        eq: { person_id: personId },
      });
      return parseRows(electionParticipationRowSchema, 'election participation', rows).map(
        toElectionParticipation,
      );
    },
  };
}

export function createSourceRepository(source: RowSource): SourceRepository {
  return {
    getSourceById(id: string) {
      return findOne(source.select('sources', { eq: { id } }), (row) =>
        toSource(parseRow(sourceRowSchema, 'source', row)),
      );
    },

    async getSourcesForClaim(claimId: string) {
      const evidenceRows = await source.select('claim_evidence', { eq: { claim_id: claimId } });
      const evidence = parseRows(claimEvidenceRowSchema, 'claim evidence', evidenceRows).map(
        toClaimEvidence,
      );
      const sourceRows = await source.select('sources', {
        in: { column: 'id', values: unique(evidence.map((e) => e.sourceId)) },
      });
      const sourcesById = new Map(
        parseRows(sourceRowSchema, 'source', sourceRows)
          .map(toSource)
          .map((s) => [s.id, s]),
      );
      return buildEvidenceItems(claimId, evidence, sourcesById);
    },
  };
}

export function createClaimRepository(source: RowSource): ClaimRepository {
  return {
    async getClaimDetail(claimId: string) {
      const claim = await findOne(source.select('claims', { eq: { id: claimId } }), (row) =>
        toClaim(parseRow(claimRowSchema, 'claim', row)),
      );
      if (!claim) {
        return null;
      }

      const evidenceRows = await source.select('claim_evidence', { eq: { claim_id: claimId } });
      const evidenceLinks = parseRows(claimEvidenceRowSchema, 'claim evidence', evidenceRows).map(
        toClaimEvidence,
      );
      const [sourceRows, subject] = await Promise.all([
        source.select('sources', {
          in: { column: 'id', values: unique(evidenceLinks.map((e) => e.sourceId)) },
        }),
        claim.subjectPersonId
          ? findOne(source.select('people', { eq: { id: claim.subjectPersonId } }), (row) =>
              toPerson(parseRow(personRowSchema, 'person', row)),
            )
          : Promise.resolve(null),
      ]);
      const sourcesById = new Map(
        parseRows(sourceRowSchema, 'source', sourceRows)
          .map(toSource)
          .map((s) => [s.id, s]),
      );

      return {
        claim,
        evidence: buildEvidenceItems(claim.id, evidenceLinks, sourcesById),
        subject: subject ? toSummary(subject) : undefined,
      };
    },
  };
}

export function createRepositories(source: RowSource, directory: DirectorySource): Repositories {
  return {
    people: createPersonRepository(source, directory),
    elections: createElectionRepository(source),
    sources: createSourceRepository(source),
    claims: createClaimRepository(source),
  };
}
