/**
 * Repository contracts for the first MVP features. Implementations live in
 * src/data/repositories and must return validated domain models only.
 *
 * Every method rejects with DataValidationError / DataIntegrityError when
 * backend data is invalid, rather than returning partial or coerced data.
 */
import type { Election, ElectionParticipation, Person, Source } from '@/domain/models';
import type {
  DirectoryEntry,
  DirectoryFilterOptions,
  DirectoryQuery,
  Page,
} from '@/domain/models/directory';
import type { CorrectionSubmission } from '@/domain/models/correction';
import type { ClaimDetail, EvidenceItem, PersonProfile } from '@/domain/models/personProfile';

export interface PersonRepository {
  /**
   * Browse and search. Always ordered alphabetically by name (then id), so the
   * same query returns the same order on every backend. Filters combine with
   * AND; a person matches the participation filters when ONE participation
   * satisfies all of them. Never ranks or scores.
   */
  searchDirectory(query: DirectoryQuery): Promise<Page<DirectoryEntry>>;
  /** Reference lists that populate the filter UI. */
  getDirectoryFilterOptions(): Promise<DirectoryFilterOptions>;
  getPersonById(id: string): Promise<Person | null>;
  getPersonProfile(id: string): Promise<PersonProfile | null>;
}

export interface ElectionRepository {
  getElectionById(id: string): Promise<Election | null>;
  getElectionParticipation(personId: string): Promise<ElectionParticipation[]>;
}

export interface SourceRepository {
  getSourceById(id: string): Promise<Source | null>;
  getSourcesForClaim(claimId: string): Promise<EvidenceItem[]>;
}

export interface ClaimRepository {
  /** The claim with all of its evidence (supporting and contradicting), or null if not found. */
  getClaimDetail(claimId: string): Promise<ClaimDetail | null>;
}

export interface CorrectionRepository {
  /**
   * Sends a correction request for editorial review. Write-only: voters cannot read requests
   * back, and a request never changes published data.
   */
  submit(submission: CorrectionSubmission): Promise<void>;
}

export type Repositories = {
  people: PersonRepository;
  elections: ElectionRepository;
  sources: SourceRepository;
  claims: ClaimRepository;
  corrections: CorrectionRepository;
};
