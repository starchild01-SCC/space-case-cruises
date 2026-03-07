import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { env } from "../config/env.js";

let client: SupabaseClient | null = null;

function getSupabase(): SupabaseClient | null {
  if (!env.supabaseUrl || !env.supabaseServiceRoleKey) {
    return null;
  }
  if (!client) {
    client = createClient(env.supabaseUrl, env.supabaseServiceRoleKey, {
      auth: { persistSession: false },
    });
  }
  return client;
}

export function isSupabaseStorageEnabled(): boolean {
  return Boolean(env.supabaseUrl && env.supabaseServiceRoleKey);
}

export interface UploadResult {
  publicUrl: string;
  path: string;
}

/**
 * Upload a file buffer to Supabase Storage and return the public URL.
 * Bucket must exist and be set to Public in Supabase Dashboard.
 */
export async function uploadToSupabaseStorage(
  path: string,
  buffer: Buffer,
  contentType: string,
): Promise<UploadResult> {
  const supabase = getSupabase();
  if (!supabase) {
    throw new Error("Supabase Storage is not configured (SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY required)");
  }

  const bucket = env.supabaseStorageBucket;
  const { data, error } = await supabase.storage.from(bucket).upload(path, buffer, {
    contentType,
    upsert: true,
  });

  if (error) {
    throw new Error(`Supabase Storage upload failed: ${error.message}`);
  }

  const { data: urlData } = supabase.storage.from(bucket).getPublicUrl(data.path);
  return {
    publicUrl: urlData.publicUrl,
    path: data.path,
  };
}
