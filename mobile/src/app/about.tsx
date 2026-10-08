import { Body, Card, Heading, Screen, Section } from '@/components/ui';
import { VERIFICATION_STATUSES } from '@/domain/enums';
import { VerificationBadge } from '@/features/sources/components/VerificationBadge';
import { VERIFICATION_STATE_INFO } from '@/features/sources/verificationStates';

export default function AboutScreen() {
  return (
    <Screen>
      <Heading>About the data</Heading>
      <Body>
        Gabay ni Juan is politically neutral. It does not endorse, rank, score, or recommend any
        person, and it does not predict election results.
      </Body>

      <Section title="Verification states">
        <Body muted>
          Each statement in a profile carries its own verification state. A state describes the
          evidence for that one statement, not the person.
        </Body>
        {VERIFICATION_STATUSES.map((status) => (
          <Card key={status}>
            <VerificationBadge status={status} />
            <Body>{VERIFICATION_STATE_INFO[status].description}</Body>
          </Card>
        ))}
      </Section>

      <Section title="Sources">
        <Body>
          Primary official records, such as election office documents, court records, and
          legislative records, are preferred. Statements by a person or their campaign are labelled
          self-declared. When credible sources disagree, every source is shown and the statement is
          marked disputed.
        </Body>
      </Section>

      <Section title="Dates">
        <Body>
          Profiles show when each statement applies, when each source was published and retrieved,
          and when the statement was last reviewed.
        </Body>
      </Section>
    </Screen>
  );
}
