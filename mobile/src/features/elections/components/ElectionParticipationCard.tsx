import { StyleSheet, Text, View } from 'react-native';

import { Card } from '@/components/ui';
import { colors, spacing } from '@/components/theme';
import type { Attested, ElectionParticipationDetail } from '@/domain/models/personProfile';
import { PARTICIPATION_STATUS_INFO } from '@/features/elections/participationLabels';
import { EvidenceBlock } from '@/features/sources/components/EvidenceBlock';
import { formatIsoDate } from '@/shared/utils/dates';

type Props = {
  item: Attested<ElectionParticipationDetail>;
  onOpenClaim?: (claimId: string) => void;
};

/**
 * One election participation: office, election, status, date, ballot number
 * (only when documented) and the evidence behind it. Aspirant states are
 * written out and never shown as "Candidate".
 */
export function ElectionParticipationCard({ item, onOpenClaim }: Props) {
  const { participation, election, office } = item.record;
  const status = PARTICIPATION_STATUS_INFO[participation.status];

  return (
    <Card>
      <Text style={styles.office}>{office.name}</Text>
      <Text style={styles.meta}>
        {election.name} · {formatIsoDate(election.electionDate)}
      </Text>

      <View
        style={styles.status}
        accessible
        accessibilityLabel={`Participation status: ${status.label}. ${status.description}`}
      >
        <Text style={styles.statusLabel}>{status.label}</Text>
      </View>
      <Text style={styles.meta}>{status.description}</Text>
      <Text style={styles.meta}>As of {formatIsoDate(participation.effectiveFrom)}</Text>
      {participation.ballotNumber ? (
        <Text style={styles.meta}>Ballot number {participation.ballotNumber}</Text>
      ) : null}

      <EvidenceBlock claims={item.claims} onOpenClaim={onOpenClaim} />
    </Card>
  );
}

const styles = StyleSheet.create({
  office: { fontSize: 16, fontWeight: '600', color: colors.text },
  meta: { fontSize: 13, color: colors.textMuted },
  status: {
    alignSelf: 'flex-start',
    minHeight: 28,
    justifyContent: 'center',
    paddingHorizontal: spacing.sm,
    borderWidth: 1,
    borderColor: colors.text,
    borderRadius: 4,
  },
  statusLabel: { fontSize: 13, fontWeight: '700', color: colors.text },
});
