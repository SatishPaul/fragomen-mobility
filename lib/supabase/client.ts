"use client";

import { createBrowserClient } from "@supabase/ssr";
import type { SupabaseClient } from "@supabase/supabase-js";
import { getSupabasePublicConfig } from "./config";

let browserClient: SupabaseClient | undefined;

export function createClient() {
  if (!browserClient) {
    const { url, anonKey } = getSupabasePublicConfig();
    browserClient = createBrowserClient(url, anonKey);
  }

  return browserClient;
}
