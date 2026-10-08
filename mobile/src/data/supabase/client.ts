import 'react-native-url-polyfill/auto';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';

/**
 * Public, read-only Supabase client for voters. Voters do not sign in, so no
 * session is persisted or refreshed. Access is limited by Row Level Security
 * to published records. Reviewer/admin auth belongs to a separate tool.
 */
export function createPublicSupabaseClient(url: string, anonKey: string): SupabaseClient {
  return createClient(url, anonKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
  });
}
