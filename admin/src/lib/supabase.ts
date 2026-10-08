import { createClient, type SupabaseClient } from '@supabase/supabase-js';

let client: SupabaseClient | undefined;

/**
 * The browser only ever holds the public anon/publishable key. What a signed-in editor may
 * do is decided by PostgreSQL (RLS, triggers, RPC checks), never by this client.
 */
export function getSupabase(): SupabaseClient {
  if (!client) {
    const url = import.meta.env.VITE_SUPABASE_URL as string | undefined;
    const key = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;
    if (!url || !key) {
      throw new Error('Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY (see admin/.env.example).');
    }
    client = createClient(url, key, { auth: { persistSession: true, autoRefreshToken: true } });
  }
  return client;
}
