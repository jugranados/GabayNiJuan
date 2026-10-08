import { useMutation } from '@tanstack/react-query';
import { useState } from 'react';
import { StyleSheet, Text, TextInput, View } from 'react-native';

import { ActionButton } from '@/components/states';
import { colors, spacing } from '@/components/theme';
import { Body, Heading, Screen } from '@/components/ui';
import {
  CORRECTION_DESCRIPTION_MAX,
  CORRECTION_NOTICE,
  validateCorrectionForm,
  type CorrectionFormErrors,
} from '@/domain/corrections';
import type { CorrectionTargetType } from '@/domain/models/correction';
import { useRepositories } from '@/shared/hooks/useRepositories';

type Props = {
  recordType: CorrectionTargetType;
  recordId: string;
  claimId?: string;
  /** Plain-language name of what is being reported, e.g. a person's name or "this claim". */
  subjectLabel?: string;
  onDone?: () => void;
};

function Field({
  label,
  hint,
  error,
  ...input
}: {
  label: string;
  hint?: string;
  error?: string;
} & React.ComponentProps<typeof TextInput>) {
  return (
    <View style={styles.field}>
      <Text style={styles.label}>{label}</Text>
      {hint ? <Text style={styles.hint}>{hint}</Text> : null}
      <TextInput
        accessibilityLabel={label}
        style={[styles.input, input.multiline && styles.multiline]}
        placeholderTextColor={colors.textMuted}
        {...input}
      />
      {error ? (
        <Text accessibilityRole="alert" style={styles.error}>
          {error}
        </Text>
      ) : null}
    </View>
  );
}

/**
 * "Report an error". No account is needed. The notice states plainly that a report is a
 * request for review and does not change the public record.
 */
export function ReportErrorView({ recordType, recordId, claimId, subjectLabel, onDone }: Props) {
  const { corrections } = useRepositories();
  const [description, setDescription] = useState('');
  const [sourceUrl, setSourceUrl] = useState('');
  const [contactEmail, setContactEmail] = useState('');
  const [errors, setErrors] = useState<CorrectionFormErrors>({});

  const submit = useMutation({
    mutationFn: (value: { description: string; sourceUrl?: string; contactEmail?: string }) =>
      corrections.submit({ recordType, recordId, claimId, ...value }),
  });

  const onSubmit = () => {
    const result = validateCorrectionForm({ description, sourceUrl, contactEmail });
    if (!result.ok) {
      setErrors(result.errors);
      return;
    }
    setErrors({});
    submit.mutate(result.value);
  };

  if (submit.isSuccess) {
    return (
      <Screen>
        <Heading>Thank you</Heading>
        <Body>Your report was received. {CORRECTION_NOTICE}</Body>
        {onDone ? <ActionButton label="Done" variant="primary" onPress={onDone} /> : null}
      </Screen>
    );
  }

  return (
    <Screen>
      <Heading>Report an error</Heading>
      {subjectLabel ? <Body>About: {subjectLabel}</Body> : null}
      <Body muted>{CORRECTION_NOTICE}</Body>

      <Field
        label="What appears incorrect?"
        value={description}
        onChangeText={setDescription}
        multiline
        maxLength={CORRECTION_DESCRIPTION_MAX}
        error={errors.description}
      />
      <Field
        label="Source URL (optional but encouraged)"
        hint="A link to a document or page that shows the correct information."
        value={sourceUrl}
        onChangeText={setSourceUrl}
        autoCapitalize="none"
        autoCorrect={false}
        keyboardType="url"
        error={errors.sourceUrl}
      />
      <Field
        label="Email (optional)"
        hint="Only used if reviewers need to ask a question. It is never shown publicly."
        value={contactEmail}
        onChangeText={setContactEmail}
        autoCapitalize="none"
        autoCorrect={false}
        keyboardType="email-address"
        error={errors.contactEmail}
      />

      {submit.isError ? (
        <Text accessibilityRole="alert" style={styles.error}>
          Your report could not be sent. Check your connection and try again.
        </Text>
      ) : null}
      <ActionButton
        label={submit.isPending ? 'Sending…' : 'Send report'}
        variant="primary"
        onPress={submit.isPending ? () => undefined : onSubmit}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  field: { gap: spacing.xs },
  label: { fontSize: 15, fontWeight: '600', color: colors.text },
  hint: { fontSize: 13, color: colors.textMuted },
  input: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 8,
    padding: spacing.sm,
    fontSize: 16,
    color: colors.text,
    backgroundColor: colors.surface,
  },
  multiline: { minHeight: 120, textAlignVertical: 'top' },
  error: { color: colors.danger, fontSize: 14 },
});
