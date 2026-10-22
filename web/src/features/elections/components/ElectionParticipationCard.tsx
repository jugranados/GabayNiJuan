import { DateText } from '@/components/ui';
import type { Attested, ElectionParticipationDetail } from '@/domain/models/personProfile';
import { PARTICIPATION_STATUS_INFO } from '@/features/elections/participationLabels';
import { EvidenceBlock } from '@/features/sources/components/EvidenceBlock';
import { formatIsoDate } from '@/lib/dates';

/**
 * One election participation: office, election, exact status, date, ballot
 * number (only when documented) and the evidence behind it. Aspirant states
 * are written out and never shown as "Candidate".
 */
export function ElectionParticipationCard({ item }: { item: Attested<ElectionParticipationDetail> }) {
  const { participation, election, office } = item.record;
  const status = PARTICIPATION_STATUS_INFO[participation.status];
  return (
    <li className="card">
      <h3 className="text-lg font-semibold">{office.name}</h3>
      <p className="text-sm text-muted">
        {election.name} ·{' '}
        <DateText date={election.electionDate}>{formatIsoDate(election.electionDate)}</DateText>
      </p>
      <p className="mt-2">
        <span className="sr-only">Participation status: </span>
        <strong>{status.label}.</strong> <span className="text-muted">{status.description}</span>
      </p>
      <p className="text-sm text-muted">
        As of{' '}
        <DateText date={participation.effectiveFrom}>
          {formatIsoDate(participation.effectiveFrom)}
        </DateText>
        {participation.ballotNumber ? ` · Ballot number ${participation.ballotNumber}` : ''}
      </p>
      <EvidenceBlock claims={item.claims} />
    </li>
  );
}
