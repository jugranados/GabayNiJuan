import { createContext, useContext } from 'react';

import type { EditorialRole } from '@/domain/enums';

export type AuthState = {
  status: 'loading' | 'signed-out' | 'signed-in';
  userId?: string;
  email?: string;
  /** Highest role, or undefined for a signed-in user with no editorial role. */
  role?: EditorialRole;
  signIn: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
};

export const AuthContext = createContext<AuthState | undefined>(undefined);

export function useAuth(): AuthState {
  const value = useContext(AuthContext);
  if (!value) throw new Error('useAuth must be used inside an AuthContext provider');
  return value;
}
