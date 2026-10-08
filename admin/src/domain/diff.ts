export type FieldChange = { field: string; before: unknown; after: unknown };

/** Fields that change on every write and carry no editorial meaning. */
const NOISE = new Set(['updated_at', 'version']);

export function diffValues(oldValue: unknown, newValue: unknown): FieldChange[] {
  const before = isRecord(oldValue) ? oldValue : {};
  const after = isRecord(newValue) ? newValue : {};
  const fields = [...new Set([...Object.keys(before), ...Object.keys(after)])].sort();
  return fields
    .filter((field) => !NOISE.has(field))
    .filter((field) => JSON.stringify(before[field] ?? null) !== JSON.stringify(after[field] ?? null))
    .map((field) => ({ field, before: before[field] ?? null, after: after[field] ?? null }));
}

export function formatValue(value: unknown): string {
  if (value === null || value === undefined) return '—';
  if (typeof value === 'string') return value;
  return JSON.stringify(value);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
