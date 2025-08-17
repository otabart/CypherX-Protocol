import { initializeApp, getApps, getApp } from "firebase/app";
import {
  getFirestore as getClientFirestore,
  Firestore,
  doc,
  getDoc,
  setDoc,
  serverTimestamp,
} from "firebase/firestore";
import { getAuth, onAuthStateChanged } from "firebase/auth";
import type { Auth, User } from "firebase/auth";
import { getStorage } from "firebase/storage";
import type { FirebaseStorage } from "firebase/storage";
import { Firestore as AdminFirestore } from "firebase-admin/firestore";
import { Storage } from "firebase-admin/storage";
import type { App } from "firebase-admin/app";
import * as dotenv from "dotenv"; // Import dotenv for .env loading

// Load environment variables from .env file
dotenv.config();

interface FirebaseError extends Error {
  code?: string;
}

// Client-side Firebase config
const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY!,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN!,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID!,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET!,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID!,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID!,
};

// Log + validate client env vars
const logEnvStatus = (key: string, value: string | undefined) =>
  value ? `${key}: Set` : `${key}: Missing`;

console.log("Firebase Client Config:", {
  apiKey: logEnvStatus("NEXT_PUBLIC_FIREBASE_API_KEY", process.env.NEXT_PUBLIC_FIREBASE_API_KEY),
  authDomain: logEnvStatus("NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN", process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN),
  projectId: logEnvStatus("NEXT_PUBLIC_FIREBASE_PROJECT_ID", process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID),
  storageBucket: logEnvStatus("NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET", process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET),
  messagingSenderId: logEnvStatus("NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID", process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID),
  appId: logEnvStatus("NEXT_PUBLIC_FIREBASE_APP_ID", process.env.NEXT_PUBLIC_FIREBASE_APP_ID),
});

const missingClientEnvVars = Object.entries({
  NEXT_PUBLIC_FIREBASE_API_KEY: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  NEXT_PUBLIC_FIREBASE_PROJECT_ID: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  NEXT_PUBLIC_FIREBASE_APP_ID: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
}).filter(([, value]) => !value);

// Initialize client-side Firebase app
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
      clientApp.options.projectId,
      "Storage Bucket:",
      clientApp.options.storageBucket
    );
  } catch (error: unknown) {
    console.error("Client-side Firebase initialization error:", {
      message: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
    });
    throw new Error("Firebase initialization failed: Client-side app setup error");
  }
}

// Initialize client-side services
let clientDb: Firestore;
try {
  clientDb = getClientFirestore(clientApp);
  console.log("Client-side Firestore initialized: Success");
} catch (error: unknown) {
  console.error("Client-side Firestore initialization failed:", {
    message: error instanceof Error ? error.message : String(error),
    stack: error instanceof Error ? error.stack : undefined,
  });
  throw new Error("Firestore initialization failed: Client-side Firestore setup error");
}

let auth: Auth;
try {
  auth = getAuth(clientApp);
  console.log("Client-side Auth initialized: Success");
} catch (error: unknown) {
  console.error("Client-side Auth initialization failed:", {
    message: error instanceof Error ? error.message : String(error),
    stack: error instanceof Error ? error.stack : undefined,
  });
  throw new Error("Auth initialization failed: Client-side Auth setup error");
}

let storage: FirebaseStorage;
try {
  storage = getStorage(clientApp, process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET!);
  console.log(
    "Client-side Storage initialized: Success, Bucket:",
    process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET
  );
} catch (error: unknown) {
  console.error("Client-side Storage initialization failed:", {
    message: error instanceof Error ? error.message : String(error),
    stack: error instanceof Error ? error.stack : undefined,
  });
  throw new Error("Storage initialization failed: Client-side Storage setup error");
}

// Listen to auth state + roles
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
        let roles: { [key: string]: boolean } = {};
        if (userDoc.exists()) {
          roles = (userDoc.data() as { roles?: { [key: string]: boolean } }).roles || {};
          console.log(
            `Auth state changed: User ${user.uid} signed in, Roles:`,
            roles
          );
        } else {
          console.log(`Creating user document for ${user.uid}`);
          const username = user.displayName?.toLowerCase().replace(/[^a-z0-9\-_]/g, '') || `user_${user.uid}`;
          if (!/^[a-z0-9\-_]+$/.test(username)) {
            throw new Error(`Invalid username format for user ${user.uid}: ${username}`);
          }
          await setDoc(userDocRef, {
            email: user.email || "",
            username: username,
            displayName: user.displayName || `User ${user.uid.slice(0, 8)}`,
            photoURL: user.photoURL || "",
            createdAt: serverTimestamp(),
            preferences: {
              notifications: {
                mover: true,
                loser: true,
                volume_spike: true,
                price_spike: true,
                news: true,
                article: true,
                ai_index: true,
                eth_stats: true,
                new_token: true,
              },
              favorites: [],
              notificationFilter: { type: "all", excludeTypes: [] },
              panelWidths: {
                sysUpdate: 33.33,
                terminalOutput: 33.33,
                notificationCenter: 33.33,
              },
            },
            roles: {},
          });
          console.log(`User document created for ${user.uid}`);
        }
        callback(user, roles);
      } catch (error: unknown) {
        const firebaseError = error as FirebaseError;
        console.error(`Error handling auth state for user ${user.uid}:`, {
          message: firebaseError.message || String(error),
          code: firebaseError.code,
          stack: firebaseError.stack,
        });
        callback(user, {});
      }
    } else {
      console.log("Auth state changed: No user signed in");
      callback(null);
    }
  });
};

