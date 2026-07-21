import { redirect } from "next/navigation";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

export type UserProfile = {
  id: string;
  email: string;
  display_name: string | null;
  role: "admin" | "user";
  is_active: boolean;
  monthly_token_quota: number;
};

export async function getAuthenticatedUser() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  return { supabase, user };
}

export async function requireUser() {
  const { supabase, user } = await getAuthenticatedUser();

  if (!user) {
    redirect("/login");
  }

  const { data } = await supabase
    .from("profiles")
    .select("id,email,display_name,role,is_active,monthly_token_quota")
    .eq("id", user.id)
    .single<UserProfile>();
  let profile = data;

  const initialAdminEmail = process.env.INITIAL_ADMIN_EMAIL?.trim().toLowerCase();
  if (profile && initialAdminEmail && user.email?.toLowerCase() === initialAdminEmail && profile.role !== "admin") {
    const admin = createAdminClient();
    const { data: promotedProfile } = await admin
      .from("profiles")
      .update({ role: "admin" })
      .eq("id", user.id)
      .select("id,email,display_name,role,is_active,monthly_token_quota")
      .single<UserProfile>();
    profile = promotedProfile || profile;
  }

  if (!profile?.is_active) {
    await supabase.auth.signOut();
    redirect("/login?error=disabled");
  }

  return { supabase, user, profile };
}

export async function requireAdmin() {
  const context = await requireUser();

  if (context.profile.role !== "admin") {
    redirect("/dashboard");
  }

  return context;
}

export class AuthorizationError extends Error {
  constructor(message: string, public readonly status: number) {
    super(message);
  }
}

export async function requireAdminApi() {
  const { supabase, user } = await getAuthenticatedUser();
  if (!user) throw new AuthorizationError("Authentication required.", 401);

  const { data: profile } = await supabase
    .from("profiles")
    .select("id,role,is_active")
    .eq("id", user.id)
    .single();

  if (!profile?.is_active || profile.role !== "admin") {
    throw new AuthorizationError("Administrator access required.", 403);
  }

  return { supabase, user, profile };
}
