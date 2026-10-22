/**
 * Repository implementations over any RowSource. Every row is validated with
 * Zod and mapped to a domain model before it leaves this module.
 */
import type { DirectorySource } from '@/data/repositories/directorySource';
import { directoryPageRowSchema } from '@/data/schemas/directory';
import { MAX_PAGE_SIZE, normalizeDirectoryQuery } from '@/domain/directory';
import { isValidSlug } from '@/domain/slug';
import { isIndexableClaimStatus } from '@/domain/currentRecords';
import {
  compareElectionOffices,
  compareElections,
  compareParticipationsMostRecentFirst,
  comparePeopleByName,
  PARTICIPATION_GROUP_ORDER,
} from '@/domain/elections';
import type { ElectionOfficeSummary, ParticipantGroup } from '@/domain/models/election';
import { DataIntegrityError } from '@/domain/validation/errors';
import type { DirectoryFilterOptions } from '@/domain/models/directory';
import {
  toDirectoryEntry,
  toAffiliationRecord,
  toClaim,
  toClaimEvidence,
  toEducationRecord,
  toElection,
  toElectionOffice,
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
  electionOfficeRowSchema,
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
import type { Claim, ClaimEvidence, ElectionParticipation, Person, Source } from '@/domain/models';
import type { Attested, PersonSummary } from '@/domain/models/personProfile';
import type {
  ClaimRepository,
  CorrectionRepository,
  ElectionRepository,
  PersonRepository,
  Repositories,
  SourceRepository,
} from '@/domain/repositories';

function toSummary(person: Person): PersonSummary {
  return { id: person.id, slug: person.slug, displayName: formatPersonName(person) };
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

  const getPersonBySlug = async (slug: string) =>
    // A malformed slug cannot match anything, so it never reaches the backend.
    isValidSlug(slug)
      ? findOne(source.select('people', { eq: { slug } }), (row) =>
          toPerson(parseRow(personRowSchema, 'person', row)),
        )
      : null;

  const repository: PersonRepository = {
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
          .map(({ id, slug, name, electionDate }) => ({ id, slug, name, electionDate }))
          .sort(
            (a, b) => byCodePoint(b.electionDate, a.electionDate) || byCodePoint(a.name, b.name),
          ),
        offices: parseRows(officeRowSchema, 'office', officeRows)
          .map(toOffice)
          .map(({ id, slug, name, level, jurisdictionId }) => ({ id, slug, name, level, jurisdictionId }))
          .sort((a, b) => byCodePoint(a.name, b.name) || byCodePoint(a.id, b.id)),
        organizations: parseRows(
          politicalOrganizationRowSchema,
          'political organization',
          organizationRows,
        )
          .map(toPoliticalOrganization)
          .map(({ id, slug, name, abbreviation }) => ({ id, slug, name, abbreviation }))
          .sort((a, b) => byCodePoint(a.name, b.name) || byCodePoint(a.id, b.id)),
      };
    },

    getPersonById,
    getPersonBySlug,

    async getPersonProfileBySlug(slug: string) {
      const person = await getPersonBySlug(slug);
      return person ? repository.getPersonProfile(person.id) : null;
    },

    async listPersonSlugs() {
      const slugs: string[] = [];
      for (let offset: number | undefined = 0; offset !== undefined; ) {
        const page: Awaited<ReturnType<PersonRepository['searchDirectory']>> =
          await repository.searchDirectory({ page: { limit: MAX_PAGE_SIZE, offset } });
        slugs.push(...page.items.map((entry) => entry.slug));
        offset = page.nextOffset;
      }
      return slugs;
    },

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
  return repository;
}

