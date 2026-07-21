import { NextResponse, type NextRequest } from "next/server";
import { safeAuthDestination } from "@/lib/auth-callback";
import { createClient } from "@/lib/supabase/server";

export async function GET(request: NextRequest) {
  const code = request.nextUrl.searchParams.get("code");
  const authError = request.nextUrl.searchParams.get("error");
  const next = safeAuthDestination(request.nextUrl.searchParams.get("next"));

  if (authError) {
    return NextResponse.redirect(new URL("/login?error=expired_link", request.url));
  }

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) return NextResponse.redirect(new URL(next, request.url));
  }

  const callbackUrl = new URL("/auth/complete", request.url);
  callbackUrl.searchParams.set("next", next);
  return NextResponse.redirect(callbackUrl);
}
