import { ConfigError, isPrivilegedSupabaseKey, parseAppConfig } from '@/shared/config/env';

function fakeJwt(payload: object): string {
  const encode = (value: object) =>
    btoa(JSON.stringify(value)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  return `${encode({ alg: 'HS256', typ: 'JWT' })}.${encode(payload)}.signature`;
}

describe('parseAppConfig', () => {
  it('defaults to fictional mock data', () => {
    expect(parseAppConfig({})).toEqual({ dataSource: 'mock' });
    expect(parseAppConfig({ EXPO_PUBLIC_DATA_SOURCE: '' })).toEqual({ dataSource: 'mock' });
  });

  it('requires URL and anon key for supabase', () => {
    expect(() => parseAppConfig({ EXPO_PUBLIC_DATA_SOURCE: 'supabase' })).toThrow(ConfigError);
  });

  it('accepts an anon key', () => {
    const config = parseAppConfig({
      EXPO_PUBLIC_DATA_SOURCE: 'supabase',
      EXPO_PUBLIC_SUPABASE_URL: 'https://project.supabase.co',
      EXPO_PUBLIC_SUPABASE_ANON_KEY: fakeJwt({ role: 'anon' }),
    });
    expect(config.dataSource).toBe('supabase');
  });

  it('refuses service-role and secret keys in the app', () => {
    expect(isPrivilegedSupabaseKey(fakeJwt({ role: 'service_role' }))).toBe(true);
    expect(isPrivilegedSupabaseKey('sb_secret_abc123')).toBe(true);
    expect(isPrivilegedSupabaseKey('sb_publishable_abc123')).toBe(false);
    expect(() =>
      parseAppConfig({
        EXPO_PUBLIC_DATA_SOURCE: 'supabase',
        EXPO_PUBLIC_SUPABASE_URL: 'https://project.supabase.co',
        EXPO_PUBLIC_SUPABASE_ANON_KEY: fakeJwt({ role: 'service_role' }),
      }),
    ).toThrow(/service-role/);
  });
});