export function createElectionRepository(source: RowSource): ElectionRepository {
  const parseElections = (rows: unknown[]) =>
    parseRows(electionRowSchema, 'election', rows).map(toElection);
  const parseOffices = (rows: unknown[]) => parseRows(officeRowSchema, 'office', rows).map(toOffice);
  const parseElectionOffices = (rows: unknown[]) =>
    parseRows(electionOfficeRowSchema, 'election office', rows).map(toElectionOffice);

  const findBySlug = <T>(
    table: 'elections' | 'offices',
    slug: string,
    parse: (rows: unknown[]) => T[],
  ): Promise<T | null> =>
    // A malformed slug cannot match anything, so it never reaches the backend.
    isValidSlug(slug)
      ? source.select(table, { eq: { slug } }).then((rows) => parse(rows)[0] ?? null)
      : Promise.resolve(null);

  /** Election offices of one election with their offices, in presentation order. */
  async function officesOf(electionId: string) {
    const electionOffices = parseElectionOffices(
      await source.select('election_offices', { eq: { election_id: electionId } }),
    );
    const officesById = new Map(
      parseOffices(
        await source.select('offices', {
          in: { column: 'id', values: unique(electionOffices.map((eo) => eo.officeId)) },
        }),
      ).map((office) => [office.id, office]),
    );
    // An election office whose office is not public is not shown (the database refuses to
    // publish one, so this only happens while an office is being retracted).
    return electionOffices
      .flatMap((electionOffice) => {
        const office = officesById.get(electionOffice.officeId);
        return office ? [{ electionOffice, office }] : [];
      })
      .sort(compareElectionOffices);
  }

  /** Participations for one election office, with each record's claims and evidence. */
  async function attestedParticipations(electionId: string, officeId: string) {
    const participations = parseRows(
      electionParticipationRowSchema,
      'election participation',
      await source.select('election_participations', {
        eq: { election_id: electionId, office_id: officeId },
      }),
    ).map(toElectionParticipation);
    const claims = parseRows(
      claimRowSchema,
      'claim',
      await source.select('claims', {
        eq: { subject_record_type: 'ELECTION_PARTICIPATION' },
        in: { column: 'subject_record_id', values: participations.map((p) => p.id) },
      }),
    ).map(toClaim);
    const evidence = parseRows(
      claimEvidenceRowSchema,
      'claim evidence',
      await source.select('claim_evidence', {
        in: { column: 'claim_id', values: claims.map((claim) => claim.id) },
      }),
    ).map(toClaimEvidence);
    const [peopleRows, sourceRows] = await Promise.all([
      source.select('people', {
        in: { column: 'id', values: unique(participations.map((p) => p.personId)) },
      }),
      source.select('sources', {
        in: { column: 'id', values: unique(evidence.map((e) => e.sourceId)) },
      }),
    ]);
    const sourcesById = new Map(
      parseRows(sourceRowSchema, 'source', sourceRows)
        .map(toSource)
        .map((s) => [s.id, s]),
    );
    const people = parseRows(personRowSchema, 'person', peopleRows).map(toPerson);
    return groupParticipants(participations, people, claims, evidence, sourcesById);
  }

  return {
    getElectionById(id: string) {
      return findOne(source.select('elections', { eq: { id } }), (row) =>
        toElection(parseRow(electionRowSchema, 'election', row)),
      );
    },

    getOfficeById(id: string) {
      return findOne(source.select('offices', { eq: { id } }), (row) =>
        toOffice(parseRow(officeRowSchema, 'office', row)),
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

    async listElections() {
      const [elections, electionOffices] = await Promise.all([
        source.selectAll('elections').then(parseElections),
        source.selectAll('election_offices').then(parseElectionOffices),
      ]);
      return elections
        .map((election) => ({
          election,
          officeCount: electionOffices.filter((eo) => eo.electionId === election.id).length,
        }))
        .sort((a, b) => compareElections(a.election, b.election));
    },

    async getElectionDetail(electionSlug: string) {
      const election = await findBySlug('elections', electionSlug, parseElections);
      if (!election) return null;
      const offices = await officesOf(election.id);
      const participations = parseRows(
        electionParticipationRowSchema,
        'election participation',
        await source.select('election_participations', { eq: { election_id: election.id } }),
      ).map(toElectionParticipation);
      return {
        election,
        offices: offices.map(({ electionOffice, office }) => {
          const latest = latestByPerson(participations.filter((p) => p.officeId === office.id));
          const statusCounts: ElectionOfficeSummary['statusCounts'] = {};
          for (const record of latest) {
            statusCounts[record.status] = (statusCounts[record.status] ?? 0) + 1;
          }
          return { electionOffice, office, participantCount: latest.length, statusCounts };
        }),
      };
    },

    async getElectionOfficeDetail(electionSlug: string, officeSlug: string) {
      const [election, office] = await Promise.all([
        findBySlug('elections', electionSlug, parseElections),
        findBySlug('offices', officeSlug, parseOffices),
      ]);
      if (!election || !office) return null;
      const [electionOffice] = parseElectionOffices(
        await source.select('election_offices', {
          eq: { election_id: election.id, office_id: office.id },
        }),
      );
      if (!electionOffice) return null;
      const groups = await attestedParticipations(election.id, office.id);
      return {
        election,
        office,
        electionOffice,
        groups,
        participantCount: groups.reduce((total, group) => total + group.participants.length, 0),
      };
    },

    async listElectionOfficePaths() {
      const [elections, offices, electionOffices] = await Promise.all([
        source.selectAll('elections').then(parseElections),
        source.selectAll('offices').then(parseOffices),
        source.selectAll('election_offices').then(parseElectionOffices),
      ]);
      const electionsById = new Map(elections.map((e) => [e.id, e]));
      const officesById = new Map(offices.map((o) => [o.id, o]));
      return electionOffices
        .flatMap((eo) => {
          const election = electionsById.get(eo.electionId);
          const office = officesById.get(eo.officeId);
          return election && office ? [{ electionSlug: election.slug, officeSlug: office.slug }] : [];
        })
        .sort(
          (a, b) =>
            byCodePoint(a.electionSlug, b.electionSlug) || byCodePoint(a.officeSlug, b.officeSlug),
        );
    },
  };
}

/** Each person's most recent record (effective date, then id). */
function latestByPerson(participations: readonly ElectionParticipation[]): ElectionParticipation[] {
  const latest = new Map<string, ElectionParticipation>();
  for (const record of [...participations].sort(compareParticipationsMostRecentFirst)) {
    if (!latest.has(record.personId)) latest.set(record.personId, record);
  }
  return [...latest.values()];
}

/**
 * Groups participants by the exact status of their most recent record, in lifecycle order.
 * Within a group: alphabetical by name. Every record keeps its own claims and evidence.
 */
function groupParticipants(
  participations: readonly ElectionParticipation[],
  people: readonly Person[],
  claims: readonly Claim[],
  evidence: readonly ClaimEvidence[],
  sourcesById: Map<string, Source>,
): ParticipantGroup[] {
  const peopleById = new Map(people.map((person) => [person.id, person]));
  const attest = (record: ElectionParticipation): Attested<ElectionParticipation> => ({
    record,
    claims: claims
      .filter(
        (claim) =>
          claim.subjectRecord?.type === 'ELECTION_PARTICIPATION' &&
          claim.subjectRecord.id === record.id,
      )
      .map((claim) => ({ claim, evidence: buildEvidenceItems(claim.id, evidence, sourcesById) })),
  });

  const byPerson = new Map<string, ElectionParticipation[]>();
  for (const record of [...participations].sort(compareParticipationsMostRecentFirst)) {
    byPerson.set(record.personId, [...(byPerson.get(record.personId) ?? []), record]);
  }
  const participants = [...byPerson.entries()]
    .map(([personId, records]) => {
      const person = peopleById.get(personId);
      if (!person) {
        throw new DataIntegrityError(`election participation ${records[0]?.id} references missing person "${personId}"`);
      }
      return { person, records };
    })
    .sort((a, b) => comparePeopleByName(a.person, b.person));

  return PARTICIPATION_GROUP_ORDER.map((status) => ({
    status,
    participants: participants
      .filter(({ records }) => records[0]?.status === status)
      .map(({ person, records }) => ({ person: toSummary(person), records: records.map(attest) })),
  })).filter((group) => group.participants.length > 0);
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
    async listIndexableClaimIds() {
      return parseRows(claimRowSchema, 'claim', await source.selectAll('claims'))
        .map(toClaim)
        .filter((claim) => isIndexableClaimStatus(claim.verificationStatus))
        .map((claim) => claim.id)
        .sort();
    },

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

/** Used when no correction backend is wired in: submitting fails loudly instead of pretending to succeed. */
const correctionsUnavailable: CorrectionRepository = {
  submit: () => Promise.reject(new Error('Corrections are not configured for this data source.')),
};

export function createRepositories(
  source: RowSource,
  directory: DirectorySource,
  corrections: CorrectionRepository = correctionsUnavailable,
): Repositories {
  return {
    corrections,
    people: createPersonRepository(source, directory),
    elections: createElectionRepository(source),
    sources: createSourceRepository(source),
    claims: createClaimRepository(source),
  };
}
