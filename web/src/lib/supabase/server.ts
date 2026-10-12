import 'server-only';

import { createServerClient } from '@supabase/ssr';
import type { SupabaseClient } from '@supabase/supabase-js';
import { cookies } from 'next/headers';

import { getAppConfig } from '@/server/config';

/**
 * Supabase client for the editorial area. It carries the signed-in editor's
 * own session from cookies and uses the public anon key, so every query runs
 * as that user under Row Level Security. There is no service-role client in
 * this app. Returns undefined when Supabase is not configured.
 *
 * Never use this for public pages: they must not depend on who is signed in.
 */
export async function createEditorialClient(): Promise<SupabaseClient | undefined> {
  const { supabase } = getAppConfig();
  if (!supabase) return undefined;
  const cookieStore = await cookies();
  return createServerClient(supabase.url, supabase.anonKey, {
    cookies: {
      getAll: () => cookieStore.getAll(),
      setAll: (list) => {
        try {
          for (const { name, value, options } of list) cookieStore.set(name, value, options);
        } catch {
          // Server Components cannot set cookies; src/proxy.ts refreshes the session instead.
        }
      },
    },
  });
}
