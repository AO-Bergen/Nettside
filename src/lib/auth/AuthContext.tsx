
'use client';

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import {
  getAuth,
  onAuthStateChanged,
  signInWithPopup,
  GoogleAuthProvider,
  signOut,
  type Auth,
  type User,
} from 'firebase/auth';
import { useFirebaseApp } from '@/firebase/provider';


type AuthContextValue = {
  auth: Auth;
  user: User | null;
  loading: boolean;
  error: Error | null;

  // Dialog state/actions expected by your UI
  isAuthDialogOpen: boolean;
  openAuthDialog: () => void;
  closeAuthDialog: () => void;

  // Handy auth actions
  signInWithGoogle: () => Promise<void>;
  signOutUser: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const app = useFirebaseApp();
  const auth = useMemo(() => getAuth(app), [app]);
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  // Dialog state used by components like <AuthDialog/>
  const [isAuthDialogOpen, setIsAuthDialogOpen] = useState(false);
  const openAuthDialog = useCallback(() => setIsAuthDialogOpen(true), []);
  const closeAuthDialog = useCallback(() => setIsAuthDialogOpen(false), []);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (u) => {
      setUser(u);
      setLoading(false);
    }, (err) => {
      setError(err instanceof Error ? err : new Error(String(err)));
      setLoading(false);
    });
    return () => unsub();
  }, [auth]);

  const signInWithGoogle = useCallback(async () => {
    const provider = new GoogleAuthProvider();
    try {
      await signInWithPopup(auth, provider);
    } catch (err) {
      setError(err instanceof Error ? err : new Error(String(err)));
      throw err;
    }
  }, [auth]);

  const signOutUser = useCallback(async () => {
    try {
      await signOut(auth);
    } catch (err) {
      setError(err instanceof Error ? err : new Error(String(err)));
      throw err;
    }
  }, [auth]);

  const value: AuthContextValue = {
    auth,
    user,
    loading,
    error,
    isAuthDialogOpen,
    openAuthDialog,
    closeAuthDialog,
    signInWithGoogle,
    signOutUser,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error('useAuth must be used within <AuthProvider>');
  }
  return ctx;
}
