import { DataIntegrityError, DataValidationError } from '@/domain/validation/errors';

export type ErrorKind = 'validation' | 'network' | 'backend';

const NETWORK_PATTERN =
  /network request failed|failed to fetch|fetch failed|networkerror|offline|timed? ?out|econn|enotfound|internet/i;

/**
 * Buckets an error for voter-facing messaging. The voter never sees stack
 * traces; developers get the detail in __DEV__ builds only.
 */
export function classifyError(error: unknown): ErrorKind {
  if (error instanceof DataValidationError || error instanceof DataIntegrityError) {
    return 'validation';
  }
  const message = error instanceof Error ? error.message : String(error);
  return NETWORK_PATTERN.test(message) ? 'network' : 'backend';
}

export const ERROR_COPY: Readonly<Record<ErrorKind, { title: string; body: string }>> = {
  network: {
    title: 'You seem to be offline',
    body: 'Check your internet connection and try again.',
  },
  validation: {
    title: 'Some records could not be shown',
    body: 'This information did not pass our data checks, so it is not displayed. It will be reviewed.',
  },
  backend: {
    title: 'Could not load information',
    body: 'Something went wrong on our side. Please try again in a moment.',
  },
};
