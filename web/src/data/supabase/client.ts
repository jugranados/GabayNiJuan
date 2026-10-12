import { createClient, type SupabaseClient } from '@supabase/supabase-js';

/**
 * Public, read-only Supabase client for voter pages. It uses the anon key and
 * carries no session, cookie or user: Row Level Security limits it to
 * published records, exactly like an anonymous browser. Editorial sign-in uses
 * a separate cookie-based client (src/lib/supabase/server.ts) and never this one.
 */
export function createPublicSupabaseClient(url: string, anonKey: string): SupabaseClient {
  return createClient(url, anonKey, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
}
