import { initializeApp, getApps, getApp } from "firebase/app";
import { getFirestore, connectFirestoreEmulator } from "firebase/firestore";
import { getAuth, connectAuthEmulator } from "firebase/auth";

// Firebase configuration
const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: "homebase-dapp.firebaseapp.com",
  projectId: "homebase-dapp",
  storageBucket: "homebase-dapp.appspot.com",
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
};

// Initialize Firebase app only if it hasn't been initialized
const app = !getApps().length ? initializeApp(firebaseConfig) : getApp();

// Initialize Firestore
const db = getFirestore(app);

// Initialize Authentication
const auth = getAuth(app);

// Connect to emulators if running locally
if (process.env.NODE_ENV === "development") {
  // Firestore emulator
  connectFirestoreEmulator(db, "localhost", 8080);
  // Auth emulator
  connectAuthEmulator(auth, "http://localhost:9099", { disableWarnings: true });
}

export { db, auth };


