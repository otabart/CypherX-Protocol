console.log("Starting firebase.ts execution");

import { initializeApp, getApps, getApp } from "firebase/app";
import { getFirestore as getClientFirestore, Firestore, doc, getDoc } from "firebase/firestore";
import { getAuth, onAuthStateChanged, Auth } from "firebase/auth";
import type { User } from "firebase/auth";
import { getStorage } from "firebase/storage";
import type { FirebaseStorage } from "firebase/storage";

// Client-side Firebase configuration
const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: "homebase-dapp.firebaseapp.com",
  projectId: "homebase-dapp",
  storageBucket: "homebase-dapp.firebasestorage.app",
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
};

// Log and validate client-side environment variables
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
  storageBucket: logEnvStatus("storageBucket", firebaseConfig.storageBucket),
});

const missingClientEnvVars = Object.entries({
  NEXT_PUBLIC_FIREBASE_API_KEY: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  NEXT_PUBLIC_FIREBASE_APP_ID: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
}).filter(([_key, value]) => !value);

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
  } catch (error: any) {
    console.error("Client-side Firebase initialization error:", {
      message: error.message,
      code: error.code,
      stack: error.stack,
    });
    throw new Error("Firebase initialization failed");
  }
}

// Initialize client-side services
let clientDb: Firestore;
try {
  clientDb = getClientFirestore(clientApp);
  console.log("Client-side Firestore initialized: Success");
} catch (error: any) {
  console.error("Client-side Firestore initialization failed:", error.message);
  throw new Error("Firestore initialization failed");
}

let auth: Auth;
try {
  auth = getAuth(clientApp);
  console.log("Client-side Auth initialized: Success");
} catch (error: any) {
  console.error("Client-side Auth initialization failed:", error.message);
  throw new Error("Auth initialization failed");
}

let storage: FirebaseStorage;
try {
  storage = getStorage(clientApp, "homebase-dapp.appspot.com");
  console.log("Client-side Storage initialized: Success, Bucket:", firebaseConfig.storageBucket);
} catch (error: any) {
  console.error("Client-side Storage initialization failed:", {
    message: error.message,
    code: error.code,
    stack: error.stack,
  });
  throw new Error("Storage initialization failed");
}

// Function to listen to auth state changes with role checking
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

// Server-side Firebase Admin
let adminDb: any = {};
let adminStorage: any = {};

if (typeof window === "undefined") {
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
    const missingAdminEnvVars = Object.entries(requiredEnvVars).filter(
      ([_key, value]) => !value
    );
    if (missingAdminEnvVars.length > 0) {
      const errorMessage = `Missing server-side Firebase Admin environment variables: ${missingAdminEnvVars
        .map(([key]) => key)
        .join(", ")}`;
      console.error(errorMessage);
      throw new Error(errorMessage);
    }

    const { initializeApp: initializeAdminApp, getApps: getAdminApps } = await import(
      "firebase-admin/app"
    );
    const { getFirestore: getAdminFirestore } = await import("firebase-admin/firestore");
    const { getStorage: getAdminStorage } = await import("firebase-admin/storage");
    const { cert } = await import("firebase-admin/app");

    const normalizePrivateKey = (key: string | undefined): string => {
      if (!key) {
        throw new Error("FIREBASE_PRIVATE_KEY is undefined or empty");
      }
      let normalizedKey = key
        .replace(/\\n/g, "\n")
        .replace(/\\r/g, "")
        .replace(/\n+/g, "\n")
        .trim();
      if (!normalizedKey.startsWith("-----BEGIN PRIVATE KEY-----\n")) {
        normalizedKey = "-----BEGIN PRIVATE KEY-----\n" + normalizedKey;
      }
      if (!normalizedKey.endsWith("\n-----END PRIVATE KEY-----\n")) {
        normalizedKey = normalizedKey + "\n-----END PRIVATE KEY-----\n";
      }
      if (!normalizedKey.includes("PRIVATE KEY")) {
        throw new Error(
          "FIREBASE_PRIVATE_KEY is malformed: Missing expected key structure"
        );
      }
      return normalizedKey;
    };

    const privateKey = normalizePrivateKey(process.env.FIREBASE_PRIVATE_KEY);
    console.log(
      "FIREBASE_PRIVATE_KEY validated: Length =",
      privateKey.length,
      "Starts with =",
      privateKey.substring(0, 30)
    );

    let adminApp;
    if (!getAdminApps().length) {
      adminApp = initializeAdminApp({
        credential: cert({
          projectId: process.env.FIREBASE_PROJECT_ID,
          clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
          privateKey,
        }),
        storageBucket: "homebase-dapp.appspot.com", // Explicitly set storage bucket
      });
      console.log("Firebase Admin app initialized successfully");
    } else {
      adminApp = getAdminApps()[0];
      console.log("Firebase Admin app already initialized");
    }

    adminDb = getAdminFirestore();
    console.log("Admin Firestore initialized: Success");

    adminStorage = getAdminStorage(adminApp);
    console.log("Admin Storage initialized: Success, Bucket:", adminStorage.bucket().name);

    adminDb
      .collection("test")
      .doc("init-check")
      .set({ timestamp: new Date() })
      .then(() => console.log("Admin SDK connectivity test: Write successful"))
      .catch((error: any) =>
        console.error("Admin SDK connectivity test failed:", error.message)
      );

    // Test Storage connectivity
    adminStorage
      .bucket("homebase-dapp.appspot.com")
      .getMetadata()
      .then((metadata: any) => {
        console.log("Admin Storage connectivity test: Metadata retrieved", {
          bucket: metadata[0].name,
          location: metadata[0].location,
        });
      })
      .catch((error: any) =>
        console.error("Admin Storage connectivity test failed:", error.message)
      );
  } catch (error: any) {
    console.error("Firebase Admin initialization error:", {
      message: error.message,
      code: error.code,
      stack: error.stack,
    });
    // Log error but don't throw to prevent breaking unrelated functionality
    console.warn("Continuing without full Admin Storage initialization");
  }
}

export { clientDb as db, auth, storage, adminDb, adminStorage, listenToAuthState };