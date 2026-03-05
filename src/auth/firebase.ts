import { initializeApp, cert, type App } from "firebase-admin/app";
import { getAuth, type Auth } from "firebase-admin/auth";
import { existsSync, readFileSync } from "fs";
import { basename, resolve } from "node:path";
import { env } from "../config/env.js";

export interface FirebaseIdentity {
  email: string;
  playaName: string;
  uid: string;
  chancellor: boolean;
}

let firebaseApp: App | null = null;
let firebaseAuth: Auth | null = null;

export const isFirebaseConfigured = Boolean(env.firebaseProjectId);

export const getAuthMode = (): "firebase" | "supabase" | "header-sim" => {
  if (firebaseAuth) return "firebase";
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
      // Check if it's likely a file path (starts with . or /, or ends with .json)
      const looksLikePath =
        env.firebaseServiceAccount.startsWith(".") ||
        env.firebaseServiceAccount.startsWith("/") ||
        env.firebaseServiceAccount.endsWith(".json");

      if (looksLikePath) {
        const configured = env.firebaseServiceAccount;
        const fileName = basename(configured);
        const candidates = [
          configured,
          resolve(process.cwd(), configured),
          resolve(process.cwd(), fileName),
          resolve(process.cwd(), "dist", fileName),
          "/app/firebase-service-account.json",
          "/app/dist/firebase-service-account.json",
        ];

        const selectedPath = candidates.find((candidate) => existsSync(candidate));
        if (!selectedPath) {
          throw new Error(
            `FIREBASE_SERVICE_ACCOUNT file not found. Tried: ${candidates.join(", ")}`,
          );
        }

        const fileContent = readFileSync(selectedPath, "utf-8");
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

    // Firebase custom claims (set via Admin SDK) are surfaced on the decoded token.
    // We treat `chancellor: true` as the server-side source of truth for elevated access.
    const chancellor =
      (decodedToken as Record<string, unknown>).chancellor === true ||
      (decodedToken as Record<string, unknown>).role === "chancellor";

    // Extract display name from token or use email prefix as fallback
    const fallbackName = decodedToken.email.split("@")[0] ?? "Cadet";
    const playaName = decodedToken.name || decodedToken.displayName || fallbackName;

    return {
      email: decodedToken.email,
      playaName,
      uid: decodedToken.uid,
      chancellor,
    };
  } catch (error) {
    console.error("Firebase token verification failed:", error);
    return null;
  }
};
