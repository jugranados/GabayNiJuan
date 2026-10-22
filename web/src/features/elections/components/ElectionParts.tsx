import Link from 'next/link';

import { DateText } from '@/components/ui';
import type { ElectionParticipationStatus } from '@/domain/enums';
import { isElectionStatusStale } from '@/domain/elections';
import type { Election } from '@/domain/models';
import type { ContestParticipant, ParticipantGroup } from '@/domain/models/election';
import {
  CANDIDACY_NOTE,
  PARTICIPATION_STATUS_INFO,
  PARTICIPATION_STATUS_ORDER,
} from '@/features/elections/participationLabels';
import { ELECTION_STATUS_LABELS } from '@/features/elections/paths';
import { politicianPath } from '@/features/politicians/paths';
import { EvidenceBlock } from '@/features/sources/components/EvidenceBlock';
import { formatIsoDate } from '@/lib/dates';
import { serializeJsonLd } from '@/lib/structuredData';

/** Date and recorded status of an election, with a note when an UPCOMING date has passed. */
export function ElectionDateStatus({ election, today }: { election: Election; today: string }) {
  return (
    <>
      <span>
        <DateText date={election.electionDate}>{formatIsoDate(election.electionDate)}</DateText>
        {' · '}
        <span className="sr-only">Status: </span>
        {ELECTION_STATUS_LABELS[election.status]}
      </span>
      {isElectionStatusStale(election, today) ? (
        <span className="block text-sm text-muted">
          The election date has passed. This status has not been updated yet.
        </span>
      ) : null}
    </>
  );
}

/** What each participation status means. A native disclosure: works without JavaScript. */
export function ParticipationStatusGuide({ open = false }: { open?: boolean }) {
  return (
    <details className="card" open={open}>
      <summary className="cursor-pointer font-semibold">What the participation statuses mean</summary>
      <p className="mt-2">{CANDIDACY_NOTE}</p>
      <dl className="mt-2 space-y-2">
        {PARTICIPATION_STATUS_ORDER.map((status) => {
          const info = PARTICIPATION_STATUS_INFO[status];
          return (
            <div key={status}>
              <dt className="font-semibold">{info.label}</dt>
              <dd>
                {info.description} <span className="text-muted">{info.evidence}</span>
              </dd>
            </div>
          );
        })}
      </dl>
    </details>
  );
}

/** Per-status counts, each status written out exactly, in lifecycle order. */
export function StatusCounts({
  counts,
}: {
  counts: Partial<Record<ElectionParticipationStatus, number>>;
}) {
  const present = PARTICIPATION_STATUS_ORDER.filter((status) => (counts[status] ?? 0) > 0);
  if (present.length === 0) return null;
  return (
    <dl className="mt-1 grid grid-cols-[1fr_auto] gap-x-4 text-sm sm:max-w-md">
      {present.map((status) => (
        <div key={status} className="contents">
          <dt>{PARTICIPATION_STATUS_INFO[status].groupHeading}</dt>
          <dd className="text-right">{counts[status]}</dd>
        </div>
      ))}
    </dl>
  );
}

function Participant({ participant }: { participant: ContestParticipant }) {
  return (
    <li className="card">
      <h4 className="text-lg font-semibold">
        <Link href={politicianPath(participant.person.slug)} className="link">
          {participant.person.displayName}
        </Link>
      </h4>
      <ol className="mt-1 space-y-3">
        {participant.records.map(({ record, claims }, index) => {
          const info = PARTICIPATION_STATUS_INFO[record.status];
          return (
            <li key={record.id}>
              <p>
                {index > 0 ? <span className="text-sm text-muted">Earlier record: </span> : null}
                <strong>{info.label}.</strong> <span className="text-muted">{info.description}</span>
              </p>
              <p className="text-sm text-muted">
                As of <DateText date={record.effectiveFrom}>{formatIsoDate(record.effectiveFrom)}</DateText>
                {record.ballotNumber ? ` · Ballot number ${record.ballotNumber}` : ''}
              </p>
              <EvidenceBlock claims={claims} />
            </li>
          );
        })}
      </ol>
    </li>
  );
}

/** Participants grouped by the exact status of their most recent record. */
export function ParticipantGroups({ groups }: { groups: readonly ParticipantGroup[] }) {
  return (
    <div className="space-y-8">
      {groups.map((group) => {
        const info = PARTICIPATION_STATUS_INFO[group.status];
        return (
          <section key={group.status} aria-labelledby={`group-${group.status}`}>
            <h3 id={`group-${group.status}`} className="text-lg font-bold">
              {info.groupHeading} ({group.participants.length})
            </h3>
            <p className="text-sm text-muted">{info.description}</p>
            <ul className="mt-2 space-y-3">
              {group.participants.map((participant) => (
                <Participant key={participant.person.id} participant={participant} />
              ))}
            </ul>
          </section>
        );
      })}
    </div>
  );
}

export function JsonLdScript({ data }: { data: Record<string, unknown> | Record<string, unknown>[] }) {
  return <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: serializeJsonLd(data) }} />;
}
