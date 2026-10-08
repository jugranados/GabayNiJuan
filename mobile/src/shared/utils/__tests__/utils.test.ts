import { DataIntegrityError, DataValidationError } from '@/domain/validation/errors';
import { formatYearRange } from '@/shared/utils/dates';
import { classifyError } from '@/shared/utils/errors';
import { photoUrlFor } from '@/shared/utils/photo';

describe('formatYearRange', () => {
  it('formats years and never claims a record is ongoing', () => {
    expect(formatYearRange('2019-06-30', '2022-06-30')).toBe('2019 – 2022');
    expect(formatYearRange('2022-01-01', '2022-12-31')).toBe('2022');
    expect(formatYearRange('2022-06-30', undefined)).toBe('From 2022');
    expect(formatYearRange(undefined, '2022-06-30')).toBe('Until 2022');
    expect(formatYearRange(undefined, undefined)).toBeUndefined();
    expect(formatYearRange('2022-06-30')).not.toMatch(/present|now|current/i);
  });
});

describe('classifyError', () => {
  it('separates validation, network and backend failures', () => {
    expect(classifyError(new DataValidationError('person', [], 'p1'))).toBe('validation');
    expect(classifyError(new DataIntegrityError('missing office'))).toBe('validation');
    expect(classifyError(new TypeError('Network request failed'))).toBe('network');
    expect(classifyError(new Error('Failed to search the directory: fetch failed'))).toBe(
      'network',
    );
    expect(classifyError(new Error('Failed to read people: permission denied'))).toBe('backend');
    expect(classifyError('something odd')).toBe('backend');
  });
});

describe('photoUrlFor', () => {
  it('resolves only https links until Storage is set up', () => {
    expect(photoUrlFor('https://example.org/p.jpg')).toBe('https://example.org/p.jpg');
    expect(photoUrlFor('asset-123')).toBeUndefined();
    expect(photoUrlFor('http://example.org/p.jpg')).toBeUndefined();
    expect(photoUrlFor(undefined)).toBeUndefined();
  });
});
