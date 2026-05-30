// src/lib/firebase-admin.ts
import 'server-only';
import * as admin from 'firebase-admin';

declare global {
  // allow global var to avoid re-initialising during HMR
  // eslint-disable-next-line no-var
  var __FIREBASE_ADMIN_APP__: admin.app.App | undefined;
}

function initAdmin() {
  if (global.__FIREBASE_ADMIN_APP__) return global.__FIREBASE_ADMIN_APP__;

  if (process.env.NODE_ENV === 'development') {
    // Use a local service account JSON from an env var
    const raw = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
    if (!raw) {
      throw new Error('Set FIREBASE_SERVICE_ACCOUNT_JSON for local dev.');
    }
    const parsed = JSON.parse(raw) as admin.ServiceAccount & { private_key: string };
    // Fix escaped newlines if present
    if (parsed.private_key?.includes('\\n')) {
      parsed.private_key = parsed.private_key.replace(/\\n/g, '\n');
    }
    global.__FIREBASE_ADMIN_APP__ = admin.initializeApp({
      credential: admin.credential.cert(parsed),
    });
  } else {
    // On Firebase App Hosting / GCP: use ADC (no JSON needed)
    global.__FIREBASE_ADMIN_APP__ = admin.initializeApp({
      credential: admin.credential.applicationDefault(),
    });
  }

  return global.__FIREBASE_ADMIN_APP__;
}

const adminApp = initAdmin();
const adminAuth = adminApp.auth();
const adminDb = adminApp.firestore();

export { adminApp, adminAuth, adminDb, admin }
