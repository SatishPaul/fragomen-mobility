import { cookies } from "next/headers";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { getAuthenticatedUser } from "@/lib/server/auth";
import { verifyGateToken } from "./gate";

export async function requirePublishingSession() {
  if (isSupabaseConfigured()) {
    const { supabase, user } = await getAuthenticatedUser();
    if (!user) throw new Error("Your session has expired. Sign in again before publishing.");
    const { data: profile } = await supabase.from("profiles").select("is_active").eq("id", user.id).single();
    if (!profile?.is_active) throw new Error("Your account is not active.");
    return { userId: user.id, supabase };
  }

  const password = process.env.APP_PASSWORD;
  if (!password) {
    throw new Error("Social publishing requires APP_PASSWORD to be configured.");
  }

  const cookieStore = await cookies();
  if (!verifyGateToken(cookieStore.get("vm_auth")?.value, password)) {
    throw new Error("Your session has expired. Sign in again before publishing.");
  }
  return undefined;
}

export function requireSameOrigin(request: Request): void {
  const origin = request.headers.get("origin");
  if (origin && origin !== new URL(request.url).origin) {
    throw new Error("Cross-origin publishing requests are not allowed.");
  }
}