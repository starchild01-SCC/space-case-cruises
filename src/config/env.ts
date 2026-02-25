import "dotenv/config";

const parseNumber = (value: string | undefined, fallback: number): number => {
  if (!value) {
    return fallback;
  }

  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
};

export const env = {
  port: parseNumber(process.env.PORT, 4000),
  requestTimeoutMs: parseNumber(process.env.REQUEST_TIMEOUT_MS, 10000),
  databaseUrl: process.env.DATABASE_URL?.trim() || null,
  supabaseUrl: process.env.SUPABASE_URL?.trim() || null,
  supabaseAnonKey: process.env.SUPABASE_ANON_KEY?.trim() || null,
  useSupabaseAuth: process.env.USE_SUPABASE_AUTH === "true",
  // Firebase config
  firebaseProjectId: process.env.FIREBASE_PROJECT_ID?.trim() || null,
  firebaseServiceAccount: process.env.FIREBASE_SERVICE_ACCOUNT?.trim() || null,
};
