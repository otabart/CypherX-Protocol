import admin from "firebase-admin";

let adminDb: admin.firestore.Firestore | null = null;
let adminStorage: admin.storage.Storage | null = null;

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

    if (!admin.apps.length) {
      const adminApp = admin.initializeApp({
        credential: admin.credential.cert({
          projectId: process.env.FIREBASE_PROJECT_ID,
          clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
          privateKey,
        }),
      });
      console.log("Firebase Admin app initialized successfully:", adminApp.name);
    } else {
      console.log("Firebase Admin app already initialized");
    }

    adminDb = admin.firestore();
    adminStorage = admin.storage();
    console.log("Admin Firestore and Storage initialized: Success");

    if (adminDb) {
      await adminDb
        .collection("test")
        .doc("init-check")
        .set({ timestamp: admin.firestore.Timestamp.fromDate(new Date()) });
      console.log("Admin SDK connectivity test: Write successful");
    } else {
      throw new Error("adminDb is null after initialization");
    }
  } catch (error: any) {
    console.error("Firebase Admin initialization error:", {
      message: error.message,
      code: error.code,
      stack: error.stack,
    });
    adminDb = null;
    adminStorage = null;
    throw new Error("Firebase Admin initialization failed");
  }
}

const getAdminDb = () => {
  if (typeof window !== "undefined") {
    throw new Error("adminDb can only be used on the server-side");
  }
  return adminDb;
};

const getAdminStorage = () => {
  if (typeof window !== "undefined") {
    throw new Error("adminStorage can only be used on the server-side");
  }
  return adminStorage;
};

export { getAdminDb as adminDb, getAdminStorage as adminStorage };