import { initializeApp } from "firebase/app";
import {
  getAuth,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
  signInWithPopup,
  signInWithRedirect,
  GoogleAuthProvider,
  type User,
  type Auth,
  type AuthError,
} from "firebase/auth";

// Firebase configuration - these will be public in the frontend
const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
};

const hasFirebaseConfig = Boolean(
  firebaseConfig.apiKey &&
    firebaseConfig.authDomain &&
    firebaseConfig.projectId &&
    firebaseConfig.appId,
);

let auth: Auth | null = null;
let googleProvider: GoogleAuthProvider | null = null;

try {
  if (hasFirebaseConfig) {
    const app = initializeApp(firebaseConfig);
    auth = getAuth(app);
    googleProvider = new GoogleAuthProvider();
  }
} catch (error) {
  console.error("Firebase initialization failed:", error);
  auth = null;
  googleProvider = null;
}

const requireAuth = (): Auth => {
  if (!auth) {
    throw new Error("Firebase authentication is not configured for this build.");
  }
  return auth;
};

const mapFirebaseError = (error: unknown): Error => {
  const authError = error as Partial<AuthError>;
  const code = authError.code || "";

  if (code === "auth/unauthorized-domain") {
    return new Error("Firebase Auth unauthorized domain. Add your NAS host/IP to Firebase Authorized Domains.");
  }

  if (code === "auth/popup-blocked") {
    return new Error("Popup blocked by browser. Google sign-in will continue with redirect.");
  }

  if (code === "auth/operation-not-allowed") {
    return new Error("Google sign-in is not enabled in Firebase Console > Authentication > Sign-in method.");
  }

  if (code === "auth/invalid-credential" || code === "auth/invalid-login-credentials") {
    return new Error("Invalid email or password, or Email/Password sign-in is disabled in Firebase.");
  }

  if (error instanceof Error) {
    return error;
  }

  return new Error("Authentication failed");
};

export const isFirebaseClientConfigured = (): boolean => Boolean(auth);

// Auth methods
export const signInWithEmail = async (email: string, password: string): Promise<User> => {
  try {
    const userCredential = await signInWithEmailAndPassword(requireAuth(), email, password);
    return userCredential.user;
  } catch (error) {
    throw mapFirebaseError(error);
  }
};

export const signUpWithEmail = async (email: string, password: string): Promise<User> => {
  const userCredential = await createUserWithEmailAndPassword(requireAuth(), email, password);
  return userCredential.user;
};

export const signInWithGoogle = async (): Promise<User> => {
  const localAuth = requireAuth();
  if (!googleProvider) {
    throw new Error("Google sign-in is not configured for this build.");
  }

  try {
    const userCredential = await signInWithPopup(localAuth, googleProvider);
    return userCredential.user;
  } catch (error) {
    const authError = error as Partial<AuthError>;
    const popupFallbackCodes = new Set([
      "auth/popup-blocked",
      "auth/popup-closed-by-user",
      "auth/cancelled-popup-request",
      "auth/web-storage-unsupported",
    ]);

    if (authError.code && popupFallbackCodes.has(authError.code)) {
      await signInWithRedirect(localAuth, googleProvider);
      throw new Error("Redirecting to Google sign-in...");
    }

    throw mapFirebaseError(error);
  }
};

export const signOutUser = async (): Promise<void> => {
  await signOut(requireAuth());
};

export const onAuthChange = (callback: (user: User | null) => void): (() => void) => {
  if (!auth) {
    callback(null);
    return () => {
      // noop when auth is not configured
    };
  }

  return onAuthStateChanged(auth, callback);
};

export const getIdToken = async (user: User): Promise<string> => {
  return await user.getIdToken();
};
