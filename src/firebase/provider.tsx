'use client';

import React, { createContext, useContext, ReactNode, useMemo, useState, useEffect } from 'react';
import { FirebaseApp, getApps, initializeApp } from 'firebase/app';
import { Firestore, getFirestore } from 'firebase/firestore';
import { Auth, User, onAuthStateChanged, getAuth } from 'firebase/auth';
import { FirebaseStorage, getStorage } from 'firebase/storage';
import { firebaseConfig } from './config';
import { FirebaseErrorListener } from '@/components/FirebaseErrorListener';

// This function should only be called on the client.
export function initializeFirebase() {
  const app = getApps().length ? getApps()[0] : initializeApp(firebaseConfig);
  return {
    firebaseApp: app,
    firestore: getFirestore(app),
    auth: getAuth(app),
    storage: getStorage(app),
  };
}

// ---- Context Setup ----
interface FirebaseContextValue {
  services: {
    firebaseApp: FirebaseApp;
    firestore: Firestore;
    auth: Auth;
    storage: FirebaseStorage;
  };
}

const FirebaseContext = createContext<FirebaseContextValue | undefined>(undefined);


// ---- Provider Component ----
export function FirebaseProvider({ children }: { children: ReactNode }) {
  const firebaseServices = useMemo(() => {
    // This ensures initialization only happens on the client side.
    if (typeof window !== 'undefined') {
      return initializeFirebase();
    }
    return null;
  }, []);

  // Avoid rendering children until Firebase is initialized on the client
  if (!firebaseServices) {
    return null; 
  }

  const contextValue: FirebaseContextValue = {
    services: firebaseServices,
  };

  return (
    <FirebaseContext.Provider value={contextValue}>
      <FirebaseErrorListener />
      {children}
    </FirebaseContext.Provider>
  );
}

// ---- Hooks for consuming the context ----
function useFirebaseContext() {
  const context = useContext(FirebaseContext);
  if (context === undefined) {
    throw new Error('useFirebase must be used within a FirebaseProvider.');
  }
  return context;
}

export function useFirebaseApp(): FirebaseApp {
  return useFirebaseContext().services.firebaseApp;
}

export function useFirestore(): Firestore {
  return useFirebaseContext().services.firestore;
}

export function useStorage(): FirebaseStorage {
  return useFirebaseContext().services.storage;
}
