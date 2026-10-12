import { TABLES } from '@/data/repositories/rowSource';
import { EDITORIAL_IDENTITY_COLUMNS, publicColumnsFor } from '@/data/supabase/publicColumns';

describe('public columns requested from Supabase', () => {
  it.each(TABLES)('%s never requests editorial identity columns', (table) => {
    const columns = publicColumnsFor(table);
    expect(columns.length).toBeGreaterThan(0);
    for (const identity of EDITORIAL_IDENTITY_COLUMNS) {
      expect(columns).not.toContain(identity);
    }
  });

  it('requests exactly the columns the row contract validates', () => {
    expect(publicColumnsFor('people')).toEqual(
      expect.arrayContaining(['id', 'first_name', 'last_name', 'birth_date']),
    );
    expect(publicColumnsFor('claim_evidence').sort()).toEqual(
      ['claim_id', 'note', 'source_id', 'supports'].sort(),
    );
  });

  it('does not expose the audit log', () => {
    expect(TABLES as readonly string[]).not.toContain('revisions');
    expect(TABLES as readonly string[]).not.toContain('editorial_roles');
  });
});
