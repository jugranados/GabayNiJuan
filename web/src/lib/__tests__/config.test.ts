import { ConfigError, isPrivilegedSupabaseKey, parseAppConfig } from '@/lib/config';

const jwt = (role: string) => `x.${btoa(JSON.stringify({ role }))}.y`;
const supabase = {
  NEXT_PUBLIC_SUPABASE_URL: 'https://example.supabase.co',
  NEXT_PUBLIC_SUPABASE_ANON_KEY: jwt('anon'),
};

describe('parseAppConfig', () => {
  it('defaults to fictional mock data, localhost and no indexing', () => {
    expect(parseAppConfig({})).toEqual({
      dataSource: 'mock',
      supabase: undefined,
      siteUrl: 'http://localhost:3000',
      indexable: false,
    });
  });

  it('requires the public Supabase values for DATA_SOURCE=supabase', () => {
    expect(() => parseAppConfig({ DATA_SOURCE: 'supabase' })).toThrow(ConfigError);
    expect(parseAppConfig({ DATA_SOURCE: 'supabase', ...supabase }).supabase).toEqual({
      url: supabase.NEXT_PUBLIC_SUPABASE_URL,
      anonKey: supabase.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    });
  });

  it('refuses a service-role or secret key, in any mode', () => {
    expect(isPrivilegedSupabaseKey(jwt('service_role'))).toBe(true);
    expect(isPrivilegedSupabaseKey('sb_secret_abc')).toBe(true);
    expect(isPrivilegedSupabaseKey('sb_publishable_abc')).toBe(false);
    for (const key of [jwt('service_role'), 'sb_secret_abc']) {
      expect(() =>
        parseAppConfig({ ...supabase, NEXT_PUBLIC_SUPABASE_ANON_KEY: key }),
      ).toThrow(/service-role/);
    }
  });

  it('never marks fictional mock data as indexable', () => {
    expect(parseAppConfig({ SITE_INDEXABLE: 'true' }).indexable).toBe(false);
    expect(parseAppConfig({ DATA_SOURCE: 'supabase', ...supabase }).indexable).toBe(false);
    expect(
      parseAppConfig({ DATA_SOURCE: 'supabase', SITE_INDEXABLE: 'true', ...supabase }).indexable,
    ).toBe(true);
  });

  it('normalises the site URL and rejects other schemes', () => {
    expect(parseAppConfig({ NEXT_PUBLIC_SITE_URL: 'https://example.org/' }).siteUrl).toBe(
      'https://example.org',
    );
    expect(() => parseAppConfig({ NEXT_PUBLIC_SITE_URL: 'javascript:alert(1)' })).toThrow(ConfigError);
  });
});
