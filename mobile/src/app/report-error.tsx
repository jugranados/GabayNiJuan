import { router, useLocalSearchParams } from 'expo-router';

import { Body, Screen } from '@/components/ui';
import { CORRECTION_TARGET_TYPES, type CorrectionTargetType } from '@/domain/models/correction';
import { ReportErrorView } from '@/features/corrections/components/ReportErrorView';

function isTargetType(value: string | undefined): value is CorrectionTargetType {
  return CORRECTION_TARGET_TYPES.some((type) => type === value);
}

export default function ReportErrorScreen() {
  const params = useLocalSearchParams<{
    recordType?: string;
    recordId?: string;
    claimId?: string;
    label?: string;
  }>();

  if (!isTargetType(params.recordType) || !params.recordId) {
    return (
      <Screen>
        <Body>This report could not be started. Please go back and try again.</Body>
      </Screen>
    );
  }
  return (
    <ReportErrorView
      recordType={params.recordType}
      recordId={params.recordId}
      claimId={params.claimId}
      subjectLabel={params.label}
      onDone={() => router.back()}
    />
  );
}
