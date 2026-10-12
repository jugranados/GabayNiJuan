import type { VerificationStatus } from '@/domain/enums';
import { VERIFICATION_STATE_INFO } from '@/features/sources/verificationStates';

/**
 * The verification state of ONE claim, as text. Every state uses the same
 * neutral style: none is coloured as good or bad, and the meaning never
 * depends on colour. `explain` adds the definition in a native disclosure.
 */
export function VerificationBadge({
  status,
  explain = false,
}: {
  status: VerificationStatus;
  explain?: boolean;
}) {
  const info = VERIFICATION_STATE_INFO[status];
  const badge = (
    <span className="inline-flex items-center rounded border border-ink px-2 py-0.5 text-sm font-bold">
      <span className="sr-only">Verification: </span>
      {info.label}
    </span>
  );
  if (!explain) return badge;
  return (
    <details className="text-sm">
      <summary className="inline-flex min-h-11 cursor-pointer list-none items-center gap-2">
        {badge}
        <span className="link">What this means</span>
      </summary>
      <p className="mt-1 text-muted">{info.description}</p>
    </details>
  );
}
