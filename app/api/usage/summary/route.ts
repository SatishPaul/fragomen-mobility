import { NextResponse } from "next/server";
import { getAuthenticatedUser } from "@/lib/server/auth";

export const runtime = "nodejs";

export async function GET() {
  const { supabase, user } = await getAuthenticatedUser();
  if (!user) {
    return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  }

  const { data, error } = await supabase.rpc("current_quota_summary");
  const summary = data?.[0];

  if (error || !summary) {
    return NextResponse.json(
      { error: "Monthly quota is temporarily unavailable." },
      { status: error?.message.includes("Active user profile required") ? 403 : 503 },
    );
  }

  return NextResponse.json({
    used: Number(summary.used),
    reserved: Number(summary.reserved),
    limit: Number(summary.quota_limit),
    remaining: Number(summary.remaining),
  });
}