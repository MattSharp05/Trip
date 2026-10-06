import { createContext, useContext, type ReactNode } from 'react';

import { useAuthSession, type AuthState } from './useAuthSession';

const AuthContext = createContext<AuthState>({ status: 'loading' });

/** Holds the one auth subscription for the app; read it with `useAuth()`. */
export function AuthProvider({ children }: { children: ReactNode }) {
  const state = useAuthSession();
  return <AuthContext.Provider value={state}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthState {
  return useContext(AuthContext);
}
