'use client';

// This is the single entry point for all Firebase-related functionality.
// It ensures that Firebase is initialized only once on the client-side.
import { useMemo } from 'react';
import { FirebaseApp, initializeApp, getApps } from 'firebase/app';
import { Firestore, getFirestore, collection, doc, CollectionReference, DocumentReference, Query, query } from 'firebase/firestore';
import { Auth, getAuth } from 'firebase/auth';
import { FirebaseStorage, getStorage } from 'firebase/storage';
import { firebaseConfig } from './config';
import { useAuth as useFirebaseAuth } from '@/lib/auth/AuthContext';


// Export the provider and core hooks directly
export { FirebaseProvider, useFirebaseApp, useFirestore, useStorage } from './provider';

// Create an alias for useAuth
export const useAuth = useFirebaseAuth;

// Export the data-fetching hooks
export { useCollection } from './firestore/use-collection';
export { useDoc } from './firestore/use-doc';

// --- Type-Safe Memoization ---
// This is a CRITICAL utility to prevent infinite loops in React hooks.
// It "tags" a Firebase query or reference, ensuring it's only recreated when dependencies change.
// The `useCollection` and `useDoc` hooks will throw an error if the query/ref is not created with this.
type MemoizableFirebaseObject = (CollectionReference | DocumentReference | Query) & { __memo?: boolean };

export function useMemoFirebase<T extends MemoizableFirebaseObject>(
  factory: () => T | null | undefined,
  deps: React.DependencyList
): T | null | undefined {
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const memoized = useMemo(factory, deps);
  if (memoized) {
    memoized.__memo = true;
  }
  return memoized;
}

// --- App-level exports for convenience ---
// You can still use these for one-off access outside of React components if needed,
// but prefer the hooks within components.
let firebaseApp: FirebaseApp;
if (typeof window !== 'undefined') {
  firebaseApp = getApps().length === 0 ? initializeApp(firebaseConfig) : getApps()[0];
}

// @ts-ignore
const firestore: Firestore = typeof window !== 'undefined' ? getFirestore(firebaseApp) : undefined;
// @ts-ignore
const auth: Auth = typeof window !== 'undefined' ? getAuth(firebaseApp) : undefined;
// @ts-ignore
const storage: FirebaseStorage = typeof window !== 'undefined' ? getStorage(firebaseApp) : undefined;

export { firestore, auth, storage };
