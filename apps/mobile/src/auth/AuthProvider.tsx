import AsyncStorage from '@react-native-async-storage/async-storage';
import { onIdTokenChanged, signOut as fbSignOut } from 'firebase/auth';
import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';

import { auth } from '@/lib/firebase';

export type AuthStatus = 'loading' | 'signedOut' | 'buyer' | 'builder';

export type AuthState = {
  status: AuthStatus;
  uid?: string;
  towerId?: string;
  unitId?: string;
};

export type AuthContextValue = AuthState & { signOut(): Promise<void> };

const AuthContext = createContext<AuthContextValue | null>(null);

const CLAIMS_KEY = 'gatehood.claims.';

/** Maps token custom claims (`role`, `towerId`, `unitId`) to the app's auth state. */
export function stateFromClaims(uid: string, claims: Record<string, unknown>): AuthState {
  if (claims.role === 'builder') return { status: 'builder', uid };
  if (claims.role === 'buyer') {
    return {
      status: 'buyer',
      uid,
      ...(typeof claims.towerId === 'string' ? { towerId: claims.towerId } : {}),
      ...(typeof claims.unitId === 'string' ? { unitId: claims.unitId } : {}),
    };
  }
  // Signed in without a role (shouldn't happen): treat as signed out.
  return { status: 'signedOut' };
}

/** Tracks the Firebase user and reads role, tower and unit from the token's custom claims. */
export function AuthProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AuthState>({ status: 'loading' });

  useEffect(() => {
    let current = 0;
    return onIdTokenChanged(auth, async (user) => {
      const run = ++current;
      if (!user) {
        setState({ status: 'signedOut' });
        return;
      }
      const cacheKey = `${CLAIMS_KEY}${user.uid}`;
      let next: AuthState;
      try {
        const { claims } = await user.getIdTokenResult();
        next = stateFromClaims(user.uid, claims);
        if (next.status !== 'signedOut') {
          await AsyncStorage.setItem(cacheKey, JSON.stringify(next)).catch(() => undefined);
        }
      } catch {
        // Token refresh failed, usually because the phone is offline with an expired token.
        // Use the claims we saw last time so a signed-in buyer can still read saved updates.
        const cached = await AsyncStorage.getItem(cacheKey).catch(() => null);
        next = cached ? (JSON.parse(cached) as AuthState) : { status: 'signedOut' };
      }
      if (run === current) setState(next);
    });
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      ...state,
      signOut: async () => {
        if (state.uid) await AsyncStorage.removeItem(`${CLAIMS_KEY}${state.uid}`).catch(() => undefined);
        await fbSignOut(auth);
      },
    }),
    [state],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside <AuthProvider>.');
  return ctx;
}
