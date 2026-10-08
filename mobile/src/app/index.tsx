import { Link } from 'expo-router';
import { StyleSheet, Text } from 'react-native';

import { colors, spacing } from '@/components/theme';
import { Body, Card, FixtureBanner, Heading, Screen } from '@/components/ui';

export default function HomeScreen() {
  return (
    <Screen>
      <FixtureBanner />
      <Heading>Gabay ni Juan</Heading>
      <Body>
        A neutral guide to the documented public record of Philippine political figures. Every piece
        of information links to its sources, so you can check them yourself.
      </Body>
      <Body muted>Gabay ni Juan does not endorse, rank, score, or recommend any candidate.</Body>

      <Link href="/politicians" asChild>
        <Text accessibilityRole="link" style={styles.link}>
          Browse politicians
        </Text>
      </Link>
      <Link href="/about" asChild>
        <Text accessibilityRole="link" style={styles.link}>
          How information is verified
        </Text>
      </Link>

      <Card>
        <Body muted>
          Verification describes the evidence behind each individual statement. It is not a
          judgement of any person.
        </Body>
      </Card>
    </Screen>
  );
}

const styles = StyleSheet.create({
  link: { fontSize: 16, color: colors.accent, paddingVertical: spacing.sm, fontWeight: '600' },
});
