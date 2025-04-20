import { initializeApp, getApps, getApp } from "firebase/app";
import { getFirestore as getClientFirestore } from "firebase/firestore";
import { getAuth } from "firebase/auth";

// Client-side Firebase configuration
const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: "homebase-dapp.firebaseapp.com",
  projectId: "homebase-dapp",
  storageBucket: "homebase-dapp.appspot.com",
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
};

// Log the config to verify env vars
console.log("Firebase Config:", {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY ? "Set" : "Missing",
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID ? "Set" : "Missing",
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID ? "Set" : "Missing",
});

// Validate client-side environment variables
const missingClientEnvVars = Object.entries({
  NEXT_PUBLIC_FIREBASE_API_KEY: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  NEXT_PUBLIC_FIREBASE_APP_ID: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
}).filter(([_key, value]) => !value);
if (missingClientEnvVars.length > 0) {
  console.error("Missing client-side Firebase environment variables:", missingClientEnvVars.map(([key]) => key));
  throw new Error("Missing required client-side Firebase environment variables");
}

// Initialize client-side Firebase app
let clientApp;
try {
  clientApp = !getApps().length ? initializeApp(firebaseConfig) : getApp();
  console.log("Client-side Firebase app initialized successfully:", !!clientApp);
} catch (error: any) {
  console.error("Client-side Firebase initialization error:", {
    message: error.message,
    stack: error.stack,
  });
  throw new Error("Failed to initialize client-side Firebase app");
}

const clientDb = getClientFirestore(clientApp);
console.log("Client-side Firestore initialized:", clientDb ? "Success" : "Failed");

const auth = getAuth(clientApp);
console.log("Client-side Auth initialized:", auth ? "Success" : "Failed");

// Server-side Firebase Admin
let adminDb: ReturnType<typeof import("firebase-admin/firestore").getFirestore>;

// Function to normalize private key
function normalizePrivateKey(key: string | undefined): string | undefined {
  if (!key) {
    console.error("FIREBASE_PRIVATE_KEY is undefined or empty");
    return undefined;
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
  return normalizedKey;
}

if (typeof window === "undefined") {
  try {
    const requiredEnvVars = {
      FIREBASE_PROJECT_ID: process.env.FIREBASE_PROJECT_ID,
      FIREBASE_CLIENT_EMAIL: process.env.FIREBASE_CLIENT_EMAIL,
      FIREBASE_PRIVATE_KEY: process.env.FIREBASE_PRIVATE_KEY,
    };
    const missingAdminEnvVars = Object.entries(requiredEnvVars).filter(([_key, value]) => !value);
    if (missingAdminEnvVars.length > 0) {
      console.error("Missing server-side Firebase Admin environment variables:", missingAdminEnvVars.map(([key]) => key));
      throw new Error("Missing required server-side environment variables for Firebase Admin");
    }

    const { initializeApp: initializeAdminApp, getApps: getAdminApps } = await import("firebase-admin/app");
    const { getFirestore: getAdminFirestore } = await import("firebase-admin/firestore");
    const { cert } = await import("firebase-admin/app");

    const privateKey = normalizePrivateKey(process.env.FIREBASE_PRIVATE_KEY);
    console.log("FIREBASE_PRIVATE_KEY length:", privateKey?.length || 0);
    console.log("FIREBASE_PRIVATE_KEY starts with:", privateKey?.substring(0, 30) + "..." || "undefined");

    if (!getAdminApps().length) {
      initializeAdminApp({
        credential: cert({
          projectId: process.env.FIREBASE_PROJECT_ID,
          clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
          privateKey,
        }),
      });
      console.log("Firebase Admin initialized successfully");
    } else {
      console.log("Firebase Admin app already initialized");
    }
    adminDb = getAdminFirestore();
    console.log("Admin Firestore initialized:", adminDb ? "Success" : "Failed");
  } catch (error: any) {
    console.error("Firebase Admin initialization error:", {
      message: error.message,
      stack: error.stack,
      code: error.code,
    });
    adminDb = {
      collection: () => ({
        doc: () => ({
          set: async () => {},
          get: async () => ({ exists: false, data: () => undefined }),
        }),
        get: async () => ({ docs: [], forEach: () => {}, size: 0 }),
        add: async () => ({ id: "mock-id" }),
      }),
    } as any;
    console.warn("Using mock adminDb to prevent app crash. Firestore operations will be limited.");
  }
} else {
  adminDb = {} as any;
}

export { clientDb, clientDb as db, auth, adminDb };