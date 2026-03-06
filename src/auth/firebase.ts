import { initializeApp, cert, type App } from "firebase-admin/app";
import { getAuth, type Auth } from "firebase-admin/auth";
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

// Initialize Firebase Admin from env vars (FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL, FIREBASE_PRIVATE_KEY)
// or from FIREBASE_SERVICE_ACCOUNT JSON string (legacy)
if (isFirebaseConfigured) {
  try {
    let credential: { projectId: string; clientEmail: string; privateKey: string } | undefined;

    if (env.firebaseClientEmail && env.firebasePrivateKey) {
      credential = {
        projectId: env.firebaseProjectId!,
        clientEmail: env.firebaseClientEmail,
        privateKey: env.firebasePrivateKey.replace(/\\n/g, "\n"),
      };
    } else if (env.firebaseServiceAccount) {
      const parsed = JSON.parse(env.firebaseServiceAccount) as {
        project_id?: string;
        client_email?: string;
        private_key?: string;
      };
      if (parsed.project_id && parsed.client_email && parsed.private_key) {
        credential = {
          projectId: parsed.project_id,
          clientEmail: parsed.client_email,
          privateKey: String(parsed.private_key).replace(/\\n/g, "\n"),
        };
      }
    }

    firebaseApp = initializeApp({
      credential: credential ? cert(credential) : undefined,
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
