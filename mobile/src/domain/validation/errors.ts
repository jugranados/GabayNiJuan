/**
 * Explicit failure types for data entering the domain layer.
 * Invalid political data is rejected, never coerced or silently dropped.
 */

export type ValidationIssue = {
  path: string;
  message: string;
};

/** A backend/fixture record did not match its schema. */
export class DataValidationError extends Error {
  override readonly name = 'DataValidationError';

  constructor(
    readonly entity: string,
    readonly issues: readonly ValidationIssue[],
    readonly recordId?: string,
  ) {
    super(
      `Invalid ${entity}${recordId ? ` (${recordId})` : ''}: ` +
        issues.map((issue) => `${issue.path || '<root>'}: ${issue.message}`).join('; '),
    );
  }
}

/** Records were individually valid but reference something that does not exist. */
export class DataIntegrityError extends Error {
  override readonly name = 'DataIntegrityError';
}

export function isDataError(error: unknown): error is DataValidationError | DataIntegrityError {
  return error instanceof DataValidationError || error instanceof DataIntegrityError;
}
