// lib/firebase/client.ts
import { initializeApp, getApps, getApp, FirebaseApp } from "firebase/app";
import { getAuth, Auth } from "firebase/auth";
import { getFirestore, Firestore } from "firebase/firestore";
import { getStorage, FirebaseStorage } from "firebase/storage";
import { firebaseConfig } from "@/firebase/config";

// Initialiser appen bare én gang (trygt både på server og klient)
const app: FirebaseApp = getApps().length ? getApp() : initializeApp(firebaseConfig);

// Tjenester
const auth: Auth = getAuth(app);
const firestore: Firestore = getFirestore(app);
const storage: FirebaseStorage = getStorage(app);

export { app, auth, firestore, storage };
