console.log("Starting firebase-client.ts execution");

import { initializeApp, getApps, getApp } from "firebase/app";
import {
  getFirestore as getClientFirestore,
  type Firestore as ClientFirestore,
  doc,
  getDoc,
} from "firebase/firestore";
import {
  getAuth,
  onAuthStateChanged,
  type Auth as FirebaseAuth,
  type User,
} from "firebase/auth";
import { getStorage, type FirebaseStorage } from "firebase/storage";

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: "homebase-dapp.firebaseapp.com",
  projectId: "homebase-dapp",
  storageBucket: "homebase-dapp.appspot.com",
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
};

const logEnvStatus = (key: string, value: string | undefined) =>
  value ? `${key}: Set` : `${key}: Missing`;
console.log("Firebase Client Config:", {
  apiKey: logEnvStatus("NEXT_PUBLIC_FIREBASE_API_KEY", process.env.NEXT_PUBLIC_FIREBASE_API_KEY),
  messagingSenderId: logEnvStatus(
    "NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID",
    process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID
  ),
  appId: logEnvStatus("NEXT_PUBLIC_FIREBASE_APP_ID", process.env.NEXT_PUBLIC_FIREBASE_APP_ID),
  authDomain: logEnvStatus("authDomain", firebaseConfig.authDomain),
  projectId: logEnvStatus("projectId", firebaseConfig.projectId),
});

const missingClientEnvVars = Object.entries({
  NEXT_PUBLIC_FIREBASE_API_KEY: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  NEXT_PUBLIC_FIREBASE_APP_ID: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
}).filter(([_key, value]) => !value);

let clientApp;
if (missingClientEnvVars.length > 0) {
  console.error(
    `Missing client-side Firebase environment variables: ${missingClientEnvVars
      .map(([key]) => key)
      .join(", ")}`
  );
  throw new Error("Firebase initialization failed: Missing environment variables");
} else {
  try {
    clientApp = !getApps().length ? initializeApp(firebaseConfig) : getApp();
    console.log(
      "Client-side Firebase app initialized:",
      clientApp.name,
      "Project ID:",
      clientApp.options.projectId
    );
  } catch (error: any) {
    console.error("Client-side Firebase initialization error:", {
      message: error.message,
      code: error.code,
      stack: error.stack,
    });
    throw new Error("Firebase initialization failed");
  }
}

let clientDb: ClientFirestore;
try {
  clientDb = getClientFirestore(clientApp);
  console.log("Client-side Firestore initialized: Success");
} catch (error: any) {
  console.error("Client-side Firestore initialization failed:", error.message);
  throw new Error("Firestore initialization failed");
}

let auth: FirebaseAuth;
try {
  auth = getAuth(clientApp);
  console.log("Client-side Auth initialized: Success");
} catch (error: any) {
  console.error("Client-side Auth initialization failed:", error.message);
  throw new Error("Auth initialization failed");
}

let storage: FirebaseStorage;
try {
  storage = getStorage(clientApp);
  console.log("Client-side Storage initialized: Success");
} catch (error: any) {
  console.error("Client-side Storage initialization failed:", error.message);
  throw new Error("Storage initialization failed");
}

const listenToAuthState = (
  callback: (user: User | null, roles?: { [key: string]: boolean }) => void
) => {
  if (!auth) {
    console.error("Auth not initialized. Cannot listen to auth state.");
    callback(null);
    return () => {};
  }
  return onAuthStateChanged(auth, async (user) => {
    if (user) {
      try {
        const userDocRef = doc(clientDb, "users", user.uid);
        const userDoc = await getDoc(userDocRef);
        const roles = userDoc.exists() ? userDoc.data()?.roles || {} : {};
        console.log(`Auth state changed: User ${user.uid} signed in, Roles:`, roles);
        callback(user, roles);
      } catch (error: any) {
        console.error(`Error fetching roles for user ${user.uid}:`, error.message);
        callback(user, {});
      }
    } else {
      console.log("Auth state changed: No user signed in");
      callback(null);
    }
  });
};

export { clientDb as db, auth, storage, listenToAuthState };