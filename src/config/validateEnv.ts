import { env } from "./env.js";

// When Firebase is used in production, require either env vars or service account JSON
const firebaseCredsOk =
  !env.firebaseProjectId ||
  (env.firebaseClientEmail && env.firebasePrivateKey) ||
  Boolean(env.firebaseServiceAccount?.trim());

const required: { key: string; value: string | null }[] = [
  {
    key: "FIREBASE (FIREBASE_PROJECT_ID + FIREBASE_CLIENT_EMAIL/FIREBASE_PRIVATE_KEY or FIREBASE_SERVICE_ACCOUNT)",
    value: firebaseCredsOk ? "ok" : null,
  },
];
// Note: DATABASE_URL is optional. If not set, the app runs in in-memory mode.

/**
 * Exits the process with code 1 if required env vars are missing (production only).
 * Import at the top of server.ts to fail fast before starting the app.
 */
function validateEnv(): void {
  if (env.nodeEnv !== "production") {
    return;
  }
  const missing = required.filter((r) => r.value === null || r.value === "");
  if (missing.length > 0) {
    const keys = missing.map((r) => r.key).join(", ");
    process.stderr.write(`Missing required environment variables: ${keys}\n`);
    process.exit(1);
  }
}

validateEnv();
