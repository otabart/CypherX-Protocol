// lib/firebase.ts

import { initializeApp, getApps, getApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import { getStorage } from "firebase/storage";

// ⚠️ Use the same NEXT_PUBLIC_* env vars that worked for you before.
// Make sure you have them in .env.local exactly as they were.
// Then RESTART your dev server after any change to .env.local.
const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,            // same as before
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,    // same
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,      // same
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET, // same
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID, // same
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,              // same
};

// Only initialize once, in case of HMR in dev
const app = !getApps().length ? initializeApp(firebaseConfig) : getApp();

// Keep the lines for Auth (like you had) plus new lines for db + storage
export const auth = getAuth(app);
export const db = getFirestore(app);
export const storage = getStorage(app);