// Server-side Firebase Admin init
let adminDb: AdminFirestore;
let adminStorage: Storage;
let adminApp: App;

if (typeof window === "undefined") {
  (async () => {
    try {
      console.log("Starting Firebase Admin initialization...");
      console.log("Raw Firebase Admin Env Vars:", {
        FIREBASE_PROJECT_ID: process.env.FIREBASE_PROJECT_ID || "Missing",
        FIREBASE_CLIENT_EMAIL: process.env.FIREBASE_CLIENT_EMAIL || "Missing",
        FIREBASE_PRIVATE_KEY: process.env.FIREBASE_PRIVATE_KEY ? "Set" : "Missing",
      });

      const requiredEnvVars = {
        FIREBASE_PROJECT_ID: process.env.FIREBASE_PROJECT_ID,
        FIREBASE_CLIENT_EMAIL: process.env.FIREBASE_CLIENT_EMAIL,
        FIREBASE_PRIVATE_KEY: process.env.FIREBASE_PRIVATE_KEY,
      };
      const missingAdminEnvVars = Object.entries(requiredEnvVars).filter(([, value]) => !value);
      if (missingAdminEnvVars.length > 0) {
        const errorMessage = `Missing server-side Firebase Admin environment variables: ${missingAdminEnvVars.map(([key]) => key).join(", ")}`;
        console.error(errorMessage);
        throw new Error(errorMessage);
      }

      console.log("Attempting to import firebase-admin modules...");
      const {
        initializeApp: initializeAdminApp,
        getApps: getAdminApps,
        cert,
      } = await import("firebase-admin/app");
      const { getFirestore: getAdminFirestore } = await import("firebase-admin/firestore");
      const { getStorage: getAdminStorage } = await import("firebase-admin/storage");

      const normalizePrivateKey = (key: string | undefined): string => {
        if (!key) throw new Error("FIREBASE_PRIVATE_KEY is undefined or empty");
        let normalizedKey = key
          .replace(/\\n/g, "\n")
          .replace(/\\r/g, "")
          .replace(/\n+/g, "\n")
          .trim();
        console.log("Raw Private Key Length:", normalizedKey.length);
        if (!normalizedKey.startsWith("-----BEGIN PRIVATE KEY-----\n")) {
          normalizedKey = "-----BEGIN PRIVATE KEY-----\n" + normalizedKey;
        }
        if (!normalizedKey.endsWith("\n-----END PRIVATE KEY-----\n")) {
          normalizedKey = normalizedKey + "\n-----END PRIVATE KEY-----\n";
        }
        if (!normalizedKey.includes("PRIVATE KEY")) {
          throw new Error("FIREBASE_PRIVATE_KEY is malformed: Missing expected key structure");
        }
        console.log("Normalized Private Key Length:", normalizedKey.length, "Sample:", normalizedKey.substring(0, 20) + "...");
        return normalizedKey;
      };

      const privateKey = normalizePrivateKey(process.env.FIREBASE_PRIVATE_KEY);
      console.log("Private Key normalized successfully");

      if (!getAdminApps().length) {
        console.log("Initializing Firebase Admin app...");
        adminApp = initializeAdminApp({
          credential: cert({
            projectId: process.env.FIREBASE_PROJECT_ID!,
            clientEmail: process.env.FIREBASE_CLIENT_EMAIL!,
            privateKey,
          }),
          storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET!,
        });
        console.log("Firebase Admin app initialized successfully");
      } else {
        adminApp = getAdminApps()[0];
        console.log("Firebase Admin app already initialized");
      }

      adminDb = getAdminFirestore();
      console.log("Admin Firestore initialized: Success");

      // Enable ignoreUndefinedProperties to prevent undefined value errors
      adminDb.settings({
        ignoreUndefinedProperties: true
      });

      adminStorage = getAdminStorage(adminApp);
      console.log("Admin Storage initialized: Success, Bucket:", adminStorage.bucket().name);

      // Test Firestore connectivity
      console.log("Testing Firestore connectivity...");
      await adminDb.collection("test").doc("init-check").set({
        timestamp: new Date(),
        initializedBy: "firebase.ts",
      });
      console.log("Admin SDK connectivity test: Firestore write successful");

      // Test Storage connectivity
      console.log("Testing Storage connectivity...");
      try {
        const bucket = adminStorage.bucket(process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET!);
        const [exists] = await bucket.exists();
        if (!exists) {
          throw new Error("Storage bucket does not exist: " + process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET);
        }
        const [metadata] = await bucket.getMetadata();
        console.log("Admin Storage connectivity test: Metadata retrieved", {
          bucket: metadata.name,
          location: metadata.location,
        });
      } catch (error: unknown) {
        console.error("Admin Storage connectivity test failed:", {
          message: error instanceof Error ? error.message : String(error),
          stack: error instanceof Error ? error.stack : undefined,
        });
        throw new Error("Admin Storage initialization failed: Unable to connect to storage bucket");
      }
    } catch (error: unknown) {
      console.error("Firebase Admin initialization error:", {
        message: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
      });
      throw new Error("Firebase Admin initialization failed: " + (error instanceof Error ? error.message : String(error)));
    }
  })();
}

export { clientDb as db, auth, storage, adminDb, adminStorage, listenToAuthState };