import "dotenv/config";
import { getAuth } from "firebase-admin/auth";
import { initializeApp, cert } from "firebase-admin/app";
import { env } from "../config/env.js";

/**
 * One-time helper script to promote a user to Chancellor by setting
 * a Firebase custom claim on their account.
 *
 * Usage (from project root):
 *   npx tsx src/scripts/set-chancellor.ts your_email@example.com
 */
const bootstrapFirebaseAdmin = () => {
  if (!env.firebaseProjectId) {
    throw new Error("FIREBASE_PROJECT_ID must be configured");
  }

  let credential: { projectId: string; clientEmail: string; privateKey: string };

  if (env.firebaseClientEmail && env.firebasePrivateKey) {
    credential = {
      projectId: env.firebaseProjectId,
      clientEmail: env.firebaseClientEmail,
      privateKey: env.firebasePrivateKey.replace(/\\n/g, "\n"),
    };
  } else if (env.firebaseServiceAccount) {
    const parsed = JSON.parse(env.firebaseServiceAccount) as {
      project_id?: string;
      client_email?: string;
      private_key?: string;
    };
    if (!parsed.project_id || !parsed.client_email || !parsed.private_key) {
      throw new Error("FIREBASE_SERVICE_ACCOUNT JSON must include project_id, client_email, private_key");
    }
    credential = {
      projectId: parsed.project_id,
      clientEmail: parsed.client_email,
      privateKey: String(parsed.private_key).replace(/\\n/g, "\n"),
    };
  } else {
    throw new Error(
      "Firebase credentials required: set FIREBASE_CLIENT_EMAIL and FIREBASE_PRIVATE_KEY, or FIREBASE_SERVICE_ACCOUNT (JSON string)",
    );
  }

  const app = initializeApp({
    credential: cert(credential),
    projectId: env.firebaseProjectId,
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

