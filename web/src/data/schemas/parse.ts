import type { z } from 'zod';

import { DataValidationError } from '@/domain/validation/errors';

function recordIdOf(row: unknown): string | undefined {
  if (row && typeof row === 'object' && 'id' in row && typeof row.id === 'string') {
    return row.id;
  }
  return undefined;
}

/** Validates one raw row. Throws DataValidationError; never returns partial data. */
export function parseRow<S extends z.ZodType>(
  schema: S,
  entity: string,
  row: unknown,
): z.output<S> {
  const result = schema.safeParse(row);
  if (!result.success) {
    throw new DataValidationError(
      entity,
      result.error.issues.map((issue) => ({
        path: issue.path.join('.'),
        message: issue.message,
      })),
      recordIdOf(row),
    );
  }
  return result.data;
}

/**
 * Validates every row. One invalid row fails the whole read: silently
 * dropping a record could hide a correction or a conflicting source.
 */
export function parseRows<S extends z.ZodType>(
  schema: S,
  entity: string,
  rows: readonly unknown[],
): z.output<S>[] {
  return rows.map((row) => parseRow(schema, entity, row));
}
