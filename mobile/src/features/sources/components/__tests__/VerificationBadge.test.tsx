import { fireEvent, render, screen } from '@testing-library/react-native';

import { VERIFICATION_STATUSES } from '@/domain/enums';
import { VerificationBadge } from '@/features/sources/components/VerificationBadge';
import { VERIFICATION_STATE_INFO } from '@/features/sources/verificationStates';

describe('VerificationBadge', () => {
  it('reveals what a state means when pressed', async () => {
    await render(<VerificationBadge status="DISPUTED" />);

    expect(screen.getByText('Disputed')).toBeOnTheScreen();
    expect(screen.queryByText(VERIFICATION_STATE_INFO.DISPUTED.description)).toBeNull();

    await fireEvent.press(screen.getByRole('button', { name: 'Verification: Disputed' }));
    expect(screen.getByText(VERIFICATION_STATE_INFO.DISPUTED.description)).toBeOnTheScreen();
  });

  it.each(VERIFICATION_STATUSES)('describes %s in evidence terms, never as a verdict', (status) => {
    const { label, description } = VERIFICATION_STATE_INFO[status];
    const text = `${label} ${description}`.toLowerCase();
    expect(description.length).toBeGreaterThan(0);
    for (const verdict of ['good', 'bad', 'trusted', 'untrusted', 'recommended', 'clean']) {
      expect(text).not.toMatch(new RegExp(`\\b${verdict}\\b`));
    }
  });
});
