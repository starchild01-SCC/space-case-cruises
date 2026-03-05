import "dotenv/config";
import { getAuth } from "firebase-admin/auth";
import { initializeApp, cert } from "firebase-admin/app";
import { readFileSync } from "node:fs";
import { env } from "../config/env.js";

/**
 * One-time helper script to promote a user to Chancellor by setting
 * a Firebase custom claim on their account.
 *
 * Usage (from project root):
 *   npx tsx src/scripts/set-chancellor.ts your_email@example.com
 */
const bootstrapFirebaseAdmin = () => {
  if (!env.firebaseProjectId || !env.firebaseServiceAccount) {
    throw new Error("FIREBASE_PROJECT_ID and FIREBASE_SERVICE_ACCOUNT must be configured");
  }

  let serviceAccount: unknown;
  if (env.firebaseServiceAccount.startsWith(".") || env.firebaseServiceAccount.startsWith("/")) {
    const fileContent = readFileSync(env.firebaseServiceAccount, "utf-8");
    serviceAccount = JSON.parse(fileContent);
  } else {
    serviceAccount = JSON.parse(env.firebaseServiceAccount);
  }

  const app = initializeApp({
    credential: cert(serviceAccount as Record<string, unknown>),
    projectId: env.firebaseProjectId ?? undefined,
  });

  return getAuth(app);
};

const main = async (): Promise<void> => {
  const email = process.argv[2];
  if (!email) {
    process.stderr.write("Usage: tsx src/scripts/set-chancellor.ts your_email@example.com\n");
    process.exit(1);
  }

  const auth = bootstrapFirebaseAdmin();
  const user = await auth.getUserByEmail(email).catch(() => null);

  if (!user) {
    throw new Error(`User with email ${email} not found in Firebase Auth`);
  }

  const existingClaims = user.customClaims ?? {};
  const updatedClaims = {
    ...existingClaims,
    chancellor: true,
  };

  await auth.setCustomUserClaims(user.uid, updatedClaims);

  process.stdout.write(
    `Chancellor claim set for ${email}. Claims are: ${JSON.stringify(updatedClaims, null, 2)}\n`,
  );
};

void main().catch((error) => {
  // eslint-disable-next-line no-console
  console.error(error);
  process.exit(1);
});

