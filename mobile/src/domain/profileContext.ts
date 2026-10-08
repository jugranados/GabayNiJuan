/**
 * Headline facts for a profile, derived ONLY from dated records and the
 * evidence attached to them. Nothing is guessed: a record that cannot be shown
 * to be current, or has no standing evidence, is simply not headlined (it still
 * appears, with its verification badge, in its own section).
 */
import { isCurrentOn, isHeadlineEligible } from '@/domain/currentRecords';
import type { IsoDate } from '@/domain/models';
import type {
  AffiliationDetail,
  Attested,
  ElectionParticipationDetail,
  OfficeTermDetail,
  PersonProfile,
} from '@/domain/models/personProfile';

export type ProfileContext = {
  /** Participations in elections that have not completed, newest election first. */
  electionContext: Attested<ElectionParticipationDetail>[];
  currentOffices: Attested<OfficeTermDetail>[];
  currentAffiliations: Attested<AffiliationDetail>[];
};

const hasStandingEvidence = (claims: Attested<unknown>['claims']): boolean =>
  isHeadlineEligible(claims.map(({ claim }) => claim.verificationStatus));

export function deriveProfileContext(profile: PersonProfile, today: IsoDate): ProfileContext {
  const electionContext = profile.electionParticipations
    .filter(
      ({ record, claims }) =>
        (record.election.status === 'UPCOMING' || record.election.status === 'ONGOING') &&
        (record.participation.effectiveTo === undefined ||
          record.participation.effectiveTo >= today) &&
        hasStandingEvidence(claims),
    )
    .sort(
      (a, b) =>
        (a.record.election.electionDate < b.record.election.electionDate ? 1 : -1) ||
        a.record.participation.id.localeCompare(b.record.participation.id),
    );

  const currentOffices = profile.officeTerms.filter(
    ({ record, claims }) =>
      isCurrentOn(today, record.term.startDate, record.term.endDate) && hasStandingEvidence(claims),
  );

  const currentAffiliations = profile.affiliations.filter(
    ({ record, claims }) =>
      isCurrentOn(today, record.affiliation.startDate, record.affiliation.endDate) &&
      hasStandingEvidence(claims),
  );

  return { electionContext, currentOffices, currentAffiliations };
}
