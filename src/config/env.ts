import "dotenv/config";

const parseNumber = (value: string | undefined, fallback: number): number => {
  if (!value) {
    return fallback;
  }

  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
};

const parseBoolean = (value: string | undefined, fallback: boolean): boolean => {
  if (value === undefined) {
    return fallback;
  }

  return value.trim().toLowerCase() === "true";
};

export const env = {
  nodeEnv: process.env.NODE_ENV?.trim() || "development",
  port: parseNumber(process.env.PORT, 4000),
  requestTimeoutMs: parseNumber(process.env.REQUEST_TIMEOUT_MS, 10000),
  databaseUrl: process.env.DATABASE_URL?.trim() || null,
  supabaseUrl: process.env.SUPABASE_URL?.trim() || null,
  supabaseAnonKey: process.env.SUPABASE_ANON_KEY?.trim() || null,
  useSupabaseAuth: process.env.USE_SUPABASE_AUTH === "true",
  allowHeaderAuth: parseBoolean(process.env.ALLOW_HEADER_AUTH, process.env.NODE_ENV !== "production"),
  corsAllowedOrigins: process.env.CORS_ALLOWED_ORIGINS?.split(",").map((origin) => origin.trim()).filter(Boolean) ?? [],
  enableRateLimit: parseBoolean(process.env.ENABLE_RATE_LIMIT, process.env.NODE_ENV === "production"),
  rateLimitWindowMs: parseNumber(process.env.RATE_LIMIT_WINDOW_MS, 60_000),
  rateLimitMax: parseNumber(process.env.RATE_LIMIT_MAX, 120),
  rateLimitAuthWindowMs: parseNumber(process.env.RATE_LIMIT_AUTH_WINDOW_MS, 15 * 60 * 1000),
  rateLimitAuthMax: parseNumber(process.env.RATE_LIMIT_AUTH_MAX, 20),
  // Firebase config (env vars for Render etc.; FIREBASE_SERVICE_ACCOUNT JSON string for legacy)
  firebaseProjectId: process.env.FIREBASE_PROJECT_ID?.trim() || null,
  firebaseClientEmail: process.env.FIREBASE_CLIENT_EMAIL?.trim() || null,
  firebasePrivateKey: process.env.FIREBASE_PRIVATE_KEY?.trim() || null,
  firebaseServiceAccount: process.env.FIREBASE_SERVICE_ACCOUNT?.trim() || null,
};
