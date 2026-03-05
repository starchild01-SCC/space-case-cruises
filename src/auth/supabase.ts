import { createClient } from "@supabase/supabase-js";
import { env } from "../config/env.js";

export interface SupabaseIdentity {
  email: string;
  playaName: string;
}

export const isSupabaseConfigured =
  Boolean(env.supabaseUrl) && Boolean(env.supabaseAnonKey) && env.useSupabaseAuth;

export const getAuthMode = (): "supabase" | "header-sim" =>
  isSupabaseConfigured ? "supabase" : "header-sim";

const supabaseClient = isSupabaseConfigured
  ? createClient(env.supabaseUrl!, env.supabaseAnonKey!, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
    })
  : null;

export const resolveSupabaseIdentity = async (
  accessToken: string,
): Promise<SupabaseIdentity | null> => {
  if (!supabaseClient) {
    return null;
  }

  const { data, error } = await supabaseClient.auth.getUser(accessToken);
  if (error || !data.user?.email) {
    return null;
  }

  const metadata = data.user.user_metadata ?? {};
  const fallbackName = data.user.email.split("@")[0] ?? "Cadet";
  const playaName =
    (typeof metadata.playa_name === "string" && metadata.playa_name.trim()) ||
    (typeof metadata.full_name === "string" && metadata.full_name.trim()) ||
    fallbackName;

  return {
    email: data.user.email,
    playaName,
  };
};
