import { createClient } from "@supabase/supabase-js";
import { getSupabasePublicConfig, getSupabaseServiceRoleKey } from "./config";

export function createAdminClient() {
  const { url } = getSupabasePublicConfig();

  return createClient(url, getSupabaseServiceRoleKey(), {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}
