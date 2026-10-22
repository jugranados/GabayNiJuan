import type { RowQuery, RowSource, TableName } from '@/data/repositories/rowSource';

export type FixtureTables = Partial<Record<TableName, readonly unknown[]>>;

function columnValue(row: unknown, column: string): unknown {
  return row && typeof row === 'object' ? (row as Record<string, unknown>)[column] : undefined;
}

/** Row source backed by in-memory fixture tables. Used for development and tests. */
export function createInMemoryRowSource(tables: FixtureTables): RowSource {
  const rowsOf = (table: TableName): readonly unknown[] => tables[table] ?? [];

  return {
    async select(table: TableName, query: RowQuery = {}) {
      return rowsOf(table).filter((row) => {
        const eqMatches = Object.entries(query.eq ?? {}).every(
          ([column, value]) => columnValue(row, column) === value,
        );
        const inMatches =
          !query.in || query.in.values.includes(String(columnValue(row, query.in.column)));
        return eqMatches && inMatches;
      });
    },
  };
}
