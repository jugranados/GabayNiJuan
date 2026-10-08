/**
 * Repository contracts for the first MVP features. Implementations live in
 * src/data/repositories and must return validated domain models only.
 *
 * Every method rejects with DataValidationError / DataIntegrityError when
 * backend data is invalid, rather than returning partial or coerced data.
 */
import type { Election, ElectionParticipation, Person, Source } from '@/domain/models';
import type {
  ClaimDetail,
  EvidenceItem,
  PersonProfile,
  PersonSummary,
} from '@/domain/models/personProfile';

export interface PersonRepository {
  getPeople(): Promise<PersonSummary[]>;
  getPersonById(id: string): Promise<Person | null>;
  searchPeople(query: string): Promise<PersonSummary[]>;
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

export type Repositories = {
  people: PersonRepository;
  elections: ElectionRepository;
  sources: SourceRepository;
  claims: ClaimRepository;
};
