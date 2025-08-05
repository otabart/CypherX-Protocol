import admin from "firebase-admin";
import * as fs from "fs";
import * as path from "path";

let adminDb: admin.firestore.Firestore | null = null;
let adminStorage: admin.storage.Storage | null = null;
let isInitialized = false;

const initializeAdmin = () => {
  if (isInitialized) return;
  
  try {
    console.log("Starting Firebase Admin initialization...");

    // Try to load service account from JSON file first
    let serviceAccount;
    try {
      const serviceAccountPath = path.join(process.cwd(), 'firebaseServiceAccount.json');
      if (fs.existsSync(serviceAccountPath)) {
        const serviceAccountFile = fs.readFileSync(serviceAccountPath, 'utf8');
        serviceAccount = JSON.parse(serviceAccountFile);
        console.log("Loaded Firebase service account from JSON file");
      }
    } catch (error) {
      console.log("Could not load service account from JSON file, trying environment variables");
    }

    // Fallback to environment variables if JSON file not available
    if (!serviceAccount) {
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
        ([, value]) => !value
      );
      if (missingAdminEnvVars.length > 0) {
        const errorMessage = `Missing server-side Firebase Admin environment variables: ${missingAdminEnvVars
          .map(([key]) => key)
          .join(", ")}`;
        console.error(errorMessage);
        throw new Error(errorMessage);
      }

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

      serviceAccount = {
        projectId: process.env.FIREBASE_PROJECT_ID,
        clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
        privateKey: normalizePrivateKey(process.env.FIREBASE_PRIVATE_KEY),
      };
    }

    if (!admin.apps.length) {
      const adminApp = admin.initializeApp({
        credential: admin.credential.cert(serviceAccount),
      });
      console.log("Firebase Admin app initialized successfully:", adminApp.name);
    } else {
      console.log("Firebase Admin app already initialized");
    }

    adminDb = admin.firestore();
    adminStorage = admin.storage();
    console.log("Admin Firestore and Storage initialized: Success");
    isInitialized = true;

  } catch (error: unknown) {
    const errorInfo: { message?: string; code?: string; stack?: string } = {};
    if (error instanceof Error) {
      errorInfo.message = error.message;
      errorInfo.stack = error.stack;
    }
    if (error && typeof error === "object" && "code" in error) {
      errorInfo.code = String((error as { code: unknown }).code);
    }
    console.error("Firebase Admin initialization error:", errorInfo);
    adminDb = null;
    adminStorage = null;
    throw new Error("Firebase Admin initialization failed");
  }
};

const getAdminDb = () => {
  if (typeof window !== "undefined") {
    throw new Error("adminDb can only be used on the server-side");
  }
  
  if (!isInitialized) {
    initializeAdmin();
  }
  
  return adminDb;
};

const getAdminStorage = () => {
  if (typeof window !== "undefined") {
    throw new Error("adminStorage can only be used on the server-side");
  }
  
  if (!isInitialized) {
    initializeAdmin();
  }
  
  return adminStorage;
};

export { getAdminDb as adminDb, getAdminStorage as adminStorage };