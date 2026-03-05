import { env } from "./env.js";

const required: { key: string; value: string | null }[] = [
  { key: "FIREBASE_SERVICE_ACCOUNT", value: env.firebaseServiceAccount },
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
