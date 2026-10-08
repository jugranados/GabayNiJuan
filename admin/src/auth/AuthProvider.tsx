import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import type { Session } from '@supabase/supabase-js';

import { fetchMyRoles } from '@/data/api';
import { highestRole } from '@/domain/roles';
import type { EditorialRole } from '@/domain/enums';
import { getSupabase } from '@/lib/supabase';

import { AuthContext, type AuthState } from './AuthContext';

/** Supabase Auth session + the signed-in user's role rows. Roles only drive which controls show. */
export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null | undefined>(undefined);
  const [role, setRole] = useState<EditorialRole | undefined>(undefined);
  const [rolesLoaded, setRolesLoaded] = useState(false);

  useEffect(() => {
    const supabase = getSupabase();
    void supabase.auth.getSession().then(({ data }) => setSession(data.session));
    const { data } = supabase.auth.onAuthStateChange((_event, next) => setSession(next));
    return () => data.subscription.unsubscribe();
  }, []);

  const userId = session?.user.id;
  useEffect(() => {
    let cancelled = false;
    if (!userId) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setRole(undefined);
      setRolesLoaded(session !== undefined);
      return;
    }
    setRolesLoaded(false);
    fetchMyRoles(userId)
      .then((roles) => !cancelled && setRole(highestRole(roles)))
      .catch(() => !cancelled && setRole(undefined))
      .finally(() => !cancelled && setRolesLoaded(true));
    return () => {
      cancelled = true;
    };
  }, [userId, session]);

  const signIn = useCallback(async (email: string, password: string) => {
    const { error } = await getSupabase().auth.signInWithPassword({ email, password });
    if (error) throw new Error('Sign-in failed. Check your email and password.');
  }, []);
  const signOut = useCallback(async () => {
    await getSupabase().auth.signOut();
  }, []);

  const value = useMemo<AuthState>(
    () => ({
      status: session === undefined || !rolesLoaded ? 'loading' : session ? 'signed-in' : 'signed-out',
      userId,
      email: session?.user.email,
      role,
      signIn,
      signOut,
    }),
    [session, rolesLoaded, userId, role, signIn, signOut],
  );
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
