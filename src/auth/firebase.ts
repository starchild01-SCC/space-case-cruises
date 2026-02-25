import { initializeApp, cert, type App } from "firebase-admin/app";
import { getAuth, type Auth } from "firebase-admin/auth";
import { readFileSync } from "fs";
import { env } from "../config/env.js";

export interface FirebaseIdentity {
  email: string;
  playaName: string;
  uid: string;
}

let firebaseApp: App | null = null;
let firebaseAuth: Auth | null = null;

export const isFirebaseConfigured = Boolean(env.firebaseProjectId);

export const getAuthMode = (): "firebase" | "supabase" | "header-sim" => {
  if (isFirebaseConfigured) return "firebase";
  // Keep backward compatibility with Supabase
  if (Boolean(env.supabaseUrl) && Boolean(env.supabaseAnonKey) && env.useSupabaseAuth) {
    return "supabase";
  }
  return "header-sim";
};

// Initialize Firebase Admin
if (isFirebaseConfigured) {
  try {
    // Support both service account file path and inline JSON
    let serviceAccount: unknown;
    
    if (env.firebaseServiceAccount) {
      // Check if it's a file path (starts with . or /)
      if (env.firebaseServiceAccount.startsWith(".") || env.firebaseServiceAccount.startsWith("/")) {
        // Read from file
        const fileContent = readFileSync(env.firebaseServiceAccount, "utf-8");
        serviceAccount = JSON.parse(fileContent);
      } else {
        // Parse as JSON string
        serviceAccount = JSON.parse(env.firebaseServiceAccount);
      }
    }

    firebaseApp = initializeApp({
      credential: serviceAccount ? cert(serviceAccount as Record<string, unknown>) : undefined,
      projectId: env.firebaseProjectId ?? undefined,
    });

    firebaseAuth = getAuth(firebaseApp);
    console.log("✅ Firebase Admin initialized");
  } catch (error) {
    console.error("❌ Failed to initialize Firebase Admin:", error);
  }
}

export const resolveFirebaseIdentity = async (
  idToken: string,
): Promise<FirebaseIdentity | null> => {
  if (!firebaseAuth) {
    return null;
  }

  try {
    const decodedToken = await firebaseAuth.verifyIdToken(idToken);
    
    if (!decodedToken.email) {
      return null;
    }

    // Extract display name from token or use email prefix as fallback
    const fallbackName = decodedToken.email.split("@")[0] ?? "Cadet";
    const playaName = decodedToken.name || decodedToken.displayName || fallbackName;

    return {
      email: decodedToken.email,
      playaName,
      uid: decodedToken.uid,
    };
  } catch (error) {
    console.error("Firebase token verification failed:", error);
    return null;
  }
};
