/**
 * Voter-facing wording for verification states. Definitions follow
 * docs/DATA_TRUST_GOVERNANCE.md. They describe the evidence, never the
 * person: no state means "good", "bad", "trusted", or "recommended".
 */
import type { VerificationStatus } from '@/domain/enums';

export type VerificationStateInfo = {
  label: string;
  description: string;
};

export const VERIFICATION_STATE_INFO: Readonly<Record<VerificationStatus, VerificationStateInfo>> =
  {
    PRIMARY_SOURCE: {
      label: 'Primary source',
      description:
        'Supported by a document from an authoritative primary source, such as an election office, court, or legislature.',
    },
    CORROBORATED: {
      label: 'Corroborated',
      description: 'Supported by more than one credible, independent source.',
    },
    SELF_DECLARED: {
      label: 'Self-declared',
      description:
        'Stated by the person, their campaign, their party, or an official representative. It has not been independently confirmed.',
    },
    REPORTED: {
      label: 'Reported',
      description:
        'Reported by a credible secondary source, such as a news outlet. A primary record has not been located.',
    },
    DISPUTED: {
      label: 'Disputed',
      description:
        'Credible sources disagree. All of them are shown so you can compare them yourself.',
    },
    UNVERIFIED: {
      label: 'Unverified',
      description: 'There is not enough evidence attached to support this information yet.',
    },
    OUTDATED: {
      label: 'Outdated',
      description:
        'This was supported by evidence before, but that evidence may no longer reflect the current situation.',
    },
  };
